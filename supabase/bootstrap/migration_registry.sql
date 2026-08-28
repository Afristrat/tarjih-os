-- Registre des migrations appliquées.
--
-- Ce fichier n'est pas une migration et ne vit pas dans `supabase/migrations/` :
-- il crée la table qui recense les migrations, ce qu'une migration ne peut pas
-- faire pour elle-même. La CLI Supabase la crée de la même façon, hors du flux
-- des migrations, avant d'y écrire quoi que ce soit.
--
-- La forme reproduite ici n'est pas reconstituée de mémoire : elle a été relevée
-- le 28 août 2026 sur une base du même serveur dont le registre a réellement été
-- créé par la CLI (`version text not null` clé primaire, `statements text[]`,
-- `name text` ; schéma et table appartenant à `postgres`, sans aucun grant).
--
-- Pas de RLS, volontairement, et c'est plus sûr que d'en poser : le schéma
-- `supabase_migrations` n'est pas exposé par PostgREST et n'accorde `usage` à
-- personne — ni `anon`, ni `authenticated`. La table est donc hors d'atteinte de
-- l'API, quand une RLS ajoutée ici divergerait de la primitive de la plateforme
-- et casserait une future commande de la CLI.
--
-- Application, une seule fois, en une transaction :
--   psql -U postgres -d postgres -1 -v ON_ERROR_STOP=1 -f migration_registry.sql

create schema if not exists supabase_migrations;

create table if not exists supabase_migrations.schema_migrations (
  version text not null primary key,
  statements text[],
  name text
);

-- Rattrapage des deux migrations appliquées avant l'existence du registre.
-- Leur présence n'est pas déclarée de mémoire : elle a été établie objet par
-- objet contre la base de production le 28 août 2026 — 8 objets sur 8 pour
-- `20260807195608`, 2 sur 2 pour `20260809090000`, 0 sur 5 pour `20260809090100`,
-- qui n'est donc pas inscrite ici.
--
-- C'est le dernier moment où ce constat pouvait être fait par lecture directe :
-- passé une troisième migration posée à la main, le rattrapage se serait fait de
-- mémoire, ce qui aurait vidé le registre de sa valeur de preuve.
insert into supabase_migrations.schema_migrations (version, name)
values
  ('20260807195608', 'create_multitenant_financial_model'),
  ('20260809090000', 'separate_tenant_admin')
on conflict (version) do nothing;

-- Preuve immédiate, dans la même transaction que la création.
select version, name from supabase_migrations.schema_migrations order by version;
