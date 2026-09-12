-- Les deux politiques de `hypothesis_decisions` ne vérifiaient pas le tenant
-- qu'elles prétendaient vérifier.
--
-- Elles portaient toutes deux `hypothesis.tenant_id = tenant_id`, où le
-- `tenant_id` non qualifié se résout sur la portée la plus INTERNE — c'est-à-dire
-- sur `hypotheses` elle-même. PostgreSQL le dit lui-même une fois la règle
-- normalisée : `pg_policies` la rend `hypothesis.tenant_id = hypothesis.tenant_id`.
-- Une tautologie. La condition ne rapprochait jamais la décision de son
-- hypothèse ; elle rapprochait l'hypothèse d'elle-même.
--
-- Ce que cela exposait RÉELLEMENT : rien, et la raison mérite d'être écrite
-- parce qu'elle n'est pas celle qu'on croit. La cohérence entre le tenant d'une
-- décision et celui de son hypothèse est imposée par une CLÉ ÉTRANGÈRE
-- COMPOSITE, `hypothesis_decisions_tenant_id_hypothesis_id_fkey`, qui référence
-- `hypotheses(tenant_id, id)`. Mesuré en production le 2026-09-10, en rôle
-- `authenticated` et en transaction annulée : un approbateur du tenant A
-- insérant une décision estampillée du tenant B sur sa propre hypothèse est
-- refusé — mais avec `23503` (violation de clé étrangère), jamais `42501`
-- (violation de politique). La règle avait laissé passer ; c'est l'intégrité
-- référentielle qui a fermé la porte. Sur 71 décisions écrites depuis le
-- 2026-08-28, zéro incohérente : la trace est vide sur TOUTE la période, ce
-- qu'une écriture ne peut pas dissimuler puisqu'elle laisse une ligne.
--
-- Pourquoi le corriger malgré tout, alors que rien ne fuit : parce que
-- l'invariant du projet ne dit pas « aucune décision ne sera incohérente », il
-- dit qu'aucune donnée n'appartient à deux tenants — et une règle qui n'énonce
-- cet invariant qu'en apparence le laisse tomber le jour où la contrainte qui
-- le tenait vraiment est retirée par une migration qui, elle, croira la
-- politique redondante. C'est le même raisonnement que
-- `20260906140000_close_anon_on_version_states` : une protection qui ne tient
-- que par un second mécanisme n'est pas la protection annoncée.
--
-- Portée du changement sur les chemins applicatifs, tracée avant d'écrire :
--   · ÉCRITURE — aucun chemin ne passe par ces politiques. `decide_hypothesis`
--     est `SECURITY DEFINER` (`prosecdef = t`), donc la RLS de la table ne
--     s'applique pas à elle, et c'est le SEUL écrivain (`budgets/actions.ts`).
--     `decisions_insert_approver` garde une porte que personne n'emprunte.
--   · LECTURE — un seul appelant, la fiche d'hypothèse
--     (`app/hypotheses/[id]/page.tsx`), en rôle `authenticated`. C'est le seul
--     endroit où une erreur de rédaction ici se verrait, et il est éprouvé.
--
-- La correction qualifie explicitement les deux côtés du rapprochement, et
-- évalue la permission sur le tenant de la LIGNE GARDÉE plutôt que sur celui de
-- l'hypothèse : une règle doit parler de ce qu'elle protège. Les deux sont
-- désormais démontrablement le même tenant, puisque c'est précisément ce que la
-- ligne au-dessus vérifie.

drop policy if exists decisions_select_scope on public.hypothesis_decisions;

create policy decisions_select_scope on public.hypothesis_decisions for select to authenticated
using (exists (
  select 1 from public.hypotheses hypothesis
  where hypothesis.id = hypothesis_decisions.hypothesis_id
    and hypothesis.tenant_id = hypothesis_decisions.tenant_id
    and (select private.has_dimension_permission(
           hypothesis_decisions.tenant_id, hypothesis.dimension_id, 'read'))
));

drop policy if exists decisions_insert_approver on public.hypothesis_decisions;

create policy decisions_insert_approver on public.hypothesis_decisions for insert to authenticated
with check (decided_by = (select auth.uid()) and exists (
  select 1 from public.hypotheses hypothesis
  where hypothesis.id = hypothesis_decisions.hypothesis_id
    and hypothesis.tenant_id = hypothesis_decisions.tenant_id
    and (select private.has_dimension_permission(
           hypothesis_decisions.tenant_id, hypothesis.dimension_id, 'approve'))
));

comment on table public.hypothesis_decisions is
  'Décisions d''approbation, en ajout seul. Le tenant de la décision est tenu'
  ' d''égaler celui de son hypothèse par la clé étrangère composite ET par les'
  ' deux politiques ci-dessus : la première le garantit, les secondes'
  ' l''énoncent, et le contrôle 05 refuse que l''une des deux disparaisse sans'
  ' que l''autre soit interrogée.';

-- Inscription au registre, dans la transaction de la migration elle-même.
insert into supabase_migrations.schema_migrations (version, name)
values ('20260910120000', 'check_the_decision_tenant')
on conflict (version) do nothing;
