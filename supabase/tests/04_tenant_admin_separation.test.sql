begin;

create extension if not exists pgtap with schema extensions;

select plan(14);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin
) values
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin-technique-a@tarjih.test', '', now(), now(), now(), '{}', '{}', false),
  ('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'contributeur-a@tarjih.test', '', now(), now(), now(), '{}', '{}', false),
  ('30000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'daf-a@tarjih.test', '', now(), now(), now(), '{}', '{}', false),
  ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin-technique-b@tarjih.test', '', now(), now(), now(), '{}', '{}', false);

insert into public.tenants (id, name, base_currency) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Tenant A', 'MAD'),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'Tenant B', 'EUR');

-- L’administrateur technique de A est un simple contributeur au sens financier :
-- son pouvoir d’administration ne vient que du booléen.
insert into public.tenant_memberships (tenant_id, user_id, role, is_tenant_admin) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'contributor', true),
  ('aaaaaaaa-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', 'contributor', false),
  ('aaaaaaaa-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', 'daf', false),
  ('bbbbbbbb-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'contributor', true);

insert into public.dimensions (id, tenant_id, kind, code, name) values
  ('aaaaaaaa-1000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'department', 'MKT', 'Marketing'),
  ('aaaaaaaa-1000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'department', 'OPS', 'Opérations'),
  ('bbbbbbbb-1000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'department', 'FIN', 'Finance');

insert into public.dimension_grants (tenant_id, user_id, dimension_id, can_read, can_contribute) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', 'aaaaaaaa-1000-0000-0000-000000000001', true, true);

insert into public.budget_cycles (id, tenant_id, name) values
  ('aaaaaaaa-2000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Budget 2027');

insert into public.budget_versions (id, tenant_id, cycle_id, version_no) values
  ('aaaaaaaa-3000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-2000-0000-0000-000000000001', 1);

insert into public.hypotheses (id, tenant_id, version_id, dimension_id, parameter_key, value, unit, proposed_by) values
  ('aaaaaaaa-4000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-3000-0000-0000-000000000001', 'aaaaaaaa-1000-0000-0000-000000000001', 'marketing_growth', '0.08', 'ratio', '30000000-0000-0000-0000-000000000002');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);

-- ---------------------------------------------------------------------------
-- L’administrateur technique : il structure, il n’encaisse aucun chiffre.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000001', true);

select is(
  (select count(*) from public.dimensions),
  2::bigint,
  'l’administrateur technique voit les dimensions qu’il administre'
);

select is(
  (select count(*) from public.hypotheses),
  0::bigint,
  'l’administrateur technique ne voit aucun chiffre sans grant financier'
);

select lives_ok(
  $$insert into public.dimensions (id, tenant_id, kind, code, name) values ('aaaaaaaa-1000-0000-0000-000000000009', 'aaaaaaaa-0000-0000-0000-000000000001', 'project', 'NEW', 'Nouveau projet')$$,
  'l’administrateur technique crée une dimension'
);

select is(
  (select count(*) from public.audit_events
    where object_type = 'dimensions'
      and action = 'insert'
      and object_id = 'aaaaaaaa-1000-0000-0000-000000000009'
      and actor_id = '30000000-0000-0000-0000-000000000001'),
  1::bigint,
  'la création de dimension est auditée au nom de son auteur'
);

select lives_ok(
  $$insert into public.dimension_grants (tenant_id, user_id, dimension_id, can_read) values ('aaaaaaaa-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', 'aaaaaaaa-1000-0000-0000-000000000009', true)$$,
  'l’administrateur technique attribue un droit fin'
);

select is(
  (select count(*) from public.list_tenant_members('aaaaaaaa-0000-0000-0000-000000000001')),
  3::bigint,
  'l’administrateur technique liste les membres de son tenant'
);

select is(
  (select count(*) from public.list_tenant_members('bbbbbbbb-0000-0000-0000-000000000001')),
  0::bigint,
  'l’administrateur d’un tenant ne liste aucun membre d’un autre tenant'
);

select ok(
  not (select private.is_tenant_admin('bbbbbbbb-0000-0000-0000-000000000001')),
  'l’administration ne franchit pas la frontière de tenant'
);

select is(
  (select count(*) from public.dimensions where tenant_id = 'bbbbbbbb-0000-0000-0000-000000000001'),
  0::bigint,
  'aucune dimension d’un autre tenant n’est visible'
);

-- ---------------------------------------------------------------------------
-- Le DAF : il voit les chiffres, il n’administre pas la structure.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000003', true);

select throws_ok(
  $$insert into public.dimensions (tenant_id, kind, code, name) values ('aaaaaaaa-0000-0000-0000-000000000001', 'department', 'DAF', 'Tentative DAF')$$,
  '42501',
  'new row violates row-level security policy for table "dimensions"',
  'le pouvoir financier n’emporte pas le pouvoir d’administration'
);

select is(
  (select count(*) from public.hypotheses),
  1::bigint,
  'le DAF voit les chiffres de son tenant'
);

-- ---------------------------------------------------------------------------
-- Le contributeur : audit fermé, et révocation effective à la requête suivante.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000002', true);

select is(
  (select count(*) from public.audit_events),
  0::bigint,
  'un contributeur sans gouvernance ne lit aucun événement d’audit'
);

select is(
  (select count(*) from public.hypotheses),
  1::bigint,
  'le contributeur voit l’hypothèse de sa dimension autorisée'
);

select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000001', true);
delete from public.dimension_grants
where tenant_id = 'aaaaaaaa-0000-0000-0000-000000000001'
  and user_id = '30000000-0000-0000-0000-000000000002'
  and dimension_id = 'aaaaaaaa-1000-0000-0000-000000000001';

select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000002', true);

select is(
  (select count(*) from public.hypotheses),
  0::bigint,
  'la révocation prend effet dès la requête suivante'
);

select * from finish();
rollback;
