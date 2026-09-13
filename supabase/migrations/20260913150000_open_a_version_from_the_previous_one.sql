-- Ouvrir une version ne reprenait rien de la précédente.
--
-- `createBudgetVersion` insérait une ligne vide, et l'immuabilité d'une version
-- publiée — qui est une force — se payait en ressaisie intégrale à chaque
-- révision. Mesuré le 2026-09-08 sur le tenant réel : 6 lignes à changer,
-- 10 ressaisies à l'identique. À 150-300 lignes, la révision devient
-- inutilisable, alors que c'est le seul chemin que le produit autorise.
--
-- Le schéma avait prévu la filiation dès l'origine : `budget_versions.
-- parent_version_id` existe depuis `20260807195608`, et la vue
-- `budget_version_states` en dérive `is_superseded` depuis `20260902120000`.
-- Rien ne l'écrivait — 0 valeur non nulle sur 32 versions en production le
-- 2026-09-13. Même trou que `calculation_model` : une colonne que personne ne
-- remplit est une fonctionnalité morte, et la vue qui la lit mentait par
-- omission.
--
-- La reprise vit en base plutôt que dans l'action serveur, pour trois raisons :
--   · elle est ATOMIQUE — version et copies dans une transaction, ou rien ;
--   · elle écrit des hypothèses AU NOM DE LEURS AUTEURS D'ORIGINE, ce que la
--     politique `hypotheses_insert_contributor` (`proposed_by = auth.uid()`)
--     interdit à juste titre à tout appelant ordinaire ; `security definer`
--     avec ses propres contrôles est le seul chemin honnête ;
--   · elle se prouve en pgTAP contre la production (`11_open_version_from_
--     previous`), là où vivent déjà tous les invariants du domaine.
--
-- Ce qu'une reprise fait, et ne fait pas :
--   · les hypothèses approuvées et proposées de la source sont copiées, les
--     rejetées non ;
--   · chaque copie redevient une PROPOSITION à la révision 1. Une approbation
--     est une décision datée, motivée, inscrite dans SA version (`05`,
--     contrôle 14 : « une décision ne se reprend pas, elle se succède ») ; une
--     copie approuvée sans décision aurait cassé la trace que `07` exige de
--     chaque chiffre publié. Le gain visé est la fin de la RESSAISIE ; la
--     décision reste un geste par ligne, dans la version où elle compte ;
--   · l'auteur d'origine reste l'auteur : celui qui a dit 320 jours l'a dit, et
--     il peut corriger sa ligne dans la version suivante (politique
--     `hypotheses_update_contributor`) ;
--   · le modèle de calcul est celui de la source, obligatoirement : les formes
--     de valeurs (`direct`, `driver`, `cost_center`) ne se traduisent pas ;
--   · la source, publiée ou non, n'est pas touchée d'un octet.

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

revoke all on function public.open_budget_version(uuid, text, uuid) from public, anon;
grant execute on function public.open_budget_version(uuid, text, uuid) to authenticated;

comment on function public.open_budget_version(uuid, text, uuid) is
  'Ouvre la version suivante d''un cycle, vide ou reprise d''une version source'
  ' du même cycle et du même modèle. Les hypothèses non rejetées de la source'
  ' sont recopiées en propositions à la révision 1, au nom de leurs auteurs'
  ' d''origine ; la source n''est pas modifiée. Seul chemin qui écrit'
  ' `parent_version_id`, dont `budget_version_states.is_superseded` dérive.';

-- Inscription au registre, dans la transaction de la migration elle-même.
insert into supabase_migrations.schema_migrations (version, name)
values ('20260913150000', 'open_a_version_from_the_previous_one')
on conflict (version) do nothing;
