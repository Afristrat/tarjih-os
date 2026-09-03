-- Jeu de recette du parcours vertical (task 09).
--
-- Ce fichier n'est PAS une migration : il ne touche à aucun objet de schéma et
-- ne s'inscrit pas dans `supabase_migrations.schema_migrations`. Il pose des
-- DONNÉES, dans deux tenants qui ne sont et ne seront jamais un client.
--
-- Pourquoi deux tenants : le parcours a besoin d'un contributeur, d'un
-- approbateur et d'un publicateur ; le contrôle négatif a besoin d'un compte
-- parfaitement légitime AILLEURS, pour prouver qu'un tenant n'est pas
-- seulement caché mais introuvable.
--
-- Pourquoi un tenant dédié plutôt que celui des données réelles : chaque
-- exécution publie une version, et une version publiée est immuable — elle ne
-- peut donc pas être nettoyée après coup. Le résidu s'accumule, et il doit
-- s'accumuler à l'écart.
--
-- Les mots de passe ne sont PAS dans ce fichier. Les marqueurs en majuscules
-- encadrés de doubles soulignés sont remplacés au moment de l'exécution, depuis
-- le coffre ; aucune valeur n'apparaît dans le dépôt, dans une ligne de commande
-- ni dans un journal.
--
-- Réexécutable : chaque insertion retombe sur `on conflict`, et les mots de
-- passe sont réécrits à chaque passage.

\set ON_ERROR_STOP on

begin;

-- ---------------------------------------------------------------- tenants --

insert into public.tenants (id, name, base_currency) values
  ('e2e00000-0000-4000-8000-000000000001', 'Recette e2e', 'MAD'),
  ('e2e00000-0000-4000-8000-000000000002', 'Recette e2e — tiers', 'MAD')
on conflict (id) do update set name = excluded.name;

-- ------------------------------------------------------------------ users --
-- `email_confirmed_at` est posé d'office : l'instance a
-- `ENABLE_EMAIL_AUTOCONFIRM=false`, et un compte de recette n'a pas de boîte
-- aux lettres où aller chercher un lien.

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('e2e00000-0000-4000-8000-000000000021', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'e2e-contributeur@tarjih-os.com',
   extensions.crypt('__PW_CONTRIB__', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('e2e00000-0000-4000-8000-000000000022', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'e2e-daf@tarjih-os.com',
   extensions.crypt('__PW_DAF__', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('e2e00000-0000-4000-8000-000000000023', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'e2e-dg@tarjih-os.com',
   extensions.crypt('__PW_DG__', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('e2e00000-0000-4000-8000-000000000024', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'e2e-intrus@tarjih-os.com',
   extensions.crypt('__PW_INTRUS__', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now())
on conflict (id) do update
  set encrypted_password = excluded.encrypted_password,
      email_confirmed_at = coalesce(auth.users.email_confirmed_at, excluded.email_confirmed_at),
      updated_at = now();

-- Sans identité « email », GoTrue refuse la connexion par mot de passe.
insert into auth.identities (
  provider_id, user_id, identity_data, provider, created_at, updated_at
)
select
  users.id::text,
  users.id,
  jsonb_build_object('sub', users.id::text, 'email', users.email, 'email_verified', true),
  'email',
  now(),
  now()
from auth.users users
where users.email like 'e2e-%@tarjih-os.com'
on conflict (provider_id, provider) do nothing;

-- ------------------------------------------------------------ membrships --
-- Aucun de ces comptes n'est `is_tenant_admin` : la recette doit jouer le
-- parcours financier, pas l'administration du tenant.

insert into public.tenant_memberships (tenant_id, user_id, role, status, is_tenant_admin) values
  ('e2e00000-0000-4000-8000-000000000001', 'e2e00000-0000-4000-8000-000000000021', 'contributor', 'active', false),
  ('e2e00000-0000-4000-8000-000000000001', 'e2e00000-0000-4000-8000-000000000022', 'daf', 'active', false),
  ('e2e00000-0000-4000-8000-000000000001', 'e2e00000-0000-4000-8000-000000000023', 'dg', 'active', false),
  ('e2e00000-0000-4000-8000-000000000002', 'e2e00000-0000-4000-8000-000000000024', 'daf', 'active', false)
on conflict (tenant_id, user_id) do update
  set role = excluded.role,
      status = excluded.status,
      is_tenant_admin = excluded.is_tenant_admin;

-- ------------------------------------------------------------- dimensions --

insert into public.dimensions (id, tenant_id, kind, code, name) values
  ('e2e00000-0000-4000-8000-000000000010', 'e2e00000-0000-4000-8000-000000000001',
   'department', 'OPS', 'Opérations'),
  ('e2e00000-0000-4000-8000-000000000011', 'e2e00000-0000-4000-8000-000000000002',
   'department', 'OPS', 'Opérations du tiers')
on conflict (id) do update set name = excluded.name;

-- ----------------------------------------------------------------- grants --
-- Le DAF porte `can_approve` : `govern_hypotheses.decide_hypothesis` exige
-- cette permission SUR LA DIMENSION, le rôle seul ne suffit pas.

insert into public.dimension_grants (
  tenant_id, user_id, dimension_id, can_read, can_contribute, can_approve, can_export
) values
  ('e2e00000-0000-4000-8000-000000000001', 'e2e00000-0000-4000-8000-000000000021',
   'e2e00000-0000-4000-8000-000000000010', true, true, false, false),
  ('e2e00000-0000-4000-8000-000000000001', 'e2e00000-0000-4000-8000-000000000022',
   'e2e00000-0000-4000-8000-000000000010', true, false, true, true),
  ('e2e00000-0000-4000-8000-000000000001', 'e2e00000-0000-4000-8000-000000000023',
   'e2e00000-0000-4000-8000-000000000010', true, false, true, true),
  ('e2e00000-0000-4000-8000-000000000002', 'e2e00000-0000-4000-8000-000000000024',
   'e2e00000-0000-4000-8000-000000000011', true, false, true, true)
on conflict (tenant_id, user_id, dimension_id) do update
  set can_read = excluded.can_read,
      can_contribute = excluded.can_contribute,
      can_approve = excluded.can_approve,
      can_export = excluded.can_export;

commit;

-- Contrôle de sortie : quatre comptes, quatre appartenances, deux dimensions,
-- quatre autorisations. Un chiffre différent signale une insertion muette.
select
  (select count(*) from auth.users where email like 'e2e-%@tarjih-os.com') as comptes,
  (select count(*) from auth.identities i join auth.users u on u.id = i.user_id
     where u.email like 'e2e-%@tarjih-os.com') as identites,
  (select count(*) from public.tenant_memberships
     where tenant_id in ('e2e00000-0000-4000-8000-000000000001',
                         'e2e00000-0000-4000-8000-000000000002')) as appartenances,
  (select count(*) from public.dimension_grants
     where tenant_id in ('e2e00000-0000-4000-8000-000000000001',
                         'e2e00000-0000-4000-8000-000000000002')) as autorisations;
