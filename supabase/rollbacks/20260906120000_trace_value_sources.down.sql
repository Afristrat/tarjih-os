-- Retour arrière de 20260906120000_trace_value_sources.sql.
--
-- À appliquer, comme la migration elle-même, en une seule transaction :
--   psql -1 -v ON_ERROR_STOP=1 -f <ce fichier>
--
-- CE QU'IL DÉTRUIT, ET QUE RIEN NE RECONSTITUE ENSUITE : la table
-- `budget_value_sources`, donc l'origine de chaque montant publié depuis
-- l'application de la migration. Les montants eux-mêmes restent intacts.
--
-- Cette perte est en partie réparable, mais seulement en partie : les parts se
-- recalculent en rejouant le moteur sur les hypothèses d'une version publiée, et
-- la reconstruction ne vaut que si l'empreinte recalculée retrouve
-- `calculation_runs.input_hash` (c'est ce que fait `scripts/reconstruire-sources.mjs`).
-- Une version dont les hypothèses auraient bougé entre-temps ne se reconstruit
-- pas. À relever avant d'appliquer ce fichier.
--
-- Il restaure la fonction `publish_calculation` à cinq paramètres, celle qui
-- publie sans traçabilité : sans cela, un retour arrière laisserait le produit
-- sans aucun chemin de publication.

drop trigger budget_value_sources_protect on public.budget_value_sources;

drop function private.protect_value_source();

drop table public.budget_value_sources;

drop function public.publish_calculation(uuid, text, text, text, jsonb, jsonb);

create or replace function public.publish_calculation(
  target_version_id uuid,
  submitted_engine_version text,
  submitted_input_hash text,
  submitted_output_hash text,
  computed_values jsonb
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
begin
  select version.tenant_id, version.status
    into target_tenant_id, target_status
  from public.budget_versions version
  where version.id = target_version_id;

  if target_tenant_id is null then
    raise exception 'Unknown budget version' using errcode = '42704';
  end if;

  if not (select private.has_tenant_role(target_tenant_id, array['daf', 'dg'])) then
    raise exception 'Only a DAF or a DG publishes a calculation' using errcode = '42501';
  end if;

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

  if jsonb_typeof(computed_values) <> 'array' or jsonb_array_length(computed_values) = 0 then
    raise exception 'A publication carries at least one value' using errcode = '22023';
  end if;
  submitted_count := jsonb_array_length(computed_values);

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

  if inserted_count <> submitted_count then
    raise exception 'Published % values for % submitted', inserted_count, submitted_count
      using errcode = '55000';
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

revoke all on function public.publish_calculation(uuid, text, text, text, jsonb) from public, anon;
grant execute on function public.publish_calculation(uuid, text, text, text, jsonb) to authenticated;

alter table public.budget_values drop constraint budget_values_tenant_id_key;

-- Le registre cesse d'affirmer que cette migration est posée : un retour arrière
-- qui laisserait la ligne en place ferait mentir la seule source qui dise ce qui
-- est appliqué.
delete from supabase_migrations.schema_migrations where version = '20260906120000';
