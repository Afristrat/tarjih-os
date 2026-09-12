-- Retour arrière de 20260910120000_check_the_decision_tenant.sql.
--
-- À appliquer, comme la migration elle-même, en une seule transaction :
--   psql -1 -v ON_ERROR_STOP=1 -f <ce fichier>
--
-- CE QU'IL DÉTRUIT : rien de mesurable. Il remet les deux politiques dans leur
-- rédaction d'origine, celle où `hypothesis.tenant_id = tenant_id` se résout en
-- tautologie. Aucune ligne n'est touchée, aucune donnée n'est perdue, et le
-- comportement observable ne change pas d'un cheveu tant que la clé étrangère
-- composite `hypothesis_decisions_tenant_id_hypothesis_id_fkey` tient — c'est
-- elle, et elle seule, qui empêchait déjà l'incohérence avant la migration.
--
-- CE QU'IL RÉOUVRE, en revanche : la possibilité qu'une migration ultérieure
-- retire cette clé étrangère en la croyant redondante avec des politiques qui,
-- redevenues tautologiques, ne rattraperaient rien. C'est le seul motif pour
-- lequel la migration existe ; l'annuler consiste donc à réintroduire
-- volontairement cette dépendance à un mécanisme unique.
--
-- Le contrôle `05_hypothesis_governance` échouera après ce retour arrière : il
-- vérifie que la RLS refuse elle-même le tenant étranger, ce qui redeviendra
-- faux. C'est voulu — un retour arrière silencieux serait pire.

drop policy if exists decisions_select_scope on public.hypothesis_decisions;

create policy decisions_select_scope on public.hypothesis_decisions for select to authenticated
using (exists (
  select 1 from public.hypotheses hypothesis
  where hypothesis.id = hypothesis_id
    and hypothesis.tenant_id = tenant_id
    and (select private.has_dimension_permission(tenant_id, hypothesis.dimension_id, 'read'))
));

drop policy if exists decisions_insert_approver on public.hypothesis_decisions;

create policy decisions_insert_approver on public.hypothesis_decisions for insert to authenticated
with check (decided_by = (select auth.uid()) and exists (
  select 1 from public.hypotheses hypothesis
  where hypothesis.id = hypothesis_id
    and hypothesis.tenant_id = tenant_id
    and (select private.has_dimension_permission(tenant_id, hypothesis.dimension_id, 'approve'))
));

comment on table public.hypothesis_decisions is null;

delete from supabase_migrations.schema_migrations where version = '20260910120000';
