-- Retour arrière de 20260906140000_close_anon_on_version_states.sql.
--
-- ATTENTION : ce retour arrière REND au rôle anonyme les privilèges qu'on vient
-- de lui retirer, et rouvre les privilèges par défaut qui les recréeraient sur
-- chaque nouvelle table. Il rétablit une violation connue de l'invariant du
-- projet (« anon n'a aucun privilège »). Il n'existe que pour la symétrie du
-- registre ; il n'y a aucune raison légitime de l'appliquer.

alter default privileges in schema public grant all on tables to anon;

grant all on public.budget_version_states to anon;

delete from supabase_migrations.schema_migrations where version = '20260906140000';
