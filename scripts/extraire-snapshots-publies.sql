-- Extrait, pour chaque version DÉJÀ publiée, la matière qui a produit ses
-- chiffres — dans la forme exacte que `lib/calculation/snapshot.ts` envoie au
-- moteur (`buildSnapshot`).
--
-- À quoi cela sert : les versions publiées avant la migration
-- `20260906120000_trace_value_sources` portent des montants sans origine. On ne
-- peut ni les recalculer ni les compléter à l'aveugle — une version publiée est
-- immuable, et le snapshot d'entrée n'a jamais été conservé : `calculation_runs`
-- ne garde que son EMPREINTE.
--
-- D'où la seule voie honnête : reconstruire le snapshot depuis les hypothèses de
-- la version, le rejouer, et n'écrire les parts QUE si l'empreinte recalculée
-- retrouve `calculation_runs.input_hash`. L'empreinte est le témoin ; sans elle,
-- la reconstruction ne serait qu'une reconstitution plausible.
--
-- Lecture seule. Rien n'est écrit ici.
--
--   ... psql -U postgres -d postgres -t -A -f scripts/extraire-snapshots-publies.sql

select coalesce(jsonb_agg(extrait order by extrait ->> 'version_id'), '[]'::jsonb)
from (
  select distinct on (version.id) jsonb_build_object(
    'version_id', version.id,
    'tenant_id', version.tenant_id,
    'run_id', run.id,
    'input_hash', run.input_hash,
    'payload', jsonb_build_object(
      'engine_version', run.engine_version,
      'model', version.calculation_model,
      'tenant_id', version.tenant_id,
      'version_id', version.id,
      'currency', tenant.base_currency,
      'accounts', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', account.id,
          'code', account.code,
          'statement', account.statement,
          'normal_balance', account.normal_balance
        )), '[]'::jsonb)
        from public.financial_accounts account
        where account.tenant_id = version.tenant_id
      ),
      'periods', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', period.id,
          'starts_on', period.starts_on,
          'ends_on', period.ends_on
        )), '[]'::jsonb)
        from public.periods period
        where period.tenant_id = version.tenant_id
      ),
      'dimensions', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', dimension.id,
          'code', dimension.code,
          'kind', dimension.kind
        )), '[]'::jsonb)
        from public.dimensions dimension
        where dimension.tenant_id = version.tenant_id
      ),
      'hypotheses', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', hypothesis.id,
          'dimension_id', hypothesis.dimension_id,
          'parameter_key', hypothesis.parameter_key,
          'unit', hypothesis.unit,
          'status', hypothesis.status,
          'value', hypothesis.value
        )), '[]'::jsonb)
        from public.hypotheses hypothesis
        where hypothesis.tenant_id = version.tenant_id
          and hypothesis.version_id = version.id
          and hypothesis.status = 'approved'
      )
    )
  ) as extrait
  from public.budget_versions version
  join public.tenants tenant on tenant.id = version.tenant_id
  join public.calculation_runs run
    on run.version_id = version.id
   and run.tenant_id = version.tenant_id
   and run.status = 'succeeded'
  where version.status = 'published'
    -- Les versions dont l'origine est déjà écrite n'ont rien à reconstruire.
    and not exists (
      select 1
      from public.budget_values value
      join public.budget_value_sources source on source.budget_value_id = value.id
      where value.version_id = version.id
    )
  order by version.id, run.completed_at desc
) as extraits;
