-- Retour arrière de 20260809090100_govern_hypotheses.sql.
--
-- À appliquer, comme la migration elle-même, en une seule transaction :
--   psql -1 -v ON_ERROR_STOP=1 -f <ce fichier>
--
-- Restaure l'état de 20260809090000 : les hypothèses redeviennent modifiables
-- sans contrôle optimiste, une version publiée redevient mutable, et plus aucune
-- décision ne peut être prise par une fonction arbitrée côté base.
--
-- Ce retour arrière ne détruit aucune donnée : les décisions déjà inscrites dans
-- `hypothesis_decisions` restent en place, la table étant append-only. Il enlève
-- les gardes, pas la trace de ce qu'ils ont laissé passer.

-- Les déclencheurs partent avant les fonctions qu'ils appellent.
drop trigger hypotheses_enforce_write on public.hypotheses;
drop trigger budget_versions_protect_published on public.budget_versions;

drop function public.decide_hypothesis(uuid, integer, text, text, jsonb, text);
drop function private.enforce_hypothesis_write();
drop function private.protect_published_version();

-- Le registre cesse d'affirmer que cette migration est posée : un retour arrière
-- qui laisserait la ligne en place ferait mentir la seule source qui dise ce qui
-- est appliqué.
delete from supabase_migrations.schema_migrations where version = '20260809090100';
