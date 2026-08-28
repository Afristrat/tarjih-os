begin;

create extension if not exists pgtap with schema extensions;

select plan(21);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin
) values
  ('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'contributeur-gouv@tarjih.test', '', now(), now(), now(), '{}', '{}', false),
  ('50000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'daf-gouv@tarjih.test', '', now(), now(), now(), '{}', '{}', false),
  ('50000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'daf-gouv-b@tarjih.test', '', now(), now(), now(), '{}', '{}', false);

insert into public.tenants (id, name, base_currency) values
  ('a5aaaaaa-0000-0000-0000-000000000001', 'Tenant A', 'MAD'),
  ('b5bbbbbb-0000-0000-0000-000000000001', 'Tenant B', 'EUR');

insert into public.tenant_memberships (tenant_id, user_id, role, is_tenant_admin) values
  ('a5aaaaaa-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'contributor', false),
  ('a5aaaaaa-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000002', 'daf', false),
  ('b5bbbbbb-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000003', 'daf', false);

insert into public.dimensions (id, tenant_id, kind, code, name) values
  ('a5aaaaaa-1000-0000-0000-000000000001', 'a5aaaaaa-0000-0000-0000-000000000001', 'department', 'MKT', 'Marketing'),
  ('a5aaaaaa-1000-0000-0000-000000000002', 'a5aaaaaa-0000-0000-0000-000000000001', 'department', 'OPS', 'Opérations'),
  ('b5bbbbbb-1000-0000-0000-000000000001', 'b5bbbbbb-0000-0000-0000-000000000001', 'department', 'FIN', 'Finance');

-- Le contributeur ne tient que Marketing, et rien sur Opérations.
insert into public.dimension_grants (tenant_id, user_id, dimension_id, can_read, can_contribute) values
  ('a5aaaaaa-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'a5aaaaaa-1000-0000-0000-000000000001', true, true);

insert into public.budget_cycles (id, tenant_id, name) values
  ('a5aaaaaa-2000-0000-0000-000000000001', 'a5aaaaaa-0000-0000-0000-000000000001', 'Budget 2027'),
  ('b5bbbbbb-2000-0000-0000-000000000001', 'b5bbbbbb-0000-0000-0000-000000000001', 'Budget 2027');

insert into public.budget_versions (id, tenant_id, cycle_id, version_no) values
  ('a5aaaaaa-3000-0000-0000-000000000001', 'a5aaaaaa-0000-0000-0000-000000000001', 'a5aaaaaa-2000-0000-0000-000000000001', 1),
  ('a5aaaaaa-3000-0000-0000-000000000002', 'a5aaaaaa-0000-0000-0000-000000000001', 'a5aaaaaa-2000-0000-0000-000000000001', 2),
  ('a5aaaaaa-3000-0000-0000-000000000003', 'a5aaaaaa-0000-0000-0000-000000000001', 'a5aaaaaa-2000-0000-0000-000000000001', 3),
  ('b5bbbbbb-3000-0000-0000-000000000001', 'b5bbbbbb-0000-0000-0000-000000000001', 'b5bbbbbb-2000-0000-0000-000000000001', 1);

insert into public.hypotheses (id, tenant_id, version_id, dimension_id, parameter_key, value, unit, proposed_by) values
  ('a5aaaaaa-4000-0000-0000-000000000001', 'a5aaaaaa-0000-0000-0000-000000000001', 'a5aaaaaa-3000-0000-0000-000000000001', 'a5aaaaaa-1000-0000-0000-000000000001', 'croissance_marketing', '{"type":"decimal","value":"0.08"}', 'ratio', '50000000-0000-0000-0000-000000000001'),
  ('a5aaaaaa-4000-0000-0000-000000000003', 'a5aaaaaa-0000-0000-0000-000000000001', 'a5aaaaaa-3000-0000-0000-000000000001', 'a5aaaaaa-1000-0000-0000-000000000001', 'budget_campagnes', '{"type":"decimal","value":"0.09"}', 'ratio', '50000000-0000-0000-0000-000000000001'),
  ('a5aaaaaa-4000-0000-0000-000000000002', 'a5aaaaaa-0000-0000-0000-000000000001', 'a5aaaaaa-3000-0000-0000-000000000002', 'a5aaaaaa-1000-0000-0000-000000000001', 'gele_par_publication', '{"type":"decimal","value":"0.04"}', 'ratio', '50000000-0000-0000-0000-000000000001'),
  ('b5bbbbbb-4000-0000-0000-000000000001', 'b5bbbbbb-0000-0000-0000-000000000001', 'b5bbbbbb-3000-0000-0000-000000000001', 'b5bbbbbb-1000-0000-0000-000000000001', 'croissance_finance', '{"type":"decimal","value":"0.03"}', 'ratio', '50000000-0000-0000-0000-000000000003');

-- La version 2 est publiée APRÈS avoir reçu son hypothèse : c'est bien la
-- publication qui la gèle, et le gel est ce que les contrôles vont éprouver.
update public.budget_versions
set status = 'published', published_at = now()
where id = 'a5aaaaaa-3000-0000-0000-000000000002';

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);

-- ---------------------------------------------------------------------------
-- Le contributeur : il propose dans son périmètre, corrige sa propre
-- proposition, et ne décide rien.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', '50000000-0000-0000-0000-000000000001', true);

select lives_ok(
  $$insert into public.hypotheses (id, tenant_id, version_id, dimension_id, parameter_key, value, unit, proposed_by) values ('a5aaaaaa-4000-0000-0000-000000000010', 'a5aaaaaa-0000-0000-0000-000000000001', 'a5aaaaaa-3000-0000-0000-000000000001', 'a5aaaaaa-1000-0000-0000-000000000001', 'cout_acquisition', '{"type":"decimal","value":"120.50"}', 'MAD', '50000000-0000-0000-0000-000000000001')$$,
  'le contributeur propose dans une dimension qui lui est attribuée'
);

select throws_ok(
  $$insert into public.hypotheses (tenant_id, version_id, dimension_id, parameter_key, value, unit, proposed_by) values ('a5aaaaaa-0000-0000-0000-000000000001', 'a5aaaaaa-3000-0000-0000-000000000001', 'a5aaaaaa-1000-0000-0000-000000000002', 'hors_perimetre', '{"type":"decimal","value":"1"}', 'ratio', '50000000-0000-0000-0000-000000000001')$$,
  '42501',
  'new row violates row-level security policy for table "hypotheses"',
  'le contributeur ne propose rien dans une dimension qu’il ne tient pas'
);

-- Le chemin que le déclencheur rendait praticable ou impraticable : une
-- correction qui succède explicitement au numéro qu'elle a lu.
select lives_ok(
  $$update public.hypotheses set value = '{"type":"decimal","value":"0.11"}', row_version = 2 where id = 'a5aaaaaa-4000-0000-0000-000000000001' and row_version = 1$$,
  'le contributeur corrige sa propre hypothèse en succédant au numéro qu’il a lu'
);

select is(
  (select value->>'value' || ' / ' || row_version::text from public.hypotheses where id = 'a5aaaaaa-4000-0000-0000-000000000001'),
  '0.11 / 2',
  'la correction est bien inscrite et le numéro de révision a avancé d’exactement un'
);

select throws_ok(
  $$update public.hypotheses set value = '{"type":"decimal","value":"0.99"}' where id = 'a5aaaaaa-4000-0000-0000-000000000001'$$,
  '40001',
  'row_version must increase exactly once',
  'une écriture qui ne succède à rien est refusée avant d’écraser quoi que ce soit'
);

select throws_ok(
  $$insert into public.hypotheses (tenant_id, version_id, dimension_id, parameter_key, value, unit, proposed_by) values ('a5aaaaaa-0000-0000-0000-000000000001', 'a5aaaaaa-3000-0000-0000-000000000002', 'a5aaaaaa-1000-0000-0000-000000000001', 'ajout_apres_publication', '{"type":"decimal","value":"1"}', 'ratio', '50000000-0000-0000-0000-000000000001')$$,
  '55000',
  'A published version is immutable',
  'une version publiée n’accepte plus une hypothèse de plus'
);

select throws_ok(
  $$update public.hypotheses set value = '{"type":"decimal","value":"0.99"}', row_version = 2 where id = 'a5aaaaaa-4000-0000-0000-000000000002' and row_version = 1$$,
  '55000',
  'A published version is immutable',
  'une hypothèse d’une version publiée ne se corrige plus'
);

select throws_ok(
  $$select public.decide_hypothesis('a5aaaaaa-4000-0000-0000-000000000001', 2, 'approved', 'Je m’auto-approuve.')$$,
  'P0002',
  'Hypothesis not found',
  'proposer n’emporte pas décider : sans droit d’approbation, la ligne est introuvable'
);

-- ---------------------------------------------------------------------------
-- Le DAF : il décide, motive, et ne peut ni se répéter ni écraser.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', '50000000-0000-0000-0000-000000000002', true);

select lives_ok(
  $$select public.decide_hypothesis('a5aaaaaa-4000-0000-0000-000000000001', 2, 'approved', 'Cohérent avec le plan commercial.')$$,
  'le DAF approuve une hypothèse de son périmètre'
);

select is(
  (select status from public.hypotheses where id = 'a5aaaaaa-4000-0000-0000-000000000001'),
  'approved',
  'la décision a changé l’état de l’hypothèse'
);

select is(
  (select decision || ' — ' || reason from public.hypothesis_decisions where hypothesis_id = 'a5aaaaaa-4000-0000-0000-000000000001'),
  'approved — Cohérent avec le plan commercial.',
  'la décision est inscrite une seule fois, avec son motif'
);

-- La décision est prise dans sa propre instruction : logée dans le `where` de
-- la requête qui la vérifie, elle s'exécuterait bien, mais la lecture porterait
-- sur l'instantané pris avant elle et rendrait la valeur d'avant.
select public.decide_hypothesis(
  'a5aaaaaa-4000-0000-0000-000000000003', 1, 'approved',
  'Valeur ramenée au réalisé.', '{"type":"decimal","value":"0.05"}'
);

select is(
  (select value->>'value' || ' / ' || status from public.hypotheses where id = 'a5aaaaaa-4000-0000-0000-000000000003'),
  '0.05 / approved',
  'approuver en modifiant remplace la valeur proposée'
);

select throws_ok(
  $$select public.decide_hypothesis('a5aaaaaa-4000-0000-0000-000000000010', 99, 'approved', 'Décision sur une lecture périmée.')$$,
  '40001',
  'The hypothesis was changed by another user',
  'une décision fondée sur une lecture périmée est refusée'
);

select throws_ok(
  $$select public.decide_hypothesis('a5aaaaaa-4000-0000-0000-000000000001', 3, 'rejected', 'Je change d’avis.')$$,
  '55000',
  'The hypothesis has already been decided',
  'une décision ne se reprend pas : elle se succède dans une version suivante'
);

select throws_ok(
  $$select public.decide_hypothesis('a5aaaaaa-4000-0000-0000-000000000010', 1, 'approved', '   ')$$,
  '22023',
  'A decision reason is required',
  'aucune décision sans motif'
);

select throws_ok(
  $$select public.decide_hypothesis('b5bbbbbb-4000-0000-0000-000000000001', 1, 'approved', 'Tentative inter-tenant.')$$,
  'P0002',
  'Hypothesis not found',
  'une hypothèse d’un autre tenant est introuvable, pas « interdite » : l’erreur ne révèle pas son existence'
);

select throws_ok(
  $$update public.budget_versions set status = 'superseded' where id = 'a5aaaaaa-3000-0000-0000-000000000002'$$,
  '55000',
  'A published version is immutable',
  'une version publiée ne change plus d’état'
);

-- ---------------------------------------------------------------------------
-- Sans RLS, au plus haut privilège : ce que les déclencheurs refusent même à
-- un chemin qui contournerait les politiques.
-- ---------------------------------------------------------------------------
reset role;

select throws_ok(
  $$update public.hypothesis_decisions set reason = 'Motif réécrit après coup.' where hypothesis_id = 'a5aaaaaa-4000-0000-0000-000000000001'$$,
  '55000',
  'hypothesis_decisions is append-only',
  'une décision ne se réécrit pas, même hors RLS'
);

select throws_ok(
  $$delete from public.hypothesis_decisions where hypothesis_id = 'a5aaaaaa-4000-0000-0000-000000000001'$$,
  '55000',
  'hypothesis_decisions is append-only',
  'une décision ne s’efface pas, même hors RLS'
);

select throws_ok(
  $$update public.hypotheses set version_id = 'a5aaaaaa-3000-0000-0000-000000000003', row_version = row_version + 1 where id = 'a5aaaaaa-4000-0000-0000-000000000010'$$,
  '55000',
  'The hypothesis scope is immutable',
  'une hypothèse ne change pas de version en cours de route, même hors RLS'
);

select throws_ok(
  $$delete from public.hypotheses where id = 'a5aaaaaa-4000-0000-0000-000000000002'$$,
  '55000',
  'A published version is immutable',
  'une hypothèse d’une version publiée ne se supprime pas, même hors RLS'
);

select * from finish();
rollback;
