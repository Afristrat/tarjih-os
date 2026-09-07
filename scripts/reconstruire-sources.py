"""PÉRIMÉ depuis le 2026-09-07 — conservé comme trace, plus comme outil.

La matière d'entrée est désormais CONSERVÉE (`calculation_runs.input_snapshot`) :
il n'y a plus rien à reconstruire, et `scripts/verifier-reproductibilite.py` la
rejoue telle quelle. Ce script ne peut d'ailleurs plus servir — les runs qu'il
vise portent `engine_version` 1.0.0, que le moteur 1.1.0 refuse
(`engine_version_mismatch`). Le rejeu rend donc un REFUS motivé, jamais une
origine plausible : vérifié, pas supposé.

Ce qu'il faisait, et qui a bien eu lieu le 2026-09-06 :

Reconstruit l'origine des montants publiés AVANT la traçabilité.

Lit sur l'entrée standard le JSON produit par
`scripts/extraire-snapshots-publies.sql`, rejoue chaque version publiée avec le
moteur, et n'écrit du SQL que pour celles dont l'empreinte recalculée retrouve
`calculation_runs.input_hash`.

    ssh … 'docker exec -i <db> psql -U postgres -d postgres -t -A \
        -f -' < scripts/extraire-snapshots-publies.sql \
      | python scripts/reconstruire-sources.py > /tmp/reconstruction.sql

Le rapport part sur la sortie d'erreur : il dit ce qu'il advient de CHAQUE
version, y compris celles qu'on renonce à reconstruire. Une version absente du
SQL produit n'est pas un oubli, c'est un refus motivé — et c'est la partie du
rapport qu'il faut lire.

Toute la logique vit dans `tarjih_calculation.replay`, sous tests. Ce fichier ne
fait que lire, appeler et écrire.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "services" / "calculation" / "src"))

from tarjih_calculation.replay import replay_published  # noqa: E402

# Le JSON est inséré tel quel dans le SQL produit : `json.dumps` échappe déjà
# tout, et le doublement des apostrophes ferme le seul chemin restant. Les
# valeurs elles-mêmes sortent du moteur, qui n'accepte que des uuid et des
# décimales — rien de ce qui suit ne provient d'une saisie libre.
GABARIT = """-- Reconstruction de l'origine des montants publiés avant la traçabilité.
--
-- Généré par `scripts/reconstruire-sources.py`. Chaque version présente ici a vu
-- son empreinte recalculée retrouver celle de son run : sa reconstruction est
-- PROUVÉE, pas supposée. Les versions absentes sont refusées, motif dans le
-- rapport de génération.
--
-- À appliquer en une seule transaction :
--   psql -1 -v ON_ERROR_STOP=1 -f <ce fichier>

begin;

insert into public.budget_value_sources (tenant_id, budget_value_id, hypothesis_id, amount)
select value.tenant_id, value.id, source.hypothesis_id, source.amount
from jsonb_to_recordset('{json}'::jsonb) as source(
  version_id uuid,
  dimension_id uuid,
  account_id uuid,
  period_id uuid,
  hypothesis_id uuid,
  amount numeric
)
join public.budget_values value
  on value.version_id = source.version_id
 and value.dimension_id = source.dimension_id
 and value.account_id = source.account_id
 and value.period_id = source.period_id;

-- Contrôle : aucune part ne doit être restée sans montant à expliquer. Si le
-- compte ne tombe pas juste, rien n'est écrit.
do $$
declare
  attendu integer := {attendu};
  ecrit integer;
begin
  select count(*) into ecrit
  from public.budget_value_sources
  where budget_value_id in (
    select value.id
    from public.budget_values value
    where value.version_id in ({versions})
  );

  if ecrit <> attendu then
    raise exception 'Reconstruit % parts pour % attendues', ecrit, attendu
      using errcode = '55000';
  end if;
end;
$$;

commit;
"""


def main() -> int:
    extraits = json.loads(sys.stdin.read() or "[]")
    if not isinstance(extraits, list):
        print("entrée inattendue : une liste JSON était attendue", file=sys.stderr)
        return 2

    sources, rapport = replay_published(extraits)

    print(f"{len(extraits)} version(s) publiée(s) sans origine :", file=sys.stderr)
    for ligne in rapport:
        print(
            f"  - {ligne['version_id']} : {ligne['verdict']}"
            f"{' — ' + ligne['detail'] if ligne['detail'] else ''}",
            file=sys.stderr,
        )

    if not sources:
        print("aucune version reconstructible : rien à écrire.", file=sys.stderr)
        return 1

    versions = sorted({source["version_id"] for source in sources})
    print(
        GABARIT.format(
            json=json.dumps(sources, ensure_ascii=False).replace("'", "''"),
            attendu=len(sources),
            versions=", ".join(f"'{version}'" for version in versions),
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
