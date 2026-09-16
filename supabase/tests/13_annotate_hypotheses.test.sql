-- Celui qui construit une hypothèse dit POURQUOI, et sa note suit la ligne.
--
-- Ce que ce fichier prouve, dans l'ordre :
--   · l'auteur écrit une note en proposant, et la corrige tant que la ligne
--     est proposée — par la même politique que sa valeur ;
--   · une note vide ou trop longue est refusée par la colonne, pas par l'écran ;
--   · une fois la ligne décidée, la note est figée comme le reste ;
--   · un tiers du tenant qui ne lit pas la dimension ne voit ni la ligne ni
--     sa note ; le DAF la lit ;
--   · la reprise (`open_budget_version`) recopie la note avec la ligne.

begin;

create extension if not exists pgtap with schema extensions;

select plan(12);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin
) values
  ('d3000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'contributeur-note@tarjih.test', '', now(), now(), now(), '{}', '{}', false),
  ('d3000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'daf-note@tarjih.test', '', now(), now(), now(), '{}', '{}', false),
  ('d3000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tiers-note@tarjih.test', '', now(), now(), now(), '{}', '{}', false);

insert into public.tenants (id, name, base_currency) values
  ('d3dddddd-0000-0000-0000-000000000001', 'Tenant D3', 'MAD');

insert into public.tenant_memberships (tenant_id, user_id, role, is_tenant_admin) values
  ('d3dddddd-0000-0000-0000-000000000001', 'd3000000-0000-0000-0000-000000000001', 'contributor', false),
  ('d3dddddd-0000-0000-0000-000000000001', 'd3000000-0000-0000-0000-000000000002', 'daf', false),
  ('d3dddddd-0000-0000-0000-000000000001', 'd3000000-0000-0000-0000-000000000003', 'contributor', false);

insert into public.dimensions (id, tenant_id, kind, code, name) values
  ('d3dddddd-1000-0000-0000-000000000001', 'd3dddddd-0000-0000-0000-000000000001', 'department', 'CONS', 'Conseil');

-- Seul le premier contributeur tient la dimension ; le tiers n'y lit rien.
insert into public.dimension_grants (tenant_id, user_id, dimension_id, can_read, can_contribute) values
  ('d3dddddd-0000-0000-0000-000000000001', 'd3000000-0000-0000-0000-000000000001', 'd3dddddd-1000-0000-0000-000000000001', true, true);

insert into public.budget_cycles (id, tenant_id, name) values
  ('d3dddddd-2000-0000-0000-000000000001', 'd3dddddd-0000-0000-0000-000000000001', 'Budget 2030');

insert into public.budget_versions (id, tenant_id, cycle_id, version_no, calculation_model) values
  ('d3dddddd-3000-0000-0000-000000000001', 'd3dddddd-0000-0000-0000-000000000001', 'd3dddddd-2000-0000-0000-000000000001', 1, 'driver');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);

-- ---------------------------------------------------------------------------
-- L'auteur : il écrit sa note en proposant, et la corrige.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', 'd3000000-0000-0000-0000-000000000001', true);

select lives_ok(
  $$insert into public.hypotheses (id, tenant_id, version_id, dimension_id, parameter_key, value, unit, proposed_by, note)
    values ('d3dddddd-4000-0000-0000-000000000001', 'd3dddddd-0000-0000-0000-000000000001', 'd3dddddd-3000-0000-0000-000000000001', 'd3dddddd-1000-0000-0000-000000000001', 'jours_factures', '{"type":"driver","driver":"volume_price","account_code":"712","period_ids":["p1"],"volume":"320","unit_price":"4500"}', 'MAD', 'd3000000-0000-0000-0000-000000000001', '16 consultants × 20 jours, hors intercontrat')$$,
  'le contributeur propose une hypothèse avec sa justification'
);

select lives_ok(
  $$insert into public.hypotheses (id, tenant_id, version_id, dimension_id, parameter_key, value, unit, proposed_by)
    values ('d3dddddd-4000-0000-0000-000000000002', 'd3dddddd-0000-0000-0000-000000000001', 'd3dddddd-3000-0000-0000-000000000001', 'd3dddddd-1000-0000-0000-000000000001', 'sans_note', '{"type":"driver","driver":"volume_price","account_code":"712","period_ids":["p1"],"volume":"1","unit_price":"1"}', 'MAD', 'd3000000-0000-0000-0000-000000000001')$$,
  'la note est facultative : une hypothèse sans note se propose comme avant'
);

select throws_ok(
  $$insert into public.hypotheses (tenant_id, version_id, dimension_id, parameter_key, value, unit, proposed_by, note)
    values ('d3dddddd-0000-0000-0000-000000000001', 'd3dddddd-3000-0000-0000-000000000001', 'd3dddddd-1000-0000-0000-000000000001', 'note_vide', '{"type":"driver","driver":"volume_price","account_code":"712","period_ids":["p1"],"volume":"1","unit_price":"1"}', 'MAD', 'd3000000-0000-0000-0000-000000000001', '   ')$$,
  '23514',
  'new row for relation "hypotheses" violates check constraint "hypotheses_note_length"',
  'une note faite d’espaces est refusée : une absence se dit null, pas blanc'
);

select throws_ok(
  $$insert into public.hypotheses (tenant_id, version_id, dimension_id, parameter_key, value, unit, proposed_by, note)
    values ('d3dddddd-0000-0000-0000-000000000001', 'd3dddddd-3000-0000-0000-000000000001', 'd3dddddd-1000-0000-0000-000000000001', 'note_longue', '{"type":"driver","driver":"volume_price","account_code":"712","period_ids":["p1"],"volume":"1","unit_price":"1"}', 'MAD', 'd3000000-0000-0000-0000-000000000001', repeat('x', 2001))$$,
  '23514',
  'new row for relation "hypotheses" violates check constraint "hypotheses_note_length"',
  'une note de plus de 2 000 caractères est refusée par la colonne'
);

select lives_ok(
  $$update public.hypotheses set note = '16 consultants × 20 jours, hors intercontrat et hors formation', row_version = 2
    where id = 'd3dddddd-4000-0000-0000-000000000001' and row_version = 1$$,
  'l’auteur corrige sa note tant que la ligne est proposée, en succédant au numéro lu'
);

select is(
  (select note || ' / ' || row_version::text from public.hypotheses where id = 'd3dddddd-4000-0000-0000-000000000001'),
  '16 consultants × 20 jours, hors intercontrat et hors formation / 2',
  'la note corrigée est inscrite et la révision a avancé'
);

-- ---------------------------------------------------------------------------
-- Le tiers du tenant : il ne lit pas la dimension, il ne voit pas la note.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', 'd3000000-0000-0000-0000-000000000003', true);

select is(
  (select count(*)::int from public.hypotheses where note is not null),
  0,
  'sans droit de lecture sur la dimension, aucune note n’est visible'
);

-- ---------------------------------------------------------------------------
-- Le DAF : il lit la note, décide, et la note est alors figée.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', 'd3000000-0000-0000-0000-000000000002', true);

select is(
  (select note from public.hypotheses where id = 'd3dddddd-4000-0000-0000-000000000001'),
  '16 consultants × 20 jours, hors intercontrat et hors formation',
  'le DAF lit la justification de l’auteur avant de décider'
);

select lives_ok(
  $$select public.decide_hypothesis('d3dddddd-4000-0000-0000-000000000001', 2, 'approved', 'Justifié par la note du contributeur.')$$,
  'le DAF approuve la ligne annotée'
);

select set_config('request.jwt.claim.sub', 'd3000000-0000-0000-0000-000000000001', true);

-- La politique `hypotheses_update_contributor` ne voit que le proposé : la
-- mise à jour ne touche aucune ligne, sans erreur, et la note reste.
update public.hypotheses set note = 'après coup', row_version = 4
where id = 'd3dddddd-4000-0000-0000-000000000001' and row_version = 3;

select is(
  (select note || ' / ' || row_version::text from public.hypotheses where id = 'd3dddddd-4000-0000-0000-000000000001'),
  '16 consultants × 20 jours, hors intercontrat et hors formation / 3',
  'une fois la ligne décidée, l’auteur ne retouche plus sa note : la politique d’écriture ne s’applique qu’au proposé'
);

-- ---------------------------------------------------------------------------
-- La reprise recopie la note avec la ligne.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', 'd3000000-0000-0000-0000-000000000002', true);

create temporary table opened as
select public.open_budget_version('d3dddddd-2000-0000-0000-000000000001', 'driver', 'd3dddddd-3000-0000-0000-000000000001') as id;

select results_eq(
  $$select parameter_key, note from public.hypotheses where version_id = (select id from opened) order by parameter_key$$,
  $$select parameter_key, note from public.hypotheses where version_id = 'd3dddddd-3000-0000-0000-000000000001' order by parameter_key$$,
  'la version reprise porte les mêmes notes que sa source, ligne à ligne'
);

select is(
  (select note from public.hypotheses where version_id = (select id from opened) and parameter_key = 'sans_note'),
  null,
  'une ligne reprise sans note reste sans note'
);

select * from finish();

rollback;
