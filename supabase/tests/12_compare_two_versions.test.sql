begin;

create extension if not exists pgtap with schema extensions;

select plan(22);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin
) values
  ('a2000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'contributeur-ecart@tarjih.test', '', now(), now(), now(), '{}', '{}', false),
  ('a2000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'daf-ecart@tarjih.test', '', now(), now(), now(), '{}', '{}', false),
  ('a2000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'daf-ecart-tiers@tarjih.test', '', now(), now(), now(), '{}', '{}', false);

insert into public.tenants (id, name, base_currency) values
  ('a2aaaaaa-0000-0000-0000-000000000001', 'Tenant G', 'MAD'),
  ('b2bbbbbb-0000-0000-0000-000000000001', 'Tenant H', 'EUR');

insert into public.tenant_memberships (tenant_id, user_id, role, is_tenant_admin) values
  ('a2aaaaaa-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001', 'contributor', false),
  ('a2aaaaaa-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000002', 'daf', false),
  ('b2bbbbbb-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000003', 'daf', false);

-- Deux dimensions : le contributeur ne lit que la première.
insert into public.dimensions (id, tenant_id, kind, code, name) values
  ('a2aaaaaa-1000-0000-0000-000000000001', 'a2aaaaaa-0000-0000-0000-000000000001', 'department', 'COM', 'Commerce'),
  ('a2aaaaaa-1000-0000-0000-000000000002', 'a2aaaaaa-0000-0000-0000-000000000001', 'department', 'DIR', 'Direction');

insert into public.dimension_grants (tenant_id, user_id, dimension_id, can_read, can_contribute) values
  ('a2aaaaaa-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001', 'a2aaaaaa-1000-0000-0000-000000000001', true, true);

insert into public.financial_accounts (id, tenant_id, code, name, statement, normal_balance) values
  ('a2aaaaaa-5000-0000-0000-000000000001', 'a2aaaaaa-0000-0000-0000-000000000001', '712', 'Ventes', 'income_statement', 'credit'),
  ('a2aaaaaa-5000-0000-0000-000000000002', 'a2aaaaaa-0000-0000-0000-000000000001', '617', 'Personnel', 'income_statement', 'debit');

insert into public.periods (id, tenant_id, starts_on, ends_on) values
  ('a2aaaaaa-6000-0000-0000-000000000001', 'a2aaaaaa-0000-0000-0000-000000000001', '2028-01-01', '2028-03-31');

insert into public.budget_cycles (id, tenant_id, name) values
  ('a2aaaaaa-2000-0000-0000-000000000001', 'a2aaaaaa-0000-0000-0000-000000000001', 'Budget 2028'),
  ('b2bbbbbb-2000-0000-0000-000000000001', 'b2bbbbbb-0000-0000-0000-000000000001', 'Budget 2028');

-- v1 PUBLIÉE (base), v2 PUBLIÉE (pour les montants), v3 BROUILLON reprise de v1
-- (pour le geste), et une version d'un autre tenant.
-- Toutes ouvertes en brouillon : une version publiée n'accepte plus une ligne
-- (`hypotheses_enforce_write`), la publication vient après les fixtures.
insert into public.budget_versions (id, tenant_id, cycle_id, version_no, calculation_model, parent_version_id) values
  ('a2aaaaaa-3000-0000-0000-000000000001', 'a2aaaaaa-0000-0000-0000-000000000001', 'a2aaaaaa-2000-0000-0000-000000000001', 1, 'driver', null),
  ('a2aaaaaa-3000-0000-0000-000000000002', 'a2aaaaaa-0000-0000-0000-000000000001', 'a2aaaaaa-2000-0000-0000-000000000001', 2, 'driver', 'a2aaaaaa-3000-0000-0000-000000000001'),
  ('a2aaaaaa-3000-0000-0000-000000000003', 'a2aaaaaa-0000-0000-0000-000000000001', 'a2aaaaaa-2000-0000-0000-000000000001', 3, 'driver', 'a2aaaaaa-3000-0000-0000-000000000001'),
  ('b2bbbbbb-3000-0000-0000-000000000001', 'b2bbbbbb-0000-0000-0000-000000000001', 'b2bbbbbb-2000-0000-0000-000000000001', 1, 'driver', null);

-- v1 : deux approuvées (une par dimension), une proposée jamais décidée, une rejetée.
-- v3 (reprise de v1) : `jours_factures` identique (proposée), `salaires` identique
-- mais sur DIR (proposée), `commission` reprise identique à une ligne que v1 n'a
-- JAMAIS approuvée, `prime` NOUVELLE, et `unite_differente` identique en valeur
-- mais pas en unité.
insert into public.hypotheses (id, tenant_id, version_id, dimension_id, parameter_key, value, unit, status, proposed_by) values
  -- v1
  ('a2aaaaaa-4000-0000-0000-000000000001', 'a2aaaaaa-0000-0000-0000-000000000001', 'a2aaaaaa-3000-0000-0000-000000000001', 'a2aaaaaa-1000-0000-0000-000000000001', 'jours_factures', '{"driver":"volume_price","account_code":"712","periods":[{"period_id":"a2aaaaaa-6000-0000-0000-000000000001","volume":"320","unit_price":"4500"}]}', 'MAD', 'approved', 'a2000000-0000-0000-0000-000000000001'),
  ('a2aaaaaa-4000-0000-0000-000000000002', 'a2aaaaaa-0000-0000-0000-000000000001', 'a2aaaaaa-3000-0000-0000-000000000001', 'a2aaaaaa-1000-0000-0000-000000000002', 'salaires', '{"driver":"volume_price","account_code":"617","periods":[{"period_id":"a2aaaaaa-6000-0000-0000-000000000001","volume":"10","unit_price":"30000"}]}', 'MAD', 'approved', 'a2000000-0000-0000-0000-000000000002'),
  ('a2aaaaaa-4000-0000-0000-000000000003', 'a2aaaaaa-0000-0000-0000-000000000001', 'a2aaaaaa-3000-0000-0000-000000000001', 'a2aaaaaa-1000-0000-0000-000000000001', 'commission', '{"driver":"percent_of","account_code":"6136","base_account_code":"712","period_ids":["a2aaaaaa-6000-0000-0000-000000000001"],"rate":"0.05"}', 'MAD', 'proposed', 'a2000000-0000-0000-0000-000000000001'),
  ('a2aaaaaa-4000-0000-0000-000000000004', 'a2aaaaaa-0000-0000-0000-000000000001', 'a2aaaaaa-3000-0000-0000-000000000001', 'a2aaaaaa-1000-0000-0000-000000000001', 'refusee', '{"driver":"volume_price","account_code":"617","periods":[{"period_id":"a2aaaaaa-6000-0000-0000-000000000001","volume":"1","unit_price":"99"}]}', 'MAD', 'rejected', 'a2000000-0000-0000-0000-000000000001'),
  ('a2aaaaaa-4000-0000-0000-000000000005', 'a2aaaaaa-0000-0000-0000-000000000001', 'a2aaaaaa-3000-0000-0000-000000000001', 'a2aaaaaa-1000-0000-0000-000000000001', 'unite_differente', '{"driver":"volume_price","account_code":"712","periods":[{"period_id":"a2aaaaaa-6000-0000-0000-000000000001","volume":"2","unit_price":"5"}]}', 'MAD', 'approved', 'a2000000-0000-0000-0000-000000000001'),
  -- v2 : jours_factures MODIFIÉE (300 jours), salaires identique, unite_differente retirée
  ('a2aaaaaa-4000-0000-0000-000000000011', 'a2aaaaaa-0000-0000-0000-000000000001', 'a2aaaaaa-3000-0000-0000-000000000002', 'a2aaaaaa-1000-0000-0000-000000000001', 'jours_factures', '{"driver":"volume_price","account_code":"712","periods":[{"period_id":"a2aaaaaa-6000-0000-0000-000000000001","volume":"300","unit_price":"4500"}]}', 'MAD', 'approved', 'a2000000-0000-0000-0000-000000000001'),
  ('a2aaaaaa-4000-0000-0000-000000000012', 'a2aaaaaa-0000-0000-0000-000000000001', 'a2aaaaaa-3000-0000-0000-000000000002', 'a2aaaaaa-1000-0000-0000-000000000002', 'salaires', '{"driver":"volume_price","account_code":"617","periods":[{"period_id":"a2aaaaaa-6000-0000-0000-000000000001","volume":"10","unit_price":"30000"}]}', 'MAD', 'approved', 'a2000000-0000-0000-0000-000000000002'),
  -- v3 (brouillon, reprise de v1)
  ('a2aaaaaa-4000-0000-0000-000000000021', 'a2aaaaaa-0000-0000-0000-000000000001', 'a2aaaaaa-3000-0000-0000-000000000003', 'a2aaaaaa-1000-0000-0000-000000000001', 'jours_factures', '{"periods":[{"unit_price":"4500","volume":"320","period_id":"a2aaaaaa-6000-0000-0000-000000000001"}],"account_code":"712","driver":"volume_price"}', 'MAD', 'proposed', 'a2000000-0000-0000-0000-000000000001'),
  ('a2aaaaaa-4000-0000-0000-000000000022', 'a2aaaaaa-0000-0000-0000-000000000001', 'a2aaaaaa-3000-0000-0000-000000000003', 'a2aaaaaa-1000-0000-0000-000000000002', 'salaires', '{"driver":"volume_price","account_code":"617","periods":[{"period_id":"a2aaaaaa-6000-0000-0000-000000000001","volume":"10","unit_price":"30000"}]}', 'MAD', 'proposed', 'a2000000-0000-0000-0000-000000000002'),
  ('a2aaaaaa-4000-0000-0000-000000000023', 'a2aaaaaa-0000-0000-0000-000000000001', 'a2aaaaaa-3000-0000-0000-000000000003', 'a2aaaaaa-1000-0000-0000-000000000001', 'commission', '{"driver":"percent_of","account_code":"6136","base_account_code":"712","period_ids":["a2aaaaaa-6000-0000-0000-000000000001"],"rate":"0.05"}', 'MAD', 'proposed', 'a2000000-0000-0000-0000-000000000001'),
  ('a2aaaaaa-4000-0000-0000-000000000024', 'a2aaaaaa-0000-0000-0000-000000000001', 'a2aaaaaa-3000-0000-0000-000000000003', 'a2aaaaaa-1000-0000-0000-000000000001', 'prime', '{"driver":"volume_price","account_code":"617","periods":[{"period_id":"a2aaaaaa-6000-0000-0000-000000000001","volume":"1","unit_price":"5000"}]}', 'MAD', 'proposed', 'a2000000-0000-0000-0000-000000000001'),
  ('a2aaaaaa-4000-0000-0000-000000000025', 'a2aaaaaa-0000-0000-0000-000000000001', 'a2aaaaaa-3000-0000-0000-000000000003', 'a2aaaaaa-1000-0000-0000-000000000001', 'unite_differente', '{"driver":"volume_price","account_code":"712","periods":[{"period_id":"a2aaaaaa-6000-0000-0000-000000000001","volume":"2","unit_price":"5"}]}', 'EUR', 'proposed', 'a2000000-0000-0000-0000-000000000001');

-- Montants publiés : v1 = 1 440 000 (712/COM) et 300 000 (617/DIR) ;
-- v2 = 1 040 000 (712/COM), 300 000 (617/DIR), et un montant NOUVEAU (617/COM).
insert into public.calculation_runs (id, tenant_id, version_id, engine_version, input_hash, status) values
  ('a2aaaaaa-7000-0000-0000-000000000001', 'a2aaaaaa-0000-0000-0000-000000000001', 'a2aaaaaa-3000-0000-0000-000000000001', '1.1.0', repeat('a', 64), 'succeeded'),
  ('a2aaaaaa-7000-0000-0000-000000000002', 'a2aaaaaa-0000-0000-0000-000000000001', 'a2aaaaaa-3000-0000-0000-000000000002', '1.1.0', repeat('b', 64), 'succeeded');

insert into public.budget_values (tenant_id, version_id, calculation_run_id, dimension_id, account_id, period_id, amount, currency) values
  ('a2aaaaaa-0000-0000-0000-000000000001', 'a2aaaaaa-3000-0000-0000-000000000001', 'a2aaaaaa-7000-0000-0000-000000000001', 'a2aaaaaa-1000-0000-0000-000000000001', 'a2aaaaaa-5000-0000-0000-000000000001', 'a2aaaaaa-6000-0000-0000-000000000001', 1440000.000000, 'MAD'),
  ('a2aaaaaa-0000-0000-0000-000000000001', 'a2aaaaaa-3000-0000-0000-000000000001', 'a2aaaaaa-7000-0000-0000-000000000001', 'a2aaaaaa-1000-0000-0000-000000000002', 'a2aaaaaa-5000-0000-0000-000000000002', 'a2aaaaaa-6000-0000-0000-000000000001', 300000.000000, 'MAD'),
  ('a2aaaaaa-0000-0000-0000-000000000001', 'a2aaaaaa-3000-0000-0000-000000000002', 'a2aaaaaa-7000-0000-0000-000000000002', 'a2aaaaaa-1000-0000-0000-000000000001', 'a2aaaaaa-5000-0000-0000-000000000001', 'a2aaaaaa-6000-0000-0000-000000000001', 1040000.000000, 'MAD'),
  ('a2aaaaaa-0000-0000-0000-000000000001', 'a2aaaaaa-3000-0000-0000-000000000002', 'a2aaaaaa-7000-0000-0000-000000000002', 'a2aaaaaa-1000-0000-0000-000000000002', 'a2aaaaaa-5000-0000-0000-000000000002', 'a2aaaaaa-6000-0000-0000-000000000001', 300000.000000, 'MAD'),
  ('a2aaaaaa-0000-0000-0000-000000000001', 'a2aaaaaa-3000-0000-0000-000000000002', 'a2aaaaaa-7000-0000-0000-000000000002', 'a2aaaaaa-1000-0000-0000-000000000001', 'a2aaaaaa-5000-0000-0000-000000000002', 'a2aaaaaa-6000-0000-0000-000000000001', 5000.000000, 'MAD');

update public.budget_versions
set status = 'published', published_at = now()
where id in ('a2aaaaaa-3000-0000-0000-000000000001', 'a2aaaaaa-3000-0000-0000-000000000002');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);

-- ---------------------------------------------------------------------------
-- Ceux qui ne voient rien : un anonyme, le DAF d'un autre tenant.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', '', true);

select throws_ok(
  $$select * from public.compare_version_hypotheses('a2aaaaaa-3000-0000-0000-000000000001', 'a2aaaaaa-3000-0000-0000-000000000002')$$,
  'P0002',
  'Version not found',
  'sans identité, aucune version n’existe'
);

select set_config('request.jwt.claim.sub', 'a2000000-0000-0000-0000-000000000003', true);

select throws_ok(
  $$select * from public.compare_version_hypotheses('a2aaaaaa-3000-0000-0000-000000000001', 'a2aaaaaa-3000-0000-0000-000000000002')$$,
  'P0002',
  'Version not found',
  'le DAF d’un autre tenant ne trouve pas les versions : « introuvable », jamais « interdit »'
);

select throws_ok(
  $$select * from public.compare_version_hypotheses('b2bbbbbb-3000-0000-0000-000000000001', 'a2aaaaaa-3000-0000-0000-000000000002')$$,
  'P0002',
  'Version not found',
  'sa propre version ne se compare pas à celle d’un autre tenant'
);

select throws_ok(
  $$select public.approve_identical_hypotheses('a2aaaaaa-3000-0000-0000-000000000001', 'a2aaaaaa-3000-0000-0000-000000000003', 'identique')$$,
  'P0002',
  'Version not found',
  'le geste refuse pareillement au DAF d’un autre tenant'
);

-- ---------------------------------------------------------------------------
-- Le contributeur : son périmètre, rien d'autre — et pas le geste.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', 'a2000000-0000-0000-0000-000000000001', true);

select results_eq(
  $$select parameter_key, outcome from public.compare_version_hypotheses('a2aaaaaa-3000-0000-0000-000000000001', 'a2aaaaaa-3000-0000-0000-000000000003') order by parameter_key$$,
  $$values ('commission', 'added'), ('jours_factures', 'identical'), ('prime', 'added'), ('unite_differente', 'changed')$$,
  'le contributeur compare SA dimension : « salaires » (Direction) n’apparaît pas, la RLS de lecture borne la comparaison'
);

select is(
  (select public.approve_identical_hypotheses('a2aaaaaa-3000-0000-0000-000000000001', 'a2aaaaaa-3000-0000-0000-000000000003', 'identique à la v1')),
  0,
  'le geste ne lui approuve rien : aucune dimension où il peut approuver'
);

select is(
  (select count(*)::int from public.hypothesis_decisions where tenant_id = 'a2aaaaaa-0000-0000-0000-000000000001'),
  0,
  'et aucune décision n’a été écrite'
);

-- ---------------------------------------------------------------------------
-- Le DAF : la comparaison entière.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', 'a2000000-0000-0000-0000-000000000002', true);

select results_eq(
  $$select parameter_key, outcome, base_status, target_status
    from public.compare_version_hypotheses('a2aaaaaa-3000-0000-0000-000000000001', 'a2aaaaaa-3000-0000-0000-000000000003') order by parameter_key$$,
  $$values ('commission', 'added', null::text, 'proposed'),
           ('jours_factures', 'identical', 'approved', 'proposed'),
           ('prime', 'added', null::text, 'proposed'),
           ('salaires', 'identical', 'approved', 'proposed'),
           ('unite_differente', 'changed', 'approved', 'proposed')$$,
  'v1 publiée ne compte que ses approuvées : « commission », proposée jamais décidée en v1, est AJOUTÉE en v3 ; « refusee » n’existe pour personne ; une unité différente est une modification'
);

select results_eq(
  $$select parameter_key, outcome from public.compare_version_hypotheses('a2aaaaaa-3000-0000-0000-000000000001', 'a2aaaaaa-3000-0000-0000-000000000002') order by parameter_key$$,
  $$values ('jours_factures', 'changed'), ('salaires', 'identical'), ('unite_differente', 'removed')$$,
  'entre deux versions publiées : modifiée, identique, retirée'
);

select is(
  (select base_value ->> 'periods' is not null and target_value ->> 'periods' is not null
   from public.compare_version_hypotheses('a2aaaaaa-3000-0000-0000-000000000001', 'a2aaaaaa-3000-0000-0000-000000000002')
   where parameter_key = 'jours_factures'),
  true,
  'une ligne modifiée rend ses deux valeurs : l’écran montre les TERMES, jamais un produit'
);

select is(
  (select count(*)::int from public.compare_version_hypotheses('a2aaaaaa-3000-0000-0000-000000000002', 'a2aaaaaa-3000-0000-0000-000000000002') where outcome <> 'identical'),
  0,
  'une version comparée à elle-même n’a aucun écart'
);

-- ---------------------------------------------------------------------------
-- Niveau 2 : les montants.
-- ---------------------------------------------------------------------------
select throws_ok(
  $$select * from public.compare_version_values('a2aaaaaa-3000-0000-0000-000000000001', 'a2aaaaaa-3000-0000-0000-000000000003')$$,
  '55000',
  'Both versions must be published',
  'un montant non publié n’existe pas : pas de comparaison de montants avec un brouillon'
);

select results_eq(
  $$select account.code, dimension.code, comparison.base_amount, comparison.target_amount, comparison.delta, comparison.delta_percent
    from public.compare_version_values('a2aaaaaa-3000-0000-0000-000000000001', 'a2aaaaaa-3000-0000-0000-000000000002') comparison
    join public.financial_accounts account on account.id = comparison.account_id
    join public.dimensions dimension on dimension.id = comparison.dimension_id
    order by dimension.code, account.code$$,
  $$values ('617', 'COM', null::numeric, 5000.000000::numeric, null::numeric, null::numeric),
           ('712', 'COM', 1440000.000000::numeric, 1040000.000000::numeric, -400000.000000::numeric, -27.8::numeric),
           ('617', 'DIR', 300000.000000::numeric, 300000.000000::numeric, 0.000000::numeric, 0.0::numeric)$$,
  'delta et variation exacts en numeric : −400 000 sur 1 440 000 fait −27,8 %, un montant nouveau n’a pas de variation'
);

-- ---------------------------------------------------------------------------
-- Le geste : approuver l'identique, une décision par ligne.
-- ---------------------------------------------------------------------------
select throws_ok(
  $$select public.approve_identical_hypotheses('a2aaaaaa-3000-0000-0000-000000000001', 'a2aaaaaa-3000-0000-0000-000000000003', '   ')$$,
  '22023',
  'A decision reason is required',
  'un motif vide est refusé avant la première ligne'
);

select throws_ok(
  $$select public.approve_identical_hypotheses('a2aaaaaa-3000-0000-0000-000000000001', 'a2aaaaaa-3000-0000-0000-000000000002', 'identique')$$,
  '55000',
  'A published version is immutable',
  'une cible publiée est refusée d’emblée'
);

select is(
  (select public.approve_identical_hypotheses('a2aaaaaa-3000-0000-0000-000000000001', 'a2aaaaaa-3000-0000-0000-000000000003', 'Identique à la version 1 approuvée')),
  2,
  'deux lignes approuvées : « jours_factures » et « salaires » — pas « commission », identique à une ligne que la v1 n’a JAMAIS approuvée ; pas « prime », nouvelle ; pas « unite_differente », modifiée'
);

select results_eq(
  $$select parameter_key, status, row_version from public.hypotheses
    where version_id = 'a2aaaaaa-3000-0000-0000-000000000003' order by parameter_key$$,
  $$values ('commission', 'proposed', 1), ('jours_factures', 'approved', 2), ('prime', 'proposed', 1), ('salaires', 'approved', 2), ('unite_differente', 'proposed', 1)$$,
  'les deux lignes sont approuvées à la révision 2, les trois autres restent des propositions à la révision 1'
);

select results_eq(
  $$select hypothesis.parameter_key, decision.decision, decision.decided_by, decision.reason
    from public.hypothesis_decisions decision
    join public.hypotheses hypothesis on hypothesis.id = decision.hypothesis_id
    where hypothesis.version_id = 'a2aaaaaa-3000-0000-0000-000000000003'
    order by hypothesis.parameter_key$$,
  $$values ('jours_factures', 'approved', 'a2000000-0000-0000-0000-000000000002'::uuid, 'Identique à la version 1 approuvée'),
           ('salaires', 'approved', 'a2000000-0000-0000-0000-000000000002'::uuid, 'Identique à la version 1 approuvée')$$,
  'une décision par ligne, au nom du DAF qui a fait le geste, avec son motif : la trace tient ligne par ligne'
);

select is(
  (select public.approve_identical_hypotheses('a2aaaaaa-3000-0000-0000-000000000001', 'a2aaaaaa-3000-0000-0000-000000000003', 'encore')),
  0,
  'rejoué, le geste n’approuve plus rien : ce qui est décidé l’est'
);

select results_eq(
  $$select parameter_key, target_status from public.compare_version_hypotheses('a2aaaaaa-3000-0000-0000-000000000001', 'a2aaaaaa-3000-0000-0000-000000000003')
    where outcome = 'identical' order by parameter_key$$,
  $$values ('jours_factures', 'approved'), ('salaires', 'approved')$$,
  'la comparaison reflète les décisions : les lignes identiques sont désormais approuvées dans la cible'
);

select is(
  (select status from public.budget_versions where id = 'a2aaaaaa-3000-0000-0000-000000000001'),
  'published',
  'la base n’a pas bougé'
);

select is(
  (select count(*)::int from public.hypotheses where version_id = 'a2aaaaaa-3000-0000-0000-000000000001' and row_version <> 1),
  0,
  'ni aucune de ses lignes'
);

select * from finish();

rollback;
