begin;

create extension if not exists pgtap with schema extensions;

select plan(17);

-- ---------------------------------------------------------------------------
-- Jeu d'essai. Deux tenants, pour que l'isolation soit vérifiable ; un
-- contributeur sans droit de lecture sur la dimension, pour que le partage du
-- droit avec le montant expliqué soit vérifiable aussi.
-- ---------------------------------------------------------------------------
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin
) values
  ('70000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'daf-sources@tarjih.test', '', now(), now(), now(), '{}', '{}', false),
  ('70000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'contrib-sources@tarjih.test', '', now(), now(), now(), '{}', '{}', false),
  ('70000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'daf-autre-tenant@tarjih.test', '', now(), now(), now(), '{}', '{}', false);

insert into public.tenants (id, name, base_currency) values
  ('e7eeeeee-0000-0000-0000-000000000001', 'Tenant E', 'MAD'),
  ('f7ffffff-0000-0000-0000-000000000001', 'Tenant F', 'MAD');

insert into public.tenant_memberships (tenant_id, user_id, role, is_tenant_admin) values
  ('e7eeeeee-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'daf', false),
  ('e7eeeeee-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000002', 'contributor', false),
  ('f7ffffff-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000003', 'daf', false);

insert into public.dimensions (id, tenant_id, kind, code, name) values
  ('e7eeeeee-1000-0000-0000-000000000001', 'e7eeeeee-0000-0000-0000-000000000001', 'department', 'RD', 'Recherche');

insert into public.financial_accounts (id, tenant_id, code, name, statement, normal_balance) values
  ('e7eeeeee-5000-0000-0000-000000000001', 'e7eeeeee-0000-0000-0000-000000000001', '61', 'Charges externes', 'income_statement', 'debit');

insert into public.periods (id, tenant_id, starts_on, ends_on) values
  ('e7eeeeee-6000-0000-0000-000000000001', 'e7eeeeee-0000-0000-0000-000000000001', '2028-01-01', '2028-03-31');

insert into public.budget_cycles (id, tenant_id, name) values
  ('e7eeeeee-2000-0000-0000-000000000001', 'e7eeeeee-0000-0000-0000-000000000001', 'Budget 2028');

-- Version 1 : celle qu'on publie. Version 2 : celle dont une hypothèse servira
-- à prouver qu'une part ne peut pas citer l'hypothèse d'une autre version.
insert into public.budget_versions (id, tenant_id, cycle_id, version_no) values
  ('e7eeeeee-3000-0000-0000-000000000001', 'e7eeeeee-0000-0000-0000-000000000001', 'e7eeeeee-2000-0000-0000-000000000001', 1),
  ('e7eeeeee-3000-0000-0000-000000000002', 'e7eeeeee-0000-0000-0000-000000000001', 'e7eeeeee-2000-0000-0000-000000000001', 2);

insert into public.hypotheses (id, tenant_id, version_id, dimension_id, parameter_key, value, unit, status, proposed_by) values
  ('e7eeeeee-4000-0000-0000-000000000001', 'e7eeeeee-0000-0000-0000-000000000001', 'e7eeeeee-3000-0000-0000-000000000001', 'e7eeeeee-1000-0000-0000-000000000001', 'charges.loyer', '{}'::jsonb, 'MAD', 'approved', '70000000-0000-0000-0000-000000000002'),
  ('e7eeeeee-4000-0000-0000-000000000002', 'e7eeeeee-0000-0000-0000-000000000001', 'e7eeeeee-3000-0000-0000-000000000001', 'e7eeeeee-1000-0000-0000-000000000001', 'charges.energie', '{}'::jsonb, 'MAD', 'approved', '70000000-0000-0000-0000-000000000002'),
  ('e7eeeeee-4000-0000-0000-000000000003', 'e7eeeeee-0000-0000-0000-000000000001', 'e7eeeeee-3000-0000-0000-000000000002', 'e7eeeeee-1000-0000-0000-000000000001', 'charges.autre', '{}'::jsonb, 'MAD', 'approved', '70000000-0000-0000-0000-000000000002');

-- ---------------------------------------------------------------------------
-- Forme du schéma.
-- ---------------------------------------------------------------------------

select has_table(
  'public', 'budget_value_sources',
  'la part d’une hypothèse dans un montant a sa table'
);

select col_type_is(
  'public', 'budget_value_sources', 'amount', 'numeric',
  'une part est un numeric SANS échelle imposée : elle reste exacte là où le montant publié est arrondi'
);

select col_is_unique(
  'public', 'budget_value_sources', array['tenant_id', 'budget_value_id', 'hypothesis_id'],
  'une hypothèse n’explique un montant qu’une fois'
);

select col_is_unique(
  'public', 'budget_values', array['tenant_id', 'id'],
  'un montant est référençable sans perdre son tenant en route'
);

select hasnt_function(
  'public', 'publish_calculation',
  array['uuid', 'text', 'text', 'text', 'jsonb'],
  'le chemin de publication SANS traçabilité n’existe plus'
);

-- ---------------------------------------------------------------------------
-- Publication : les montants et leurs parts, ensemble.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', '70000000-0000-0000-0000-000000000001', true);

select lives_ok(
  $$select public.publish_calculation(
      'e7eeeeee-3000-0000-0000-000000000001',
      '1.0.0',
      repeat('1', 64),
      repeat('2', 64),
      '[{"dimension_id":"e7eeeeee-1000-0000-0000-000000000001","account_id":"e7eeeeee-5000-0000-0000-000000000001","period_id":"e7eeeeee-6000-0000-0000-000000000001","amount":"25.925925","currency":"MAD"}]'::jsonb,
      '[{"dimension_id":"e7eeeeee-1000-0000-0000-000000000001","account_id":"e7eeeeee-5000-0000-0000-000000000001","period_id":"e7eeeeee-6000-0000-0000-000000000001","hypothesis_id":"e7eeeeee-4000-0000-0000-000000000001","amount":"25.92592540740741"},
        {"dimension_id":"e7eeeeee-1000-0000-0000-000000000001","account_id":"e7eeeeee-5000-0000-0000-000000000001","period_id":"e7eeeeee-6000-0000-0000-000000000001","hypothesis_id":"e7eeeeee-4000-0000-0000-000000000002","amount":"0"}]'::jsonb
    )$$,
  'un DAF publie un montant et l’origine de ce montant dans la même transaction'
);

select is(
  (select count(*)::integer from public.budget_value_sources
    where tenant_id = 'e7eeeeee-0000-0000-0000-000000000001'),
  2,
  'les deux hypothèses qui ont produit le montant sont écrites'
);

select is(
  (select amount::text from public.budget_value_sources
    where hypothesis_id = 'e7eeeeee-4000-0000-0000-000000000001'),
  '25.92592540740741',
  'une part garde ses décimales là où le montant publié, lui, est arrondi à six'
);

-- La question à laquelle la task 07 devait répondre, posée telle qu'un écran la
-- posera : d'où vient ce chiffre ?
select is(
  (select string_agg(hypothesis.parameter_key, ', ' order by hypothesis.parameter_key)
     from public.budget_values value
     join public.budget_value_sources source on source.budget_value_id = value.id
     join public.hypotheses hypothesis on hypothesis.id = source.hypothesis_id
    where value.version_id = 'e7eeeeee-3000-0000-0000-000000000001'),
  'charges.energie, charges.loyer',
  'depuis un montant publié on remonte aux hypothèses de CE montant'
);

-- ---------------------------------------------------------------------------
-- Immuabilité : l’origine d’un chiffre ne se réécrit pas.
-- ---------------------------------------------------------------------------

select throws_ok(
  $$update public.budget_value_sources set amount = 1
    where hypothesis_id = 'e7eeeeee-4000-0000-0000-000000000001'$$,
  '55000',
  'A published amount source is immutable',
  'une part ne se modifie pas'
);

select throws_ok(
  $$delete from public.budget_value_sources
    where hypothesis_id = 'e7eeeeee-4000-0000-0000-000000000001'$$,
  '55000',
  'A published amount source is immutable',
  'une part ne se supprime pas'
);

-- ---------------------------------------------------------------------------
-- Ce que la publication refuse.
-- ---------------------------------------------------------------------------

select throws_ok(
  $$select public.publish_calculation(
      'e7eeeeee-3000-0000-0000-000000000002',
      '1.0.0',
      repeat('3', 64),
      repeat('4', 64),
      '[{"dimension_id":"e7eeeeee-1000-0000-0000-000000000001","account_id":"e7eeeeee-5000-0000-0000-000000000001","period_id":"e7eeeeee-6000-0000-0000-000000000001","amount":"10.000000","currency":"MAD"}]'::jsonb,
      '[]'::jsonb
    )$$,
  '22023',
  'A published value carries at least one source',
  'un montant ne se publie pas sans origine'
);

-- Une part dont le triplet n’a pas été publié ne trouve aucune jointure : elle
-- doit faire échouer la publication, pas disparaître.
select throws_ok(
  $$select public.publish_calculation(
      'e7eeeeee-3000-0000-0000-000000000002',
      '1.0.0',
      repeat('5', 64),
      repeat('6', 64),
      '[{"dimension_id":"e7eeeeee-1000-0000-0000-000000000001","account_id":"e7eeeeee-5000-0000-0000-000000000001","period_id":"e7eeeeee-6000-0000-0000-000000000001","amount":"10.000000","currency":"MAD"}]'::jsonb,
      '[{"dimension_id":"e7eeeeee-1000-0000-0000-000000000001","account_id":"e7eeeeee-5000-0000-0000-000000000001","period_id":"e7eeeeee-6000-0000-0000-000000000001","hypothesis_id":"e7eeeeee-4000-0000-0000-000000000003","amount":"10"},
        {"dimension_id":"e7eeeeee-1000-0000-0000-000000000001","account_id":"e7eeeeee-5000-0000-0000-000000000001","period_id":"11111111-1111-4111-8111-111111111111","hypothesis_id":"e7eeeeee-4000-0000-0000-000000000003","amount":"5"}]'::jsonb
    )$$,
  '55000',
  'Attached 1 sources for 2 submitted',
  'une part qui ne se rattache à aucun montant publié fait échouer la publication'
);

-- Une part citant l’hypothèse d’une AUTRE version raconterait une origine fausse.
select throws_ok(
  $$select public.publish_calculation(
      'e7eeeeee-3000-0000-0000-000000000002',
      '1.0.0',
      repeat('7', 64),
      repeat('8', 64),
      '[{"dimension_id":"e7eeeeee-1000-0000-0000-000000000001","account_id":"e7eeeeee-5000-0000-0000-000000000001","period_id":"e7eeeeee-6000-0000-0000-000000000001","amount":"10.000000","currency":"MAD"}]'::jsonb,
      '[{"dimension_id":"e7eeeeee-1000-0000-0000-000000000001","account_id":"e7eeeeee-5000-0000-0000-000000000001","period_id":"e7eeeeee-6000-0000-0000-000000000001","hypothesis_id":"e7eeeeee-4000-0000-0000-000000000001","amount":"10"}]'::jsonb
    )$$,
  '55000',
  'A source cites an hypothesis of another version',
  'une part ne cite pas l’hypothèse d’une autre version'
);

select is(
  (select status from public.budget_versions where id = 'e7eeeeee-3000-0000-0000-000000000002'),
  'draft',
  'aucun de ces refus n’a publié la version au passage'
);

-- ---------------------------------------------------------------------------
-- Lecture : exactement le droit du montant expliqué.
-- ---------------------------------------------------------------------------

-- Le rôle applicatif, et pas `postgres` : une RLS ne s'applique pas à un
-- superutilisateur, et un contrôle d'isolation joué en superutilisateur passe
-- toujours — il ne prouverait rien.
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '70000000-0000-0000-0000-000000000003', true);

select is(
  (select count(*)::integer from public.budget_value_sources),
  0,
  'le DAF d’un autre tenant ne voit aucune part'
);

select set_config('request.jwt.claim.sub', '70000000-0000-0000-0000-000000000002', true);

select is(
  (select count(*)::integer from public.budget_value_sources),
  0,
  'un contributeur sans droit de lecture sur la dimension ne voit pas l’origine des chiffres'
);

select * from finish();
rollback;
