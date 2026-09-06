begin;

create extension if not exists pgtap with schema extensions;

select plan(5);

-- ---------------------------------------------------------------------------
-- Jeu d'essai : deux dimensions dans le même tenant, pour que le périmètre de
-- lecture soit vérifiable — un contributeur qui ne lit qu'une dimension ne doit
-- pas apprendre qui écrit dans l'autre.
-- ---------------------------------------------------------------------------
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin
) values
  ('80000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'daf-auteurs@tarjih.test', '', now(), now(), now(), '{}', '{}', false),
  ('80000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'auteur-rd@tarjih.test', '', now(), now(), now(), '{}', '{}', false),
  ('80000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'auteur-ventes@tarjih.test', '', now(), now(), now(), '{}', '{}', false),
  ('80000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'daf-ailleurs@tarjih.test', '', now(), now(), now(), '{}', '{}', false);

insert into public.tenants (id, name, base_currency) values
  ('a8aaaaaa-0000-0000-0000-000000000001', 'Tenant G', 'MAD'),
  ('b8bbbbbb-0000-0000-0000-000000000001', 'Tenant H', 'MAD');

insert into public.tenant_memberships (tenant_id, user_id, role, is_tenant_admin) values
  ('a8aaaaaa-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', 'daf', false),
  ('a8aaaaaa-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000002', 'contributor', false),
  ('a8aaaaaa-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000003', 'contributor', false),
  ('b8bbbbbb-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000004', 'daf', false);

insert into public.dimensions (id, tenant_id, kind, code, name) values
  ('a8aaaaaa-1000-0000-0000-000000000001', 'a8aaaaaa-0000-0000-0000-000000000001', 'department', 'RD', 'Recherche'),
  ('a8aaaaaa-1000-0000-0000-000000000002', 'a8aaaaaa-0000-0000-0000-000000000001', 'department', 'VT', 'Ventes');

-- Le contributeur « RD » ne lit que sa dimension.
insert into public.dimension_grants (tenant_id, dimension_id, user_id, can_read, can_contribute) values
  ('a8aaaaaa-0000-0000-0000-000000000001', 'a8aaaaaa-1000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000002', true, true);

insert into public.budget_cycles (id, tenant_id, name) values
  ('a8aaaaaa-2000-0000-0000-000000000001', 'a8aaaaaa-0000-0000-0000-000000000001', 'Budget 2029');

insert into public.budget_versions (id, tenant_id, cycle_id, version_no) values
  ('a8aaaaaa-3000-0000-0000-000000000001', 'a8aaaaaa-0000-0000-0000-000000000001', 'a8aaaaaa-2000-0000-0000-000000000001', 1);

insert into public.hypotheses (id, tenant_id, version_id, dimension_id, parameter_key, value, unit, status, proposed_by) values
  ('a8aaaaaa-4000-0000-0000-000000000001', 'a8aaaaaa-0000-0000-0000-000000000001', 'a8aaaaaa-3000-0000-0000-000000000001', 'a8aaaaaa-1000-0000-0000-000000000001', 'charges.rd', '{}'::jsonb, 'MAD', 'proposed', '80000000-0000-0000-0000-000000000002'),
  ('a8aaaaaa-4000-0000-0000-000000000002', 'a8aaaaaa-0000-0000-0000-000000000001', 'a8aaaaaa-3000-0000-0000-000000000001', 'a8aaaaaa-1000-0000-0000-000000000002', 'produits.vt', '{}'::jsonb, 'MAD', 'proposed', '80000000-0000-0000-0000-000000000003');

select has_function(
  'public', 'list_hypothesis_authors', array['uuid'],
  'l’auteur d’une hypothèse peut être nommé'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);

-- ---------------------------------------------------------------------------
-- Le DAF approuve : il voit de qui vient ce qu'il approuve.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', '80000000-0000-0000-0000-000000000001', true);

select is(
  (select string_agg(email, ', ' order by email)
     from public.list_hypothesis_authors('a8aaaaaa-0000-0000-0000-000000000001')),
  'auteur-rd@tarjih.test, auteur-ventes@tarjih.test',
  'le DAF, qui lit toutes les dimensions, voit les auteurs de toutes les hypothèses'
);

-- ---------------------------------------------------------------------------
-- Le périmètre de lecture s'applique : ce n'est pas un annuaire.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', '80000000-0000-0000-0000-000000000002', true);

select is(
  (select string_agg(email, ', ' order by email)
     from public.list_hypothesis_authors('a8aaaaaa-0000-0000-0000-000000000001')),
  'auteur-rd@tarjih.test',
  'un contributeur ne découvre pas qui écrit dans une dimension qu’il ne lit pas'
);

-- ---------------------------------------------------------------------------
-- Isolation inter-tenant.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', '80000000-0000-0000-0000-000000000004', true);

select is(
  (select count(*)::integer
     from public.list_hypothesis_authors('a8aaaaaa-0000-0000-0000-000000000001')),
  0,
  'le DAF d’un autre tenant n’apprend le nom de personne'
);

select set_config('request.jwt.claim.sub', null, true);

select is(
  (select count(*)::integer
     from public.list_hypothesis_authors('a8aaaaaa-0000-0000-0000-000000000001')),
  0,
  'sans identité, la fonction ne rend rien — `security definer` ne vaut pas passe-droit'
);

select * from finish();
rollback;
