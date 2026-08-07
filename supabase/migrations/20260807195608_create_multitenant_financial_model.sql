create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 160),
  base_currency text not null check (base_currency ~ '^[A-Z]{3}$'),
  created_at timestamptz not null default now()
);

create table public.tenant_memberships (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('contributor', 'daf', 'dg', 'tenant_admin')),
  status text not null default 'active' check (status in ('invited', 'active', 'suspended')),
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

create table public.dimensions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  kind text not null check (kind in ('entity', 'department', 'project', 'product', 'channel', 'geography')),
  code text not null check (length(btrim(code)) between 1 and 64),
  name text not null check (length(btrim(name)) between 1 and 160),
  parent_id uuid,
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, kind, code),
  foreign key (tenant_id, parent_id) references public.dimensions(tenant_id, id)
);

create table public.dimension_grants (
  tenant_id uuid not null,
  user_id uuid not null,
  dimension_id uuid not null,
  can_read boolean not null default false,
  can_contribute boolean not null default false,
  can_approve boolean not null default false,
  can_export boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id, dimension_id),
  foreign key (tenant_id, user_id) references public.tenant_memberships(tenant_id, user_id) on delete cascade,
  foreign key (tenant_id, dimension_id) references public.dimensions(tenant_id, id) on delete cascade,
  check (can_read or can_contribute or can_approve or can_export)
);

create table public.financial_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  code text not null check (length(btrim(code)) between 1 and 64),
  name text not null check (length(btrim(name)) between 1 and 160),
  statement text not null check (statement in ('income_statement', 'balance_sheet', 'cash_flow', 'kpi')),
  normal_balance text not null check (normal_balance in ('debit', 'credit', 'none')),
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, code)
);

create table public.periods (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  starts_on date not null,
  ends_on date not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, starts_on, ends_on),
  check (ends_on >= starts_on)
);

create table public.budget_cycles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 160),
  status text not null default 'draft' check (status in ('draft', 'open', 'review', 'closed')),
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, name)
);

create table public.budget_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  cycle_id uuid not null,
  version_no integer not null check (version_no > 0),
  status text not null default 'draft' check (status in ('draft', 'calculating', 'ready', 'published', 'superseded', 'failed')),
  parent_version_id uuid,
  input_hash text check (input_hash is null or input_hash ~ '^[0-9a-f]{64}$'),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (cycle_id, version_no),
  foreign key (tenant_id, cycle_id) references public.budget_cycles(tenant_id, id) on delete cascade,
  foreign key (tenant_id, parent_version_id) references public.budget_versions(tenant_id, id),
  check ((status = 'published' and published_at is not null) or (status <> 'published'))
);

create table public.hypotheses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  version_id uuid not null,
  dimension_id uuid not null,
  parameter_key text not null check (length(btrim(parameter_key)) between 1 and 160),
  value jsonb not null,
  unit text not null check (length(btrim(unit)) between 1 and 32),
  status text not null default 'proposed' check (status in ('proposed', 'approved', 'rejected')),
  proposed_by uuid not null references auth.users(id),
  row_version integer not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, version_id, dimension_id, parameter_key),
  foreign key (tenant_id, version_id) references public.budget_versions(tenant_id, id) on delete cascade,
  foreign key (tenant_id, dimension_id) references public.dimensions(tenant_id, id)
);

create table public.hypothesis_decisions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hypothesis_id uuid not null,
  decision text not null check (decision in ('approved', 'rejected')),
  decided_by uuid not null references auth.users(id),
  reason text not null check (length(btrim(reason)) > 0),
  created_at timestamptz not null default now(),
  foreign key (tenant_id, hypothesis_id) references public.hypotheses(tenant_id, id)
);

create table public.calculation_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  version_id uuid not null,
  engine_version text not null,
  input_hash text not null check (input_hash ~ '^[0-9a-f]{64}$'),
  output_hash text check (output_hash is null or output_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (tenant_id, id),
  foreign key (tenant_id, version_id) references public.budget_versions(tenant_id, id)
);

create table public.budget_values (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  version_id uuid not null,
  calculation_run_id uuid not null,
  dimension_id uuid not null,
  account_id uuid not null,
  period_id uuid not null,
  amount numeric(24, 6) not null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  created_at timestamptz not null default now(),
  unique (tenant_id, version_id, dimension_id, account_id, period_id),
  foreign key (tenant_id, version_id) references public.budget_versions(tenant_id, id),
  foreign key (tenant_id, calculation_run_id) references public.calculation_runs(tenant_id, id),
  foreign key (tenant_id, dimension_id) references public.dimensions(tenant_id, id),
  foreign key (tenant_id, account_id) references public.financial_accounts(tenant_id, id),
  foreign key (tenant_id, period_id) references public.periods(tenant_id, id)
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants(id),
  actor_id uuid references auth.users(id),
  action text not null,
  object_type text not null,
  object_id text not null,
  before_hash text check (before_hash is null or before_hash ~ '^[0-9a-f]{64}$'),
  after_hash text check (after_hash is null or after_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);

create table public.exports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  requested_by uuid not null references auth.users(id),
  version_id uuid not null,
  dimension_id uuid,
  scope_hash text not null check (scope_hash ~ '^[0-9a-f]{64}$'),
  file_hash text check (file_hash is null or file_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'requested' check (status in ('requested', 'processing', 'ready', 'expired', 'failed')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, version_id) references public.budget_versions(tenant_id, id),
  foreign key (tenant_id, dimension_id) references public.dimensions(tenant_id, id),
  check (expires_at > created_at)
);

create index tenant_memberships_user_tenant_idx on public.tenant_memberships(user_id, tenant_id) where status = 'active';
create index dimension_grants_user_tenant_dimension_idx on public.dimension_grants(user_id, tenant_id, dimension_id);
create index dimensions_tenant_parent_idx on public.dimensions(tenant_id, parent_id);
create index hypotheses_scope_idx on public.hypotheses(tenant_id, version_id, dimension_id, status);
create index hypothesis_decisions_hypothesis_idx on public.hypothesis_decisions(tenant_id, hypothesis_id);
create index calculation_runs_version_idx on public.calculation_runs(tenant_id, version_id);
create index budget_values_scope_idx on public.budget_values(tenant_id, version_id, dimension_id, period_id, account_id);
create index audit_events_tenant_created_idx on public.audit_events(tenant_id, created_at desc);
create index exports_requester_idx on public.exports(requested_by, tenant_id);

create or replace function private.is_tenant_member(target_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.tenant_memberships membership
    where membership.tenant_id = target_tenant_id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
  );
$$;

create or replace function private.has_tenant_role(target_tenant_id uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.tenant_memberships membership
    where membership.tenant_id = target_tenant_id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
      and membership.role = any(allowed_roles)
  );
$$;

create or replace function private.has_dimension_permission(
  target_tenant_id uuid,
  target_dimension_id uuid,
  requested_permission text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select requested_permission in ('read', 'contribute', 'approve', 'export')
    and (select auth.uid()) is not null
    and (
      (select private.has_tenant_role(target_tenant_id, array['daf', 'dg']))
      or exists (
        select 1
        from public.dimension_grants permission_grant
        join public.tenant_memberships membership
          on membership.tenant_id = permission_grant.tenant_id
         and membership.user_id = permission_grant.user_id
         and membership.status = 'active'
        where permission_grant.tenant_id = target_tenant_id
          and permission_grant.dimension_id = target_dimension_id
          and permission_grant.user_id = (select auth.uid())
          and case requested_permission
            when 'read' then permission_grant.can_read
            when 'contribute' then permission_grant.can_contribute
            when 'approve' then permission_grant.can_approve
            when 'export' then permission_grant.can_export
            else false
          end
      )
    );
$$;

revoke all on function private.is_tenant_member(uuid) from public, anon;
revoke all on function private.has_tenant_role(uuid, text[]) from public, anon;
revoke all on function private.has_dimension_permission(uuid, uuid, text) from public, anon;
grant execute on function private.is_tenant_member(uuid) to authenticated;
grant execute on function private.has_tenant_role(uuid, text[]) to authenticated;
grant execute on function private.has_dimension_permission(uuid, uuid, text) to authenticated;

create or replace function private.reject_append_only_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% is append-only', tg_table_name using errcode = '55000';
end;
$$;

create trigger hypothesis_decisions_append_only
before update or delete on public.hypothesis_decisions
for each row execute function private.reject_append_only_mutation();

create trigger audit_events_append_only
before update or delete on public.audit_events
for each row execute function private.reject_append_only_mutation();

create or replace function private.record_audit_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  before_row jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  after_row jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;
  tenant_value uuid := coalesce(
    nullif(after_row ->> 'tenant_id', '')::uuid,
    nullif(before_row ->> 'tenant_id', '')::uuid,
    nullif(after_row ->> 'id', '')::uuid,
    nullif(before_row ->> 'id', '')::uuid
  );
  object_value text := coalesce(after_row ->> 'id', before_row ->> 'id', 'composite-key');
begin
  insert into public.audit_events (
    tenant_id,
    actor_id,
    action,
    object_type,
    object_id,
    before_hash,
    after_hash
  ) values (
    tenant_value,
    (select auth.uid()),
    lower(tg_op),
    tg_table_name,
    object_value,
    case when before_row is null then null else encode(extensions.digest(before_row::text, 'sha256'), 'hex') end,
    case when after_row is null then null else encode(extensions.digest(after_row::text, 'sha256'), 'hex') end
  );
  return coalesce(new, old);
end;
$$;

revoke all on function private.reject_append_only_mutation() from public, anon, authenticated;
revoke all on function private.record_audit_event() from public, anon, authenticated;

create trigger tenants_audit after insert or update or delete on public.tenants
for each row execute function private.record_audit_event();
create trigger memberships_audit after insert or update or delete on public.tenant_memberships
for each row execute function private.record_audit_event();
create trigger dimensions_audit after insert or update or delete on public.dimensions
for each row execute function private.record_audit_event();
create trigger dimension_grants_audit after insert or update or delete on public.dimension_grants
for each row execute function private.record_audit_event();
create trigger financial_accounts_audit after insert or update or delete on public.financial_accounts
for each row execute function private.record_audit_event();
create trigger periods_audit after insert or update or delete on public.periods
for each row execute function private.record_audit_event();
create trigger budget_cycles_audit after insert or update or delete on public.budget_cycles
for each row execute function private.record_audit_event();
create trigger budget_versions_audit after insert or update or delete on public.budget_versions
for each row execute function private.record_audit_event();
create trigger hypotheses_audit after insert or update or delete on public.hypotheses
for each row execute function private.record_audit_event();
create trigger hypothesis_decisions_audit after insert on public.hypothesis_decisions
for each row execute function private.record_audit_event();
create trigger calculation_runs_audit after insert or update or delete on public.calculation_runs
for each row execute function private.record_audit_event();
create trigger budget_values_audit after insert or update or delete on public.budget_values
for each row execute function private.record_audit_event();
create trigger exports_audit after insert or update or delete on public.exports
for each row execute function private.record_audit_event();

alter table public.tenants enable row level security;
alter table public.tenant_memberships enable row level security;
alter table public.dimensions enable row level security;
alter table public.dimension_grants enable row level security;
alter table public.financial_accounts enable row level security;
alter table public.periods enable row level security;
alter table public.budget_cycles enable row level security;
alter table public.budget_versions enable row level security;
alter table public.hypotheses enable row level security;
alter table public.hypothesis_decisions enable row level security;
alter table public.calculation_runs enable row level security;
alter table public.budget_values enable row level security;
alter table public.audit_events enable row level security;
alter table public.exports enable row level security;

create policy tenants_select_member on public.tenants for select to authenticated
using ((select private.is_tenant_member(id)));
create policy tenants_update_admin on public.tenants for update to authenticated
using ((select private.has_tenant_role(id, array['tenant_admin'])))
with check ((select private.has_tenant_role(id, array['tenant_admin'])));

create policy memberships_select_self_or_admin on public.tenant_memberships for select to authenticated
using (user_id = (select auth.uid()) or (select private.has_tenant_role(tenant_id, array['tenant_admin'])));
create policy memberships_insert_admin on public.tenant_memberships for insert to authenticated
with check ((select private.has_tenant_role(tenant_id, array['tenant_admin'])));
create policy memberships_update_admin on public.tenant_memberships for update to authenticated
using ((select private.has_tenant_role(tenant_id, array['tenant_admin'])))
with check ((select private.has_tenant_role(tenant_id, array['tenant_admin'])));
create policy memberships_delete_admin on public.tenant_memberships for delete to authenticated
using ((select private.has_tenant_role(tenant_id, array['tenant_admin'])));

create policy dimensions_select_scope on public.dimensions for select to authenticated
using ((select private.has_tenant_role(tenant_id, array['tenant_admin'])) or (select private.has_dimension_permission(tenant_id, id, 'read')));
create policy dimensions_manage_admin on public.dimensions for all to authenticated
using ((select private.has_tenant_role(tenant_id, array['tenant_admin'])))
with check ((select private.has_tenant_role(tenant_id, array['tenant_admin'])));

create policy grants_select_self_or_admin on public.dimension_grants for select to authenticated
using (user_id = (select auth.uid()) or (select private.has_tenant_role(tenant_id, array['tenant_admin'])));
create policy grants_manage_admin on public.dimension_grants for all to authenticated
using ((select private.has_tenant_role(tenant_id, array['tenant_admin'])))
with check ((select private.has_tenant_role(tenant_id, array['tenant_admin'])));

create policy accounts_select_member on public.financial_accounts for select to authenticated
using ((select private.is_tenant_member(tenant_id)));
create policy accounts_manage_finance on public.financial_accounts for all to authenticated
using ((select private.has_tenant_role(tenant_id, array['daf', 'dg'])))
with check ((select private.has_tenant_role(tenant_id, array['daf', 'dg'])));

create policy periods_select_member on public.periods for select to authenticated
using ((select private.is_tenant_member(tenant_id)));
create policy periods_manage_finance on public.periods for all to authenticated
using ((select private.has_tenant_role(tenant_id, array['daf', 'dg'])))
with check ((select private.has_tenant_role(tenant_id, array['daf', 'dg'])));

create policy cycles_select_member on public.budget_cycles for select to authenticated
using ((select private.is_tenant_member(tenant_id)));
create policy cycles_manage_finance on public.budget_cycles for all to authenticated
using ((select private.has_tenant_role(tenant_id, array['daf', 'dg'])))
with check ((select private.has_tenant_role(tenant_id, array['daf', 'dg'])));

create policy versions_select_member on public.budget_versions for select to authenticated
using ((select private.is_tenant_member(tenant_id)));
create policy versions_manage_finance on public.budget_versions for all to authenticated
using ((select private.has_tenant_role(tenant_id, array['daf', 'dg'])))
with check ((select private.has_tenant_role(tenant_id, array['daf', 'dg'])));

create policy hypotheses_select_scope on public.hypotheses for select to authenticated
using ((select private.has_dimension_permission(tenant_id, dimension_id, 'read')));
create policy hypotheses_insert_contributor on public.hypotheses for insert to authenticated
with check (proposed_by = (select auth.uid()) and status = 'proposed' and (select private.has_dimension_permission(tenant_id, dimension_id, 'contribute')));
create policy hypotheses_update_contributor on public.hypotheses for update to authenticated
using (status = 'proposed' and proposed_by = (select auth.uid()) and (select private.has_dimension_permission(tenant_id, dimension_id, 'contribute')))
with check (status = 'proposed' and proposed_by = (select auth.uid()) and (select private.has_dimension_permission(tenant_id, dimension_id, 'contribute')));

create policy decisions_select_scope on public.hypothesis_decisions for select to authenticated
using (exists (
  select 1 from public.hypotheses hypothesis
  where hypothesis.id = hypothesis_id
    and hypothesis.tenant_id = tenant_id
    and (select private.has_dimension_permission(tenant_id, hypothesis.dimension_id, 'read'))
));
create policy decisions_insert_approver on public.hypothesis_decisions for insert to authenticated
with check (decided_by = (select auth.uid()) and exists (
  select 1 from public.hypotheses hypothesis
  where hypothesis.id = hypothesis_id
    and hypothesis.tenant_id = tenant_id
    and (select private.has_dimension_permission(tenant_id, hypothesis.dimension_id, 'approve'))
));

create policy calculation_runs_select_finance on public.calculation_runs for select to authenticated
using ((select private.has_tenant_role(tenant_id, array['daf', 'dg'])));
create policy budget_values_select_scope on public.budget_values for select to authenticated
using ((select private.has_dimension_permission(tenant_id, dimension_id, 'read')));

create policy audit_events_select_governance on public.audit_events for select to authenticated
using ((select private.has_tenant_role(tenant_id, array['daf', 'dg', 'tenant_admin'])));

create policy exports_select_requester_or_finance on public.exports for select to authenticated
using (requested_by = (select auth.uid()) or (select private.has_tenant_role(tenant_id, array['daf', 'dg'])));
create policy exports_insert_authorized on public.exports for insert to authenticated
with check (
  requested_by = (select auth.uid())
  and (
    (dimension_id is null and (select private.has_tenant_role(tenant_id, array['daf', 'dg'])))
    or (dimension_id is not null and (select private.has_dimension_permission(tenant_id, dimension_id, 'export')))
  )
);

grant select, update on public.tenants to authenticated;
grant select, insert, update, delete on public.tenant_memberships, public.dimensions, public.dimension_grants to authenticated;
grant select, insert, update, delete on public.financial_accounts, public.periods, public.budget_cycles, public.budget_versions to authenticated;
grant select, insert, update on public.hypotheses to authenticated;
grant select, insert on public.hypothesis_decisions to authenticated;
grant select on public.calculation_runs, public.budget_values, public.audit_events to authenticated;
grant select, insert on public.exports to authenticated;

revoke update, delete on public.hypothesis_decisions from authenticated;
revoke insert, update, delete on public.audit_events from authenticated;

revoke all on all tables in schema public from anon;
