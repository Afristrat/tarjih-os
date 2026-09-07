-- Retour arrière de 20260907120000_keep_input_snapshot.sql.
--
-- À appliquer, comme la migration elle-même, en une seule transaction :
--   psql -1 -v ON_ERROR_STOP=1 -f <ce fichier>
--
-- CE QU'IL DÉTRUIT, ET QUE RIEN NE RECONSTITUE ENSUITE : la matière d'entrée
-- conservée de chaque version publiée depuis l'application de la migration.
-- Cette perte est DÉFINITIVE et, à la différence des parts d'un montant, elle
-- ne se recalcule pas : c'est précisément parce que cette matière n'existait
-- nulle part ailleurs que la colonne a été créée. Après ce retour arrière, une
-- version publiée redevient rejouable seulement en refaisant sa matière depuis
-- un référentiel qui a continué de vivre — ce qui a déjà échoué en production.
--
-- Il restaure la fonction `publish_calculation` à six paramètres, celle qui
-- publie sans conserver la matière : sans cela, un retour arrière laisserait le
-- produit sans aucun chemin de publication.
--
-- Il NE remet PAS le moteur en 1.0.0 : la version du moteur vit dans le code
-- Python, pas dans le schéma. Un retour arrière de la base sans retour arrière
-- du déploiement laisse un moteur 1.1.0 devant une base qui l'accepte — les
-- empreintes restent celles de 1.1.0, ce que `calculation_runs.engine_version`
-- continue de dire pour chaque run.

drop trigger calculation_runs_protect_snapshot on public.calculation_runs;

drop function private.protect_run_snapshot();

drop function public.publish_calculation(uuid, text, text, text, jsonb, jsonb, jsonb);

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

alter table public.calculation_runs
  drop constraint calculation_runs_snapshot_describes_its_run,
  drop column input_snapshot;

-- Le registre cesse d'affirmer que cette migration est posée : un retour arrière
-- qui laisserait la ligne en place ferait mentir la seule source qui dise ce qui
-- est appliqué.
delete from supabase_migrations.schema_migrations where version = '20260907120000';
