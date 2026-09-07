-- Ce qu'un export a le droit d'emporter, et ce que la base en retient.
--
-- La table `exports` porte une RLS depuis la migration initiale, et personne ne
-- l'avait jamais rejouée — c'est la leçon du 2026-09-06, à ceci près qu'ici le
-- contrôle n'existait même pas.
--
-- Le contrôle le plus important de ce fichier est le DERNIER, et il ne teste
-- pas `exports` : il établit que `budget_values` est lisible par un contributeur
-- qui n'a PAS le droit d'exporter. C'est la raison d'être du filtre applicatif
-- (`lib/exports/scope.ts`) — sans lui, une requête ordinaire remonterait des
-- lignes que le fichier n'a pas le droit d'emporter.
--
-- À jouer, comme les autres, en begin/rollback : rien n'est laissé en base.

begin;

create extension if not exists pgtap with schema extensions;

select plan(10);

-- ---------------------------------------------------------------------------
-- Jeu d'essai : deux tenants, un DAF, un contributeur à deux dimensions dont
-- une seule est exportable.
-- ---------------------------------------------------------------------------
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin
) values
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'daf-export@tarjih.test', '', now(), now(), now(), '{}', '{}', false),
  ('a0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'contrib-export@tarjih.test', '', now(), now(), now(), '{}', '{}', false),
  ('a0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'daf-autre-export@tarjih.test', '', now(), now(), now(), '{}', '{}', false);

insert into public.tenants (id, name, base_currency) values
  ('c1aaaaaa-0000-0000-0000-000000000001', 'Tenant Export', 'MAD'),
  ('d1bbbbbb-0000-0000-0000-000000000001', 'Tenant Voisin', 'MAD');

insert into public.tenant_memberships (tenant_id, user_id, role, is_tenant_admin) values
  ('c1aaaaaa-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'daf', false),
  ('c1aaaaaa-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'contributor', false),
  ('d1bbbbbb-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 'daf', false);

insert into public.dimensions (id, tenant_id, kind, code, name) values
  ('c1aaaaaa-1000-0000-0000-000000000001', 'c1aaaaaa-0000-0000-0000-000000000001', 'department', 'OPS', 'Opérations'),
  ('c1aaaaaa-1000-0000-0000-000000000002', 'c1aaaaaa-0000-0000-0000-000000000001', 'department', 'RD', 'Recherche');

-- Le contributeur LIT les deux dimensions, mais n'en EXPORTE qu'une. Tout ce
-- fichier tourne autour de cet écart.
insert into public.dimension_grants (tenant_id, user_id, dimension_id, can_read, can_contribute, can_approve, can_export) values
  ('c1aaaaaa-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'c1aaaaaa-1000-0000-0000-000000000001', true, true, false, true),
  ('c1aaaaaa-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'c1aaaaaa-1000-0000-0000-000000000002', true, true, false, false);

insert into public.financial_accounts (id, tenant_id, code, name, statement, normal_balance) values
  ('c1aaaaaa-5000-0000-0000-000000000001', 'c1aaaaaa-0000-0000-0000-000000000001', '61', 'Charges externes', 'income_statement', 'debit');

insert into public.periods (id, tenant_id, starts_on, ends_on) values
  ('c1aaaaaa-6000-0000-0000-000000000001', 'c1aaaaaa-0000-0000-0000-000000000001', '2030-01-01', '2030-03-31');

insert into public.budget_cycles (id, tenant_id, name) values
  ('c1aaaaaa-2000-0000-0000-000000000001', 'c1aaaaaa-0000-0000-0000-000000000001', 'Budget 2030');

-- `budget_versions_check` exige une date de publication dès que le statut l'est :
-- une version publiée sans date serait un chiffre officiel sans moment.
insert into public.budget_versions (id, tenant_id, cycle_id, version_no, status, published_at) values
  ('c1aaaaaa-3000-0000-0000-000000000001', 'c1aaaaaa-0000-0000-0000-000000000001', 'c1aaaaaa-2000-0000-0000-000000000001', 1, 'published', now());

insert into public.calculation_runs (id, tenant_id, version_id, engine_version, input_hash, status) values
  ('c1aaaaaa-7000-0000-0000-000000000001', 'c1aaaaaa-0000-0000-0000-000000000001', 'c1aaaaaa-3000-0000-0000-000000000001', '1.1.0', repeat('e', 64), 'succeeded');

-- Un montant sur la dimension que le contributeur peut lire SANS pouvoir
-- l'exporter : c'est la ligne qui ne doit jamais atteindre un fichier.
insert into public.budget_values (
  tenant_id, version_id, calculation_run_id, dimension_id, account_id, period_id, amount, currency
) values (
  'c1aaaaaa-0000-0000-0000-000000000001', 'c1aaaaaa-3000-0000-0000-000000000001',
  'c1aaaaaa-7000-0000-0000-000000000001', 'c1aaaaaa-1000-0000-0000-000000000002',
  'c1aaaaaa-5000-0000-0000-000000000001', 'c1aaaaaa-6000-0000-0000-000000000001', 42.000000, 'MAD'
);

select has_table('public', 'exports', 'la trace des exports a sa table');

select is(
  (select relrowsecurity from pg_class where oid = 'public.exports'::regclass),
  true,
  'la trace des exports est protégée par la RLS'
);

-- ---------------------------------------------------------------------------
-- Qui peut demander quoi. Joué en `authenticated`, jamais en superutilisateur :
-- la RLS ne s'applique pas à ce dernier, et tout serait vert sans rien prouver.
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000001', true);

select lives_ok(
  $$insert into public.exports
      (tenant_id, requested_by, version_id, dimension_id, scope_hash, status, expires_at)
    values (
      'c1aaaaaa-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
      'c1aaaaaa-3000-0000-0000-000000000001', null, repeat('1', 64), 'ready', now() + interval '1 day'
    )$$,
  'un DAF journalise un export du tenant entier'
);

select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000002', true);

select throws_ok(
  $$insert into public.exports
      (tenant_id, requested_by, version_id, dimension_id, scope_hash, status, expires_at)
    values (
      'c1aaaaaa-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002',
      'c1aaaaaa-3000-0000-0000-000000000001', null, repeat('2', 64), 'ready', now() + interval '1 day'
    )$$,
  '42501',
  'new row violates row-level security policy for table "exports"',
  'un contributeur ne demande pas un export du tenant entier'
);

select lives_ok(
  $$insert into public.exports
      (tenant_id, requested_by, version_id, dimension_id, scope_hash, status, expires_at)
    values (
      'c1aaaaaa-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002',
      'c1aaaaaa-3000-0000-0000-000000000001', 'c1aaaaaa-1000-0000-0000-000000000001',
      repeat('3', 64), 'ready', now() + interval '1 day'
    )$$,
  'un contributeur journalise l’export de la dimension qu’il peut exporter'
);

-- Le cœur du sujet : lisible ne vaut pas exportable.
select throws_ok(
  $$insert into public.exports
      (tenant_id, requested_by, version_id, dimension_id, scope_hash, status, expires_at)
    values (
      'c1aaaaaa-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002',
      'c1aaaaaa-3000-0000-0000-000000000001', 'c1aaaaaa-1000-0000-0000-000000000002',
      repeat('4', 64), 'ready', now() + interval '1 day'
    )$$,
  '42501',
  'new row violates row-level security policy for table "exports"',
  'une dimension seulement LISIBLE ne s’exporte pas'
);

select throws_ok(
  $$insert into public.exports
      (tenant_id, requested_by, version_id, dimension_id, scope_hash, status, expires_at)
    values (
      'c1aaaaaa-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
      'c1aaaaaa-3000-0000-0000-000000000001', 'c1aaaaaa-1000-0000-0000-000000000001',
      repeat('5', 64), 'ready', now() + interval '1 day'
    )$$,
  '42501',
  'new row violates row-level security policy for table "exports"',
  'personne ne demande un export au nom de quelqu’un d’autre'
);

-- ---------------------------------------------------------------------------
-- Ce que la trace laisse voir.
-- ---------------------------------------------------------------------------

-- Deux traces existent dans ce tenant : celle du DAF et celle du contributeur.
-- `exports_select_requester_or_finance` n'ouvre la lecture qu'au demandeur et
-- aux financiers : un contributeur ne voit donc QUE la sienne. Attendre le
-- contraire était une erreur de ce fichier, pas du produit.
select is(
  (select count(*)::integer from public.exports
    where tenant_id = 'c1aaaaaa-0000-0000-0000-000000000001'),
  1,
  'un contributeur voit sa demande, et aucune de celles des autres'
);

select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000003', true);

select is(
  (select count(*)::integer from public.exports),
  0,
  'le DAF d’un autre tenant ne voit aucune trace d’export'
);

-- ---------------------------------------------------------------------------
-- POURQUOI le filtre applicatif existe.
--
-- `budget_values_select_scope` porte sur la permission `read`. Ce contrôle
-- établit qu'une ligne d'une dimension NON exportable remonte bel et bien d'une
-- requête ordinaire du contributeur : la base ne borne pas l'export, et c'est
-- `lib/exports/scope.ts` qui doit le faire avant que le fichier n'existe.
-- Si ce contrôle venait à rougir parce que la RLS s'est resserrée, le filtre
-- applicatif deviendrait une seconde barrière — pas une raison de le retirer.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000002', true);

select is(
  (select count(*)::integer from public.budget_values
    where dimension_id = 'c1aaaaaa-1000-0000-0000-000000000002'),
  1,
  'une ligne SEULEMENT lisible remonte d’une requête ordinaire : le filtre d’export ne peut pas être délégué à la RLS'
);

select * from finish();

rollback;
