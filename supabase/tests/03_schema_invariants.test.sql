begin;

create extension if not exists pgtap with schema extensions;

select plan(4);

select is(
  (select count(*) from pg_class table_definition join pg_namespace schema_definition on schema_definition.oid = table_definition.relnamespace where schema_definition.nspname = 'public' and table_definition.relkind = 'r'),
  14::bigint,
  'le schéma public contient exactement les quatorze tables V1'
);

select is(
  (select count(*) from pg_class table_definition join pg_namespace schema_definition on schema_definition.oid = table_definition.relnamespace where schema_definition.nspname = 'public' and table_definition.relkind = 'r' and table_definition.relrowsecurity),
  14::bigint,
  'RLS est activée sur chaque table V1'
);

select is(
  (select count(*) from information_schema.role_table_grants where grantee = 'anon' and table_schema = 'public'),
  0::bigint,
  'le rôle anonyme ne possède aucun privilège sur les tables V1'
);

select is(
  (
    select count(*)
    from pg_proc function_definition
    join pg_namespace schema_definition on schema_definition.oid = function_definition.pronamespace
    where schema_definition.nspname = 'private'
      and function_definition.proname in ('is_tenant_member', 'has_tenant_role', 'has_dimension_permission')
      and function_definition.prosecdef
  ),
  3::bigint,
  'les trois prédicats RLS sont privés et exécutés avec des droits contrôlés'
);

select * from finish();
rollback;
