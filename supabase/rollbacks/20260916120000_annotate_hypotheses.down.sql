-- Retour arrière de 20260916120000_annotate_hypotheses.sql.
--
-- À appliquer, comme la migration elle-même, en une seule transaction :
--   psql -1 -v ON_ERROR_STOP=1 -f <ce fichier>
--
-- CE QU'IL DÉTRUIT : la colonne `hypotheses.note` ET SON CONTENU — toute
-- justification saisie par un contributeur est perdue, sur les versions
-- publiées comme sur les brouillons. Ce n'est pas un retour neutre : le jouer
-- sur une base qui porte des notes efface une matière qu'aucune trace ne
-- garde ailleurs. À réserver à une base où la colonne est vide, ou après
-- extraction.
--
-- CE QU'IL RESTAURE : `open_budget_version` telle que `20260913150000` l'a
-- posée, qui ne recopie pas de note (la colonne n'existe plus).
--
-- CE QU'IL CASSE : l'action serveur `proposeHypothesis` écrit `note` ; sans
-- la colonne, plus aucune hypothèse ne se propose depuis l'écran. Ce retour
-- arrière n'a donc de sens qu'accompagné du retour au commit applicatif
-- antérieur. Le contrôle `13_annotate_hypotheses` échouera — c'est voulu.

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
      tenant_id, version_id, dimension_id, parameter_key, value, unit, status, proposed_by
    )
    select
      hypothesis.tenant_id,
      opened_version_id,
      hypothesis.dimension_id,
      hypothesis.parameter_key,
      hypothesis.value,
      hypothesis.unit,
      'proposed',
      hypothesis.proposed_by
    from public.hypotheses hypothesis
    where hypothesis.version_id = source_version_id
      and hypothesis.tenant_id = cycle_tenant_id
      and hypothesis.status <> 'rejected';
  end if;

  return opened_version_id;
end;
$$;

alter table public.hypotheses drop column note;

delete from supabase_migrations.schema_migrations where version = '20260916120000';
