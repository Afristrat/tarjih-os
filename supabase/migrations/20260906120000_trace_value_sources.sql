-- Task 07, critère 5 — d'où vient ce chiffre.
--
-- `budget_values` portait le run et la version. Depuis un montant publié on
-- remontait donc à TOUTES les hypothèses approuvées de sa version, jamais à
-- celles de ce montant-là. Sur une version qui en porte des dizaines, cela ne
-- répond pas à la question que pose un DAF devant un chiffre.
--
-- Le moteur calculait déjà l'information (`resolvers.Contribution.hypothesis_id`)
-- et l'abandonnait à l'agrégation. Elle est désormais transportée jusqu'ici.
--
-- Trois choses, et rien de plus :
--   1. la table des parts ;
--   2. son immuabilité, alignée sur celle des montants qu'elle explique ;
--   3. la publication, qui écrit les deux ensemble ou rien.

-- ---------------------------------------------------------------------------
-- 0. De quoi référencer un montant.
--
-- `budget_values` n'exposait pas de clé (tenant_id, id) : sans elle, aucune
-- table ne peut pointer un montant sans perdre le tenant en route, et une clé
-- étrangère qui laisse traverser la frontière d'un tenant n'en est pas une.
-- La contrainte ne peut rien refuser d'existant — `id` est déjà unique.
-- ---------------------------------------------------------------------------
alter table public.budget_values
  add constraint budget_values_tenant_id_key unique (tenant_id, id);

-- ---------------------------------------------------------------------------
-- 1. La part d'une hypothèse dans un montant.
--
-- `amount` est un `numeric` SANS échelle imposée, à la différence de
-- `budget_values.amount` qui est un `numeric(24, 6)`. Ce n'est pas un oubli :
-- une part est une valeur de calcul exacte — un produit volume × prix en porte
-- couramment plus de six décimales — et c'est son arrondi, une fois les parts
-- sommées, qui donne le montant publié. Arrondir chaque part ferait une somme
-- de parts différente du total qu'elles prétendent expliquer, précisément ce
-- que cette table existe pour éviter.
--
-- La dimension, le compte et la période ne sont pas répétés ici : ils
-- appartiennent au montant, et les dupliquer ouvrirait la possibilité qu'ils
-- divergent de lui.
--
-- Pas de trigger d'audit : une part est insérée dans la transaction qui publie
-- le montant, lequel est audité. Un second événement pour la même écriture
-- n'ajouterait rien à ce qu'on peut déjà reconstituer.
-- ---------------------------------------------------------------------------
create table public.budget_value_sources (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  budget_value_id uuid not null,
  hypothesis_id uuid not null,
  amount numeric not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, budget_value_id, hypothesis_id),
  -- Pas de `on delete cascade` : un montant publié ne se supprime pas, et si un
  -- chemin tentait de le faire, la clé étrangère doit s'y opposer plutôt que
  -- d'emporter silencieusement la trace de son origine.
  foreign key (tenant_id, budget_value_id) references public.budget_values(tenant_id, id),
  foreign key (tenant_id, hypothesis_id) references public.hypotheses(tenant_id, id)
);

comment on table public.budget_value_sources is
  'Part exacte de chaque hypothèse dans chaque montant publié. L''arrondi de la'
  ' somme des parts d''un montant égale ce montant : le moteur le garantit'
  ' (identity_sources) et la publication le vérifie.';

create index budget_value_sources_value_idx
  on public.budget_value_sources(tenant_id, budget_value_id);
create index budget_value_sources_hypothesis_idx
  on public.budget_value_sources(tenant_id, hypothesis_id);

-- ---------------------------------------------------------------------------
-- 2. Lecture : exactement le droit du montant expliqué.
--
-- Le prédicat de `budget_values_select_scope` est repris tel quel, à travers le
-- montant. Une part n'est ni plus ni moins sensible que le chiffre dont elle dit
-- l'origine : lui donner sa propre règle finirait par les faire diverger.
-- ---------------------------------------------------------------------------
alter table public.budget_value_sources enable row level security;

create policy budget_value_sources_select_scope on public.budget_value_sources
for select to authenticated
using (exists (
  select 1
  from public.budget_values value
  where value.id = budget_value_sources.budget_value_id
    and value.tenant_id = budget_value_sources.tenant_id
    and (select private.has_dimension_permission(value.tenant_id, value.dimension_id, 'read'))
));

-- Aucune écriture directe : la seule voie est `publish_calculation`, qui écrit
-- les montants et leurs parts dans la même transaction.
grant select on public.budget_value_sources to authenticated;
revoke insert, update, delete on public.budget_value_sources from authenticated;
revoke all on public.budget_value_sources from anon;

-- ---------------------------------------------------------------------------
-- 3. Immuabilité.
--
-- Une part explique un montant publié, qui est immuable : la laisser mutable
-- permettrait de réécrire l'origine d'un chiffre sans toucher au chiffre. Le
-- garde est au niveau de la table, donc il couvre aussi un chemin
-- `security definer` — il ne dépend pas des droits de l'appelant.
-- ---------------------------------------------------------------------------
create or replace function private.protect_value_source()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'A published amount source is immutable' using errcode = '55000';
end;
$$;

revoke all on function private.protect_value_source() from public, anon, authenticated;

create trigger budget_value_sources_protect
before update or delete on public.budget_value_sources
for each row execute function private.protect_value_source();

-- ---------------------------------------------------------------------------
-- 4. Publication : les montants et leurs parts, ensemble ou rien.
--
-- L'ancienne fonction est SUPPRIMÉE plutôt que surchargée. Une surcharge
-- laisserait vivre un chemin qui publie sans traçabilité, et celle-ci cesserait
-- de dépendre du schéma pour dépendre de la discipline de l'appelant.
-- ---------------------------------------------------------------------------
drop function public.publish_calculation(uuid, text, text, text, jsonb);

create or replace function public.publish_calculation(
  target_version_id uuid,
  submitted_engine_version text,
  submitted_input_hash text,
  submitted_output_hash text,
  computed_values jsonb,
  computed_sources jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_tenant_id uuid;
  target_status text;
  existing_run_id uuid;
  new_run_id uuid;
  submitted_count integer;
  inserted_count integer;
  submitted_source_count integer;
  inserted_source_count integer;
begin
  select version.tenant_id, version.status
    into target_tenant_id, target_status
  from public.budget_versions version
  where version.id = target_version_id;

  if target_tenant_id is null then
    raise exception 'Unknown budget version' using errcode = '42704';
  end if;

  -- Le périmètre dimensionnel ne suffit pas ici : publier engage le budget du
  -- tenant entier, c'est une prérogative de DAF ou de DG.
  if not (select private.has_tenant_role(target_tenant_id, array['daf', 'dg'])) then
    raise exception 'Only a DAF or a DG publishes a calculation' using errcode = '42501';
  end if;

  -- Idempotence avant toute écriture : un rejeu ne doit rien tenter.
  select run.id into existing_run_id
  from public.calculation_runs run
  where run.tenant_id = target_tenant_id
    and run.version_id = target_version_id
    and run.input_hash = submitted_input_hash
    and run.status = 'succeeded'
  limit 1;

  if existing_run_id is not null then
    return existing_run_id;
  end if;

  if target_status = 'published' then
    raise exception 'A published version is immutable' using errcode = '55000';
  end if;

  if jsonb_typeof(computed_values) <> 'array' then
    raise exception 'computed_values must be a json array' using errcode = '22023';
  end if;

  submitted_count := jsonb_array_length(computed_values);
  if submitted_count = 0 then
    raise exception 'A published version carries at least one value' using errcode = '22023';
  end if;

  if jsonb_typeof(computed_sources) <> 'array' then
    raise exception 'computed_sources must be a json array' using errcode = '22023';
  end if;

  submitted_source_count := jsonb_array_length(computed_sources);
  if submitted_source_count = 0 then
    raise exception 'A published value carries at least one source' using errcode = '22023';
  end if;

  insert into public.calculation_runs (
    tenant_id, version_id, engine_version, input_hash, status
  ) values (
    target_tenant_id, target_version_id, submitted_engine_version, submitted_input_hash, 'running'
  )
  returning id into new_run_id;

  insert into public.budget_values (
    tenant_id, version_id, calculation_run_id, dimension_id, account_id, period_id, amount, currency
  )
  select
    target_tenant_id,
    target_version_id,
    new_run_id,
    (item ->> 'dimension_id')::uuid,
    (item ->> 'account_id')::uuid,
    (item ->> 'period_id')::uuid,
    (item ->> 'amount')::numeric,
    item ->> 'currency'
  from jsonb_array_elements(computed_values) as item;

  get diagnostics inserted_count = row_count;

  -- Une ligne perdue en route ne doit pas produire un budget publié plus court
  -- que celui qui a été calculé et empreinté.
  if inserted_count <> submitted_count then
    raise exception 'Published % values for % submitted', inserted_count, submitted_count
      using errcode = '55000';
  end if;

  -- Les parts se rattachent à leur montant par le triplet qui l'identifie dans
  -- ce run. Une part dont le triplet n'a pas été publié ne trouve aucune
  -- jointure : le comptage qui suit la fait échouer au lieu de la perdre.
  insert into public.budget_value_sources (
    tenant_id, budget_value_id, hypothesis_id, amount
  )
  select
    target_tenant_id,
    value.id,
    (item ->> 'hypothesis_id')::uuid,
    (item ->> 'amount')::numeric
  from jsonb_array_elements(computed_sources) as item
  join public.budget_values value
    on value.calculation_run_id = new_run_id
   and value.dimension_id = (item ->> 'dimension_id')::uuid
   and value.account_id = (item ->> 'account_id')::uuid
   and value.period_id = (item ->> 'period_id')::uuid;

  get diagnostics inserted_source_count = row_count;

  if inserted_source_count <> submitted_source_count then
    raise exception 'Attached % sources for % submitted',
      inserted_source_count, submitted_source_count
      using errcode = '55000';
  end if;

  -- Un montant sans origine est ce que cette migration existe pour empêcher.
  if exists (
    select 1
    from public.budget_values value
    where value.calculation_run_id = new_run_id
      and not exists (
        select 1
        from public.budget_value_sources source
        where source.budget_value_id = value.id
      )
  ) then
    raise exception 'A published amount carries no source' using errcode = '55000';
  end if;

  -- Une part qui citerait une hypothèse d'une AUTRE version raconterait une
  -- origine fausse. Le moteur ne peut pas en produire ; la base ne s'en remet
  -- pas au moteur pour autant.
  if exists (
    select 1
    from public.budget_value_sources source
    join public.budget_values value on value.id = source.budget_value_id
    join public.hypotheses hypothesis on hypothesis.id = source.hypothesis_id
    where value.calculation_run_id = new_run_id
      and hypothesis.version_id <> target_version_id
  ) then
    raise exception 'A source cites an hypothesis of another version' using errcode = '55000';
  end if;

  update public.calculation_runs
     set status = 'succeeded',
         output_hash = submitted_output_hash,
         completed_at = now()
   where id = new_run_id;

  update public.budget_versions
     set status = 'published',
         input_hash = submitted_input_hash,
         published_at = now()
   where id = target_version_id;

  return new_run_id;
end;
$$;

revoke all on function public.publish_calculation(uuid, text, text, text, jsonb, jsonb)
  from public, anon;
grant execute on function public.publish_calculation(uuid, text, text, text, jsonb, jsonb)
  to authenticated;

-- Inscription au registre, dans la transaction de la migration elle-même.
insert into supabase_migrations.schema_migrations (version, name)
values ('20260906120000', 'trace_value_sources')
on conflict (version) do nothing;
