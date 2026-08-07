do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end
$$;

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key,
  instance_id uuid,
  aud text,
  role text,
  email text,
  encrypted_password text,
  email_confirmed_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  raw_app_meta_data jsonb,
  raw_user_meta_data jsonb,
  is_super_admin boolean
);

alter table auth.users add column if not exists instance_id uuid;
alter table auth.users add column if not exists aud text;
alter table auth.users add column if not exists role text;
alter table auth.users add column if not exists email text;
alter table auth.users add column if not exists encrypted_password text;
alter table auth.users add column if not exists email_confirmed_at timestamptz;
alter table auth.users add column if not exists created_at timestamptz;
alter table auth.users add column if not exists updated_at timestamptz;
alter table auth.users add column if not exists raw_app_meta_data jsonb;
alter table auth.users add column if not exists raw_user_meta_data jsonb;
alter table auth.users add column if not exists is_super_admin boolean;

create or replace function auth.uid()
returns uuid
language sql
stable
set search_path = ''
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
