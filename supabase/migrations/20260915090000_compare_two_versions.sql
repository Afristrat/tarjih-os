-- « Qu'est-ce qui a changé depuis la version publiée ? » n'avait pas de
-- réponse dans le produit.
--
-- C'est la première question d'un directeur financier qui révise, et le
-- comparatif de la simulation du 2026-09-08 a dû être reconstruit EN BASE, hors
-- de tout écran. Depuis `20260913150000`, une version suivante reprend la
-- précédente et `parent_version_id` dit de qui elle descend : la comparaison
-- devient possible, et elle se pose en deux niveaux qui ne disent pas la même
-- chose.
--
-- NIVEAU 1 — les hypothèses. Jointure sur `(dimension_id, parameter_key)`,
-- dont l'unicité par version est garantie par contrainte. Chaque couple est
-- identique, modifié, ajouté ou retiré. Ce niveau porte le POURQUOI d'un écart
-- (320 jours sont devenus 300), et il porte la clé du geste « approuver ce qui
-- est identique » : une version de 300 lignes reprise coûtait 300 décisions une
-- à une, même pour les lignes que personne n'a touchées.
--
-- Ce que chaque côté compte : une version PUBLIÉE ne compte que ses hypothèses
-- approuvées — ce sont elles, et elles seules, qui ont produit ses chiffres.
-- Une version non publiée compte tout ce qui n'est pas rejeté : une proposition
-- en attente fait partie de ce que la révision met sur la table. Conséquence
-- assumée : une ligne proposée et jamais décidée dans la version 1, reprise
-- dans la version 2, y apparaît comme AJOUTÉE — la version 1 publiée ne l'a
-- pas comptée, la version 2 pourrait le faire.
--
-- NIVEAU 2 — les montants publiés. Jointure sur `(dimension, compte, période)`,
-- delta et variation. Seulement entre deux versions publiées : un montant non
-- publié n'existe pas. L'arithmétique est celle de `numeric`, exacte ; le
-- pourcentage est arrondi à une décimale à l'affichage, jamais avant. Le piège
-- mesuré le 2026-09-08 — un total en `Number` qui affichait −8,7 % pour −27,8 %
-- réels — ne peut pas se reproduire dans une colonne `numeric`.
--
-- Les deux fonctions sont `security invoker` : la RLS de `hypotheses` et de
-- `budget_values` s'applique à l'appelant, donc un contributeur compare SON
-- périmètre et rien d'autre, sans qu'une ligne de code ait à le savoir. Elles
-- refusent « version introuvable » (P0002) sans distinguer l'inexistant de
-- l'étranger, comme partout ailleurs.
--
-- LE GESTE — `approve_identical_hypotheses`. Pour chaque ligne de la cible
-- identique à une ligne APPROUVÉE de la base, et sur laquelle l'appelant a le
-- droit d'approuver, il appelle `decide_hypothesis` — une décision par ligne,
-- au nom de l'appelant, avec son motif, dans UNE transaction. Rien n'est copié
-- ni hérité : `05` contrôle 14 (« une décision ne se reprend pas, elle se
-- succède ») et la trace de `07` tiennent, ligne par ligne. Ce qu'il n'approuve
-- jamais : une ligne identique à une proposition non décidée de la base (elle
-- n'a jamais été approuvée par personne), une ligne modifiée, une ligne d'une
-- dimension hors du droit de l'appelant.

-- ---------------------------------------------------------------------------
-- 1. Niveau 1 : les hypothèses, couple par couple.
-- ---------------------------------------------------------------------------
create or replace function public.compare_version_hypotheses(
  base_version_id uuid,
  target_version_id uuid
)
returns table (
  dimension_id uuid,
  parameter_key text,
  outcome text,
  base_hypothesis_id uuid,
  base_value jsonb,
  base_unit text,
  base_status text,
  target_hypothesis_id uuid,
  target_value jsonb,
  target_unit text,
  target_status text,
  target_row_version integer
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  base_version public.budget_versions;
  target_version public.budget_versions;
begin
  -- Les deux versions sont lues sous RLS : une version d'un autre tenant est
  -- introuvable, pas interdite.
  select version.* into base_version
  from public.budget_versions version where version.id = base_version_id;
  if not found then
    raise exception 'Version not found' using errcode = 'P0002';
  end if;

  select version.* into target_version
  from public.budget_versions version where version.id = target_version_id;
  if not found or target_version.tenant_id <> base_version.tenant_id then
    raise exception 'Version not found' using errcode = 'P0002';
  end if;

  return query
  with base_side as (
    select hypothesis.*
    from public.hypotheses hypothesis
    where hypothesis.version_id = base_version.id
      and hypothesis.tenant_id = base_version.tenant_id
      and case
        when base_version.status = 'published' then hypothesis.status = 'approved'
        else hypothesis.status <> 'rejected'
      end
  ),
  target_side as (
    select hypothesis.*
    from public.hypotheses hypothesis
    where hypothesis.version_id = target_version.id
      and hypothesis.tenant_id = target_version.tenant_id
      and case
        when target_version.status = 'published' then hypothesis.status = 'approved'
        else hypothesis.status <> 'rejected'
      end
  )
  select
    coalesce(base_side.dimension_id, target_side.dimension_id),
    coalesce(base_side.parameter_key, target_side.parameter_key),
    case
      when base_side.id is null then 'added'
      when target_side.id is null then 'removed'
      when base_side.value = target_side.value and base_side.unit = target_side.unit then 'identical'
      else 'changed'
    end,
    base_side.id,
    base_side.value,
    base_side.unit,
    base_side.status,
    target_side.id,
    target_side.value,
    target_side.unit,
    target_side.status,
    target_side.row_version
  from base_side
  full outer join target_side
    on target_side.dimension_id = base_side.dimension_id
   and target_side.parameter_key = base_side.parameter_key
  order by 1, 2;
end;
$$;

revoke all on function public.compare_version_hypotheses(uuid, uuid) from public, anon;
grant execute on function public.compare_version_hypotheses(uuid, uuid) to authenticated;

comment on function public.compare_version_hypotheses(uuid, uuid) is
  'Hypothèses de deux versions du même tenant, couple par couple sur'
  ' (dimension, paramètre) : identical, changed, added, removed. Une version'
  ' publiée compte ses approuvées, une autre tout ce qui n''est pas rejeté.'
  ' security invoker : le périmètre de lecture de l''appelant s''applique.';

-- ---------------------------------------------------------------------------
-- 2. Niveau 2 : les montants publiés, triplet par triplet.
-- ---------------------------------------------------------------------------
create or replace function public.compare_version_values(
  base_version_id uuid,
  target_version_id uuid
)
returns table (
  dimension_id uuid,
  account_id uuid,
  period_id uuid,
  currency text,
  base_amount numeric,
  target_amount numeric,
  delta numeric,
  delta_percent numeric
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  base_version public.budget_versions;
  target_version public.budget_versions;
begin
  select version.* into base_version
  from public.budget_versions version where version.id = base_version_id;
  if not found then
    raise exception 'Version not found' using errcode = 'P0002';
  end if;

  select version.* into target_version
  from public.budget_versions version where version.id = target_version_id;
  if not found or target_version.tenant_id <> base_version.tenant_id then
    raise exception 'Version not found' using errcode = 'P0002';
  end if;

  if base_version.status <> 'published' or target_version.status <> 'published' then
    raise exception 'Both versions must be published' using errcode = '55000';
  end if;

  return query
  select
    coalesce(base_side.dimension_id, target_side.dimension_id),
    coalesce(base_side.account_id, target_side.account_id),
    coalesce(base_side.period_id, target_side.period_id),
    coalesce(base_side.currency, target_side.currency),
    base_side.amount,
    target_side.amount,
    target_side.amount - base_side.amount,
    -- Une variation n'a de sens que si les deux montants existent et que la
    -- base n'est pas nulle : ailleurs, « — » vaut mieux qu'un infini.
    case
      when base_side.amount is null or target_side.amount is null or base_side.amount = 0 then null
      else round((target_side.amount - base_side.amount) * 100 / base_side.amount, 1)
    end
  from (
    select value.* from public.budget_values value
    where value.version_id = base_version.id and value.tenant_id = base_version.tenant_id
  ) base_side
  full outer join (
    select value.* from public.budget_values value
    where value.version_id = target_version.id and value.tenant_id = target_version.tenant_id
  ) target_side
    on target_side.dimension_id = base_side.dimension_id
   and target_side.account_id = base_side.account_id
   and target_side.period_id = base_side.period_id
  order by 1, 2, 3;
end;
$$;

revoke all on function public.compare_version_values(uuid, uuid) from public, anon;
grant execute on function public.compare_version_values(uuid, uuid) to authenticated;

comment on function public.compare_version_values(uuid, uuid) is
  'Montants publiés de deux versions publiées du même tenant, triplet par'
  ' triplet sur (dimension, compte, période) : montants, delta et variation en'
  ' numeric exact. security invoker : le périmètre de lecture de l''appelant'
  ' s''applique.';

-- ---------------------------------------------------------------------------
-- 3. Le geste : approuver ce qui est identique à une ligne approuvée de la base.
-- ---------------------------------------------------------------------------
create or replace function public.approve_identical_hypotheses(
  base_version_id uuid,
  target_version_id uuid,
  decision_reason text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_version public.budget_versions;
  target_version public.budget_versions;
  candidate record;
  approved_count integer := 0;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if length(btrim(coalesce(decision_reason, ''))) = 0 then
    raise exception 'A decision reason is required' using errcode = '22023';
  end if;

  -- SECURITY DEFINER : l'appartenance fait partie de la clause de recherche,
  -- pour que l'appelant ne distingue pas « inexistante » de « pas à vous ».
  select version.* into base_version
  from public.budget_versions version
  where version.id = base_version_id
    and private.is_tenant_member(version.tenant_id);
  if not found then
    raise exception 'Version not found' using errcode = 'P0002';
  end if;

  select version.* into target_version
  from public.budget_versions version
  where version.id = target_version_id
    and version.tenant_id = base_version.tenant_id;
  if not found then
    raise exception 'Version not found' using errcode = 'P0002';
  end if;

  -- Le déclencheur d'immuabilité le refuserait ligne à ligne ; le dire avant
  -- évite d'annoncer une décision partielle.
  if target_version.status = 'published' then
    raise exception 'A published version is immutable' using errcode = '55000';
  end if;

  -- Sous SECURITY DEFINER la comparaison lit toutes les lignes des deux
  -- versions ; c'est le droit d'APPROUVER, ligne par ligne, qui borne le geste.
  for candidate in
    select comparison.target_hypothesis_id, comparison.target_row_version
    from public.compare_version_hypotheses(base_version.id, target_version.id) comparison
    where comparison.outcome = 'identical'
      and comparison.base_status = 'approved'
      and comparison.target_status = 'proposed'
      and private.has_dimension_permission(
        target_version.tenant_id,
        comparison.dimension_id,
        'approve'
      )
  loop
    -- Une décision par ligne, au nom de l'appelant : `decide_hypothesis` porte
    -- le verrou, le contrôle optimiste, l'état et la trace. Un conflit sur une
    -- seule ligne annule tout le lot — un lot à moitié approuvé mentirait.
    perform public.decide_hypothesis(
      candidate.target_hypothesis_id,
      candidate.target_row_version,
      'approved',
      decision_reason
    );
    approved_count := approved_count + 1;
  end loop;

  return approved_count;
end;
$$;

revoke all on function public.approve_identical_hypotheses(uuid, uuid, text) from public, anon;
grant execute on function public.approve_identical_hypotheses(uuid, uuid, text) to authenticated;

comment on function public.approve_identical_hypotheses(uuid, uuid, text) is
  'Approuve, dans la version cible (non publiée), chaque proposition identique'
  ' à une hypothèse APPROUVÉE de la version de base, sur les seules dimensions'
  ' où l''appelant peut approuver — une décision par ligne via'
  ' decide_hypothesis, dans une transaction. Rend le nombre de lignes'
  ' approuvées.';

-- Inscription au registre, dans la transaction de la migration elle-même.
insert into supabase_migrations.schema_migrations (version, name)
values ('20260915090000', 'compare_two_versions')
on conflict (version) do nothing;
