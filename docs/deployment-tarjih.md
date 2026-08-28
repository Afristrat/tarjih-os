# Déploiement Tarjih

État vérifié le 28 août 2026.

## Ressources publiques

- dépôt public : `https://github.com/Afristrat/tarjih-os` ;
- application : `https://tarjih-os.com` ;
- API Supabase : `https://api.tarjih-os.com` ;
- santé web : `https://tarjih-os.com/health`.

## Isolation

Tarjih ne partage aucune base Supabase avec un autre produit. La pile vit dans le projet Coolify `Tarjih` et utilise :

- projet Coolify : `n3njfl7sfu0hatepq5ihugid` ;
- application web : `l3fov9fbnjvrgt5ly75b7g5r` ;
- service Supabase : `f10v8td71bwii32blb9lalfk` ;
- volume PostgreSQL : `f10v8td71bwii32blb9lalfk_supabase-db-data` ;
- tunnel Cloudflare : `ab534be3-2f8c-4b5e-ac6a-0865a446e567`.

Le connecteur Cloudflare appartient au Compose Supabase Tarjih. Il rejoint uniquement le réseau Supabase dédié et le réseau d’ingress Coolify. Le jeton du tunnel reste dans un fichier serveur protégé en mode `0600` ; il n’est ni versionné ni exposé dans cette documentation.

## Registre des migrations

La base dit elle-même quelles migrations sont posées, dans `supabase_migrations.schema_migrations` :

```bash
docker exec supabase-db-f10v8td71bwii32blb9lalfk \
  psql -U postgres -d postgres -c \
  'select version, name from supabase_migrations.schema_migrations order by version;'
```

La table est celle de la CLI Supabase, pas un registre maison : `version text` clé primaire, `statements text[]`, `name text`. Sa forme a été relevée sur une base du même serveur réellement gérée par la CLI, de sorte qu’une reprise ultérieure en `supabase db push` retrouve son registre au lieu d’en découvrir un autre.

Elle est créée par `supabase/bootstrap/migration_registry.sql`, qui n’est **pas** une migration et ne vit pas dans `supabase/migrations/` : une migration ne peut pas créer la table qui la recense. Le fichier est rejouable — une seconde application rend `INSERT 0 0`.

Aucune RLS n’est posée dessus, volontairement : le schéma n’accorde `usage` à personne. `anon`, `authenticated`, `authenticator` et même `service_role` — qui contourne pourtant la RLS — n’ont ni `usage` sur le schéma ni `select` sur la table. La table est donc hors d’atteinte de l’API, quand une RLS ajoutée ici divergerait de la primitive de la plateforme et casserait une future commande de la CLI.

Les deux premières migrations ont été appliquées avant l’existence du registre ; elles y ont été inscrites par le bootstrap, sur un constat établi **objet par objet** contre la production le 28 août 2026 (8 objets sur 8 pour `20260807195608`, 2 sur 2 pour `20260809090000`). Le registre a été posé à ce moment précis parce que c’était le dernier où ce constat pouvait encore se faire par lecture directe : passé une troisième migration à la main, le rattrapage se serait fait de mémoire.

## Appliquer une migration

**Chaque migration s’inscrit elle-même au registre**, par un `insert … on conflict do nothing` en fin de fichier, exécuté dans la même transaction que le reste. Appliquer une migration sans l’inscrire devient donc impossible : cela ne repose plus sur la discipline de celui qui l’applique. Symétriquement, chaque retour arrière supprime sa ligne — un rollback qui la laisserait en place ferait mentir la seule source qui dise ce qui est posé.

Toute migration s’applique **en une seule transaction** :

```bash
docker exec supabase-db-f10v8td71bwii32blb9lalfk \
  psql -U postgres -d postgres -1 -v ON_ERROR_STOP=1 -q -f /tmp/<migration>.sql
```

L’enveloppe n’est pas une précaution de style. Les migrations d’autorisation remplacent des politiques : appliquées instruction par instruction, un échec à mi-parcours laisserait des tables dont la politique de lecture a été supprimée sans être recréée.

Chaque migration a son retour arrière dans `supabase/rollbacks/`, à appliquer de la même façon. Celui de `20260809090000` est vérifié par aller-retour contre une copie du schéma de production : après migration puis retour arrière, `pg_dump --schema-only` est identique à l’octet près, et les 17 contrôles pgTAP d’origine repassent.

## Contrôles pgTAP

31 contrôles, tous au vert, exécutés contre une copie du schéma de production (base jetable dans le même cluster, supprimée après usage) :

| Fichier | Contrôles | Objet |
|---|---:|---|
| `02_multitenant_rls.test.sql` | 13 | isolation inter-tenant et refus par défaut |
| `03_schema_invariants.test.sql` | 4 | invariants de schéma |
| `04_tenant_admin_separation.test.sql` | 14 | séparation administration technique / pouvoir financier |

`npm run test:db` reste la voie outillée, mais elle exige Docker sur le poste. À défaut, la copie jetable dans le cluster de production a l’avantage de tester la version exacte de PostgreSQL et le socle Supabase réels.

## Comptes

| Rôle | `is_tenant_admin` | Ce qu’il voit |
|---|:---:|---|
| `dg` | non | tout le périmètre financier, par son rôle ; aucune administration |
| `contributor` | oui | administre dimensions, droits et membres ; aucun chiffre |

Le second compte existe pour prouver la séparation en conditions réelles : un administrateur sans grant dimensionnel ne lit aucune hypothèse ni aucune valeur budgétaire.

**Créer un compte directement en SQL exige de renseigner `confirmation_token`, `recovery_token`, `email_change_token_new` et `email_change` à la chaîne vide.** GoTrue les lit dans des chaînes Go non nullables : laissées à `NULL`, l’authentification échoue en `500 Database error querying schema` et l’interface n’affiche qu’un banal « identifiants incorrects ».

## Preuves de fonctionnement

- application Coolify : `running:healthy` sur l’image `0989ba8` ;
- service Supabase : `running:healthy`, `OOMKilled=false`, 0 redémarrage ;
- mémoire du conteneur PostgreSQL : pic à 340 Mio sur un plafond de 4 Gio ;
- santé web : HTTP `200` ; `/app` et `/app/settings/dimensions` rendent `307` vers la connexion pour un visiteur ;
- schéma et isolation : 31 contrôles pgTAP réussis ;
- 10 politiques portées par `private.is_tenant_admin`, aucune ne dépend plus du rôle `tenant_admin` ;
- navigateur : connexion, administration des dimensions, attribution d’un droit fin, inscription au journal d’audit et déconnexion parcourus sur l’environnement déployé ; aucune erreur console ; aucun défilement horizontal à 375 px.

Les secrets applicatifs sont gérés dans Coolify. Aucun secret ne doit être ajouté au dépôt Git.
