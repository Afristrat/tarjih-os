begin;

create extension if not exists pgtap with schema extensions;

select plan(20);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin
) values
  ('e1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'contributeur-reprise@tarjih.test', '', now(), now(), now(), '{}', '{}', false),
  ('e1000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'daf-reprise@tarjih.test', '', now(), now(), now(), '{}', '{}', false),
  ('e1000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'daf-reprise-b@tarjih.test', '', now(), now(), now(), '{}', '{}', false);

insert into public.tenants (id, name, base_currency) values
  ('e1eeeeee-0000-0000-0000-000000000001', 'Tenant E', 'MAD'),
  ('f1ffffff-0000-0000-0000-000000000001', 'Tenant F', 'EUR');

insert into public.tenant_memberships (tenant_id, user_id, role, is_tenant_admin) values
  ('e1eeeeee-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'contributor', false),
  ('e1eeeeee-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000002', 'daf', false),
  ('f1ffffff-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000003', 'daf', false);

insert into public.dimensions (id, tenant_id, kind, code, name) values
  ('e1eeeeee-1000-0000-0000-000000000001', 'e1eeeeee-0000-0000-0000-000000000001', 'department', 'COM', 'Commerce');

insert into public.dimension_grants (tenant_id, user_id, dimension_id, can_read, can_contribute) values
  ('e1eeeeee-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'e1eeeeee-1000-0000-0000-000000000001', true, true);

insert into public.budget_cycles (id, tenant_id, name) values
  ('e1eeeeee-2000-0000-0000-000000000001', 'e1eeeeee-0000-0000-0000-000000000001', 'Budget 2028'),
  ('e1eeeeee-2000-0000-0000-000000000002', 'e1eeeeee-0000-0000-0000-000000000001', 'Budget 2029'),
  ('f1ffffff-2000-0000-0000-000000000001', 'f1ffffff-0000-0000-0000-000000000001', 'Budget 2028');

-- La source : une version « inducteurs » PUBLIÉE, avec une hypothèse approuvée,
-- une proposée jamais décidée, et une rejetée. Dans l'autre cycle, une version
-- « saisie directe » : elle sert à prouver que le modèle ne se franchit pas.
insert into public.budget_versions (id, tenant_id, cycle_id, version_no, calculation_model) values
  ('e1eeeeee-3000-0000-0000-000000000001', 'e1eeeeee-0000-0000-0000-000000000001', 'e1eeeeee-2000-0000-0000-000000000001', 1, 'driver'),
  ('e1eeeeee-3000-0000-0000-000000000009', 'e1eeeeee-0000-0000-0000-000000000001', 'e1eeeeee-2000-0000-0000-000000000002', 1, 'direct'),
  ('f1ffffff-3000-0000-0000-000000000001', 'f1ffffff-0000-0000-0000-000000000001', 'f1ffffff-2000-0000-0000-000000000001', 1, 'driver');

insert into public.hypotheses (id, tenant_id, version_id, dimension_id, parameter_key, value, unit, status, proposed_by) values
  ('e1eeeeee-4000-0000-0000-000000000001', 'e1eeeeee-0000-0000-0000-000000000001', 'e1eeeeee-3000-0000-0000-000000000001', 'e1eeeeee-1000-0000-0000-000000000001', 'jours_factures', '{"type":"driver","driver":"volume_price","account_code":"712","period_ids":["p1"],"volume":"320","unit_price":"4500"}', 'MAD', 'approved', 'e1000000-0000-0000-0000-000000000001'),
  ('e1eeeeee-4000-0000-0000-000000000002', 'e1eeeeee-0000-0000-0000-000000000001', 'e1eeeeee-3000-0000-0000-000000000001', 'e1eeeeee-1000-0000-0000-000000000001', 'commission', '{"type":"driver","driver":"percent_of","account_code":"6136","base_account_code":"712","period_ids":["p1"],"rate":"0.05"}', 'MAD', 'proposed', 'e1000000-0000-0000-0000-000000000001'),
  ('e1eeeeee-4000-0000-0000-000000000003', 'e1eeeeee-0000-0000-0000-000000000001', 'e1eeeeee-3000-0000-0000-000000000001', 'e1eeeeee-1000-0000-0000-000000000001', 'prime_refusee', '{"type":"driver","driver":"volume_price","account_code":"617","period_ids":["p1"],"volume":"1","unit_price":"99"}', 'MAD', 'rejected', 'e1000000-0000-0000-0000-000000000001');

update public.budget_versions
set status = 'published', published_at = now()
where id = 'e1eeeeee-3000-0000-0000-000000000001';

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);

-- ---------------------------------------------------------------------------
-- Ceux qui ne peuvent pas ouvrir : un contributeur, le DAF d'un autre tenant.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', 'e1000000-0000-0000-0000-000000000001', true);

select throws_ok(
  $$select public.open_budget_version('e1eeeeee-2000-0000-0000-000000000001', 'driver', 'e1eeeeee-3000-0000-0000-000000000001')$$,
  '42501',
  'Only the DAF or the DG opens a version',
  'un contributeur n’ouvre pas de version, même en reprenant celle où il a écrit'
);

select set_config('request.jwt.claim.sub', 'e1000000-0000-0000-0000-000000000003', true);

select throws_ok(
  $$select public.open_budget_version('e1eeeeee-2000-0000-0000-000000000001', 'driver', 'e1eeeeee-3000-0000-0000-000000000001')$$,
  'P0002',
  'Cycle not found',
  'le DAF d’un autre tenant ne trouve pas le cycle : « introuvable », jamais « interdit »'
);

-- ---------------------------------------------------------------------------
-- Le DAF du tenant : ce qu'il ne peut pas faire non plus.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', 'e1000000-0000-0000-0000-000000000002', true);

select throws_ok(
  $$select public.open_budget_version('e1eeeeee-2000-0000-0000-000000000002', 'direct', 'e1eeeeee-3000-0000-0000-000000000001')$$,
  'P0002',
  'Source version not found',
  'une version ne se reprend pas d’un autre cycle'
);

select throws_ok(
  $$select public.open_budget_version('e1eeeeee-2000-0000-0000-000000000001', 'direct', 'e1eeeeee-3000-0000-0000-000000000001')$$,
  '22023',
  'A resumed version keeps the calculation model of its source',
  'la reprise garde le modèle de sa source : les formes de valeurs ne se traduisent pas'
);

select throws_ok(
  $$select public.open_budget_version('e1eeeeee-2000-0000-0000-000000000001', 'boule_de_cristal', null)$$,
  '22023',
  'Unknown calculation model',
  'un modèle inconnu est refusé avant d’atteindre la contrainte de colonne'
);

-- ---------------------------------------------------------------------------
-- La reprise elle-même.
-- ---------------------------------------------------------------------------
create temporary table opened as
select public.open_budget_version('e1eeeeee-2000-0000-0000-000000000001', 'driver', 'e1eeeeee-3000-0000-0000-000000000001') as id;

select is(
  (select version_no || ' ' || status || ' ' || calculation_model || ' ' || parent_version_id::text
   from public.budget_versions where id = (select id from opened)),
  '2 draft driver e1eeeeee-3000-0000-0000-000000000001',
  'la version ouverte succède à sa source : numéro suivant, brouillon, même modèle, filiation écrite'
);

select is(
  (select is_superseded from public.budget_version_states where id = 'e1eeeeee-3000-0000-0000-000000000001'),
  true,
  'la source est désormais remplacée — sans qu’un octet de sa ligne ait changé'
);

select is(
  (select count(*)::int from public.hypotheses where version_id = (select id from opened)),
  2,
  'les hypothèses approuvées et proposées sont reprises, la rejetée ne l’est pas'
);

select is(
  (select count(*)::int from public.hypotheses
   where version_id = (select id from opened) and (status <> 'proposed' or row_version <> 1)),
  0,
  'chaque reprise redevient une proposition, à la révision 1 : rien n’est approuvé sans décision dans CETTE version'
);

select results_eq(
  $$select dimension_id, parameter_key, value, unit, proposed_by
    from public.hypotheses where version_id = (select id from opened) order by parameter_key$$,
  $$select dimension_id, parameter_key, value, unit, proposed_by
    from public.hypotheses where version_id = 'e1eeeeee-3000-0000-0000-000000000001' and status <> 'rejected' order by parameter_key$$,
  'dimension, paramètre, valeur, unité et AUTEUR sont ceux de la source : celui qui a dit 320 jours reste celui qui l’a dit'
);

select results_eq(
  $$select parameter_key, status, row_version from public.hypotheses
    where version_id = 'e1eeeeee-3000-0000-0000-000000000001' order by parameter_key$$,
  $$values ('commission', 'proposed', 1), ('jours_factures', 'approved', 1), ('prime_refusee', 'rejected', 1)$$,
  'la source n’a pas bougé'
);

-- Une reprise est une proposition ordinaire : son auteur la corrige, le DAF la
-- décide. Sans ces deux contrôles, une copie pourrait n'être qu'un fantôme que
-- ni l'un ni l'autre ne sait manier.
select set_config('request.jwt.claim.sub', 'e1000000-0000-0000-0000-000000000001', true);

select lives_ok(
  $$update public.hypotheses set row_version = 2, unit = 'MAD'
    where version_id = (select id from opened) and parameter_key = 'jours_factures'$$,
  'l’auteur d’origine corrige sa ligne reprise'
);

select set_config('request.jwt.claim.sub', 'e1000000-0000-0000-0000-000000000002', true);

select lives_ok(
  $$select public.decide_hypothesis(
      (select id from public.hypotheses where version_id = (select id from opened) and parameter_key = 'jours_factures'),
      2, 'approved', 'Reconduit tel quel.')$$,
  'le DAF décide une ligne reprise comme n’importe quelle proposition'
);

-- ---------------------------------------------------------------------------
-- Ouvrir sans reprendre : la version vide, comme avant.
-- ---------------------------------------------------------------------------
create temporary table opened_empty as
select public.open_budget_version('e1eeeeee-2000-0000-0000-000000000001', 'cost_center', null) as id;

select is(
  (select version_no || ' ' || status || ' ' || calculation_model || ' ' || coalesce(parent_version_id::text, 'sans parent')
   from public.budget_versions where id = (select id from opened_empty)),
  '3 draft cost_center sans parent',
  'une version vide prend le modèle demandé, le numéro suivant, et n’a pas de parent'
);

select is(
  (select count(*)::int from public.hypotheses where version_id = (select id from opened_empty)),
  0,
  'une version vide ne reprend rien'
);

-- ---------------------------------------------------------------------------
-- Reprendre un brouillon : permis — abandonner une candidate pour repartir
-- d'elle est un usage légitime, et la source reste intacte.
-- ---------------------------------------------------------------------------
create temporary table opened_from_draft as
select public.open_budget_version('e1eeeeee-2000-0000-0000-000000000001', 'driver', (select id from opened)) as id;

select is(
  (select count(*)::int from public.hypotheses where version_id = (select id from opened_from_draft)),
  2,
  'un brouillon se reprend aussi'
);

select is(
  (select status from public.hypotheses where version_id = (select id from opened_from_draft) and parameter_key = 'jours_factures'),
  'proposed',
  'la décision prise dans le brouillon source n’est pas reprise : elle lui appartient'
);

-- ---------------------------------------------------------------------------
-- Sans identité, rien.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', '', true);

select throws_ok(
  $$select public.open_budget_version('e1eeeeee-2000-0000-0000-000000000001', 'driver', null)$$,
  '28000',
  'Authentication required',
  'aucune version ne s’ouvre sans identité'
);

-- ---------------------------------------------------------------------------
-- Forme : la fonction est bien celle que l'application appelle, et rien
-- d'autre que les membres authentifiés ne peut l'exécuter.
-- ---------------------------------------------------------------------------
reset role;

select function_privs_are(
  'public', 'open_budget_version', array['uuid', 'text', 'uuid'], 'anon', array[]::text[],
  'un visiteur anonyme ne peut pas appeler l’ouverture de version'
);

select is(
  (select prosecdef from pg_proc where proname = 'open_budget_version' and pronamespace = 'public'::regnamespace),
  true,
  'la fonction porte ses propres contrôles : elle s’exécute au-dessus de la RLS pour écrire au nom des auteurs d’origine'
);

select * from finish();

rollback;
