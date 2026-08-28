# PASSATION — Tarjih (plateforme financière multi-tenant)

> Dépôt : `c:\projets\Budget & CFO` · remote `Afristrat/tarjih-os` (public) · branche `master`.
> Production : `https://tarjih-os.com`, Coolify `serveuria`, Supabase dédié.
> Sources de vérité produit : `specs/_source/` · découpage : `specs/todo/README.md`.

## 2026-08-28 — Tasks 03 et 04 closes et prouvées en production ; console d'administration refondue

```
[ETAT]   master = **0989ba8** poussé et vérifié (`git fetch` + comparaison `HEAD`/`origin/master`, hashes identiques).
         Production sur l'image `0989ba8`, `running:healthy`. Supabase `running:healthy`, `OOMKilled=false`, 0 redémarrage.
         Gates : typecheck 0 erreur, lint 0 erreur **0 warning**, 11 tests Node, build OK, **31 contrôles pgTAP** (13+4+14), 0 échec.
         Tasks 01→04 terminées. Reste 05→10. Un lot task 05 non commité dort dans le worktree (voir [NEXT] 1).

[FAIT]   **0. Ce fichier n'existait pas.** Aucune passation Tarjih, aucune entrée dans l'index central : le hook rendait
         « CWD HORS PROJETS ». État reconstruit par preuve système (git, gates, base de production), pas par mémoire.

         **1. Migration `20260809090000` scindée en deux.** Elle mélangeait la task 04 (séparation de l'administration)
         et la task 05 (gouvernance des hypothèses). Vérifié d'abord qu'elle n'était appliquée **nulle part** — en
         production `tenant_memberships` n'avait que 5 colonnes et aucune des 5 routines n'existait — donc le scindage
         était libre. Devenue `20260809090000_separate_tenant_admin.sql` (task 04, appliquée) et
         `20260809090100_govern_hypotheses.sql` (task 05, **non commitée, non appliquée**).

         **2. Oracle d'existence inter-tenant fermé dans `decide_hypothesis`.** La fonction est `SECURITY DEFINER` et
         sélectionnait la ligne **sans filtre de tenant**, le contrôle de permission venant après : les messages
         distinguaient « hypothèse inexistante » de « hypothèse appartenant à un autre tenant ». Le droit d'approbation
         fait désormais partie de la clause de recherche, l'absence de droit rend la ligne introuvable. Jamais parti en
         production (migration 05 non appliquée).

         **3. Trou trouvé et refermé : `audit_events_select_governance`.** La migration convertissait 9 politiques vers
         `is_tenant_admin` mais laissait la lecture de l'audit sur l'ancien `role = 'tenant_admin'` — un administrateur
         désigné par le seul booléen aurait été aveugle à la trace des mutations qu'il autorise. 10 politiques portées
         par `private.is_tenant_admin`, **0 dépendant encore du rôle** (compté en production).

         **4. Isolation re-certifiée.** C'était l'inconnue : la migration fait `drop policy` puis `create policy` sur
         des politiques couvertes par les 13 contrôles d'origine. Nouveau `04_tenant_admin_separation.test.sql`
         (14 contrôles). Les 13 d'isolation et les 4 d'invariants **repassent** contre les politiques remplacées.

         **5. Retour arrière écrit et prouvé** (`supabase/rollbacks/`, exigence de `~/.claude/rules/supabase.md`).
         Aller-retour contre une copie du schéma de production : `pg_dump --schema-only` identique à l'octet près,
         et les 17 contrôles d'origine repassent sur la base rollbackée.

         **6. Déployé et prouvé en navigateur (SOP-011).** Migration appliquée en production en transaction unique,
         3 déploiements Coolify. Parcours réel : connexion, création d'une dimension (code auto-généré
         `RECETTE_TASK_04`), attribution d'un droit fin, **2 événements d'audit constatés en base**, déconnexion,
         puis purge des données de recette. Un administrateur technique voit 5 dimensions et 2 membres, et
         **0 hypothèse, 0 valeur budgétaire, aucun droit financier ni d'approbation**.

         **7. Console d'administration refondue** (skill `frontend-design`, sur signalement d'Amine). La page était
         livrée avec **11 classes CSS sur 12 qui n'existaient pas** : rendu aux styles par défaut du navigateur. Elle
         héritait aussi de l'échelle éditoriale (`h1` jusqu'à 7,6rem). Échelle de travail cloisonnée sous `.console`,
         matrice **pivotée par membre** (12 lignes → 5 ; 600 → 30 à l'échelle réelle), et une colonne « portée » qui dit
         en clair ce que chacun voit. `roleLabel` était écrit, testé, et branché nulle part — le bandeau affichait
         `contributor` brut. Aucune navigation ne menait à l'écran ni n'en revenait.

         **8. Code mort supprimé** avant commit : `optionalText`, `canSeeConsolidation` (exportés, jamais appelés),
         et le warning lint préexistant sur `budgets/actions.ts`.

[ALERTE] **Aucun registre de migrations en base.** `supabase_migrations.schema_migrations` n'existe pas : les
         migrations sont appliquées à la main, rien en base ne dit lesquelles sont posées. La vérification se fait
         objet par objet. Tenable à 2 migrations, ingérable à 10. À refermer avant la task 06.

         **Créer un utilisateur Supabase en SQL direct ne suffit pas.** `confirmation_token`, `recovery_token`,
         `email_change_token_new` et `email_change` doivent valoir `''` : GoTrue les lit dans des chaînes Go non
         nullables et rend `500 Database error querying schema`, que l'interface traduit en « identifiants
         incorrects ». Diagnostiqué par le journal du conteneur `supabase-auth`, jamais devinable depuis l'écran.

         **Le CLAUDE.md du projet exige un parcours Playwright critique avant toute déclaration de complétude.**
         Aucun test Playwright n'est versionné : la recette de ce jour a été conduite à la main via le MCP. C'est la
         task 09, mais l'exigence est écrite comme permanente — l'écart est réel et assumé, pas ignoré.

[BLOQUE] rien.

[NEXT]   1) **Task 05 — le lot non commité du worktree.** `apps/web/src/app/app/budgets/actions.ts` (4 server actions)
            et `supabase/migrations/20260809090100_govern_hypotheses.sql` existent, typechecks, mais **aucune page
            `/app/budgets` n'existe** : ces actions redirigent vers des 404. À finir en un lot complet (pages incluses),
            avec son rollback et ses contrôles pgTAP, sur le modèle de la 04.
         2) Effet de bord à traiter dans la 05 : le trigger `hypotheses_enforce_update` impose
            `row_version = old + 1` sur **toute** mise à jour. Le chemin « un contributeur corrige son hypothèse »
            (politique `hypotheses_update_contributor`) cassera s'il n'incrémente pas.
         3) Registre de migrations à instaurer (cf. [ALERTE]).
         4) Compte de recette : mot de passe dans le scratchpad de session (`acces-admin-technique.txt`, éphémère),
            à déposer au coffre via `add-secret.ps1 -Name TARJIH_ADMIN_TECHNIQUE` puis supprimer.

[CTX]    Session `37d2777d`, 2026-08-28, CWD `c:\projets\Budget & CFO`. HEAD de référence `99c8342`, aucune autre
         session déclarée, HEAD stable de bout en bout. SOP lues et appliquées : 003 (priorisation, §4bis
         surcomplexité), 019 (mise en scène nommée, jamais `git add -A`, publication vérifiée par `fetch`),
         007 (mesure avant affirmation sur la production), 011 (vérification déployée), 014 (déploiement Coolify),
         001 §8ter (deux expositions de mot de passe consignées dans `~/.claude/secrets-leaks.log`, **rotation finale
         effectuée**, les deux valeurs exposées sont mortes). 5 commits : `012ddff`, `cb1132f`, `943e11d`, `e62f767`,
         `0989ba8`. Docker Desktop indisponible sur le poste (service non démarrable sans élévation) : les contrôles
         pgTAP ont tourné dans une base jetable du cluster de production, sur arbitrage d'Amine, mémoire mesurée avant
         et après (pic 340 Mio sur 4 Gio), base supprimée et état d'origine reprouvé.

[MEMO]   **Une suite de tests verte ne prouve pas ce qu'elle ne touche pas.** Les 11 tests Node passaient depuis le
         début : ils testent de la logique TypeScript en mémoire, aucun ne parle à PostgreSQL. La séparation des
         pouvoirs — le cœur du produit — n'était prouvée que par deux assertions sur un objet JS pendant que
         9 politiques RLS avaient été remplacées sans qu'aucun contrôle ne les revoie.

         **Un écran peut être fonctionnellement juste et visuellement inexistant.** La page d'administration a passé
         typecheck, lint, build et 4 critères d'acceptation en production tout en étant rendue sans feuille de style :
         11 classes sur 12 n'avaient jamais été écrites. Aucun gate automatique ne voit ça. Seul le navigateur le voit.

         **Ce que la recette déployée attrape et que rien d'autre n'attrape** : un écran inaccessible faute de lien,
         un compte inutilisable pour une raison qui vit dans le journal d'un autre conteneur, un helper testé mais
         branché nulle part. Trois défauts réels, aucun détectable sans ouvrir la page.

         **Mesurer avant d'affirmer, y compris contre soi-même.** Deux fois ce jour, une lecture visuelle m'a induit
         en erreur — un bouton cru plein qui était transparent, un débordement mobile attribué à ma correction alors
         que la feuille de style n'était pas chargée pendant la bascule des conteneurs. Le DOM et `pg_dump` ont
         tranché ; l'impression ne tranche jamais.
```
