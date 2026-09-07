-- La matière d'entrée d'une version publiée est conservée, et ne se réécrit pas.
--
-- `input_hash` prouvait l'intégrité, jamais la reproductibilité : rejouer une
-- version publiée supposait de refaire sa matière depuis un référentiel qui a
-- continué de vivre. Ces contrôles portent sur ce que la base garantit
-- désormais — la matière est là, elle décrit BIEN la version qui la porte, et
-- personne ne la réécrit après coup.
--
-- À jouer, comme les autres, en begin/rollback : rien n'est laissé en base.

begin;

create extension if not exists pgtap with schema extensions;

select plan(17);

-- ---------------------------------------------------------------------------
-- Jeu d'essai. Deux tenants, parce que le snapshot embarque tout le référentiel
-- d'un tenant : si une colonne devait fuir, ce serait celle-là.
-- ---------------------------------------------------------------------------
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin
) values
  ('90000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'daf-snapshot@tarjih.test', '', now(), now(), now(), '{}', '{}', false),
  ('90000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'daf-snapshot-autre@tarjih.test', '', now(), now(), now(), '{}', '{}', false);

insert into public.tenants (id, name, base_currency) values
  ('a9aaaaaa-0000-0000-0000-000000000001', 'Tenant A9', 'MAD'),
  ('b9bbbbbb-0000-0000-0000-000000000001', 'Tenant B9', 'MAD');

insert into public.tenant_memberships (tenant_id, user_id, role, is_tenant_admin) values
  ('a9aaaaaa-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001', 'daf', false),
  ('b9bbbbbb-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000002', 'daf', false);

insert into public.dimensions (id, tenant_id, kind, code, name) values
  ('a9aaaaaa-1000-0000-0000-000000000001', 'a9aaaaaa-0000-0000-0000-000000000001', 'department', 'RD', 'Recherche');

insert into public.financial_accounts (id, tenant_id, code, name, statement, normal_balance) values
  ('a9aaaaaa-5000-0000-0000-000000000001', 'a9aaaaaa-0000-0000-0000-000000000001', '61', 'Charges externes', 'income_statement', 'debit');

insert into public.periods (id, tenant_id, starts_on, ends_on) values
  ('a9aaaaaa-6000-0000-0000-000000000001', 'a9aaaaaa-0000-0000-0000-000000000001', '2029-01-01', '2029-03-31');

insert into public.budget_cycles (id, tenant_id, name) values
  ('a9aaaaaa-2000-0000-0000-000000000001', 'a9aaaaaa-0000-0000-0000-000000000001', 'Budget 2029');

-- Version 1 : celle qu'on publie. Version 2 : la cible des refus, pour qu'aucun
-- refus ne soit prouvé sur une version déjà publiée (elle refuserait de toute
-- façon, et le contrôle ne dirait plus rien de ce qu'il prétend dire).
insert into public.budget_versions (id, tenant_id, cycle_id, version_no) values
  ('a9aaaaaa-3000-0000-0000-000000000001', 'a9aaaaaa-0000-0000-0000-000000000001', 'a9aaaaaa-2000-0000-0000-000000000001', 1),
  ('a9aaaaaa-3000-0000-0000-000000000002', 'a9aaaaaa-0000-0000-0000-000000000001', 'a9aaaaaa-2000-0000-0000-000000000001', 2);

insert into public.hypotheses (id, tenant_id, version_id, dimension_id, parameter_key, value, unit, status, proposed_by) values
  ('a9aaaaaa-4000-0000-0000-000000000001', 'a9aaaaaa-0000-0000-0000-000000000001', 'a9aaaaaa-3000-0000-0000-000000000001', 'a9aaaaaa-1000-0000-0000-000000000001', 'charges.loyer', '{}'::jsonb, 'MAD', 'approved', '90000000-0000-0000-0000-000000000001'),
  ('a9aaaaaa-4000-0000-0000-000000000002', 'a9aaaaaa-0000-0000-0000-000000000001', 'a9aaaaaa-3000-0000-0000-000000000002', 'a9aaaaaa-1000-0000-0000-000000000001', 'charges.autre', '{}'::jsonb, 'MAD', 'approved', '90000000-0000-0000-0000-000000000001');

-- ---------------------------------------------------------------------------
-- Forme du schéma.
-- ---------------------------------------------------------------------------

select has_column(
  'public', 'calculation_runs', 'input_snapshot',
  'un run porte la matière d’entrée, pas seulement son empreinte'
);

select col_type_is(
  'public', 'calculation_runs', 'input_snapshot', 'jsonb',
  'la matière est conservée telle qu’elle a été soumise au moteur'
);

select hasnt_function(
  'public', 'publish_calculation',
  array['uuid', 'text', 'text', 'text', 'jsonb', 'jsonb'],
  'le chemin de publication qui ne conservait PAS la matière n’existe plus'
);

select has_function(
  'public', 'publish_calculation',
  array['uuid', 'text', 'text', 'text', 'jsonb', 'jsonb', 'jsonb'],
  'la seule voie de publication est celle qui conserve la matière'
);

-- ---------------------------------------------------------------------------
-- Publication : la matière part avec les chiffres.
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '90000000-0000-0000-0000-000000000001', true);

select lives_ok(
  $$select public.publish_calculation(
      'a9aaaaaa-3000-0000-0000-000000000001',
      '1.1.0',
      repeat('1', 64),
      repeat('2', 64),
      '[{"dimension_id":"a9aaaaaa-1000-0000-0000-000000000001","account_id":"a9aaaaaa-5000-0000-0000-000000000001","period_id":"a9aaaaaa-6000-0000-0000-000000000001","amount":"10.000000","currency":"MAD"}]'::jsonb,
      '[{"dimension_id":"a9aaaaaa-1000-0000-0000-000000000001","account_id":"a9aaaaaa-5000-0000-0000-000000000001","period_id":"a9aaaaaa-6000-0000-0000-000000000001","hypothesis_id":"a9aaaaaa-4000-0000-0000-000000000001","amount":"10"}]'::jsonb,
      '{"version_id":"a9aaaaaa-3000-0000-0000-000000000001","tenant_id":"a9aaaaaa-0000-0000-0000-000000000001","currency":"MAD","engine_version":"1.1.0","model":"direct"}'::jsonb
    )$$,
  'un DAF publie un calcul, sa matière d’entrée comprise'
);

select is(
  (select input_snapshot ->> 'model' from public.calculation_runs
    where version_id = 'a9aaaaaa-3000-0000-0000-000000000001'),
  'direct',
  'la matière conservée est celle qui a été soumise, champ pour champ'
);

-- ---------------------------------------------------------------------------
-- Ce que la publication refuse.
-- ---------------------------------------------------------------------------

select throws_ok(
  $$select public.publish_calculation(
      'a9aaaaaa-3000-0000-0000-000000000002',
      '1.1.0',
      repeat('3', 64),
      repeat('4', 64),
      '[{"dimension_id":"a9aaaaaa-1000-0000-0000-000000000001","account_id":"a9aaaaaa-5000-0000-0000-000000000001","period_id":"a9aaaaaa-6000-0000-0000-000000000001","amount":"10.000000","currency":"MAD"}]'::jsonb,
      '[{"dimension_id":"a9aaaaaa-1000-0000-0000-000000000001","account_id":"a9aaaaaa-5000-0000-0000-000000000001","period_id":"a9aaaaaa-6000-0000-0000-000000000001","hypothesis_id":"a9aaaaaa-4000-0000-0000-000000000002","amount":"10"}]'::jsonb,
      null
    )$$,
  '22023',
  'submitted_snapshot must be a json object',
  'aucun chiffre ne se publie sans la matière qui l’a produit'
);

select throws_ok(
  $$select public.publish_calculation(
      'a9aaaaaa-3000-0000-0000-000000000002',
      '1.1.0',
      repeat('5', 64),
      repeat('6', 64),
      '[{"dimension_id":"a9aaaaaa-1000-0000-0000-000000000001","account_id":"a9aaaaaa-5000-0000-0000-000000000001","period_id":"a9aaaaaa-6000-0000-0000-000000000001","amount":"10.000000","currency":"MAD"}]'::jsonb,
      '[{"dimension_id":"a9aaaaaa-1000-0000-0000-000000000001","account_id":"a9aaaaaa-5000-0000-0000-000000000001","period_id":"a9aaaaaa-6000-0000-0000-000000000001","hypothesis_id":"a9aaaaaa-4000-0000-0000-000000000002","amount":"10"}]'::jsonb,
      '[]'::jsonb
    )$$,
  '22023',
  'submitted_snapshot must be a json object',
  'une matière qui n’a pas la forme d’un snapshot est refusée'
);

-- Le cas dangereux : une matière parfaitement valide, mais celle d'une autre
-- version. Un rejeu retrouverait une empreinte, et ce serait la mauvaise.
select throws_ok(
  $$select public.publish_calculation(
      'a9aaaaaa-3000-0000-0000-000000000002',
      '1.1.0',
      repeat('7', 64),
      repeat('8', 64),
      '[{"dimension_id":"a9aaaaaa-1000-0000-0000-000000000001","account_id":"a9aaaaaa-5000-0000-0000-000000000001","period_id":"a9aaaaaa-6000-0000-0000-000000000001","amount":"10.000000","currency":"MAD"}]'::jsonb,
      '[{"dimension_id":"a9aaaaaa-1000-0000-0000-000000000001","account_id":"a9aaaaaa-5000-0000-0000-000000000001","period_id":"a9aaaaaa-6000-0000-0000-000000000001","hypothesis_id":"a9aaaaaa-4000-0000-0000-000000000002","amount":"10"}]'::jsonb,
      '{"version_id":"a9aaaaaa-3000-0000-0000-000000000001","tenant_id":"a9aaaaaa-0000-0000-0000-000000000001"}'::jsonb
    )$$,
  '22023',
  'submitted_snapshot describes another version',
  'la matière d’une autre version est refusée, même si elle est valide'
);

select throws_ok(
  $$select public.publish_calculation(
      'a9aaaaaa-3000-0000-0000-000000000002',
      '1.1.0',
      repeat('9', 64),
      repeat('a', 64),
      '[{"dimension_id":"a9aaaaaa-1000-0000-0000-000000000001","account_id":"a9aaaaaa-5000-0000-0000-000000000001","period_id":"a9aaaaaa-6000-0000-0000-000000000001","amount":"10.000000","currency":"MAD"}]'::jsonb,
      '[{"dimension_id":"a9aaaaaa-1000-0000-0000-000000000001","account_id":"a9aaaaaa-5000-0000-0000-000000000001","period_id":"a9aaaaaa-6000-0000-0000-000000000001","hypothesis_id":"a9aaaaaa-4000-0000-0000-000000000002","amount":"10"}]'::jsonb,
      '{"version_id":"a9aaaaaa-3000-0000-0000-000000000002","tenant_id":"b9bbbbbb-0000-0000-0000-000000000001"}'::jsonb
    )$$,
  '22023',
  'submitted_snapshot describes another version',
  'la matière d’un autre tenant est refusée'
);

-- ---------------------------------------------------------------------------
-- Isolation. Le snapshot embarque tout le référentiel d'un tenant : c'est la
-- colonne la plus sensible de la table.
--
-- Joué en `authenticated`, jamais en superutilisateur — la RLS ne s'applique
-- pas à ce dernier, et le contrôle serait vert sans rien prouver.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', '90000000-0000-0000-0000-000000000002', true);

select is(
  (select count(*)::integer from public.calculation_runs
    where version_id = 'a9aaaaaa-3000-0000-0000-000000000001'),
  0,
  'le DAF d’un autre tenant ne voit ni le run ni la matière qu’il porte'
);

select set_config('request.jwt.claim.sub', '90000000-0000-0000-0000-000000000001', true);

select is(
  (select count(*)::integer from public.calculation_runs
    where version_id = 'a9aaaaaa-3000-0000-0000-000000000001'),
  1,
  'le DAF du tenant, lui, voit le run de sa version'
);

-- ---------------------------------------------------------------------------
-- Immuabilité de la matière.
--
-- Joué en superutilisateur, et c'est voulu ici : un trigger de table doit
-- s'opposer même à un chemin qui ne passe par aucune RLS — c'est le sens de ce
-- garde, qui protège aussi contre un futur `security definer`.
-- ---------------------------------------------------------------------------

reset role;

select throws_ok(
  $$update public.calculation_runs
      set input_snapshot = '{"version_id":"a9aaaaaa-3000-0000-0000-000000000001","tenant_id":"a9aaaaaa-0000-0000-0000-000000000001","model":"driver"}'::jsonb
    where version_id = 'a9aaaaaa-3000-0000-0000-000000000001'$$,
  '55000',
  'A calculation run input snapshot is immutable',
  'la matière d’une version publiée ne se réécrit pas'
);

-- Un run antérieur à la migration n'a pas de matière, et n'en recevra pas : la
-- fabriquer après coup reviendrait à inventer la preuve que cette colonne
-- existe pour porter.
insert into public.calculation_runs (id, tenant_id, version_id, engine_version, input_hash, status)
values (
  'a9aaaaaa-7000-0000-0000-000000000001',
  'a9aaaaaa-0000-0000-0000-000000000001',
  'a9aaaaaa-3000-0000-0000-000000000002',
  '1.0.0', repeat('b', 64), 'succeeded'
);

select throws_ok(
  $$update public.calculation_runs
      set input_snapshot = '{"version_id":"a9aaaaaa-3000-0000-0000-000000000002","tenant_id":"a9aaaaaa-0000-0000-0000-000000000001"}'::jsonb
    where id = 'a9aaaaaa-7000-0000-0000-000000000001'$$,
  '55000',
  'A calculation run input snapshot is immutable',
  'une matière absente ne se fabrique pas après coup'
);

-- Le garde ne doit bloquer QUE la réécriture de la matière : un run doit
-- continuer de passer en `succeeded`, sinon la publication elle-même casse.
select lives_ok(
  $$update public.calculation_runs
      set status = 'failed', completed_at = now()
    where id = 'a9aaaaaa-7000-0000-0000-000000000001'$$,
  'le reste du run se met à jour normalement'
);

-- ---------------------------------------------------------------------------
-- La contrainte de table, indépendamment de la fonction.
-- ---------------------------------------------------------------------------

select throws_ok(
  $$insert into public.calculation_runs
      (tenant_id, version_id, engine_version, input_hash, input_snapshot, status)
    values (
      'a9aaaaaa-0000-0000-0000-000000000001',
      'a9aaaaaa-3000-0000-0000-000000000002',
      '1.1.0', repeat('c', 64),
      '{"version_id":"a9aaaaaa-3000-0000-0000-000000000001","tenant_id":"a9aaaaaa-0000-0000-0000-000000000001"}'::jsonb,
      'succeeded'
    )$$,
  '23514',
  'new row for relation "calculation_runs" violates check constraint "calculation_runs_snapshot_describes_its_run"',
  'aucune écriture, même directe, ne peut faire porter à un run la matière d’une autre version'
);

select is(
  (select input_snapshot from public.calculation_runs
    where id = 'a9aaaaaa-7000-0000-0000-000000000001'),
  null,
  'un run antérieur dit qu’il n’a pas de matière plutôt que d’en montrer une fausse'
);

select * from finish();

rollback;
