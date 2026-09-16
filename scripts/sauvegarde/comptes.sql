-- Les comptes qui prouvent une restauration de Tarjih : données (chaque table publique),
-- l'invariant financier (somme EXACTE des montants publiés, numeric sans arrondi), les
-- utilisateurs, le registre des migrations, et la structure qu'un dump SQL perd sans le
-- dire (fonctions publiques, déclencheurs, policies RLS).
-- Lu tel quel par sauvegarde-tarjih.sh (avant le dump) ET par sauvegarde-tarjih-verif.sh
-- (sur le témoin restauré) : un seul texte, sinon les deux divergeraient.
select
  (select count(*) from tenants) || '|' ||
  (select count(*) from tenant_memberships) || '|' ||
  (select count(*) from dimensions) || '|' ||
  (select count(*) from dimension_grants) || '|' ||
  (select count(*) from financial_accounts) || '|' ||
  (select count(*) from periods) || '|' ||
  (select count(*) from budget_cycles) || '|' ||
  (select count(*) from budget_versions) || '|' ||
  (select count(*) from budget_versions where status = 'published') || '|' ||
  (select count(*) from hypotheses) || '|' ||
  (select count(*) from hypothesis_decisions) || '|' ||
  (select count(*) from budget_values) || '|' ||
  (select coalesce(sum(amount), 0) from budget_values) || '|' ||
  (select count(*) from budget_value_sources) || '|' ||
  (select count(*) from calculation_runs) || '|' ||
  (select count(*) from exports) || '|' ||
  (select count(*) from audit_events) || '|' ||
  (select count(*) from auth.users) || '|' ||
  (select count(*) from supabase_migrations.schema_migrations) || '|' ||
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public') || '|' ||
  (select count(*) from pg_trigger where not tgisinternal) || '|' ||
  (select count(*) from pg_policies);
