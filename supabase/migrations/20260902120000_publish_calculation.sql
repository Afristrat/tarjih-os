-- Task 07 — Publier les calculs.
--
-- Trois choses ici, et rien de plus :
--   1. le modèle de calcul, figé par version budgétaire ;
--   2. la publication atomique d'un run et de ses valeurs ;
--   3. la supersession, dérivée plutôt que mutée.
--
-- Le moteur Python n'apparaît nulle part dans ce fichier : il ne parle jamais à
-- la base. Le backend l'appelle, reçoit des montants, et les présente ici.

-- ---------------------------------------------------------------------------
-- 1. Le modèle de calcul appartient à la version, pas au tenant.
--
-- Une version publiée est immuable ; le modèle qui a produit ses chiffres doit
-- l'être avec elle, sinon relire une version publiée ne dirait plus comment
-- elle a été calculée. `default 'direct'` couvre les versions déjà en base :
-- c'est le seul modèle qui n'ajoute aucune sémantique aux montants saisis, donc
-- le seul qu'on puisse leur attribuer sans rien affirmer de faux.
-- ---------------------------------------------------------------------------
alter table public.budget_versions
  add column calculation_model text not null default 'direct'
  check (calculation_model in ('direct', 'cost_center', 'driver'));

-- ---------------------------------------------------------------------------
-- 2. Supersession dérivée.
--
-- Le marqueur `ponytail:` de `20260809090100_govern_hypotheses.sql:72-77` posait
-- le choix : ouvrir la transition `published` -> `superseded` dans le trigger
-- d'immuabilité, ou déduire l'état « remplacée » de l'existence d'une version
-- enfant. La seconde issue est retenue : elle n'ouvre aucune brèche dans
-- l'invariant, et une version remplacée ne change alors littéralement pas d'un
-- octet. Le statut `superseded` de la contrainte de colonne reste donc
-- inutilisé — il n'est pas retiré, car retirer une valeur d'un `check` sur une
-- table qui porte des lignes publiées relèverait de la réécriture d'historique.
-- ---------------------------------------------------------------------------
create or replace view public.budget_version_states
with (security_invoker = true) as
  select
    version.id,
    version.tenant_id,
    version.cycle_id,
    version.version_no,
    version.status,
    version.calculation_model,
    version.parent_version_id,
    version.input_hash,
    version.published_at,
    version.created_at,
    exists (
      select 1
      from public.budget_versions child
      where child.tenant_id = version.tenant_id
        and child.parent_version_id = version.id
    ) as is_superseded
  from public.budget_versions version;

comment on view public.budget_version_states is
  'Versions budgétaires et leur état effectif. `is_superseded` est dérivé de'
  ' l''existence d''une version enfant : aucune ligne publiée n''est mutée pour'
  ' porter cet état. `security_invoker` laisse la RLS de budget_versions'
  ' s''appliquer à l''appelant.';

grant select on public.budget_version_states to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Publication atomique.
--
-- Tout tient dans une transaction : le run, ses valeurs, le succès du run et la
-- publication de la version. Si quoi que ce soit échoue, aucune valeur ne reste
-- visible (`specs/_source/archi.md:97-98`).
--
-- Idempotente par `input_hash` : rejouer le même calcul sur la même version rend
-- le run déjà réussi au lieu d'en créer un second. C'est ce qui rend l'appel
-- rejouable après un délai réseau sans publier deux fois.
-- ---------------------------------------------------------------------------
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

-- Inscription au registre, dans la transaction de la migration elle-même.
insert into supabase_migrations.schema_migrations (version, name)
values ('20260902120000', 'publish_calculation')
on conflict (version) do nothing;
