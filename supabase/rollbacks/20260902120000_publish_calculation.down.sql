-- Retour arrière de 20260902120000_publish_calculation.sql.
--
-- À appliquer, comme la migration elle-même, en une seule transaction :
--   psql -1 -v ON_ERROR_STOP=1 -f <ce fichier>
--
-- Restaure l'état de 20260809090100 : plus aucune publication arbitrée côté
-- base, plus de vue d'état, et les versions ne portent plus leur modèle de
-- calcul.
--
-- Ce retour arrière ne détruit aucun chiffre : les `calculation_runs` et les
-- `budget_values` déjà publiés restent en place. Il retire le chemin de
-- publication, pas ce qui a été publié.
--
-- Il fait en revanche perdre une information : le modèle avec lequel chaque
-- version publiée a été calculée. Rien ne le reconstitue ensuite — les valeurs
-- ne portent pas la trace du résolveur qui les a produites. À relever avant
-- d'appliquer ce fichier sur une base qui porte des versions publiées avec un
-- modèle autre que `direct`.

drop function public.publish_calculation(uuid, text, text, text, jsonb);

drop view public.budget_version_states;

alter table public.budget_versions drop column calculation_model;

-- Le registre cesse d'affirmer que cette migration est posée : un retour arrière
-- qui laisserait la ligne en place ferait mentir la seule source qui dise ce qui
-- est appliqué.
delete from supabase_migrations.schema_migrations where version = '20260902120000';
