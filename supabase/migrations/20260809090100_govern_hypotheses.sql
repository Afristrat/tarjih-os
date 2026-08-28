-- Task 05 : gouverner les hypothèses budgétaires.
-- Une version publiée est immuable ; une décision est concurrente-sûre,
-- motivée et tracée ; aucune erreur ne révèle l'existence d'une hypothèse
-- appartenant à un autre tenant.

-- Le garde couvre les trois écritures, pas seulement la mise à jour. Une
-- version publiée que l'on ne peut plus modifier mais où l'on peut encore
-- INSÉRER une ligne n'est pas immuable : elle change de contenu sans qu'aucune
-- de ses lignes n'ait bougé. La suppression est déjà refusée à tout rôle client
-- faute de politique `delete`, mais elle est fermée ici aussi pour que le futur
-- code `security definer` bute sur la même règle.
create or replace function private.enforce_hypothesis_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  touched public.hypotheses;
  version_status text;
begin
  if tg_op = 'DELETE' then
    touched := old;
  else
    touched := new;
  end if;

  select version.status
  into version_status
  from public.budget_versions version
  where version.id = touched.version_id
    and version.tenant_id = touched.tenant_id;

  if version_status = 'published' then
    raise exception 'A published version is immutable' using errcode = '55000';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  if tg_op = 'UPDATE' then
    -- Le contrôle optimiste vit ici et nulle part ailleurs : l'appelant doit
    -- avoir lu la ligne pour savoir quel numéro succède au sien. Une mise à
    -- jour qui reprend le numéro qu'elle a lu écraserait en silence celle qui
    -- s'est glissée entre sa lecture et son écriture.
    if new.row_version <> old.row_version + 1 then
      raise exception 'row_version must increase exactly once' using errcode = '40001';
    end if;

    if new.tenant_id <> old.tenant_id
      or new.version_id <> old.version_id
      or new.dimension_id <> old.dimension_id
      or new.proposed_by <> old.proposed_by then
      raise exception 'The hypothesis scope is immutable' using errcode = '55000';
    end if;
  end if;

  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.enforce_hypothesis_write() from public, anon, authenticated;

create trigger hypotheses_enforce_write
before insert or update or delete on public.hypotheses
for each row execute function private.enforce_hypothesis_write();

-- Refus de toute mutation d'une version publiée, y compris son passage à
-- `superseded`.
--
-- ponytail: plafond — la supersession d'une version publiée n'est donc pas
-- possible ; déclencheur de réexamen — task 07, au moment où une correction
-- devra créer la version suivante. Deux issues seront alors ouvertes : relâcher
-- ici la seule transition `published` -> `superseded`, ou dériver l'état
-- « remplacée » de l'existence d'une version enfant, ce qui garde l'invariant
-- d'immuabilité absolu. Rien n'est tranché tant que la 07 n'existe pas.
create or replace function private.protect_published_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'published' then
    raise exception 'A published version is immutable' using errcode = '55000';
  end if;
  return coalesce(new, old);
end;
$$;

revoke all on function private.protect_published_version() from public, anon, authenticated;

create trigger budget_versions_protect_published
before update or delete on public.budget_versions
for each row execute function private.protect_published_version();

create or replace function public.decide_hypothesis(
  target_hypothesis_id uuid,
  expected_row_version integer,
  requested_decision text,
  decision_reason text,
  replacement_value jsonb default null,
  replacement_unit text default null
)
returns public.hypotheses
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_hypothesis public.hypotheses;
  decided_hypothesis public.hypotheses;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if requested_decision not in ('approved', 'rejected') then
    raise exception 'Invalid decision' using errcode = '22023';
  end if;

  if length(btrim(decision_reason)) = 0 then
    raise exception 'A decision reason is required' using errcode = '22023';
  end if;

  -- La fonction est SECURITY DEFINER : sans ce filtre, la sélection lirait
  -- n'importe quelle ligne du parc et un appelant distinguerait « hypothèse
  -- inexistante » de « hypothèse appartenant à un autre tenant ». Le droit
  -- d'approbation fait donc partie de la clause de recherche, et l'absence de
  -- droit rend la ligne introuvable.
  select hypothesis.*
  into current_hypothesis
  from public.hypotheses hypothesis
  where hypothesis.id = target_hypothesis_id
    and private.has_dimension_permission(
      hypothesis.tenant_id,
      hypothesis.dimension_id,
      'approve'
    )
  for update;

  if not found then
    raise exception 'Hypothesis not found' using errcode = 'P0002';
  end if;

  if current_hypothesis.status <> 'proposed' then
    raise exception 'The hypothesis has already been decided' using errcode = '55000';
  end if;

  if current_hypothesis.row_version <> expected_row_version then
    raise exception 'The hypothesis was changed by another user' using errcode = '40001';
  end if;

  update public.hypotheses
  set status = requested_decision,
      value = coalesce(replacement_value, value),
      unit = coalesce(nullif(btrim(replacement_unit), ''), unit),
      row_version = row_version + 1
  where id = current_hypothesis.id
  returning * into decided_hypothesis;

  insert into public.hypothesis_decisions (
    tenant_id,
    hypothesis_id,
    decision,
    decided_by,
    reason
  ) values (
    current_hypothesis.tenant_id,
    current_hypothesis.id,
    requested_decision,
    (select auth.uid()),
    btrim(decision_reason)
  );

  return decided_hypothesis;
end;
$$;

revoke all on function public.decide_hypothesis(uuid, integer, text, text, jsonb, text) from public, anon;
grant execute on function public.decide_hypothesis(uuid, integer, text, text, jsonb, text) to authenticated;

-- Inscription au registre, dans la transaction de la migration elle-même : une
-- migration appliquée sans être inscrite devient alors impossible, sans dépendre
-- de la discipline de celui qui l'applique. `on conflict` la rend rejouable et
-- laisse la CLI Supabase écrire la même ligne sans se heurter à celle-ci.
insert into supabase_migrations.schema_migrations (version, name)
values ('20260809090100', 'govern_hypotheses')
on conflict (version) do nothing;
