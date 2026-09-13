-- Retour arrière de 20260913150000_open_a_version_from_the_previous_one.sql.
--
-- À appliquer, comme la migration elle-même, en une seule transaction :
--   psql -1 -v ON_ERROR_STOP=1 -f <ce fichier>
--
-- CE QU'IL DÉTRUIT : la fonction seulement. Les versions ouvertes par elle et
-- leurs hypothèses reprises sont des lignes ordinaires — elles restent, avec
-- leur `parent_version_id` : le retirer réécrirait la filiation d'une version
-- éventuellement publiée, ce que le projet s'interdit.
--
-- CE QU'IL CASSE : l'action serveur `createBudgetVersion` appelle cette
-- fonction ; sans elle, plus aucune version ne s'ouvre depuis l'écran. Ce
-- retour arrière n'a donc de sens qu'accompagné du retour au commit applicatif
-- antérieur. Le contrôle `11_open_version_from_previous` échouera — c'est voulu.

drop function if exists public.open_budget_version(uuid, text, uuid);

delete from supabase_migrations.schema_migrations where version = '20260913150000';
