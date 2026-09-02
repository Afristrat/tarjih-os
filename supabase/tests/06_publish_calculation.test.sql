begin;

create extension if not exists pgtap with schema extensions;

select plan(15);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin
) values
  ('60000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'contributeur-calc@tarjih.test', '', now(), now(), now(), '{}', '{}', false),
  ('60000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'daf-calc@tarjih.test', '', now(), now(), now(), '{}', '{}', false),
  ('60000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'daf-calc-b@tarjih.test', '', now(), now(), now(), '{}', '{}', false);

insert into public.tenants (id, name, base_currency) values
  ('c6cccccc-0000-0000-0000-000000000001', 'Tenant C', 'MAD'),
  ('d6dddddd-0000-0000-0000-000000000001', 'Tenant D', 'EUR');

insert into public.tenant_memberships (tenant_id, user_id, role, is_tenant_admin) values
  ('c6cccccc-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 'contributor', false),
  ('c6cccccc-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000002', 'daf', false),
  ('d6dddddd-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000003', 'daf', false);

insert into public.dimensions (id, tenant_id, kind, code, name) values
  ('c6cccccc-1000-0000-0000-000000000001', 'c6cccccc-0000-0000-0000-000000000001', 'department', 'RD', 'Recherche');

insert into public.financial_accounts (id, tenant_id, code, name, statement, normal_balance) values
  ('c6cccccc-5000-0000-0000-000000000001', 'c6cccccc-0000-0000-0000-000000000001', '61', 'Charges externes', 'income_statement', 'debit');

insert into public.periods (id, tenant_id, starts_on, ends_on) values
  ('c6cccccc-6000-0000-0000-000000000001', 'c6cccccc-0000-0000-0000-000000000001', '2027-01-01', '2027-03-31'),
  ('c6cccccc-6000-0000-0000-000000000002', 'c6cccccc-0000-0000-0000-000000000001', '2027-04-01', '2027-06-30');

insert into public.budget_cycles (id, tenant_id, name) values
  ('c6cccccc-2000-0000-0000-000000000001', 'c6cccccc-0000-0000-0000-000000000001', 'Budget 2027');

-- Version 1 : celle qu'on publie. Version 2 : son enfant, qui la remplacera.
-- Version 3 : restée candidate, pour les refus qui exigent une version ouverte.
insert into public.budget_versions (id, tenant_id, cycle_id, version_no, parent_version_id) values
  ('c6cccccc-3000-0000-0000-000000000001', 'c6cccccc-0000-0000-0000-000000000001', 'c6cccccc-2000-0000-0000-000000000001', 1, null),
  ('c6cccccc-3000-0000-0000-000000000002', 'c6cccccc-0000-0000-0000-000000000001', 'c6cccccc-2000-0000-0000-000000000001', 2, 'c6cccccc-3000-0000-0000-000000000001'),
  ('c6cccccc-3000-0000-0000-000000000003', 'c6cccccc-0000-0000-0000-000000000001', 'c6cccccc-2000-0000-0000-000000000001', 3, null);

-- ---------------------------------------------------------------------------
-- Forme du schéma.
-- ---------------------------------------------------------------------------

select has_column(
  'public', 'budget_versions', 'calculation_model',
  'une version budgétaire porte le modèle qui a produit ses chiffres'
);

select throws_ok(
  $$update public.budget_versions set calculation_model = 'astrologie'
    where id = 'c6cccccc-3000-0000-0000-000000000003'$$,
  '23514',
  null,
  'un modèle de calcul inconnu est refusé par la contrainte, pas par l’interface'
);

select has_view(
  'public', 'budget_version_states',
  'l’état effectif d’une version est exposé par une vue'
);

-- ---------------------------------------------------------------------------
-- Supersession : dérivée, jamais écrite.
-- ---------------------------------------------------------------------------

select is(
  (select is_superseded from public.budget_version_states
    where id = 'c6cccccc-3000-0000-0000-000000000001'),
  true,
  'une version qui a une version enfant est remplacée, sans qu’aucune ligne n’ait été mutée'
);

select is(
  (select is_superseded from public.budget_version_states
    where id = 'c6cccccc-3000-0000-0000-000000000003'),
  false,
  'une version sans enfant n’est pas remplacée'
);

-- ---------------------------------------------------------------------------
-- Publication : qui a le droit.
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '60000000-0000-0000-0000-000000000001', true);

select throws_ok(
  $$select public.publish_calculation(
      'c6cccccc-3000-0000-0000-000000000003',
      '1.0.0',
      repeat('a', 64),
      repeat('b', 64),
      '[{"dimension_id":"c6cccccc-1000-0000-0000-000000000001","account_id":"c6cccccc-5000-0000-0000-000000000001","period_id":"c6cccccc-6000-0000-0000-000000000001","amount":"10.000000","currency":"MAD"}]'::jsonb
    )$$,
  '42501',
  'Only a DAF or a DG publishes a calculation',
  'un contributeur ne publie pas un calcul, même en appelant la fonction directement'
);

select set_config('request.jwt.claim.sub', '60000000-0000-0000-0000-000000000003', true);

select throws_ok(
  $$select public.publish_calculation(
      'c6cccccc-3000-0000-0000-000000000003',
      '1.0.0',
      repeat('a', 64),
      repeat('b', 64),
      '[{"dimension_id":"c6cccccc-1000-0000-0000-000000000001","account_id":"c6cccccc-5000-0000-0000-000000000001","period_id":"c6cccccc-6000-0000-0000-000000000001","amount":"10.000000","currency":"MAD"}]'::jsonb
    )$$,
  '42501',
  'Only a DAF or a DG publishes a calculation',
  'un DAF d’un autre tenant ne publie rien ici'
);

-- ---------------------------------------------------------------------------
-- Publication : ce qu'elle écrit.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', '60000000-0000-0000-0000-000000000002', true);

select lives_ok(
  $$select public.publish_calculation(
      'c6cccccc-3000-0000-0000-000000000003',
      '1.0.0',
      repeat('c', 64),
      repeat('d', 64),
      '[{"dimension_id":"c6cccccc-1000-0000-0000-000000000001","account_id":"c6cccccc-5000-0000-0000-000000000001","period_id":"c6cccccc-6000-0000-0000-000000000001","amount":"10.500000","currency":"MAD"},
        {"dimension_id":"c6cccccc-1000-0000-0000-000000000001","account_id":"c6cccccc-5000-0000-0000-000000000001","period_id":"c6cccccc-6000-0000-0000-000000000002","amount":"4.500000","currency":"MAD"}]'::jsonb
    )$$,
  'un DAF publie le calcul de sa version'
);

select is(
  (select status from public.budget_versions where id = 'c6cccccc-3000-0000-0000-000000000003'),
  'published',
  'la version est publiée par la même transaction'
);

select is(
  (select count(*)::integer from public.budget_values
    where version_id = 'c6cccccc-3000-0000-0000-000000000003'),
  2,
  'les deux valeurs calculées sont écrites'
);

select is(
  (select status from public.calculation_runs
    where version_id = 'c6cccccc-3000-0000-0000-000000000003'),
  'succeeded',
  'le run est marqué réussi'
);

select is(
  (select output_hash from public.calculation_runs
    where version_id = 'c6cccccc-3000-0000-0000-000000000003'),
  repeat('d', 64),
  'l’empreinte des résultats est conservée avec le run'
);

-- ---------------------------------------------------------------------------
-- Idempotence et immuabilité.
-- ---------------------------------------------------------------------------

select is(
  (select public.publish_calculation(
      'c6cccccc-3000-0000-0000-000000000003',
      '1.0.0',
      repeat('c', 64),
      repeat('d', 64),
      '[{"dimension_id":"c6cccccc-1000-0000-0000-000000000001","account_id":"c6cccccc-5000-0000-0000-000000000001","period_id":"c6cccccc-6000-0000-0000-000000000001","amount":"10.500000","currency":"MAD"}]'::jsonb
    )),
  (select id from public.calculation_runs where version_id = 'c6cccccc-3000-0000-0000-000000000003'),
  'rejouer le même calcul rend le run déjà réussi au lieu d’en créer un second'
);

select is(
  (select count(*)::integer from public.budget_values
    where version_id = 'c6cccccc-3000-0000-0000-000000000003'),
  2,
  'un rejeu ne double aucune valeur'
);

select throws_ok(
  $$select public.publish_calculation(
      'c6cccccc-3000-0000-0000-000000000003',
      '1.0.0',
      repeat('e', 64),
      repeat('f', 64),
      '[{"dimension_id":"c6cccccc-1000-0000-0000-000000000001","account_id":"c6cccccc-5000-0000-0000-000000000001","period_id":"c6cccccc-6000-0000-0000-000000000001","amount":"99.000000","currency":"MAD"}]'::jsonb
    )$$,
  '55000',
  'A published version is immutable',
  'un autre calcul ne réécrit pas une version déjà publiée'
);

select throws_ok(
  $$select public.publish_calculation(
      'c6cccccc-3000-0000-0000-000000000002',
      '1.0.0',
      repeat('9', 64),
      repeat('8', 64),
      '[]'::jsonb
    )$$,
  '22023',
  'A published version carries at least one value',
  'une version ne se publie pas vide'
);

select * from finish();
rollback;
