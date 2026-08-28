-- Retour arrière de 20260809090000_separate_tenant_admin.sql.
--
-- À appliquer, comme la migration elle-même, en une seule transaction :
--   psql -1 -v ON_ERROR_STOP=1 -f <ce fichier>
-- Sans cette enveloppe, un échec après les `drop policy` laisserait les tables
-- sans politique de lecture : la RLS refuserait tout, et un `alter table ...
-- disable row level security` improvisé pour « débloquer » ouvrirait le parc.
--
-- Restaure l’état de 20260807195608 : l’administration redevient le rôle
-- `tenant_admin`, et le drapeau disparaît.

drop policy audit_events_select_governance on public.audit_events;
create policy audit_events_select_governance on public.audit_events for select to authenticated
using ((select private.has_tenant_role(tenant_id, array['daf', 'dg', 'tenant_admin'])));

drop policy grants_manage_admin on public.dimension_grants;
create policy grants_manage_admin on public.dimension_grants for all to authenticated
using ((select private.has_tenant_role(tenant_id, array['tenant_admin'])))
with check ((select private.has_tenant_role(tenant_id, array['tenant_admin'])));

drop policy grants_select_self_or_admin on public.dimension_grants;
create policy grants_select_self_or_admin on public.dimension_grants for select to authenticated
using (user_id = (select auth.uid()) or (select private.has_tenant_role(tenant_id, array['tenant_admin'])));

drop policy dimensions_manage_admin on public.dimensions;
create policy dimensions_manage_admin on public.dimensions for all to authenticated
using ((select private.has_tenant_role(tenant_id, array['tenant_admin'])))
with check ((select private.has_tenant_role(tenant_id, array['tenant_admin'])));

drop policy dimensions_select_scope on public.dimensions;
create policy dimensions_select_scope on public.dimensions for select to authenticated
using ((select private.has_tenant_role(tenant_id, array['tenant_admin'])) or (select private.has_dimension_permission(tenant_id, id, 'read')));

drop policy memberships_delete_admin on public.tenant_memberships;
create policy memberships_delete_admin on public.tenant_memberships for delete to authenticated
using ((select private.has_tenant_role(tenant_id, array['tenant_admin'])));

drop policy memberships_update_admin on public.tenant_memberships;
create policy memberships_update_admin on public.tenant_memberships for update to authenticated
using ((select private.has_tenant_role(tenant_id, array['tenant_admin'])))
with check ((select private.has_tenant_role(tenant_id, array['tenant_admin'])));

drop policy memberships_insert_admin on public.tenant_memberships;
create policy memberships_insert_admin on public.tenant_memberships for insert to authenticated
with check ((select private.has_tenant_role(tenant_id, array['tenant_admin'])));

drop policy memberships_select_self_or_admin on public.tenant_memberships;
create policy memberships_select_self_or_admin on public.tenant_memberships for select to authenticated
using (user_id = (select auth.uid()) or (select private.has_tenant_role(tenant_id, array['tenant_admin'])));

drop policy tenants_update_admin on public.tenants;
create policy tenants_update_admin on public.tenants for update to authenticated
using ((select private.has_tenant_role(id, array['tenant_admin'])))
with check ((select private.has_tenant_role(id, array['tenant_admin'])));

-- Les fonctions ne partent qu’une fois toutes les politiques détachées d’elles.
drop function public.list_tenant_members(uuid);
drop function private.is_tenant_admin(uuid);

-- Le drapeau part en dernier : les membres promus par le seul booléen
-- redeviennent de simples membres, ce qui est bien l’état d’avant.
alter table public.tenant_memberships drop column is_tenant_admin;
