-- Celui qui construit une hypothèse ne pouvait pas dire POURQUOI.
--
-- Le seul texte libre du système était `hypothesis_decisions.reason`, réservé
-- au DÉCIDEUR. Un contributeur qui propose 320 jours facturés n'avait aucun
-- endroit où écrire « 16 consultants × 20 jours, hors intercontrat » — et le
-- DAF qui décide devait deviner, ou demander à côté de l'outil. Constaté le
-- 2026-09-08 sur le tenant réel (ALERTE 8 de la passation).
--
-- Une colonne, pas une table : la note appartient à la ligne, elle suit sa
-- révision (`row_version`) et sa politique d'écriture (l'auteur, tant que la
-- ligne est proposée — `hypotheses_update_contributor` ne change pas). Elle
-- n'entre PAS dans le calcul : le snapshot d'entrée lit des colonnes nommées
-- (`id, dimension_id, parameter_key, unit, status, value`), l'empreinte
-- `input_hash` reste donc la même avec ou sans note — deux versions aux mêmes
-- chiffres restent « identiques » pour la comparaison.
--
-- La reprise (`open_budget_version`) recopie la note avec la ligne : la
-- justification d'un chiffre repris vaut encore pour sa copie, qui porte le
-- même auteur et le même terme.

alter table public.hypotheses
  add column note text
  constraint hypotheses_note_length check (note is null or length(btrim(note)) between 1 and 2000);

comment on column public.hypotheses.note is
  'Justification libre de l''auteur (pourquoi ce terme). Hors calcul et hors'
  ' empreinte d''entrée ; modifiable par l''auteur tant que la ligne est proposée.';

create or replace function public.open_budget_version(
  target_cycle_id uuid,
  requested_model text,
  source_version_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  cycle_tenant_id uuid;
  source_version public.budget_versions;
  opened_version_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if requested_model not in ('direct', 'driver', 'cost_center') then
    raise exception 'Unknown calculation model' using errcode = '22023';
  end if;

  -- SECURITY DEFINER : sans ce filtre, l'appelant distinguerait « cycle
  -- inexistant » de « cycle d'un autre tenant ». L'appartenance fait donc
  -- partie de la clause de recherche, et l'absence rend le cycle introuvable.
  select cycle.tenant_id
  into cycle_tenant_id
  from public.budget_cycles cycle
  where cycle.id = target_cycle_id
    and private.is_tenant_member(cycle.tenant_id);

  if not found then
    raise exception 'Cycle not found' using errcode = 'P0002';
  end if;

  if not private.has_tenant_role(cycle_tenant_id, array['daf', 'dg']) then
    raise exception 'Only the DAF or the DG opens a version' using errcode = '42501';
  end if;

  if source_version_id is not null then
    select version.*
    into source_version
    from public.budget_versions version
    where version.id = source_version_id
      and version.tenant_id = cycle_tenant_id
      and version.cycle_id = target_cycle_id;

    if not found then
      raise exception 'Source version not found' using errcode = 'P0002';
    end if;

    if source_version.calculation_model <> requested_model then
      raise exception 'A resumed version keeps the calculation model of its source'
        using errcode = '22023';
    end if;
  end if;

  -- Le numéro se déduit de la dernière version du cycle. Deux ouvertures
  -- simultanées butent sur l'unicité `(cycle_id, version_no)` : la seconde
  -- échoue franchement au lieu de dupliquer un numéro.
  insert into public.budget_versions (
    tenant_id, cycle_id, version_no, status, calculation_model, parent_version_id
  )
  select
    cycle_tenant_id,
    target_cycle_id,
    coalesce(max(version.version_no), 0) + 1,
    'draft',
    requested_model,
    source_version_id
  from public.budget_versions version
  where version.tenant_id = cycle_tenant_id
    and version.cycle_id = target_cycle_id
  returning id into opened_version_id;

  if source_version_id is not null then
    insert into public.hypotheses (
      tenant_id, version_id, dimension_id, parameter_key, value, unit, status, proposed_by, note
    )
    select
      hypothesis.tenant_id,
      opened_version_id,
      hypothesis.dimension_id,
      hypothesis.parameter_key,
      hypothesis.value,
      hypothesis.unit,
      'proposed',
      hypothesis.proposed_by,
      hypothesis.note
    from public.hypotheses hypothesis
    where hypothesis.version_id = source_version_id
      and hypothesis.tenant_id = cycle_tenant_id
      and hypothesis.status <> 'rejected';
  end if;

  return opened_version_id;
end;
$$;

-- Inscription au registre, dans la transaction de la migration elle-même.
insert into supabase_migrations.schema_migrations (version, name)
values ('20260916120000', 'annotate_hypotheses')
on conflict (version) do nothing;
