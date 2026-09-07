-- Extrait la matière d'entrée CONSERVÉE de chaque version publiée, pour la
-- rejouer et vérifier qu'elle rend bien l'empreinte sous laquelle elle a été
-- publiée.
--
-- Ce fichier remplace, pour tout run postérieur au 2026-09-07, le détour de
-- `scripts/extraire-snapshots-publies.sql` : celui-ci RECONSTRUISAIT la matière
-- depuis un référentiel qui a continué de vivre, ce qui a déjà rendu une version
-- publiée irrejouable (`c6033eb3`, mesuré le 2026-09-06). Ici il n'y a rien à
-- reconstruire : la matière est celle qui a été soumise au moteur.
--
-- Les runs antérieurs à la migration `20260907120000` n'ont pas de matière et
-- sont donc absents. Ce n'est pas un oubli : elle n'a jamais existé, et la
-- fabriquer après coup reviendrait à écrire soi-même la preuve qu'on prétend
-- vérifier.
--
-- Lecture seule. Rien n'est écrit ici.
--
--   ssh … 'docker exec -i <db> psql -U postgres -d postgres -t -A -f -' \
--     < scripts/extraire-matieres-conservees.sql \
--     | python scripts/verifier-reproductibilite.py

select coalesce(jsonb_agg(extrait order by extrait ->> 'version_id'), '[]'::jsonb)
from (
  select jsonb_build_object(
    'version_id', run.version_id,
    'input_hash', run.input_hash,
    'payload', run.input_snapshot
  ) as extrait
  from public.calculation_runs run
  join public.budget_versions version
    on version.id = run.version_id
   and version.tenant_id = run.tenant_id
  where run.status = 'succeeded'
    and run.input_snapshot is not null
    and version.status = 'published'
) as extraits;
