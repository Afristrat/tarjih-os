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

Chaque migration a son retour arrière dans `supabase/rollbacks/`, à appliquer de la même façon. Les deux sont vérifiés par aller-retour contre une copie du schéma de production : après migration puis retour arrière, `pg_dump --schema-only` est identique à l’octet près — même empreinte SHA-256, mêmes 229 905 octets pour `20260809090100` — et les contrôles pgTAP antérieurs repassent sur la base rollbackée (17 pour `20260809090000`, 31 pour `20260809090100`).

## Contrôles pgTAP

52 contrôles, tous au vert, exécutés contre une copie du schéma de production (base jetable dans le même cluster, supprimée après usage) :

| Fichier | Contrôles | Objet |
|---|---:|---|
| `02_multitenant_rls.test.sql` | 13 | isolation inter-tenant et refus par défaut |
| `03_schema_invariants.test.sql` | 4 | invariants de schéma |
| `04_tenant_admin_separation.test.sql` | 14 | séparation administration technique / pouvoir financier |
| `05_hypothesis_governance.test.sql` | 21 | gouvernance des hypothèses, concurrence, immuabilité d’une version publiée |

Les quatre derniers contrôles de la suite 05 tournent **hors RLS**, au plus haut privilège : ils éprouvent ce que les déclencheurs refusent à un chemin qui contournerait les politiques, ce qu’aucun contrôle joué en `authenticated` ne peut atteindre — la RLS filtre alors les lignes avant que le déclencheur n’ait la parole, et l’écriture ne touche rien plutôt que d’être refusée.

`npm run test:db` reste la voie outillée, mais elle exige Docker sur le poste. À défaut, la copie jetable dans le cluster de production a l’avantage de tester la version exacte de PostgreSQL et le socle Supabase réels.

## Comptes

| Compte | Rôle | `is_tenant_admin` | État | Ce qu’il voit |
|---|---|:---:|---|---|
| `a.mansouri@afriquestrategie.com` | `dg` | non | actif | tout le périmètre financier, par son rôle ; aucune administration |
| `admin.technique@tarjih-os.com` | `contributor` | oui | actif | administre dimensions, droits et membres ; aucun chiffre |
| `recette-daf-05@tarjih-os.com` | `daf` | non | **suspendu** | rien : appartenance suspendue |
| `recette-contrib-05@tarjih-os.com` | `contributor` | non | **suspendu** | rien : appartenance suspendue |

Le compte administrateur technique existe pour prouver la séparation en conditions réelles : un administrateur sans grant dimensionnel ne lit aucune hypothèse ni aucune valeur budgétaire.

Les deux comptes `recette-*` ont servi la recette de la task 05 puis ont été rendus inertes — appartenance suspendue, mot de passe remplacé par une valeur que personne ne connaît. **Ils ne peuvent pas être supprimés** : la décision qu’ils ont produite est append-only, l’hypothèse est retenue par cette décision, et l’hypothèse retient son auteur. Les effacer exigerait de désactiver la garantie d’audit que la task 05 apporte ; le cycle a donc été clos plutôt qu’effacé. C’est le comportement voulu, pas un reliquat.

**Créer un compte directement en SQL exige de renseigner `confirmation_token`, `recovery_token`, `email_change_token_new` et `email_change` à la chaîne vide.** GoTrue les lit dans des chaînes Go non nullables : laissées à `NULL`, l’authentification échoue en `500 Database error querying schema` et l’interface n’affiche qu’un banal « identifiants incorrects ».

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
