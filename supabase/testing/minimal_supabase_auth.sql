-- Socle minimal pour rejouer le schéma sur une base qui n'a PAS le socle
-- Supabase : les rôles, le schéma `auth`, la table `auth.users` avec les
-- colonnes que les migrations, les contrôles pgTAP et le jeu de recette
-- touchent, et `auth.uid()`. Tout est idempotent (`if not exists`) : sur une
-- base qui porte déjà le vrai socle (image `supabase/postgres`, production), le
-- fichier ne remplace rien — en particulier pas `auth.uid()`, dont la version de
-- la plateforme reste celle qui est éprouvée. Sur l'image de la plateforme, le
-- schéma `auth` n'appartient pas à `postgres` : jouer ce fichier en
-- `supabase_admin` (cf. `scripts/db-gates.sh`, `PSQL_ADMIN`).

set client_min_messages = warning;

-- Schéma `extensions` tel que la plateforme le livre : `pgtap` et `pgcrypto` y
-- vivent, il est dans le `search_path` de la base et les rôles applicatifs y ont
-- `usage` — sans quoi `is()`, `ok()` ou `crypt()` ne se résolvent pas sous
-- `set local role authenticated`.
create schema if not exists extensions;
grant usage on schema extensions to anon, authenticated;
do $$
begin
  execute format(
    'alter database %I set search_path to "$user", public, extensions',
    current_database()
  );
end
$$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin;
  end if;
end
$$;

-- Privilèges par défaut que la plateforme pose pour `postgres` dans `public`
-- (relevés en production le 2026-09-14 : tables, séquences et fonctions, aux
-- trois rôles applicatifs). C'est la source du défaut que
-- `20260906140000_close_anon_on_version_states` ferme et que
-- `03_schema_invariants` surveille : sans eux, ni la migration ni le contrôle
-- n'éprouveraient rien. Idempotent : redonner un privilège déjà donné ne change rien.
alter default privileges for role postgres in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all on sequences to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all on functions to anon, authenticated, service_role;

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

-- Sur l'image de la plateforme, `auth.users` existe déjà dans sa forme
-- d'origine, antérieure aux migrations de GoTrue (pas de `email_confirmed_at`,
-- par exemple) : le `create table if not exists` n'a rien fait, et chaque
-- colonne attendue se pose une à une.
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
-- Colonnes que GoTrue lit dans des chaînes Go non nullables ; le jeu de recette
-- les pose à la chaîne vide (cf. `docs/deployment-tarjih.md`, « Comptes »).
alter table auth.users add column if not exists confirmation_token text;
alter table auth.users add column if not exists recovery_token text;
alter table auth.users add column if not exists email_change_token_new text;
alter table auth.users add column if not exists email_change text;
alter table auth.users add column if not exists email_change_token_current text;
alter table auth.users add column if not exists phone_change text;
alter table auth.users add column if not exists phone_change_token text;
alter table auth.users add column if not exists reauthentication_token text;

-- Forme relevée en production le 2026-09-14 (colonnes et contraintes de GoTrue) :
-- le jeu de recette y écrit une identité `email` par compte.
create table if not exists auth.identities (
  id uuid primary key default gen_random_uuid(),
  provider_id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  identity_data jsonb not null,
  provider text not null,
  last_sign_in_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  email text,
  unique (provider_id, provider)
);

-- En production ces deux tables appartiennent à `supabase_auth_admin` (GoTrue
-- les crée) et `postgres` — qui n'y est PAS superutilisateur — y reçoit tous
-- les privilèges. Reproduit quand le rôle existe et que l'exécutant peut le
-- faire (image de la plateforme, socle joué par `supabase_admin`) ; sur une base
-- jetable d'un cluster réel créée par `postgres`, qui n'est pas membre du rôle,
-- `postgres` reste propriétaire — sans effet sur ce que la chaîne éprouve.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin')
     and pg_has_role('supabase_auth_admin', 'member') then
    alter table auth.users owner to supabase_auth_admin;
    alter table auth.identities owner to supabase_auth_admin;
  end if;
end
$$;
grant all on auth.users, auth.identities to postgres;

do $$
begin
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'auth' and p.proname = 'uid'
  ) then
    create function auth.uid()
    returns uuid
    language sql
    stable
    set search_path = ''
    as 'select nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';
  end if;
end
$$;
