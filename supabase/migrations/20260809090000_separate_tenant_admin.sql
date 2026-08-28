-- Task 04 : séparer l'administration technique du pouvoir financier.
-- Un administrateur de tenant gère la structure et les droits ; il n'obtient
-- aucune lecture de chiffre sans grant dimensionnel explicite.

alter table public.tenant_memberships
add column is_tenant_admin boolean not null default false;

update public.tenant_memberships
set is_tenant_admin = true
where role = 'tenant_admin';

create or replace function private.is_tenant_admin(target_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1
    from public.tenant_memberships membership
    where membership.tenant_id = target_tenant_id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
      and (membership.is_tenant_admin or membership.role = 'tenant_admin')
  );
$$;

revoke all on function private.is_tenant_admin(uuid) from public, anon;
grant execute on function private.is_tenant_admin(uuid) to authenticated;

drop policy tenants_update_admin on public.tenants;
create policy tenants_update_admin on public.tenants for update to authenticated
using ((select private.is_tenant_admin(id)))
with check ((select private.is_tenant_admin(id)));

drop policy memberships_select_self_or_admin on public.tenant_memberships;
create policy memberships_select_self_or_admin on public.tenant_memberships for select to authenticated
using (user_id = (select auth.uid()) or (select private.is_tenant_admin(tenant_id)));

drop policy memberships_insert_admin on public.tenant_memberships;
create policy memberships_insert_admin on public.tenant_memberships for insert to authenticated
with check ((select private.is_tenant_admin(tenant_id)));

drop policy memberships_update_admin on public.tenant_memberships;
create policy memberships_update_admin on public.tenant_memberships for update to authenticated
using ((select private.is_tenant_admin(tenant_id)))
with check ((select private.is_tenant_admin(tenant_id)));

drop policy memberships_delete_admin on public.tenant_memberships;
create policy memberships_delete_admin on public.tenant_memberships for delete to authenticated
using ((select private.is_tenant_admin(tenant_id)));

drop policy dimensions_select_scope on public.dimensions;
create policy dimensions_select_scope on public.dimensions for select to authenticated
using ((select private.is_tenant_admin(tenant_id)) or (select private.has_dimension_permission(tenant_id, id, 'read')));

drop policy dimensions_manage_admin on public.dimensions;
create policy dimensions_manage_admin on public.dimensions for all to authenticated
using ((select private.is_tenant_admin(tenant_id)))
with check ((select private.is_tenant_admin(tenant_id)));

drop policy grants_select_self_or_admin on public.dimension_grants;
create policy grants_select_self_or_admin on public.dimension_grants for select to authenticated
using (user_id = (select auth.uid()) or (select private.is_tenant_admin(tenant_id)));

drop policy grants_manage_admin on public.dimension_grants;
create policy grants_manage_admin on public.dimension_grants for all to authenticated
using ((select private.is_tenant_admin(tenant_id)))
with check ((select private.is_tenant_admin(tenant_id)));

-- L'audit est le contrôle de l'administrateur sur les mutations qu'il autorise.
-- Sans cette reprise, un administrateur désigné par le seul booléen resterait
-- aveugle à sa propre trace, puisque la lecture restait attachée au rôle.
drop policy audit_events_select_governance on public.audit_events;
create policy audit_events_select_governance on public.audit_events for select to authenticated
using ((select private.has_tenant_role(tenant_id, array['daf', 'dg'])) or (select private.is_tenant_admin(tenant_id)));

create or replace function public.list_tenant_members(target_tenant_id uuid)
returns table (
  user_id uuid,
  email text,
  role text,
  status text,
  is_tenant_admin boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select membership.user_id,
         auth_user.email::text,
         membership.role,
         membership.status,
         membership.is_tenant_admin
  from public.tenant_memberships membership
  join auth.users auth_user on auth_user.id = membership.user_id
  where membership.tenant_id = target_tenant_id
    and (select private.is_tenant_admin(target_tenant_id))
  order by lower(auth_user.email);
$$;

revoke all on function public.list_tenant_members(uuid) from public, anon;
grant execute on function public.list_tenant_members(uuid) to authenticated;
