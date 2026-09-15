-- Retour arrière de 20260915090000_compare_two_versions.sql.
--
-- À appliquer, comme la migration elle-même, en une seule transaction :
--   psql -1 -v ON_ERROR_STOP=1 -f <ce fichier>
--
-- CE QU'IL DÉTRUIT : les trois fonctions seulement. Les décisions prises par
-- `approve_identical_hypotheses` sont des lignes ordinaires de
-- `hypothesis_decisions`, écrites par `decide_hypothesis` : elles restent —
-- une décision ne s'efface pas.
--
-- CE QU'IL CASSE : l'écran de consolidation appelle ces fonctions ; sans elles,
-- la section « Écart » échoue. Ce retour arrière n'a donc de sens qu'accompagné
-- du retour au commit applicatif antérieur. Le contrôle `12_compare_two_versions`
-- échouera — c'est voulu.

drop function if exists public.approve_identical_hypotheses(uuid, uuid, text);
drop function if exists public.compare_version_values(uuid, uuid);
drop function if exists public.compare_version_hypotheses(uuid, uuid);

delete from supabase_migrations.schema_migrations where version = '20260915090000';
