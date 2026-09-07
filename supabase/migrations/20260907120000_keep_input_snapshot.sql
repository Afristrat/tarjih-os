-- Reproductibilité d'une version publiée — la matière d'entrée est conservée.
--
-- `calculation_runs` ne gardait que l'EMPREINTE de ce qui a produit les chiffres.
-- Rejouer une version publiée supposait donc de refaire sa matière depuis la
-- base — c'est-à-dire depuis un référentiel qui a continué de vivre. Mesuré en
-- production le 2026-09-06 : la version `c6033eb3` ne retrouvait plus son
-- empreinte alors qu'aucun de ses chiffres n'avait bougé ; son tenant avait
-- simplement gagné un compte et une période depuis.
--
-- Deux corrections, complémentaires et de portées différentes :
--   * le moteur (1.1.0) n'empreinte plus que le référentiel réellement cité par
--     les hypothèses — la cause du cas mesuré, et l'idempotence de cette
--     fonction sur `input_hash` avec elle ;
--   * ici, la matière d'entrée est CONSERVÉE. C'est ce qui rend la promesse
--     vraie de façon permanente : renommer plus tard le code d'un compte
--     réellement utilisé ne rend plus une version publiée irrejouable.
--
-- Ce que cette migration ne fait pas : inventer la matière des runs antérieurs.
-- Elle n'existe nulle part. Les six runs déjà publiés — tous du tenant de
-- recette — restent sans snapshot, et le disent (`input_snapshot is null`)
-- plutôt que de porter une reconstitution plausible.

-- ---------------------------------------------------------------------------
-- 1. La matière d'entrée, à côté de son empreinte.
--
-- Nullable, et ce n'est pas une porte laissée ouverte : la colonne ne peut pas
-- être `not null` sans écrire une valeur pour les runs antérieurs, donc sans
-- inventer. La garantie vit dans la fonction de publication, qui est la SEULE
-- voie d'écriture et qui refuse désormais un snapshot absent — exactement comme
-- la traçabilité des montants ne repose pas sur la discipline de l'appelant.
--
-- Le `check` interdit qu'un snapshot décrive une autre version que celle du run
-- qui le porte : sans lui, un rejeu retrouverait une empreinte — celle de
-- quelqu'un d'autre — et cette erreur-là est indétectable à la lecture.
-- ---------------------------------------------------------------------------
alter table public.calculation_runs
  add column input_snapshot jsonb,
  add constraint calculation_runs_snapshot_describes_its_run check (
    input_snapshot is null or (
      jsonb_typeof(input_snapshot) = 'object'
      and input_snapshot ->> 'version_id' = version_id::text
      and input_snapshot ->> 'tenant_id' = tenant_id::text
    )
  );

comment on column public.calculation_runs.input_snapshot is
  'Matière d''entrée exacte soumise au moteur, telle qu''empreintée par'
  ' input_hash. Nulle pour les runs antérieurs au 2026-09-07, dont la matière'
  ' n''a jamais été conservée et ne se reconstitue pas honnêtement.';

-- ---------------------------------------------------------------------------
-- 2. Immuabilité de la matière.
--
-- Un run est mis à jour une fois, légitimement, pour passer en `succeeded` :
-- le garde ne bloque donc pas l'`update`, il bloque le seul changement qui
-- réécrirait l'histoire. Il refuse aussi de REMPLIR un snapshot resté nul :
-- écrire après coup une matière que personne n'a conservée reviendrait à
-- fabriquer la preuve que cette colonne existe pour porter.
-- ---------------------------------------------------------------------------
create or replace function private.protect_run_snapshot()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.input_snapshot is distinct from old.input_snapshot then
    raise exception 'A calculation run input snapshot is immutable'
      using errcode = '55000';
  end if;
  return new;
end;
$$;

revoke all on function private.protect_run_snapshot() from public, anon, authenticated;

create trigger calculation_runs_protect_snapshot
before update on public.calculation_runs
for each row execute function private.protect_run_snapshot();

-- ---------------------------------------------------------------------------
-- 3. Publication : les chiffres, leurs parts ET leur matière, ensemble ou rien.
--
-- L'ancienne signature est SUPPRIMÉE plutôt que surchargée, pour la raison qui
-- valait déjà à la migration précédente : une surcharge laisserait vivre un
-- chemin publiant sans conserver la matière, et la garantie cesserait de
-- dépendre du schéma pour dépendre de qui appelle.
-- ---------------------------------------------------------------------------
drop function public.publish_calculation(uuid, text, text, text, jsonb, jsonb);

create or replace function public.publish_calculation(
  target_version_id uuid,
  submitted_engine_version text,
  submitted_input_hash text,
  submitted_output_hash text,
  computed_values jsonb,
  computed_sources jsonb,
  submitted_snapshot jsonb
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

  -- Sans la matière d'entrée, `input_hash` ne prouve que son propre calcul :
  -- rien ne permet de rejouer la version pour vérifier qu'elle rend le même
  -- chiffre. La conserver est ce qui rend vraie la promesse d'auditabilité.
  -- `is null` en premier, et ce n'est pas une redondance : `jsonb_typeof(null)`
  -- rend NULL, donc `<> 'object'` n'est jamais vrai pour un snapshot ABSENT.
  -- Sans cette branche, le cas le plus banal — ne rien transmettre — glissait
  -- jusqu'au contrôle suivant et s'annonçait « décrit une autre version ».
  if submitted_snapshot is null or jsonb_typeof(submitted_snapshot) <> 'object' then
    raise exception 'submitted_snapshot must be a json object' using errcode = '22023';
  end if;

  -- Un snapshot décrivant une AUTRE version, ou un autre tenant, ferait mentir
  -- le rejeu de la façon la plus convaincante qui soit : il retrouverait une
  -- empreinte, mais celle de quelqu'un d'autre.
  if submitted_snapshot ->> 'version_id' is distinct from target_version_id::text
     or submitted_snapshot ->> 'tenant_id' is distinct from target_tenant_id::text then
    raise exception 'submitted_snapshot describes another version' using errcode = '22023';
  end if;

  insert into public.calculation_runs (
    tenant_id, version_id, engine_version, input_hash, input_snapshot, status
  ) values (
    target_tenant_id, target_version_id, submitted_engine_version, submitted_input_hash,
    submitted_snapshot, 'running'
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

revoke all on function public.publish_calculation(uuid, text, text, text, jsonb, jsonb, jsonb)
  from public, anon;
grant execute on function public.publish_calculation(uuid, text, text, text, jsonb, jsonb, jsonb)
  to authenticated;

-- Inscription au registre, dans la transaction de la migration elle-même.
insert into supabase_migrations.schema_migrations (version, name)
values ('20260907120000', 'keep_input_snapshot')
on conflict (version) do nothing;
