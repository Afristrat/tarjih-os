begin;

create extension if not exists pgtap with schema extensions;

select plan(13);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin
) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'contributor-a@tarjih.test', '', now(), now(), now(), '{}', '{}', false),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin-a@tarjih.test', '', now(), now(), now(), '{}', '{}', false),
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dg-b@tarjih.test', '', now(), now(), now(), '{}', '{}', false);

insert into public.tenants (id, name, base_currency) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Tenant A', 'MAD'),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'Tenant B', 'EUR');

insert into public.tenant_memberships (tenant_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'contributor'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'tenant_admin'),
  ('bbbbbbbb-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'dg');

insert into public.dimensions (id, tenant_id, kind, code, name) values
  ('aaaaaaaa-1000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'department', 'MKT', 'Marketing'),
  ('aaaaaaaa-1000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'department', 'OPS', 'Opérations'),
  ('bbbbbbbb-1000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'department', 'FIN', 'Finance');

insert into public.dimension_grants (tenant_id, user_id, dimension_id, can_read, can_contribute, can_export) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'aaaaaaaa-1000-0000-0000-000000000001', true, true, true);

insert into public.budget_cycles (id, tenant_id, name) values
  ('aaaaaaaa-2000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Budget 2027'),
  ('bbbbbbbb-2000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Budget 2027');

insert into public.budget_versions (id, tenant_id, cycle_id, version_no) values
  ('aaaaaaaa-3000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-2000-0000-0000-000000000001', 1),
  ('bbbbbbbb-3000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'bbbbbbbb-2000-0000-0000-000000000001', 1);

insert into public.hypotheses (id, tenant_id, version_id, dimension_id, parameter_key, value, unit, proposed_by) values
  ('aaaaaaaa-4000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-3000-0000-0000-000000000001', 'aaaaaaaa-1000-0000-0000-000000000001', 'marketing_growth', '0.08', 'ratio', '10000000-0000-0000-0000-000000000001'),
  ('aaaaaaaa-4000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-3000-0000-0000-000000000001', 'aaaaaaaa-1000-0000-0000-000000000002', 'ops_growth', '0.03', 'ratio', '10000000-0000-0000-0000-000000000002'),
  ('bbbbbbbb-4000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'bbbbbbbb-3000-0000-0000-000000000001', 'bbbbbbbb-1000-0000-0000-000000000001', 'finance_growth', '0.04', 'ratio', '20000000-0000-0000-0000-000000000001');

insert into public.hypothesis_decisions (id, tenant_id, hypothesis_id, decision, decided_by, reason) values
  ('aaaaaaaa-5000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-4000-0000-0000-000000000001', 'approved', '10000000-0000-0000-0000-000000000002', 'Test append-only');

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is((select count(*) from public.tenants), 1::bigint, 'un membre ne voit que son tenant');
select is((select count(*) from public.dimensions), 1::bigint, 'le contributeur ne voit que sa dimension autorisée');
select is((select count(*) from public.hypotheses), 1::bigint, 'les hypothèses sont filtrées par dimension');
select ok((select private.is_tenant_member('aaaaaaaa-0000-0000-0000-000000000001')), 'l’appartenance au tenant A est reconnue');
select ok(not (select private.is_tenant_member('bbbbbbbb-0000-0000-0000-000000000001')), 'l’appartenance au tenant B est refusée');
select ok((select private.has_dimension_permission('aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-1000-0000-0000-000000000001', 'export')), 'l’export autorisé sur Marketing est reconnu');
select ok(not (select private.has_dimension_permission('aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-1000-0000-0000-000000000002', 'read')), 'la dimension Opérations est refusée');
select throws_ok(
  $$insert into public.hypotheses (tenant_id, version_id, dimension_id, parameter_key, value, unit, proposed_by) values ('bbbbbbbb-0000-0000-0000-000000000001', 'bbbbbbbb-3000-0000-0000-000000000001', 'bbbbbbbb-1000-0000-0000-000000000001', 'intrusion', '1', 'ratio', '10000000-0000-0000-0000-000000000001')$$,
  '42501',
  'new row violates row-level security policy for table "hypotheses"',
  'une insertion inter-tenant est bloquée'
);
select ok(not has_table_privilege('authenticated', 'public.hypothesis_decisions', 'UPDATE'), 'une décision ne peut pas être modifiée par le rôle applicatif');
select ok(not has_table_privilege('authenticated', 'public.hypothesis_decisions', 'DELETE'), 'une décision ne peut pas être supprimée par le rôle applicatif');
select ok(not has_table_privilege('authenticated', 'public.audit_events', 'UPDATE'), 'un événement d’audit ne peut pas être modifié par le rôle applicatif');
select ok(not has_table_privilege('authenticated', 'public.audit_events', 'DELETE'), 'un événement d’audit ne peut pas être supprimé par le rôle applicatif');

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
select is((select count(*) from public.hypotheses), 0::bigint, 'l’administrateur technique n’a aucun accès financier implicite');

select * from finish();
rollback;
