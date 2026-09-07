"""Vérifie qu'une version publiée rend toujours l'empreinte sous laquelle elle
a été publiée.

C'est la promesse d'auditabilité du produit, et elle était FAUSSE : le snapshot
d'entrée n'était pas conservé, on le reconstruisait depuis un référentiel qui a
continué de vivre, et une version pouvait cesser d'être reproductible sans qu'un
seul de ses chiffres n'ait bougé. Depuis la migration `20260907120000`, la
matière est conservée ; ce script est ce qui le VÉRIFIE, plutôt que de le
supposer.

    ssh … 'docker exec -i <db> psql -U postgres -d postgres -t -A -f -' \
      < scripts/extraire-matieres-conservees.sql \
      | python scripts/verifier-reproductibilite.py

Le code de sortie vaut 1 dès qu'une version ne se reproduit pas : c'est un
contrôle, il doit pouvoir échouer dans une chaîne automatisée. Une extraction
vide sort aussi en 1 — « rien à vérifier » n'est pas « tout va bien », et c'est
exactement ce qu'on lirait si la matière avait cessé d'être conservée.

Toute la logique de rejeu vit dans `tarjih_calculation.replay`, sous tests. Ce
fichier ne fait que lire, appeler et rendre compte.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "services" / "calculation" / "src"))

from tarjih_calculation.replay import replay_published  # noqa: E402


def main() -> int:
    extraits = json.loads(sys.stdin.read())
    if not extraits:
        print("Aucune version publiée ne porte de matière conservée.", file=sys.stderr)
        return 1

    _, rapport = replay_published(extraits)

    # `replay_published` sert d'abord à reconstruire des parts : son verdict de
    # succès en porte le nom. Ici on ne reconstruit rien, on vérifie — le rejeu
    # est le même, la question posée ne l'est pas.
    reproduites = [ligne for ligne in rapport if ligne["verdict"] == "reconstruite"]
    for ligne in rapport:
        reussi = ligne["verdict"] == "reconstruite"
        verdict = "empreinte retrouvée" if reussi else ligne["verdict"]
        print(
            f"{'OK   ' if reussi else 'ÉCHEC'} {ligne['version_id']} — {verdict}"
            f"{' : ' + ligne['detail'] if ligne['detail'] else ''}",
            file=sys.stderr,
        )

    print(
        f"\n{len(reproduites)}/{len(rapport)} version(s) publiée(s) rendent leur empreinte.",
        file=sys.stderr,
    )
    return 0 if len(reproduites) == len(rapport) else 1


if __name__ == "__main__":
    sys.exit(main())
