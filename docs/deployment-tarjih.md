# Déploiement Tarjih

État vérifié le 14 septembre 2026 (la section « Preuves de fonctionnement » date du 28 août 2026 et est conservée telle quelle).

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

Chaque migration a son retour arrière dans `supabase/rollbacks/`, à appliquer de la même façon. Les deux sont vérifiés par aller-retour contre une copie du schéma de production : après migration puis retour arrière, `pg_dump --schema-only` est identique à l’octet près — même empreinte SHA-256, mêmes 229 905 octets pour `20260809090100` — et les contrôles pgTAP antérieurs repassent sur la base rollbackée (17 pour `20260809090000`, 31 pour `20260809090100`).

## Gates

Quatre commandes, à la racine, couvrent les deux piles ; elles sont la seule définition de ce qui doit passer, sur le poste comme en intégration continue :

| Commande | Web (`apps/web`) | Moteur (`services/calculation`, `scripts/`) |
|---|---|---|
| `npm run lint` | `eslint` | `ruff check` + `ruff format --check` (`ruff.toml`) |
| `npm run typecheck` | `tsc --noEmit` | `mypy --strict` (`pyproject.toml`, `src`, `tests` et `scripts/`) |
| `npm test` | `node --test` | `unittest` + `scripts/validate_prompt_artifacts.py` |
| `npm run build` | `next build` | — |

Prérequis Python : `pip install -e "services/calculation[api,dev]"` (versions épinglées dans `pyproject.toml` ; celles de l’image de production pour le moteur, celles du poste pour les outils).

`.github/workflows/ci.yml` exécute ces gates à chaque poussée sur `master` et sur chaque pull request, avec les versions de la production (Node 22, Python 3.13), plus la gate de base de données ci-dessous. Une gate rouge sur `master` est un défaut à corriger avant tout autre travail.

### Gate de base de données

`scripts/db-gates.sh` rejoue **toute la chaîne du schéma sur une base vide** : socle minimal (`supabase/testing/minimal_supabase_auth.sql` — rôles, `auth.users`, `auth.identities`, `auth.uid()`, privilèges par défaut et `search_path` tels que la plateforme les livre, tous idempotents), les migrations dans l’ordre et chacune dans sa transaction, le registre, puis :

- le registre recense exactement les fichiers de `supabase/migrations/` ;
- les contrôles pgTAP (`supabase/tests/`, 140 au 14 septembre 2026) jouent chacun jusqu’à son plan, sans un seul `not ok` ;
- le jeu de recette `supabase/seed/e2e-recette.sql` s’applique (mots de passe factices) ;
- les retours arrière (`supabase/rollbacks/`) s’appliquent dans l’ordre inverse, chaque migration après la première ayant le sien, et le schéma revient **à l’octet près** (`pg_dump --schema-only`) à l’état d’après la première migration, registre compris.

Deux façons de la jouer :

- en CI, contre un service `supabase/postgres:15.8.1.085` — l’image exacte de `supabase-db` en production ;
- depuis le poste, `npm run test:db` (`scripts/db-gates-cluster.sh`) crée une base **jetable** dans le cluster PostgreSQL réel à travers SSH (`TARJIH_SSH` requis), y joue la chaîne et la supprime quoi qu’il arrive. Même version, même socle que la production, sans Docker sur le poste. Vérifié le 14 septembre 2026 : 55 s, aucune base résiduelle.

Les contrôles pgTAP sont aussi rejouables un à un contre la production, en `begin`/`rollback` :

```bash
cat supabase/tests/11_open_version_from_previous.test.sql | ssh …   'docker exec -i supabase-db-f10v8td71bwii32blb9lalfk psql -U postgres -d postgres    --set=client_encoding=UTF8 -v ON_ERROR_STOP=1 -f -'
```

Certains contrôles tournent **hors RLS**, au plus haut privilège : ils éprouvent ce que les déclencheurs refusent à un chemin qui contournerait les politiques, ce qu’aucun contrôle joué en `authenticated` ne peut atteindre — la RLS filtre alors les lignes avant que le déclencheur n’ait la parole, et l’écriture ne touche rien plutôt que d’être refusée.

### Recettes navigateur

`npm run test:e2e` joue les recettes Playwright (`apps/web/e2e/`, 29 contrôles) contre `https://tarjih-os.com`, avec les comptes du coffre injectés par le broker de secrets (`invoke-secret.ps1 -TimeoutSec 570`, la suite dure un peu plus de quatre minutes). Elles ne tournent pas en CI : deux exécutions simultanées sur les mêmes tenants de recette se télescoperaient. Elles se jouent depuis le poste avant chaque déploiement.

## Sondes de santé

| Service | Sonde | Ce qu’elle dit | Ce qu’elle ne dit pas |
|---|---|---|---|
| web (`l3fov9fbnjvrgt5ly75b7g5r`) | `GET /health` → `{"service":"tarjih-web","status":"ok"}`, `Cache-Control: no-store` ; `HEALTHCHECK` du `Dockerfile` toutes les 30 s (`wget --spider` sur `127.0.0.1:3000/health`, 20 s de grâce, 3 échecs) ; publique : `https://tarjih-os.com/health` | le processus Next.js répond | rien sur Supabase ni sur le moteur |
| moteur (`tuxybsaq9adb6txew2rc6zkr`) | `GET /health` → `{"status":"ok","engine_version":"1.1.0"}` ; `HEALTHCHECK` du `Dockerfile` toutes les 30 s (`curl -fsS 127.0.0.1:8000/health`, 15 s de grâce, 3 échecs) ; interne seulement (`http://tarjih-calculation:8000`) | le processus vit, et quelle version du moteur | **volontairement rien sur la clé de service** : un jeton absent ferait redémarrer en boucle un conteneur sain |

Coolify lit ces `HEALTHCHECK` : `healthy` sur les deux conteneurs est la condition de fin d’un déploiement (SOP-014). Vérifié le 14 septembre 2026 : web `200`, moteur `healthy` avec `engine_version` `1.1.0`.

## Comptes

État relevé en base le 14 septembre 2026.

| Compte | Tenant | Rôle | `is_tenant_admin` | État |
|---|---|---|:---:|---|
| `a.mansouri@afriquestrategie.com` | Afrique Stratégie | `dg` | oui | actif — seul membre du tenant réel, qu’il administre (décision du 13 septembre 2026) |
| `e2e-contributeur@tarjih-os.com` | Recette e2e | `contributor` | non | actif — recette |
| `e2e-daf@tarjih-os.com` | Recette e2e | `daf` | non | actif — recette |
| `e2e-dg@tarjih-os.com` | Recette e2e | `dg` | non | actif — recette |
| `e2e-intrus@tarjih-os.com` | Recette e2e — tiers | `daf` | non | actif — contrôle négatif d’isolation |
| `admin.technique@tarjih-os.com` | — | — | — | **banni** (`banned_until = infinity`), plus membre d’aucun tenant |
| `recette-daf-05@tarjih-os.com` | — | — | — | **banni**, plus membre d’aucun tenant |
| `recette-contrib-05@tarjih-os.com` | — | — | — | **banni**, plus membre d’aucun tenant |

Les trois comptes bannis ont écrit dans un système à ajout seul (une hypothèse, une décision) : ils **ne peuvent pas être supprimés** sans effacer la provenance de ce qu’ils ont produit. Ils restent en base, fermés.

Les comptes de recette sont posés par `supabase/seed/e2e-recette.sql` (réexécutable, mots de passe remplacés à l’exécution depuis le coffre, jamais dans le dépôt).

**Créer un compte directement en SQL exige de renseigner `confirmation_token`, `recovery_token`, `email_change_token_new` et `email_change` à la chaîne vide.** GoTrue les lit dans des chaînes Go non nullables : laissées à `NULL`, l’authentification échoue en `500 Database error querying schema` et l’interface n’affiche qu’un banal « identifiants incorrects ».

## Sauvegarde de la base (SOP-026)

La base de production (`supabase-db-f10v8td71bwii32blb9lalfk`, base `postgres`) est sauvegardée par le projet lui-même, en plus du dump global du parc, parce que ce dernier **ne se restaure pas** : mesuré le 16 septembre 2026 sur les données de Tarjih, le `pg_dumpall` SQL nocturne (`/data/backups/pg/`, 90 Mo) restauré dans un cluster neuf de l’image de production rend zéro ligne, zéro fonction, zéro déclencheur, zéro policy (60 erreurs : les schémas `auth` et `storage` pré-initialisés par l’image font échouer les `COPY`, puis `psql` lit les données comme du SQL). Le même instant en `pg_dump -Fc`, restauré `--clean --if-exists --no-owner --no-privileges`, rend la production à l’identique.

Source de vérité : `scripts/sauvegarde/` ; sur l’hôte : `$HOME/ops/tarjih/` (arborescence plate, empreintes SHA-256 des scripts inscrites dans chaque statut, à comparer au dépôt).

| Pièce | Où | Quand | Ce qu’elle prouve |
|---|---|---|---|
| `sauvegarde-tarjih.sh` | cron `serveuria` 03:10 | chaque nuit | `pg_dump -Fc` (1 Mo, 1,5 s) avec ses **comptes** écrits à côté (`comptes.sql` : 22 compteurs, dont la somme exacte des montants, les fonctions, déclencheurs et policies) ; chiffré `gpg` pour la clé publique `tarjih-sauvegarde.pub` ; rotation GFS 7 quotidiens, 8 hebdomadaires, 12 mensuels (date lue dans le nom) ; copie hors site du seul `.gpg` (`serveuria-backups/tarjih/` sur la machine qui reçoit déjà celles du parc, jamais le clair) ; statut `/data/backups/tarjih/last-status.json` |
| `sauvegarde-tarjih-verif.sh` | cron `serveuria` 04:50 | chaque jour | restaure le dernier dump dans un **témoin neuf** (même image, sans réseau, 2 Go, détruit dans tous les cas, ~11 s) et compare ses comptes à ceux du dump ; refuse un dump de plus de 26 h ; statut `/data/backups/tarjih-drill/last-status.json` |
| `verif-distante.ps1` → `verif-distante.sh` | tâche planifiée du poste « Tarjih - exercice de restauration distante », le 2 de chaque mois 09:30 | chaque mois | lit la dernière copie **distante** à travers l’hôte, la déchiffre sur le poste avec la clé privée du coffre (`TARJIH_SAUVEGARDE_GPG_PRIVEE_B64`, jamais sur l’hôte), renvoie le clair en `/tmp` de l’hôte, joue l’exercice (`distant`), efface ; journal `%LOCALAPPDATA%	arjiherif-distante.log`, statut `last-status-distant.json` |

`docker-watch` (session infra) lit tout `/data/backups/*/last-status.json` : un statut autre que `ok`, ou plus vieux que 48 h, part en alerte ; c’est pour cela que l’exercice est quotidien. Chemins d’échec exercés le 16 septembre 2026, chacun avec sa cause nommée : `dump_perime_30h`, `comptes_divergents`, `aucun_dump`, `conteneur_non_unique`, `chiffre_pour_une_autre_cle`.

Ce que ce filet ne couvre pas : les rôles du cluster (l’image les recrée), Supabase Storage (non utilisé), et la bascule en production d’un témoin restauré (runbook distinct). Rotation de la clé gpg : nouvelle paire sur le poste, privée au coffre, publique dans `scripts/sauvegarde/` et importée sur l’hôte, `EMPREINTE_GPG` et `SOUS_CLE_CHIFFREMENT` du script mis à jour ; les anciens `.gpg` restent lisibles avec l’ancienne clé tant qu’elle est au coffre.

## Preuves de fonctionnement

- application Coolify : `running:healthy` sur l’image `21b4ed6` ;
- service Supabase : `running:healthy`, `OOMKilled=false`, 0 redémarrage ; 250 Mio sur un plafond de 4 Gio après la recette ;
- santé web : HTTP `200` sur `/health`, `/` et `/login` ; `/app`, `/app/budgets` et `/app/hypotheses/…` rendent `307` vers la connexion pour un visiteur ;
- registre : les trois migrations inscrites en base, dont `20260809090100` par sa propre transaction ;
- schéma, isolation et gouvernance : 52 contrôles pgTAP réussis ;
- 10 politiques portées par `private.is_tenant_admin`, aucune ne dépend plus du rôle `tenant_admin` ;
- parcours vertical complet parcouru sur l’environnement déployé : le DAF ouvre un cycle puis une version, le contributeur propose sur la seule dimension qui lui est attribuée — une sur cinq — corrige sa proposition, le DAF approuve en modifiant la valeur avec motif, et la décision apparaît horodatée dans une trace définitive ;
- exactitude décimale prouvée bout en bout : `0.10` saisi s’affiche `0.10`, jamais `0.1` ;
- contrôle optimiste prouvé par écriture concurrente réelle : pendant que la page restait ouverte, une session `psql` distincte a fait avancer la révision ; la correction fondée sur la lecture périmée a été refusée et la valeur concurrente préservée ;
- aucune erreur ni avertissement console ; aucun défilement horizontal à 375 px sur les cinq écrans, mesuré par comparaison `scrollWidth` / `clientWidth`, pas à l’œil.

**Le cache fausse la mesure d’un correctif de style.** Un rendu mesuré juste après un déploiement peut porter la feuille du build précédent : le fragment CSS était encore celui de l’ancien build, dont l’URL ne répondait déjà plus. Toute vérification visuelle post-déploiement passe par une URL portant un paramètre qui casse le cache, sans quoi on mesure ce qu’on vient de remplacer.

Les secrets applicatifs sont gérés dans Coolify. Aucun secret ne doit être ajouté au dépôt Git.
