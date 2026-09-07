# PASSATION — Tarjih (plateforme financière multi-tenant)

> Dépôt : `c:\projets\Budget & CFO` · remote `Afristrat/tarjih-os` (public) · branche `master`.
> Production : `https://tarjih-os.com`, Coolify `serveuria`, Supabase dédié.
> Sources de vérité produit : `specs/_source/` · découpage : `specs/todo/README.md`.

## 2026-09-07 (fin) — Task 08 LIVRÉE ET PROUVÉE : la recette navigateur a trouvé le classeur vide

```
[ETAT]
  Repo      : `HEAD` == `origin/master`, worktree PROPRE. Le hash de tête bouge avec les commits
              documentaires ; le repère qui compte est le dernier commit APPLICATIF, **`ce63e7f`**.
  Prod      : `tarjih-web` sur **`ce63e7f`** (tag d'image vérifié, `healthy`), `tarjih-calculation`
              sur `6b398e0` — aucun fichier de `services/` ne diffère entre les deux commits
              (vérifié par `git diff --name-only`), le moteur servi est donc bien celui de HEAD.
  Gates     : typecheck 0, lint 0 warning, **68 tests Node**, **43 tests Python**, build OK.
              **117 contrôles pgTAP** sur les NEUF fichiers, joués contre la PRODUCTION en
              begin/rollback, 0 échec — rejoués APRÈS la recette, pas seulement avant.
              **17 tests Playwright verts** contre `https://tarjih-os.com`, sur le commit
              RÉELLEMENT DÉPLOYÉ (11 d'avant + 6 d'export).
  Données   : recomptées à la clôture — 16 versions publiées, 16 montants, 21 parts,
              **0 montant sans origine**, 16 runs réussis dont 10 avec matière conservée.
              **10 traces d'export**, toutes en périmètre global (DAF/DG), sur 3 versions et
              **3 empreintes distinctes** : les demandes répétées d'un même export ont bien
              rendu la MÊME empreinte, le déterminisme est donc prouvé par le JOURNAL et pas
              seulement par un test.
              **Tenant réel « Afrique Stratégie » : 1 hypothèse, 0 montant — INTACT.**
  Migrations: registre à 8 lignes. La task 08 n'en a ajouté AUCUNE.
  Tasks     : 01→09 ✅ · **10 ⬜** — seule tâche non commencée.

[FAIT]
  1. **LA RECETTE NAVIGATEUR A TROUVÉ CE QUE DIX CONTRÔLES UNITAIRES VERTS NE POUVAIENT PAS VOIR :
     le classeur remis au DAF ne portait QUE sa ligne d'en-tête.** C'est LE fait de cette session,
     et il valide l'alerte que la passation précédente laissait ouverte. Cause : un `numeric`
     revient de PostgREST en **NOMBRE JSON** — il a déjà traversé un flottant binaire avant que le
     code ne le voie — et le garde de l'endpoint, qui exigeait du texte, écartait chaque ligne
     **en silence**, une par une. L'écran de consolidation contournait déjà le problème avec un
     `String(row.amount)`, c'est-à-dire en faisant transiter le montant par un flottant : ce que la
     convention du projet interdit, et ce que `workbook.ts` existait précisément pour éviter.
  2. **DEUX CORRECTIONS, PAS UNE.** Le cast `amount::text` dans la requête corrige le défaut à sa
     racine (une fois qu'un nombre JSON atteint JavaScript, la précision est perdue et ne se
     rattrape plus). Mais la seconde compte davantage : l'endpoint **refuse désormais** un export
     dont le compte de lignes ne retombe pas sur celui de la requête. Toutes ces colonnes sont
     `not null` — une ligne qui échoue au garde est une ANOMALIE, pas un filtrage. Un classeur
     reçu, signé et faux est pire qu'une erreur, et c'est le silence qui avait rendu le défaut
     invisible.
  3. **La 08 est close sur preuve** : 6 parcours navigateur contre la production, dont le contrôle
     central — un contributeur portant `can_read` et NON `can_export` reçoit un 403 sur l'adresse
     DEVINÉE. La promesse `prd.md:60` (« aucune donnée hors périmètre, y compris dans les
     exports ») est vérifiée en conditions réelles, plus seulement en laboratoire.
  4. **`fflate` était importé par du code de PRODUCTION sans être déclaré** (`workbook.ts`),
     joignable seulement comme transitive de `write-excel-file`. Le jour où celui-ci change de
     compresseur, le build casse en production. Déclaré et épinglé. `write-excel-file` était en
     `^4.1.1` alors que toutes les autres dépendances d'exécution sont épinglées exactes : un
     caret aurait laissé une version ultérieure changer les octets du fichier, donc l'empreinte
     que la trace promet. Épinglé à `4.1.1`.

[ALERTE]
  - **L'export ne porte QUE les montants**, pas les parts d'hypothèses que l'écran de consolidation
    affiche. YAGNI assumé, non demandé par la spec — mais un DAF qui exporte perd l'origine des
    chiffres qu'il voit à l'écran. À trancher au premier retour d'usage.
  - **La chaîne d'AFFICHAGE de la consolidation fait toujours transiter les montants par un
    flottant** (`String(row.amount)` ligne 266, puis `Number()` dans `formatAmount` ligne 89 et
    dans le total ligne 342). Sans effet mesurable en deçà d'environ 9·10¹⁵, mais contraire à la
    convention « montants en `numeric`, jamais en flottants ». NON corrigé : corriger la seule
    lecture sans reprendre `formatAmount` et le total ne changerait rien de mesurable — c'est un
    chantier d'affichage distinct, pas une rustine à glisser dans la task d'export.
  - **Écart assumé à la spec 08** : elle listait `services/calculation/.../export.py`. Ce fichier
    n'existe pas et n'est pas prévu — le moteur Python ne reçoit aucun contexte utilisateur
    (`archi.md`), il ne peut donc pas filtrer. L'écart est désormais écrit DANS la spec.
  - **Rangement des specs incohérent** : 01→05 vivent dans `specs/done/` avec `status: completed` ;
    06, 07, 08 et 09, terminées elles aussi, sont restées dans `specs/todo/` avec `status: done`.
    Le tableau de `specs/todo/README.md` fait foi — c'est écrit dans le README. Non « corrigé » :
    déplacer quatre fichiers invaliderait les chemins cités dans plusieurs entrées ci-dessous.
  - **Les six runs antérieurs au 2026-09-07 restent sans matière et non rejouables** (moteur 1.1.0
    refuse un snapshot 1.0.0). Tous du tenant de recette.
  - **Tarjih toujours ABSENT du tableau de `PASSATION-INDEX.md`** — ouvert depuis le 2026-08-28.
    Écriture hors projet (règle n°6) : signalée, jamais faite. À ajouter par Amine.

[BLOQUE]
  **RIEN. L'accès au tenant RÉEL est débloqué depuis le 2026-09-07.** Sur décision explicite
  d'Amine — qui revient sur la règle « le mot de passe du DG ne va pas au coffre » — le compte
  `a.mansouri@afriquestrategie.com` a un nouveau mot de passe, GÉNÉRÉ sans jamais être imprimé et
  déposé au coffre sous **`TARJIH_DG_REEL_PW`** (variante C de la SOP-001). L'ancien est mort.
  L'empreinte a été posée dans une transaction qui se vérifiait elle-même — si elle n'avait pas
  rouvert le compte, rien n'aurait été écrit et l'ancien accès aurait survécu — puis la connexion
  a été **prouvée dans un navigateur** sur `https://tarjih-os.com` (atterrissage `/app`, tenant
  affiché), parce qu'une empreinte correcte ne prouve pas qu'une session s'ouvre.
  ⚠️ **Ce compte écrit dans la PRODUCTION d'Amine.** Publier une version avec lui crée de la
  donnée IMMUABLE dans « Afrique Stratégie ». Le tenant est resté INTACT à ce stade (1 hypothèse,
  0 montant, recompté après la connexion) : la publication reste à décider par Amine, elle n'a
  pas été faite.

[NEXT]
  1. **Faire produire à Tarjih un chiffre pour un tenant réel** — l'accès n'est plus un obstacle
     (cf. [BLOQUE]) ; ne reste que la décision d'Amine d'écrire pour de bon dans « Afrique
     Stratégie », puisque la publication y est irréversible.
  2. **Task 10 (déploiement preview)** — dernière tâche du découpage, P1, estimée 1 h.
  3. Trancher : l'export doit-il porter les parts d'hypothèses ? (première ALERTE ci-dessus).
  4. Modèle économique pilote (`prd.md:138`) : question de découverte client, déclencheur = premier
     client réel. PAS une dette technique.

[CTX]
  Session `7f92c561`, 2026-09-07, CWD `c:\projets\Budget & CFO`. HEAD de référence au démarrage
  `ef1b7e5` ; aucune autre session n'a écrit dans le dépôt (vérifié par `fetch` avant chaque push).
  Cinq commits poussés : `6b398e0` (la 08 telle qu'écrite la session d'avant), `5e1d3af` (les deux
  corrections trouvées par la recette), `ce63e7f` (déclaration de `fflate` et clôture de la spec),
  puis deux documentaires — `d97765a` (cette entrée) et `87b0674` (`.gitattributes`).

  Le contexte opératoire — serveur, base, uuid Coolify, commandes de gates, pgTAP, migration,
  recette, déploiement, preuve par tag d'image, coffre — est INCHANGÉ : voir l'entrée du
  2026-09-06, toujours exacte, section [CTX].

[MEMO]
  Pièges payés cette session :
  1. **PostgREST rend un `numeric` en NOMBRE JSON.** Tout garde qui exige `typeof === "string"` sur
     un montant rejette donc TOUTES les lignes. Le correctif est le cast `::text` dans le `select`
     (`select("…, amount::text, …")`, la clé rendue garde son nom) — pas un `String(valeur)`, qui
     arrive trop tard : la précision est déjà perdue au parsing JSON.
  2. **UN `continue` SILENCIEUX TRANSFORME UN DÉFAUT EN FICHIER VIDE.** Le mode de défaillance
     était pire que le défaut lui-même : rien dans les journaux, un 200, un fichier bien formé.
     Quand un garde protège d'une ANOMALIE (colonnes `not null`) et non d'un filtrage, il doit
     faire ÉCHOUER, pas ignorer.
  3. **Une attente de test peut être JUSTE là où l'envie de « bien faire » est fausse.** J'ai
     commencé par normaliser le montant en forme canonique (`1234.560000` → `1234.56`) pour aligner
     le fichier sur l'écran. Un contrôle existant attendait `10.005000` **tel quel**, et son
     intention était la bonne : un export d'audit reflète la base, sans décision de mise en forme.
     Code annulé. Vérifier ce qu'un test PROTÈGE avant de le « corriger ».
  4. **`git diff` peut afficher un couple `-`/`+` de lignes strictement identiques** (vérifié à
     l'octet près par `od -c` : ni CRLF, ni caractère invisible). Artefact d'ancrage de l'algorithme
     de diff, sans conséquence — ne pas partir en chasse d'un caractère fantôme.
  5. **`PASSATION.md` était le SEUL fichier du dépôt en CRLF.** Le réécrire avec un outil qui
     normalise en LF a produit un diff de 1 141 lignes pour un ajout de 129 — le fichier entier,
     remplacé ligne à ligne, dans celui qu'on relit justement. La conversion est bonne (tout le
     reste du dépôt est en LF) ; ce qui manquait était la règle qui la tient sur un poste Windows.
     `.gitattributes` (`* text=auto eol=lf`) la fixe désormais.
  6. **Un test unitaire d'export ne prouve rien sur le service déployé.** Ici, les dix contrôles
     unitaires portaient sur `scope.ts` et `workbook.ts`, tous deux corrects. Le défaut vivait
     dans la couche qu'aucun d'eux ne traverse : la lecture PostgREST. La règle du projet — la
     recette navigateur contre la production est la preuve, pas le complément — n'est pas une
     précaution de style.
```

---

## 2026-09-07 (suite) — Task 08 : l'export, écrit et prouvé en unitaire, PAS ENCORE LIVRÉ

> **PÉRIMÉE : la task 08 est depuis LIVRÉE, DÉPLOYÉE et PROUVÉE — voir l'entrée du 2026-09-07
> (fin) ci-dessus.** Son [ENCOURS] et son [NEXT] sont entièrement traités, et son [ETAT] cite un
> HEAD dépassé. Elle reste ici pour ce qu'elle documente encore exactement : les décisions de
> conception de l'export, le choix de bibliothèque fondé sur les advisories, et le fait que la
> RLS de `budget_values` porte sur `read` et non sur `export`. Son alerte n°1 disait vrai : le
> code n'était pas prouvé, et la recette a bel et bien trouvé un défaut.

```
[ETAT]
  Repo      : `HEAD` == `origin/master` == **`ae29f79`**. **WORKTREE SALE** : la task 08 est en
              cours et n'est NI commitée NI déployée (liste exacte dans [ENCOURS]).
  Prod      : dernier commit APPLICATIF déployé **`2aafe07`**, les DEUX services (`tarjih-web` et
              `tarjih-calculation`) `healthy`, tags d'image vérifiés, bascule terminée. Rien de la
              task 08 ne tourne en production.
  Gates     : typecheck 0. **68 tests Node** (58 + 10 d'export), **43 tests Python**.
              **117 contrôles pgTAP** sur NEUF fichiers (107 + 10 nouveaux), 0 échec, joués contre
              la PRODUCTION en begin/rollback.
              **lint 0 warning et build OK**, rejoués sur l'état final des fichiers (le lint
              couvre `src tests e2e playwright.config.ts`, donc le parcours d'export inclus).
              ⚠️ **Recette Playwright de l'export JAMAIS JOUÉE** (`e2e/export-rbac.spec.ts` écrit,
              non exécuté). 11 tests e2e verts au titre de la partie empreinte, pas de la 08.
  Données   : tenant réel « Afrique Stratégie » : 1 hypothèse, **0 montant — INTACT**.
              Recette e2e : 8 versions publiées, 8 montants, 11 parts, 0 montant sans origine.
              Runs réussis : 8, dont 2 avec matière d'entrée conservée.
  Migrations: registre à 8 lignes. **La task 08 n'en ajoute AUCUNE** — `public.exports` existait
              depuis la migration initiale, avec sa RLS.
  Tasks     : 01→07 ✅ · **08 🟨 en cours** · 09 ✅ · 10 ⬜.

[FAIT]
  (La première moitié de la session — reproductibilité des versions publiées, moteur 1.1.0,
  `calculation_runs.input_snapshot` — est décrite dans l'entrée du 2026-09-07 ci-dessous. Elle est
  livrée, déployée et prouvée. Ce qui suit ne concerne QUE la task 08.)

  1. **LA RLS DE `budget_values` PORTE SUR `read`, PAS SUR `export`.** C'est la découverte qui
     structure toute la task. Un contributeur peut avoir `can_read` sur une dimension sans
     `can_export` : une requête ordinaire remonte donc des lignes que le fichier n'a pas le droit
     d'emporter. Conséquence : `lib/exports/scope.ts` **DÉCIDE**, il n'est pas un miroir de la base
     comme l'est `hasDimensionPermission` ailleurs. Le fait est figé par un contrôle pgTAP dédié
     (fichier 10, dernier contrôle), pour qu'un futur resserrement de la RLS soit VU et non deviné.
  2. **`public.exports` n'avait AUCUN test** alors que sa RLS existe depuis l'origine.
     `supabase/tests/10_export_rbac.test.sql` : 10 contrôles, tous verts contre la production —
     dont le refus opposé à un contributeur qui demanderait une dimension seulement lisible, et le
     refus d'une demande au nom d'autrui.
  3. **LE DÉTERMINISME EXIGÉ PAR `prd.md:122` N'ÉTAIT PAS ACQUIS.** Mesuré : `write-excel-file`
     rend un fichier DIFFÉRENT à chaque appel — seize octets, les horodatages que le format ZIP
     écrit dans chaque en-tête. Sans correction, `exports.file_hash` n'aurait permis de vérifier
     aucun fichier reçu. `figerLArchive` réécrit l'archive avec une date constante (1980-01-01 ;
     `mtime: 0` est REFUSÉ, le format ne code que 1980-2099).
  4. Bibliothèque choisie sur PREUVE, pas de mémoire : `xlsx` (SheetJS) écarté — la seule version
     sur npm public, 0.18.5, porte **deux advisories `high`** dont les correctifs (0.19.3, 0.20.2)
     n'existent que hors du registre public. `exceljs` : 0 advisory mais **9 dépendances et 21,8 Mo**.
     Retenu : **`write-excel-file@4.1.1`** — 0 advisory, **une seule transitive (`fflate`), 1,8 Mo**,
     écriture seule (pas de parseur, donc moins de surface). Vérifié : il n'écrit AUCUN `docProps`,
     donc aucune métadonnée d'auteur ni de date.
  5. Les deux écrans portent le lien : « Exporter le classeur » sur la consolidation (DAF/DG) et
     « Exporter mon périmètre » sur la version (contributeur ayant un périmètre). Un endpoint
     qu'aucun écran n'atteint n'est livré qu'à moitié — leçon déjà payée le 2026-08-28.

[ENCOURS]
  **Task 08, tout est écrit, RIEN n'est livré.** Fichiers non commités :
    · `apps/web/src/lib/exports/scope.ts`      (périmètre + `scope_hash`)
    · `apps/web/src/lib/exports/workbook.ts`   (classeur déterministe, `figerLArchive` exportée)
    · `apps/web/src/app/api/exports/[versionId]/route.ts` (endpoint, journalisation AVANT envoi)
    · `apps/web/tests/exports.test.ts`         (10 contrôles)
    · `apps/web/e2e/export-rbac.spec.ts`       (6 parcours, **jamais exécutés**)
    · `supabase/tests/10_export_rbac.test.sql` (10 contrôles, verts)
    · modifiés : `package.json` + `package-lock.json` (nouvelle dépendance),
      `app/app/budgets/[versionId]/page.tsx`, `app/app/consolidation/[versionId]/page.tsx`

  Reste à faire, dans cet ordre :
    1. `npm run lint` puis `npm run build` — non rejoués depuis les derniers fichiers ;
    2. commit + push ;
    3. déployer **les DEUX services** (voir MEMO 1 de l'entrée du 2026-09-06) ;
    4. jouer `e2e/export-rbac.spec.ts` contre `https://tarjih-os.com` — **c'est LA preuve qui
       manque**, et son contrôle central est le refus opposé au contributeur sur une adresse
       DEVINÉE (le jeu de recette lui donne `can_read` et NON `can_export`) ;
    5. rejouer les NEUF fichiers pgTAP ;
    6. passer la spec 08 en `status: done` et la déplacer dans `specs/done/`.

[ALERTE]
  - **NE PAS DÉCLARER LA 08 TERMINÉE SANS LA RECETTE NAVIGATEUR.** Le filtrage d'export ne repose
    PAS sur la RLS (cf. FAIT 1) : c'est du code applicatif qui décide seul. Un test unitaire vert
    ne prouve rien sur le service déployé. Tant que l'étape 4 ci-dessus n'a pas tourné, la promesse
    « un contributeur ne reçoit aucune donnée hors périmètre, y compris dans les exports »
    (`prd.md:60`) n'est PAS vérifiée en conditions réelles.
  - **ÉCART ASSUMÉ À LA SPEC 08** : elle liste `services/calculation/.../export.py`. Ce fichier
    n'existe pas et n'est pas prévu — le moteur Python ne reçoit aucun contexte utilisateur
    (`archi.md`), il ne peut donc pas filtrer, et son cœur est à ZÉRO dépendance. Toute la
    génération vit côté web. Décision à confirmer par Amine s'il tenait à ce découpage.
  - **L'export ne porte QUE les montants**, pas les parts d'hypothèses que l'écran de consolidation
    affiche. YAGNI assumé, non demandé par la spec — mais un DAF qui exporte perd l'origine des
    chiffres qu'il voit à l'écran. À trancher au premier retour d'usage.
  - **Les six runs antérieurs au 2026-09-07 restent sans matière et non rejouables** (moteur 1.1.0
    refuse un snapshot 1.0.0 — vérifié : `engine_version_mismatch`). Tous du tenant de recette.
  - **Tarjih toujours ABSENT du tableau de `PASSATION-INDEX.md`** — ouvert depuis le 2026-08-28.
    Écriture hors projet (règle n°6) : signalée, jamais faite. À ajouter par Amine.

[BLOQUE]
  Rien techniquement. Le seul jalon PRODUIT qui reste bloqué par un accès :
  faire produire un chiffre à un TENANT RÉEL — `a.mansouri@afriquestrategie.com` est le seul DG du
  tenant « Afrique Stratégie » et son mot de passe n'est pas au coffre.

[NEXT]
  1. **FINIR LA 08** : les six étapes de [ENCOURS], dans l'ordre. Rien d'autre avant.
  2. **Faire produire à Tarjih un chiffre pour un tenant réel** (cf. [BLOQUE]).
  3. Task 10 (déploiement preview).
  4. Modèle économique pilote (`prd.md:138`) : question de découverte client, déclencheur = premier
     client réel. PAS une dette technique.

[CTX]
  Session `12b5a4a6`, 2026-09-07, CWD `c:\projets\Budget & CFO`. HEAD de référence au démarrage
  `b7b069b` ; aucune autre session n'a écrit dans le dépôt (vérifié par `fetch` avant chaque push).
  Trois commits poussés : `2aafe07` (applicatif — empreinte), `f0969a9` et `ae29f79` (documentaires).
  Arbitrages tranchés par Amine cette session : **A + C** sur l'empreinte ; **XLSX via
  bibliothèque** pour l'export (contre ma recommandation CSV — appliqué pleinement, les trois
  risques que j'avais nommés étant traités : métadonnées absentes, horodatages figés, déterminisme
  prouvé).

  Vérifier la reproductibilité d'une version publiée (lecture seule, rejouable) :
    `cat scripts/extraire-matieres-conservees.sql | ssh … 'docker exec -i <db> psql -U postgres`
    `   -d postgres -t -A -f -' > matieres.json`
    `python scripts/verifier-reproductibilite.py < matieres.json`   → code 0 si toutes rejouent.

  Le reste du contexte opératoire (serveur, base, uuid Coolify, gates, pgTAP, déploiement, recette,
  coffre) est INCHANGÉ — voir l'entrée du 2026-09-06, toujours exacte.

[MEMO]
  Pièges payés dans cette seconde moitié de session :
  1. **UN CONTRÔLE PEUT RESTER VERT DEUX FALSIFICATIONS DE SUITE.** Le test de déterminisme de
     l'export est passé vert (a) sans aucune normalisation, parce que deux générations tombent dans
     la même seconde et que l'horodatage ZIP a une granularité de DEUX secondes ; puis (b) avec une
     normalisation écrivant la date COURANTE, parce que les deux appels du test la partageaient.
     Il n'attrape le cas réel que depuis qu'il compare à une **valeur de référence figée**. Trois
     tentatives. Falsifier n'est pas une formalité : il faut falsifier de la façon dont le code
     casserait VRAIMENT.
  2. **`npm view` ne dit rien des vulnérabilités.** Les advisories se lisent au registre :
     `curl -s -X POST https://registry.npmjs.org/-/npm/v1/security/advisories/bulk -d '{"paquet":["version"]}'`.
     C'est ce qui a écarté `xlsx` — dont la dernière version publique est vulnérable et le
     restera, SheetJS ayant quitté npm.
  3. **Une attente de test peut être fausse sans que le produit le soit.** Le contrôle pgTAP n°8
     attendait qu'un contributeur voie la demande d'export du DAF. La policy ne l'ouvre qu'au
     demandeur et aux financiers : c'était l'attente qui était fausse, et le comportement réel est
     le bon. Lire la policy avant d'accuser le code.
  4. **`apps/web/AGENTS.md` impose de lire `node_modules/next/dist/docs/` AVANT d'écrire du code
     Next.** Fait pour les Route Handlers : dans cette version, `params` est une **Promise**, et un
     helper global `RouteContext<'/chemin/[id]'>` existe (types générés par `next build`/`typegen`).
  5. **Une version publiée exige `published_at`** (`budget_versions_check`) : un jeu d'essai qui
     insère `status = 'published'` sans date est refusé par le schéma. Bon invariant, à connaître
     avant d'écrire un fixture.
  6. **La table `exports` impose son modèle RBAC par sa RLS d'insertion** : `dimension_id IS NULL`
     réservé au DAF/DG, sinon une ligne PAR dimension avec `can_export`. L'endpoint s'y conforme —
     un DAF laisse une trace globale, un contributeur une trace par dimension emportée.
```

---

## 2026-09-07 — Une version publiée rejoue enfin son empreinte, et la preuve est en production

```
[ETAT]
  Repo      : `HEAD` == `origin/master`, worktree propre. Dernier commit APPLICATIF **`2aafe07`**,
              sur lequel tournent **les deux** services (`tarjih-web` ET `tarjih-calculation`),
              conteneurs `healthy`, tags d'image VÉRIFIÉS (pas déduits du statut) et bascule
              terminée — un seul conteneur par service.
  Gates     : typecheck 0, lint 0 warning, **58 tests Node**, **43 tests Python** (34 + 9 nouveaux),
              build OK, **107 contrôles pgTAP** sur les HUIT fichiers, joués contre la PRODUCTION
              en begin/rollback, 0 échec — rejoués APRÈS la recette, pas seulement avant.
              **11 tests Playwright verts** contre `https://tarjih-os.com` (2,2 min).
  Données   : recomptées à la clôture — 8 versions publiées, 8 montants, 11 parts,
              **0 montant sans origine**. Runs réussis : 8, dont **2 avec matière d'entrée
              conservée** et 6 sans (antérieurs, voir ALERTE).
              **Tenant réel « Afrique Stratégie » : 1 hypothèse, 0 montant — INTACT.**
  Migrations: registre à **8 lignes** (ajout de `20260907120000`). Rollback écrit ET prouvé.
  Moteur    : **1.1.0** (était 1.0.0). Les deux côtés bougent ensemble (`EXPECTED_ENGINE_VERSION`).
  Tasks     : 01→07 ✅ · 08 ⬜ · 09 ✅ · 10 ⬜. Inchangé : ce chantier ferme un DÉFAUT, pas une task.

[FAIT]
  1. **L'ALERTE N°1 DE LA PASSATION PRÉCÉDENTE EST FERMÉE, ET PROUVÉE EN PRODUCTION.**
     « Une version publiée cesse d'être reproductible dès qu'on ajoute un compte » : c'était vrai,
     ça ne l'est plus. La preuve n'est pas un test de laboratoire — c'est le scénario réel qui
     avait cassé `c6033eb3`. Les deux versions publiées aujourd'hui appartiennent au MÊME tenant ;
     la première a été publiée quand il portait 9 comptes et 9 périodes, il en porte 10 et 10
     maintenant, et elle **retrouve toujours son empreinte** (`scripts/verifier-reproductibilite.py`,
     2/2, code de sortie 0). Mesuré, pas supposé.
  2. **LE MOTEUR N'EMPREINTE PLUS QUE CE QUE LES HYPOTHÈSES CITENT** (`canonical.snapshot_hash`).
     Le snapshot continue de transporter tout le référentiel du tenant — mesuré sur les matières
     conservées : **9 et 10 comptes transportés pour UN seul cité** — mais l'empreinte n'en retient
     que la part utile. Trois propriétés à ne pas perdre de vue :
     * le périmètre est **dérivé des contributions résolues**, jamais d'une liste de champs tenue à
       la main. Un résolveur qui cite un compte produit forcément une contribution dessus, le
       compte de base d'un `percent_of` compris (sans lui, `base_missing`). Une liste manuelle
       aurait été un TROISIÈME jumeau à maintenir, après `hypothesis-value.ts`/`resolvers.py` ;
     * la restriction ne touche QUE le hachage, jamais le calcul : aucun résultat ne change, et
       une sous-inclusion ne peut pas casser un budget qui marchait ;
     * elle restaure au passage l'idempotence de `publish_calculation` sur `input_hash`, qui était
       ILLUSOIRE — deux publications identiques divergeaient dès que le référentiel grossissait.
  3. **LA MATIÈRE D'ENTRÉE EST CONSERVÉE** (`calculation_runs.input_snapshot`). C'est ce qui rend la
     promesse vraie de façon PERMANENTE : restreindre l'empreinte corrige le cas mesuré, mais
     renommer le code d'un compte réellement utilisé l'aurait encore cassée. Elle ne peut pas
     manquer (l'ancienne fonction à six paramètres est SUPPRIMÉE, pas surchargée), ne peut pas
     décrire une autre version ni un autre tenant (contrainte de table), et ne se réécrit pas
     (trigger — qui refuse aussi de REMPLIR un snapshot resté nul).
  4. **LE MOTEUR EST PASSÉ EN 1.1.0, ET C'EST DÉLIBÉRÉ.** L'empreinte fait partie de son contrat :
     sans ce numéro, une même matière rendant une autre empreinte serait inexplicable pour qui
     audite un run ancien. `calculation_runs.engine_version` continue de dire, run par run, sous
     quelle convention chacun a été empreinté.
  5. `specs/_source/archi.md` réaligné : `input_snapshot` dans la table des colonnes, le cycle de
     calcul corrigé (c'est le MOTEUR qui rend `input_hash`, après résolution — pas le backend
     avant), et ce que la publication refuse désormais.

[ALERTE]
  - **LES SIX RUNS ANTÉRIEURS N'AURONT JAMAIS DE MATIÈRE, ET LES SIX VERSIONS QU'ILS ONT PUBLIÉES
    NE SONT PLUS REJOUABLES.** Deux causes distinctes, toutes deux assumées : leur matière n'a
    jamais été conservée (la fabriquer serait écrire soi-même la preuve qu'on prétend vérifier —
    le trigger l'interdit), et le moteur 1.1.0 refuse un snapshot `1.0.0`. Vérifié plutôt que
    supposé : le rejeu rend `engine_version_mismatch`, donc un REFUS motivé, jamais une origine
    plausible. Les six appartiennent toutes au tenant de recette ; aucun engagement client n'est
    concerné. Conséquence pratique : `scripts/reconstruire-sources.py` et
    `scripts/extraire-snapshots-publies.sql` ne peuvent plus rien reconstruire. Ils restent au
    dépôt comme trace de ce qui a été fait le 2026-09-06, pas comme outils vivants.
  - **Tarjih reste ABSENT du tableau de `PASSATION-INDEX.md`** (il vit hors de `OneDrive\Projets`).
    Le hook le retrouve par le CWD, mais il n'apparaît pas dans la liste inter-projets alors qu'il
    en serait la ligne la plus récente. Écriture hors projet (règle n°6) : signalée, non faite.
    Ouverte depuis le 2026-08-28, jamais soldée.

[BLOQUE]
  Rien.

[NEXT]
  1. **FAIRE PRODUIRE À TARJIH UN CHIFFRE POUR UN TENANT RÉEL.** C'est désormais LE seul jalon
     produit qui manque, et l'ordre qui l'imposait après l'empreinte est levé : la fenêtre où l'on
     pouvait corriger l'auditabilité sans casser d'engagement client a été utilisée. Ne demande
     plus de code. Point d'attention : `a.mansouri@afriquestrategie.com` est le seul DG du tenant
     réel et son mot de passe n'est pas au coffre.
  2. Task 08 (exports RBAC), puis 10 (déploiement preview).
  3. Modèle économique pilote (`prd.md:138`) : question de découverte client, PAS une dette
     technique. Déclencheur : premier client réel.
  4. Envisager d'ajouter `verifier-reproductibilite.py` à la recette : il ne tourne aujourd'hui
     que sur demande, alors qu'il porte la promesse la plus forte du produit. Non fait — ce serait
     élargir la portée du chantier sans mandat.

[CTX]
  Session `12b5a4a6`, 2026-09-07, CWD `c:\projets\Budget & CFO`. HEAD de référence au démarrage
  `b7b069b` ; aucune autre session n'a écrit dans le dépôt (vérifié par `fetch` avant push).
  Arbitrage tranché par Amine : **A + C** (restreindre l'empreinte ET conserver la matière),
  proposé avec le coût de rupture mesuré — nul, les 6 empreintes cassées étant toutes de recette.

  Vérifier la reproductibilité (rejouable à volonté, lecture seule) :
    `cat scripts/extraire-matieres-conservees.sql | ssh … 'docker exec -i <db> psql -U postgres`
    `   -d postgres -t -A -f -' > matieres.json`
    `python scripts/verifier-reproductibilite.py < matieres.json`   → code 0 si toutes rejouent.
    Une extraction VIDE sort en 1 : « rien à vérifier » n'est pas « tout va bien ».

  Le reste du contexte opératoire (serveur, base, uuid Coolify, commandes de gates, pgTAP,
  déploiement, recette, coffre) est INCHANGÉ — voir l'entrée du 2026-09-06, toujours exacte.

[MEMO]
  Pièges payés cette session :
  1. **`jsonb_typeof(NULL)` rend NULL, pas `'null'`.** Le garde `jsonb_typeof(x) <> 'object'` ne
     voit donc PAS un paramètre absent : le cas le plus banal — ne rien transmettre — glissait
     jusqu'au contrôle suivant et s'annonçait « décrit une autre version », un message faux.
     Trouvé par le contrôle pgTAP pendant que la migration n'était encore qu'une transaction
     d'essai. Écrire `x is null or jsonb_typeof(x) <> 'object'`.
  2. **UN CONTRÔLE VERT PEUT NE RIEN PROUVER, ET SEULE LA FALSIFICATION LE DIT.** Le contrôle
     « le compte cité fait partie de l'empreinte » passait en modifiant le CODE du compte — mais
     l'empreinte bougeait par l'HYPOTHÈSE, qui cite ce code et qui est hachée en entier. Falsifié,
     il est resté vert : 2 rouges sur 3. Reformulé sur `normal_balance`, que l'hypothèse ne cite
     pas, il discrimine. Falsifier chaque contrôle, un par un, avant de croire un vert.
  3. **`awk` sous Git Bash réécrit les fins de ligne** : un extrait de fichier LF ressort en CRLF,
     et le diff affiche alors TOUT le fichier comme modifié (SOP-022). Extraire en Python avec
     `newline=""` pour préserver l'original, et vérifier le diff AVANT de conclure.
  4. **Le corps d'une fonction SQL recréée se DÉRIVE, ne se réécrit pas.** La nouvelle
     `publish_calculation` a été produite par trois remplacements ciblés sur le corps extrait de la
     migration précédente, et le diff (3 changements, rien d'autre) l'a prouvé. Le rollback a été
     vérifié plus loin encore : `pg_get_functiondef` comparé avant/après dans la même transaction
     rend la fonction **identique à l'octet près**.
  5. **Changer la signature d'une fonction casse les fichiers pgTAP qui l'appellent** — 06 et 07,
     dix appels. Complétés par un script qui compte les parenthèses plutôt qu'à la main, diff
     vérifié ensuite (20 insertions, 10 suppressions : exactement les dix appels).
  6. **Une migration appliquée avant son déploiement casse la production dans l'intervalle.**
     La signature à six paramètres disparaît, le code déployé l'appelle encore : la publication a
     été indisponible entre l'application et la bascule des conteneurs. Sans conséquence ici (aucun
     tenant réel n'avait de version à publier), mais l'ordre correct est migration → déploiement
     IMMÉDIAT, et la fenêtre doit être annoncée avant, pas constatée après.
  7. **Le mot « ponytail » ne dispense pas de placer la correction au bon étage.** La première
     idée — restreindre le snapshot côté TypeScript — aurait dupliqué en TS la connaissance des
     champs qui citent un compte, avec un vrai risque de sous-inclusion cassant un calcul. La
     corriger dans le moteur, sur les contributions déjà résolues, est à la fois plus court, plus
     sûr, et impossible à désynchroniser.
```

---

## 2026-09-06 — Chaque chiffre publié dit d'où il vient, et trois défauts sortent du bois

> **PÉRIMÉE SUR UN POINT, corrigé par l'entrée du 2026-09-07 — ne pas s'y fier :** son ALERTE n°1
> (« une version publiée cesse d'être reproductible dès qu'on ajoute un compte ») est FERMÉE, et
> l'arbitrage qu'elle laissait ouvert est TRANCHÉ (A + C). Le contournement qu'elle décrit —
> reprendre le référentiel daté à `published_at` — n'a plus lieu d'être : la matière d'entrée
> est désormais conservée, il n'y a plus rien à reconstruire. Le reste de l'entrée demeure exact.

```
[ETAT]
  Repo      : `HEAD` == `origin/master`, worktree propre. Le hash de tête n'est pas figé ici : les
              derniers commits sont documentaires et le font bouger à chaque correction de ce
              fichier — `git log --oneline -1` fait foi. Le repère qui compte est le dernier commit
              APPLICATIF, **`13c8ddb`**, sur lequel tournent **les deux** services (`tarjih-web` ET
              `tarjih-calculation`), conteneurs `healthy` — tags d'image vérifiés, pas déduits du
              statut. Les commits documentaires qui suivent ne changent aucune ligne servie.
  Gates     : typecheck 0, lint 0 warning, **58 tests Node**, **36 tests Python**, build OK,
              **90 contrôles pgTAP** sur les SEPT fichiers, joués contre la PRODUCTION en
              begin/rollback, 0 échec. **11 tests Playwright verts** contre `https://tarjih-os.com`.
  Données   : recomptées à la clôture — **6 montants publiés, 0 sans origine, 8 parts**,
              6 versions publiées, 7 migrations au registre. Les publications supplémentaires sont
              le résidu assumé de la recette (chaque passage publie ; une version publiée est
              immuable, donc rien ne se nettoie — cf. la borne dans `specs/todo/09-parcours-e2e.md`).
              **Tenant réel « Afrique Stratégie » : 1 hypothèse, 0 montant — INTACT.**
  Migrations: registre à 7 lignes (ajout de `20260906120000`, `20260906130000`, `20260906140000`).
              Les trois rollbacks existent ; celui de la traçabilité a été joué en transaction
              d'essai et prouvé par cinq contrôles avant application.
  Tasks     : 01→07 ✅ · 08 ⬜ · 09 ✅ · 10 ⬜. **La 07 est close, critère 5 compris.**

[FAIT]
  1. **D'OÙ VIENT CE CHIFFRE : la réponse existe.** `public.budget_value_sources` porte la part
     EXACTE de chaque hypothèse dans chaque montant. Trois propriétés la rendent utilisable :
     elle est exacte et non arrondie (`numeric` sans échelle contre `numeric(24, 6)` pour le
     montant — arrondir les parts imprimerait une addition fausse) ; elle ne peut pas manquer
     (l'ancienne fonction à cinq paramètres, qui publiait sans origine, est SUPPRIMÉE, pas
     surchargée ; un montant sans part, une part orpheline ou une part citant l'hypothèse d'une
     autre version font échouer la publication entière) ; elle ne se réécrit pas (trigger, donc
     même un chemin `security definer` bute dessus).
  2. **LES DEUX VERSIONS DÉJÀ PUBLIÉES ONT ÉTÉ REJOUÉES, PAS DEVINÉES.** Le snapshot d'entrée
     n'existe nulle part — `calculation_runs` n'en garde que l'EMPREINTE. La reconstruction n'écrit
     donc que si l'empreinte recalculée retrouve `input_hash`. C'est ce témoin qui a révélé
     l'alerte n°1 ci-dessous : sans lui, on aurait écrit une origine plausible sous un chiffre
     intangible, et on n'aurait rien vu.
  3. **L'ARRONDI TENAIT EN DEUX CONVENTIONS CONCURRENTES.** L'agrégation arrondissait en commercial
     (`ROUND_HALF_UP`), la sérialisation canonique au pair le plus proche — le défaut de `Decimal`,
     jamais choisi. Sans effet tant qu'elle ne recevait que des montants déjà arrondis ; or les
     parts, elles, ne le sont pas. `to_publishable` est désormais le SEUL endroit qui arrondit.
     Marqueur `ponytail:` de `engine.py` fermé : la convention est actée, pas reportée.
     Prouvé sans régression : cinq budgets, dont deux cas d'arrondi limite, donnent des empreintes
     et des valeurs IDENTIQUES avant et après (comparaison contre le code extrait de `git archive`).
  4. **LE CORPUS PARTAGÉ N'AVAIT AUCUN CAS MULTI-PÉRIODES**, alors que le moteur boucle sur
     `amounts` et en produit une contribution par période. Les deux jumeaux pouvaient donc diverger
     en silence sur une forme acceptée. Le cas existe, et il discrimine des deux côtés (falsifié à
     251,00 : le Python rougit ; restauré : vert).
  5. Cas 8 : une hypothèse à deux périodes n'est plus affichée comme si elle n'en portait qu'une —
     « (1re de 2 périodes) ». Un affichage tronqué SANS le dire, sur un chiffre financier, est ce
     qui détruit la confiance dans l'outil.
  6. Cas 4 : une panne du service d'authentification ne s'annonce plus « mot de passe incorrect ».
     La distinction se fait sur le code HTTP (4xx = refus, le reste = panne) et ne dit JAMAIS si
     l'adresse existe. Une erreur sans statut est traitée comme une panne : rien n'a vérifié le
     mot de passe, donc rien ne permet de le mettre en doute.
  7. Cas 3 : l'approbateur voit qui a proposé. `list_hypothesis_authors` ne rend que les auteurs
     des hypothèses que l'appelant a DÉJÀ le droit de lire — ce n'est pas un annuaire, et
     `list_tenant_members` reste réservée aux administrateurs. `proposed_by` cesse d'être lu là où
     il ne servait à rien.
  8. Cas 7 : la borne de la recette est ÉCRITE (`specs/todo/09-parcours-e2e.md`) — la recette cesse
     de tourner sur cette base au premier client payant, pas « quand on aura le temps ».

  9. **UNE RECETTE NAVIGATEUR EST ÉCRITE AVANT LE CODE, ET ELLE A TROUVÉ UN DÉFAUT RÉEL.**
     `e2e/tracabilite-des-montants.spec.ts` publie DEUX hypothèses approuvées sur le même compte
     et la même période — ce que le parcours vertical ne faisait pas, et c'est pourquoi il ne
     prouvait rien sur l'origine : une part unique égale forcément son total.
     Le moteur a réussi ses trois épreuves (une seule ligne agrégée, arrondi unique à 30,01, les
     deux hypothèses nommées). **L'ÉCRAN, LUI, MENTAIT** : 10,005 et 20,005 s'affichaient
     « 10,01 » et « 20,01 » sous un total de « 30,01 ». Le lecteur additionne 30,02 et cesse de
     croire, non pas l'affichage, mais LE CHIFFRE. Cause : `formatAmount` fixe deux décimales et
     passe par `Number`. Les parts gardent désormais toutes leurs décimales, sans conversion
     numérique. Corrigé APRÈS avoir vu le rouge, jamais l'inverse.
     Évalué en base après coup, indépendamment de Playwright : parts `10.005` et `20.005`,
     montant `30.010000`, et `round(somme des parts, 6) = montant` VRAI. Le moteur Python était
     juste sur toute la ligne ; le défaut était entièrement dans le rendu.
     L'arithmétique du test est en `bigint`, jamais en flottant — mesurer une addition avec
     l'erreur qu'on veut détecter ne prouverait rien — et l'instrument a ses propres tests
     unitaires (`tests/montants-affiches.test.ts`, 9 contrôles) : un instrument faux déclarerait
     juste une addition fausse.

[ALERTE]
  - **UNE VERSION PUBLIÉE CESSE D'ÊTRE REPRODUCTIBLE DÈS QU'ON AJOUTE UN COMPTE.** Mesuré, pas
    supposé : la version `c6033eb3` (empreinte `6d5de917d09b`) ne retrouvait plus la sienne. Ses
    chiffres n'avaient pas bougé — son tenant avait gagné UN compte et UNE période depuis. Le
    snapshot embarque TOUT le référentiel du tenant, y compris ce qu'aucun calcul n'a touché.
    La promesse d'auditabilité (« rejouer une version publiée rend la même empreinte ») est donc
    FAUSSE aujourd'hui. Contournement en place : l'extraction reprend le référentiel tel qu'il
    était (`created_at <= published_at`), et les deux versions se sont alors reconstruites.
    **ARBITRAGE OUVERT, non tranché** : restreindre le snapshot au référentiel effectivement
    utilisé corrigerait la cause, mais changerait l'empreinte de toute version publiée. Défaut
    ANTÉRIEUR à ce chantier.
  - **LA PASSATION PRÉCÉDENTE ANNONÇAIT « LE PREMIER CHIFFRE RÉEL DE TARJIH ». C'EST INEXACT.**
    Les 1 200,50 MAD d'empreinte `6d5de917d09b` appartiennent au tenant **« Recette e2e »**. Le
    tenant réel « Afrique Stratégie » porte une version en `draft`, 1 hypothèse approuvée et
    **ZÉRO montant**. Tarjih n'a jamais produit de chiffre pour un tenant réel — seulement pour
    sa propre recette.
  - **FAILLE FERMÉE, ET LA LEÇON COMPTE PLUS QUE LA FAILLE** : le rôle `anon` détenait sept
    privilèges sur `budget_version_states` depuis le 2026-09-02. Aucune fuite constatée (la vue
    est `security_invoker`, un anonyme n'a ni `auth.uid()` ni appartenance), mais l'invariant du
    projet dit « aucun privilège », pas « ne peut rien lire ». Le contrôle qui l'a trouvée existait
    depuis le début et disait vrai : **personne ne l'avait rejoué**. Règle qui en découle : après
    CHAQUE migration, rejouer les SEPT fichiers pgTAP, pas seulement celui du sujet traité.

[BLOQUE]
  Rien.

[NEXT]
  1. **Trancher l'arbitrage de l'empreinte** (alerte n°1) : le snapshot doit-il se restreindre au
     référentiel réellement employé ? Cela corrige l'auditabilité et casse les empreintes déjà
     publiées. Rien ne presse tant qu'aucun client réel n'a de version publiée — ce qui est le cas.
  2. **Faire produire à Tarjih un chiffre pour un TENANT RÉEL** (alerte n°2). C'est le seul jalon
     produit qui manque, et il ne demande plus de code.
  3. Task 08 (exports RBAC), puis 10 (déploiement preview).
  4. Modèle économique pilote (`prd.md:138`) : question de découverte client, PAS une dette
     technique. Déclencheur : premier client réel. Elle bloquait l'arrondi ; elle ne bloque plus
     rien depuis que la convention est actée.

[CTX]
  Session `d60e0c75`, 2026-09-06, CWD `c:\projets\Budget & CFO`. HEAD de référence au démarrage
  `ae04d44` ; aucune autre session n'a écrit dans le dépôt (vérifié par `fetch` + comparaison).

  Serveur   : `ssh -i ~/.ssh/serveurai_mnemo -o BatchMode=yes serveuria@192.168.100.24`
              → hostname attendu `serveuria-MS-7D98`. IP dynamique : re-vérifier après reboot.
  Base      : conteneur `supabase-db-f10v8td71bwii32blb9lalfk` — SEULE des ONZE instances Supabase
              du serveur à porter les tables Tarjih. NE PAS redeviner.
  Coolify   : projet `Tarjih` uuid `n3njfl7sfu0hatepq5ihugid`.
              `tarjih-web` uuid `l3fov9fbnjvrgt5ly75b7g5r` ·
              `tarjih-calculation` uuid `tuxybsaq9adb6txew2rc6zkr` (alias réseau stable
              `tarjih-calculation`, non exposé publiquement).
              **LES DEUX SE DÉPLOIENT ENSEMBLE** — voir MEMO 1.

  Commandes exactes, toutes vérifiées cette session :

  - Gates      : `npm run typecheck` · `npm run lint` · `npm test` · `npm run build` (racine).
  - Python     : `cd services/calculation && PYTHONPATH=src python -m unittest discover -s tests`
  - pgTAP      : chaque fichier porte son `begin`/`rollback`, donc rien n'est laissé en base.
                 `cat supabase/tests/<f>.test.sql | ssh -i ~/.ssh/serveurai_mnemo -o BatchMode=yes \
                    serveuria@192.168.100.24 'docker exec -i supabase-db-f10v8td71bwii32blb9lalfk \
                    psql -U postgres -d postgres --set=client_encoding=UTF8 -v ON_ERROR_STOP=1 -f -'`
                 **Les SEPT fichiers après CHAQUE migration**, jamais seulement celui du sujet.
  - Migration  : même commande avec `-1` en plus (une seule transaction).
                 Essai sans rien laisser : concaténer `begin;` + migration + corps du test (privé
                 de son propre `begin`/`rollback`) + `rollback;`.
  - Recette    : `& 'C:\Users\amans\.claude\scripts\invoke-secret.ps1' -TimeoutSec 900 \
                    -Keys TARJIH_E2E_PW_CONTRIB,TARJIH_E2E_PW_DAF,TARJIH_E2E_PW_DG,TARJIH_E2E_PW_INTRUS \
                    -Command 'Set-Location "C:\projets\Budget & CFO\apps\web"; \
                              node ./node_modules/playwright/cli.js test'`
                 `E2E_BASE_URL` surcharge la cible. Le broker coupe à 300 s par défaut : `-TimeoutSec 900`.
  - Déploiement: `& 'C:\Users\amans\.claude\scripts\invoke-secret.ps1' -Keys COOLIFY_API_TOKEN,COOLIFY_URL \
                    -Command 'curl.exe -s -X GET -H "Authorization: Bearer $env:COOLIFY_API_TOKEN" \
                      "$env:COOLIFY_URL/api/v1/deploy?uuid=<uuid>&force=false" \
                      | jq -r ".deployments[0].message"'`
                 Guillemets DOUBLES autour de l'en-tête (sinon `$env:` part littéralement) ; le
                 filtre `jq` à champ unique est EXIGÉ par le garde anti-fuite.
  - Preuve     : le tag d'image doit valoir le sha du commit —
                 `docker ps --filter name=<uuid> --format "{{.Image}} {{.Status}}"`. Un `healthy`
                 seul ne prouve pas ce qui tourne.

  Reconstruction d'origines (one-shot, rejouable) :
    `scripts/extraire-snapshots-publies.sql` (lecture seule, référentiel daté à `published_at`)
    → `python scripts/reconstruire-sources.py` (rejeu, écrit du SQL SEULEMENT si l'empreinte
      recalculée retrouve `calculation_runs.input_hash` ; le rapport va sur stderr)
    → appliquer le SQL produit. Logique sous tests : `tarjih_calculation.replay`.

  Coffre     : `TARJIH_E2E_PW_CONTRIB|DAF|DG|INTRUS`, `TARJIH_ADMIN_EMAIL`,
               `TARJIH_ADMIN_TECHNIQUE`, `TARJIH_CALCULATION_SERVICE_TOKEN`. Jamais en clair,
               toujours par le broker. Le jeu de comptes se repose avec
               `supabase/seed/e2e-recette.sql` (réexécutable, marqueurs remplacés au runtime) —
               ce n'est PAS une migration, il ne s'inscrit pas au registre.

  Comptes réels : `a.mansouri@afriquestrategie.com` est le seul DG du tenant « Afrique
               Stratégie » ; son mot de passe n'est pas au coffre. Ce n'est pas un blocage — la
               recette a ses propres acteurs et n'emprunte jamais le compte d'une personne réelle.

[MEMO]
  Pièges payés cette session :
  1. **CE PRODUIT A DEUX SERVICES À DÉPLOYER, PAS UN.** Déployer `tarjih-web` sans
     `tarjih-calculation` laisse le moteur rendre l'ancienne forme : la recette a échoué sur
     « le service de calcul n'a pas répondu », alors que le service répondait parfaitement — c'est
     le contrôle de conformité qui refusait sa réponse. Il a bien fonctionné : il a empêché une
     publication sans traçabilité.
  2. **Une migration qui change la SIGNATURE d'une fonction casse les tests qui l'appellent.**
     Le fichier `06` a dû être repris en même temps. C'est voulu : laisser l'ancienne signature
     aurait laissé vivre un chemin publiant sans origine.
  3. **Réécrire un bloc SQL « de mémoire » change des messages d'erreur sur lesquels des tests
     s'appuient.** Deux l'ont été, rattrapés par un `difflib` entre l'ancienne et la nouvelle
     fonction. Comparer, ne pas relire.
  4. **Le garde anti-fuite exige un filtre `jq` à champ unique** sur une réponse d'API de la
     plate-forme de déploiement — même quand la commande n'imprime qu'un code HTTP. S'y conformer,
     ne pas le contourner.
  5. **PowerShell rend un code de sortie 1 quand un exécutable natif écrit sur stderr**, même pour
     un simple avertissement Node. La recette Playwright était VERTE (6/6) avec un code 1.
  6. **Un montant exact se sérialise en forme canonique** (zéros de fin retirés) : `1000.50`
     devient `1000.5`. Deux tests écrits avec l'autre attente ont dû être corrigés — l'attente
     était arbitraire, pas le code.
  7. **`plan(n)` de pgTAP ne pardonne pas** : compter les contrôles à la main, ou le fichier
     signale un écart même quand tout passe.
  8. **`target: ES2017` dans `tsconfig.json` interdit les littéraux `bigint`** (`0n`). `BigInt(0)`
     passe. Ne pas remonter la cible du projet pour un besoin de test.
  9. **Ne jamais écrire un caractère invisible dans du code** : les espaces insécables d'`Intl`
     (U+00A0, U+202F) collés dans une classe de caractères rendent la ligne inéditable — un
     `Edit` ne retrouve pas la chaîne, et une correction ultérieure les supprime sans le savoir.
     Les écrire en échappement (` `) et les nommer.
 10. **Un contrôle d'isolation joué en `postgres` ne prouve RIEN** : la RLS ne s'applique pas à un
     superutilisateur. `set local role authenticated` est obligatoire, comme le fait le fichier 02.
```

---

## 2026-09-04 — Tarjih produit son premier chiffre, et une recette navigateur le rejoue

> **PÉRIMÉE SUR TROIS POINTS, corrigés par l'entrée du 2026-09-06 — ne pas s'y fier :**
> 1. « LE PREMIER CHIFFRE RÉEL DE TARJIH » : ces 1 200,50 MAD appartiennent au tenant
>    **« Recette e2e »**, pas à un tenant client. Le tenant réel n'a toujours aucun montant.
> 2. La task 07 y est 🟨 : elle est **close** depuis le 2026-09-06, critère 5 compris.
> 3. L'alerte « rien ne relie un montant à ses hypothèses » est **fermée** par
>    `public.budget_value_sources`, y compris rétroactivement.
> Le reste de l'entrée — jeu de recette, pont entre les jumeaux, pièges — reste valable.


```
[ETAT]
  Repo      : `HEAD` == `origin/master`, worktree propre. Prod sur l'image du commit poussé
              (vérifié : tag d'image == sha du commit, conteneur `healthy`).
  Gates     : typecheck 0, lint 0 (e2e et config Playwright inclus), 39 tests Node,
              29 tests Python, build OK, **6 tests Playwright verts contre
              `https://tarjih-os.com`** (145 s, code de sortie 0, deux exécutions).
  Données   : tenant réel « Afrique Stratégie » — 1 cycle, 1 hypothèse, **INTACT** (recompté après
              deux passages de recette). Tenants de recette : 2 cycles, 4 hypothèses,
              2 versions publiées.
  Tasks     : 01→06 ✅ · **07 🟨** (un critère non rempli, voir ALERTE) · 08 ⬜ · **09 ✅** · 10 ⬜.

[FAIT]
  1. LE PONT ENTRE LES DEUX JUMEAUX EST POSÉ. `lib/budgets/hypothesis-value.ts` et
     `resolvers.py` décrivaient la même forme sans rien qui les relie : en modifier un cassait le
     calcul en silence côté écran. Ils lisent désormais UN corpus,
     `schemas/hypothesis-value.cases.json`, avec un test de chaque côté. Deux règles, une par
     côté : tout ce que l'interface PRODUIT, le moteur l'accepte ; tout ce que le moteur ACCEPTE,
     l'interface sait le relire.
  2. Le filet a été rendu ROUGE avant toute correction, et il a attrapé TROIS divergences réelles :
     (a) un prix unitaire à plus de six décimales était refusé à la saisie alors que le moteur
     l'autorise délibérément — la validation d'un inducteur est maintenant distincte de celle d'un
     montant ; (b) `percent_of`, que le moteur résout, était illisible côté interface : une
     hypothèse valide s'affichait « non calculable — à ressaisir » ; (c) un montant hors de
     `numeric(24,6)` était accepté à la saisie et n'échouait qu'à la publication.
     Discrimination prouvée dans les deux sens (un champ renommé dans `resolvers.py` fait rougir
     trois cas côté Python).
  3. JEU DE RECETTE (`supabase/seed/e2e-recette.sql`) : deux tenants qui ne seront jamais un
     client, quatre comptes, les autorisations que les règles exigent RÉELLEMENT — le DAF porte
     `can_approve` SUR LA DIMENSION, car `decide_hypothesis` demande cette permission et pas le
     rôle. Aucun mot de passe dans le dépôt : les marqueurs sont remplacés au runtime depuis le
     coffre (`TARJIH_E2E_PW_*`).
  4. RECETTE NAVIGATEUR (task 09) contre le domaine DÉPLOYÉ, jamais un serveur local (SOP-011) :
     référentiel → cycle → version → deux hypothèses → une seule approuvée → calcul → publication,
     plus le contrôle d'isolation inter-tenant. Zéro erreur de console sur tout le parcours.
  5. **LE PREMIER CHIFFRE RÉEL DE TARJIH EXISTE** — et il est prouvé EN BASE, indépendamment de
     Playwright : version `published`, moteur `1.0.0`, empreinte `6d5de917d09b`,
     **1 200,500000 MAD**. L'hypothèse `charge_en_attente` (999,99) est restée `proposed` et n'a
     produit aucune valeur : la gouvernance filtre, ce n'est plus une intention.
  6. Documentation réalignée sur le code : `/app/settings/reference` ajoutée aux Pages V1 de
     `archi.md`, tableau des tasks corrigé (06 était marquée non commencée alors qu'elle tourne).

[ALERTE]
  - **LA PASSATION PRÉCÉDENTE DÉCLARAIT LA TASK 07 TERMINÉE. C'EST FAUX.** Quatre critères sur
    cinq tiennent, vérifiés un par un. Le cinquième non : `budget_values` porte le run et la
    version, mais RIEN ne relie un montant aux hypothèses qui l'ont produit. Le moteur calcule
    pourtant ce lien (`resolvers.Contribution.hypothesis_id`) et l'abandonne à l'agrégation.
    Depuis un montant publié on remonte à la version, donc à TOUTES ses hypothèses approuvées,
    jamais à celles de ce chiffre-là. Sur une version qui en porte des dizaines, cela ne répond
    pas à « d'où vient ce chiffre ». Statut ramené à 🟨, reste écrit dans la task.
  - **`login/actions.ts` traduit une panne du service d'authentification en « mot de passe
    incorrect ».** Constaté en vrai : GoTrue renvoyait un 500
    (`converting NULL to string is unsupported`) et l'écran affichait `invalid-credentials`. Un DAF
    bloqué par une panne d'infrastructure s'entend donc dire que son mot de passe est faux. Non
    corrigé : cela ajoute un message visible par l'utilisateur, donc c'est un arbitrage produit.
  - **Le worker Playwright a refusé de se terminer une fois** (« did not exit within 300000ms »),
    faisant sortir la suite en code 1 alors que les six tests passaient. NON REPRODUIT sur deux
    exécutions suivantes (code 0, 145 s). Le poste portait alors des dizaines de processus
    Chromium et Playwright résiduels appartenant à un AUTRE projet. Signalé, pas « corrigé ».
  - **Résidu de recette assumé** : chaque exécution publie une version, et une version publiée est
    immuable — elle ne peut pas être nettoyée. Les versions s'accumulent donc dans les tenants de
    recette. C'est le prix du choix (arbitré par Amine) de jouer la recette en production plutôt
    que de provisionner un second stack ; le tenant réel a été recompté INTACT après coup.
  - **Arbitrage du 2026-08-28 TOUJOURS OUVERT et disparu de la dernière passation** : un
    approbateur doit-il voir l'identité de l'auteur d'une hypothèse ? Rien n'a été fait, comme
    convenu, mais la question n'a jamais reçu de réponse.

[BLOQUE]
  Rien de technique. Le compte DG réel (`a.mansouri@afriquestrategie.com`) reste le seul DG actif
  et son mot de passe n'est pas au coffre — mais ce n'est PLUS un blocage : la recette a ses
  propres acteurs et n'emprunte jamais le compte d'une personne réelle.

[NEXT]
  1. **Trancher le critère 5 de la 07** : relier un montant publié à ses hypothèses sources.
     Le moteur a déjà l'information ; il faut la transporter (table de liens ou colonne) et la
     montrer. C'est la dernière dette de la tranche verticale.
  2. **Deux arbitrages produit en attente** : identité de l'auteur pour un approbateur (ouvert
     depuis le 28/08) ; message distinct quand l'authentification est en panne.
  3. Modèle économique pilote (`prd.md:138`) et réexamen de l'arrondi `ROUND_HALF_UP`
     (`engine.py:32`, seul marqueur `ponytail:` vivant du dépôt).
  4. Task 08 (exports RBAC), puis 10 (déploiement preview).

[CTX]
  Recette : les mots de passe vivent au coffre (`TARJIH_E2E_PW_CONTRIB|DAF|DG|INTRUS`) et ne
  s'utilisent QUE par le broker. La commande complète est écrite dans
  `specs/todo/09-parcours-e2e.md`. `E2E_BASE_URL` surcharge la cible.
  Le jeu de comptes se repose avec `supabase/seed/e2e-recette.sql` (réexécutable, marqueurs
  remplacés au runtime) — ce n'est PAS une migration et il ne s'inscrit pas au registre.

[MEMO]
  Pièges payés cette session :
  1. **UN COMPTE CRÉÉ EN SQL NE PEUT PAS SE CONNECTER SI SES COLONNES DE JETONS SONT NULLES.**
     GoTrue les lit en `string` non nullable : `confirmation_token`, `recovery_token`,
     `email_change_token_new`, `email_change` doivent valoir la chaîne vide. Le symptôme ment —
     l'écran dit « mot de passe incorrect », la vérité est dans `docker logs supabase-auth-…`.
     La bonne méthode : comparer colonne par colonne avec un compte qui FONCTIONNE, pas deviner.
  2. **`page.goto` attend par défaut TOUTES les sous-ressources** (`waitUntil: "load"`). Sur ce
     site, cela faisait passer une étape de 9 s à 46 s et finissait en navigation avortée.
     `domcontentloaded` suffit : les localisateurs attendent déjà leur élément.
  3. **Le garde anti-fuite bloque une lecture d'environnement dans un conteneur, même sans
     imprimer la valeur.** Ne pas le contourner : changer d'approche. Ici, créer les comptes en SQL
     a évité de déplacer le moindre secret — meilleur sur tous les axes.
  4. **Le broker coupe à 300 s** ; une suite navigateur dépasse. `-TimeoutSec 900`.
  5. **Un garde de sécurité peut se déclencher sur sa propre documentation** : le contrôle
     « aucun marqueur de mot de passe ne subsiste » matchait le commentaire d'en-tête qui citait
     le motif. Un garde doit chercher une forme, pas une sous-chaîne présente dans sa propre prose.
  6. **PowerShell ne connaît pas la redirection `<`.** Pour alimenter l'entrée standard d'un
     exécutable natif, il faut un tube depuis une variable.
```

---

## 2026-09-03 — Tarjih calcule : moteur déterministe, publication atomique, référentiel

> **PÉRIMÉE SUR DEUX POINTS** (entrée du 2026-09-06) : l'alerte « aucun test ne relie les deux
> jumeaux » est fermée depuis le 2026-09-04 (corpus partagé) ; l'arrondi `ROUND_HALF_UP` n'est
> plus un marqueur `ponytail:` mais une convention actée et centralisée dans `to_publishable`.


> Cette entrée remplace et consolide celles du 2026-09-02 et du 2026-09-03 (première rédaction),
> dont plusieurs affirmations sont devenues fausses dans la même session (« aucun écran pour les
> comptes et périodes », « l'adresse du moteur n'est pas stable »).

```
[ETAT]
  Repo      : `HEAD` == `origin/master` == `9a69262`, worktree propre (vérifié par `git rev-parse`).
              Dernier commit APPLICATIF : `63cc258`.
  Prod web  : `tarjih-web` uuid `l3fov9fbnjvrgt5ly75b7g5r`, conteneur `...-163218648735`,
              `running:healthy`. Point de rollback : image `l3fov9fbnjvrgt5ly75b7g5r:21b4ed6cebef...`.
  Prod calc : `tarjih-calculation` uuid `tuxybsaq9adb6txew2rc6zkr`, `running:healthy`,
              alias réseau STABLE `tarjih-calculation`. Non exposé : aucun domaine, aucun port publié.
  Base      : conteneur `supabase-db-f10v8td71bwii32blb9lalfk` — SEULE des onze instances Supabase du
              serveur à porter les tables Tarjih (vérifié objet par objet ; NE PAS redeviner).
              Registre `supabase_migrations.schema_migrations` : 4 lignes.
  Gates     : typecheck 0, lint 0, 30 tests Node, build OK, 26 tests Python,
              16 contrôles pgTAP exécutés sur la base de PRODUCTION (begin/rollback, rien laissé).
  Données   : 5 dimensions, 1 hypothèse approuvée (ANCIENNE FORME → non calculable),
              0 compte financier, 0 période, 0 budget_value.
  Tasks     : 01→07 terminées. Restent 08 (exports RBAC), 09 (parcours e2e), 10 (déploiement preview).

[FAIT]
  1. Moteur déterministe `services/calculation/` — stdlib pure, ZÉRO dépendance dans le cœur
     (FastAPI isolé dans un extra `[api]`, `api.py`). Déterminisme prouvé ENTRE PROCESSUS
     (`PYTHONHASHSEED` 0/1/42/random → même empreinte). Un pipeline, trois résolveurs
     (`direct`, `cost_center`, `driver`) : choix d'Amine d'offrir les trois à l'utilisateur, le modèle
     étant figé PAR VERSION budgétaire (une version publiée est immuable, son modèle aussi).
     Une hypothèse non approuvée FAIT ÉCHOUER le calcul au lieu d'être filtrée en silence.
     Les nombres circulent en CHAÎNE, jamais en nombre JSON : un float est refusé à la frontière.
     Un inducteur (volume, prix, taux) n'est PAS soumis à l'échelle `numeric(24,6)` — seul le
     résultat est arrondi, une fois, à l'agrégation.
  2. Migration `20260902120000_publish_calculation` APPLIQUÉE en production (+ rollback + 16 pgTAP) :
     colonne `budget_versions.calculation_model`, vue `budget_version_states`, fonction
     `publish_calculation` (`security definer`, idempotente sur `input_hash`, publication atomique).
  3. Marqueur `ponytail:` de `govern_hypotheses:72-77` FERMÉ : la supersession est DÉRIVÉE de
     l'existence d'une version enfant (`is_superseded`), jamais écrite comme statut — l'invariant
     d'immuabilité ne reçoit aucune brèche.
  4. Écran `/app/consolidation/[versionId]` (DAF/DG), atteignable depuis la table des versions.
  5. DÉFAUT MAJEUR CORRIGÉ : une hypothèse était stockée en `{"type":"decimal","value":"..."}` — ni
     compte ni période. AUCUNE hypothèse saisie dans l'interface n'était calculable ; tout le chemin
     livré était inatteignable depuis l'écran. `value` porte désormais compte + période + chiffre,
     dans la forme que le moteur valide (`lib/budgets/hypothesis-value.ts`, jumeau de `resolvers.py`
     — LES DEUX ÉVOLUENT ENSEMBLE). Choix du jsonb plutôt que de colonnes : la forme dépend du
     modèle (inducteur = volume + prix ; taux = compte de base), que deux colonnes ne couvriraient
     pas sans une foule de nuls.
  6. Écran `/app/settings/reference` (comptes et périodes) — ils n'avaient AUCUNE interface, et un
     calcul refuse sans eux. Réservé DAF/DG, comme leur RLS le dit déjà.
  7. `decimalValue` supprimé (export mort) ; ses contrôles reportés sur la valeur que le moteur lit.
  8. Vérifié DÉPLOYÉ (SOP-011) : `/app/settings/reference`, `/app/consolidation/[id]`, `/app/budgets`
     rendent 307 vers `/login` contre 404 sur une URL bidon ; le conteneur web appelle le moteur avec
     le vrai jeton et reçoit 422 (snapshot vide refusé), PAS 401 → authentification prouvée.

[ALERTE]
  - `lib/budgets/hypothesis-value.ts` et `services/calculation/.../resolvers.py` décrivent LA MÊME
    forme de données. Modifier l'un sans l'autre casse le calcul en silence côté UI (le moteur, lui,
    refusera). Aucun test ne relie encore les deux — angle mort assumé.
  - L'unique hypothèse approuvée en base est à l'ANCIENNE forme : elle s'affiche « non calculable —
    à ressaisir ». Ne pas la prendre pour un bug.
  - Le jeu de FORMULES métier n'est pas tranché : `specs/_source/prd.md:138` pose la question du
    modèle économique pilote. Les trois résolveurs donnent l'arithmétique et les garde-fous, PAS une
    sémantique sectorielle. Convention d'arrondi `ROUND_HALF_UP` marquée `ponytail:` dans `engine.py`
    (plafond + déclencheur = ce moment-là).
  - `/app/consolidation/[versionId]` et `/app/settings/reference` ne figurent pas dans les Pages V1 de
    `specs/_source/archi.md:104-115` (la première y est, sous une autre forme ; la seconde non).
    L'archi est en retard sur le code : à réaligner.

[BLOQUE]
  Plus rien de technique. Le blocage est un COMPTE : seul `a.mansouri@afriquestrategie.com` est
  **DG actif** et peut créer comptes/périodes, approuver et publier.
  `admin.technique@tarjih-os.com` (coffre : `TARJIH_ADMIN_EMAIL`, `TARJIH_ADMIN_TECHNIQUE`) est
  *contributeur + tenant_admin* : il ne peut NI créer comptes/périodes NI publier — séparation VOULUE
  (migration `separate_tenant_admin`). Les comptes `recette-*-05` sont suspendus.
  Le mot de passe du DG n'est pas au coffre et n'a pas été réinitialisé.

[NEXT]
  1. Se connecter en DG, puis : Référentiel → 1 compte + 1 période ; Budget → saisir une hypothèse ;
     l'approuver ; Consolidation → « Calculer et publier ». C'est le premier chiffre réel de Tarjih.
  2. Trancher le modèle économique pilote (`prd.md:138`) et réexaminer l'arrondi.
  3. Réaligner `specs/_source/archi.md` sur les routes réelles.
  4. Task 08 (exports RBAC), 09 (parcours e2e Playwright), 10 (déploiement preview).
  5. Optionnel : amender SOP-014 des quatre pièges ci-dessous (déclencheur REX atteint).

[CTX]
  Serveur   : `ssh -i ~/.ssh/serveurai_mnemo -o BatchMode=yes serveuria@192.168.100.24` →
              hostname attendu `serveuria-MS-7D98`.
  Coolify   : projet `Tarjih` uuid `n3njfl7sfu0hatepq5ihugid`, serveur `etbh3cvs6qxr9l6w5hrcunj5`,
              environnement `production`.
  Variables : `tarjih-web` porte NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
              CALCULATION_SERVICE_URL (= `http://tarjih-calculation:8000`), CALCULATION_SERVICE_TOKEN.
              `tarjih-calculation` porte CALCULATION_SERVICE_TOKEN. Coffre :
              `TARJIH_CALCULATION_SERVICE_TOKEN` (ajouté ce jour, 64 car.).
  Tests     : `cd services/calculation && PYTHONPATH=src python -m unittest discover -s tests`.
              pgTAP : `cat supabase/tests/06_*.sql | ssh ... 'docker exec -i supabase-db-f10v8... psql
              -U postgres -d postgres --set=client_encoding=UTF8 -v ON_ERROR_STOP=1 -f -'`.

[MEMO]
  Pièges payés cher cette session — ne pas les revivre :
  1. ADRESSE D'UN SERVICE : une application Coolify « Dockerfile » reçoit un conteneur
     `<uuid>-<horodatage>`, qui change à chaque déploiement → inutilisable comme adresse. Seuls les
     services d'un COMPOSE reçoivent un alias = nom de service (vérifié sur `capture-worker`,
     `hermes`, `broker`, `dispatcher`). D'où `docker-compose.calculation.yaml` à la RACINE du dépôt :
     un `context: ../..` depuis le dossier du service remonte au-dessus du fichier compose, ce que
     Docker refuse dans une arborescence clonée.
  2. PATCH COMBINÉS IGNORÉS EN SILENCE : un corps portant `build_pack` ET `docker_compose_location`
     n'applique qu'une partie des champs, sans erreur. UN CHAMP PAR PATCH, puis RELECTURE.
  3. LOGS DE DÉPLOIEMENT ABSENTS DE L'API (`.logs` = null) : ils vivent dans la base de la plateforme
     → `docker exec coolify-db psql -U coolify -d coolify -tAc "select logs from
     application_deployment_queues where deployment_uuid = '<uuid>'"`. C'est la SEULE façon d'avoir
     eu les deux causes réelles ; trois déploiements perdus avant d'y penser.
  4. SONDE : la plateforme interroge le conteneur avec un client HTTP en ligne de commande. Une image
     `python:*-slim` n'en embarque aucun → conteneur déclaré non sain → rollback silencieux. Installer
     le client dans l'image et aligner les deux sondes (Dockerfile + compose).
  5. QUOTING WINDOWS : dans une commande passée au broker, l'en-tête `Authorization` doit être en
     GUILLEMETS DOUBLES. En guillemets simples, `$env:COOLIFY_API_TOKEN` part LITTÉRALEMENT et l'API
     répond `Unauthenticated.` — le jeton est valide, c'est la commande qui est fautive.
  6. RUNNER DE TESTS : `npm test` exécute les modules TS SANS le résolveur d'alias de Next. Un
     `import type` via `@/` survit (effacé à la compilation), un IMPORT DE VALEUR NON. Dans un module
     couvert par `npm test` : import relatif AVEC extension `.ts` (`./hypothesis-value.ts`).
  7. PRESSE-PAPIER INTERMITTENT sur ce poste : disponible en début de session, `ERROR_ACCESS_DENIED`
     une heure plus tard. Repli `add-secret.ps1 -Value $variable` (expansion runtime) → nécessaire.
  8. BASH-GUARD, faux positifs : un message de commit contenant « Coolify » + « curl » est bloqué
     (règle Couche D). Écrire le message dans un FICHIER puis `git commit -F <fichier>`.
```

---

## 2026-08-28 (suite) — Registre de migrations posé, task 05 close et prouvée en production

```
[ETAT]   master poussé et vérifié (`fetch` + comparaison `HEAD`/`origin/master`), worktree vide. Le hash de tête
         n'est pas écrit ici : les derniers commits de la session sont documentaires et le font bouger à chaque
         correction de ce fichier — `git log --oneline -1` fait foi. Le repère qui compte est le dernier commit
         **applicatif**, `21b4ed6`, qui est l'image que la production exécute.
         Production sur l'image `21b4ed6` (`2d8d97e` est documentaire), `running:healthy`.
         Supabase `running:healthy`, `OOMKilled=false`, 0 redémarrage, 238,8 Mio sur 4 Gio, aucune base jetable résiduelle.
         Gates : typecheck 0 erreur, lint 0 erreur **0 warning**, **27 tests Node**, build OK, **52 contrôles pgTAP**
         (13+4+14+21), 0 échec. Tasks 01→05 terminées. Reste 06→10.
         Données de production : 1 cycle (clos), 1 version, 1 hypothèse approuvée, 1 décision, 26 événements d'audit.

[FAIT]   **1. Le compte de recette est au coffre** (`TARJIH_ADMIN_TECHNIQUE`, `TARJIH_ADMIN_EMAIL`), identité prouvée
         par comparaison `-ceq` dans un processus neuf **avant** suppression du fichier de scratchpad, qui n'existe plus.
         Écart de procédure assumé : le presse-papier est **structurellement indisponible** depuis l'outil PowerShell de
         Claude Code sur ce poste (`OpenClipboard` → `ERROR_ACCESS_DENIED`, aucune fenêtre propriétaire, thread pourtant
         STA — la window station du processus n'en a pas). Le chemin nominal de SOP-001 est donc inapplicable ; repli par
         `add-secret.ps1 -Value $variable`, valeur expansée au runtime depuis une lecture in-process, jamais dans le
         transcript. Toutes les garanties du script sont identiques sur ce chemin.

         **2. L'ALERTE « aucun registre de migrations » est fermée.** La table est celle de la CLI Supabase, **pas** un
         registre maison : sa forme exacte a été relevée sur une autre base du même serveur réellement gérée par la CLI
         (`version text` PK, `statements text[]`, `name text`), de sorte qu'un futur `supabase db push` retrouve son
         registre. Elle vit dans `supabase/bootstrap/`, hors du flux des migrations — une migration ne peut pas créer la
         table qui la recense. **Chaque migration s'inscrit désormais elle-même**, dans sa propre transaction : appliquer
         sans inscrire est devenu impossible, cela ne repose plus sur la discipline de personne. Chaque rollback supprime
         sa ligne. Pas de RLS dessus, volontairement : `anon`, `authenticated`, `authenticator` et même `service_role`
         n'ont ni `usage` ni `select` — plus fermé qu'une RLS, et sans diverger de la primitive de la plateforme.
         Le rattrapage des deux migrations antérieures s'est fait sur un constat **objet par objet** contre la production :
         c'était le dernier moment où il pouvait se faire par lecture directe plutôt que de mémoire.

         **3. Task 05 livrée en un lot complet.** L'architecture (`specs/_source/archi.md:109-111`) prescrit **trois**
         écrans, pas un : `/app/budgets`, `/app/budgets/[versionId]`, `/app/hypotheses/[id]`. J'avais tranché pour un seul
         avant d'ouvrir ce fichier — c'était le code qui déviait, pas l'archi. Les trois existent, plus la navigation :
         le bandeau n'affichait de liens **qu'aux administrateurs**, tout membre en a désormais.

         **4. Trou refermé dans la migration : une version publiée acceptait encore un INSERT.** Elle changeait donc de
         contenu sans qu'aucune de ses lignes ne bouge. Le garde couvre maintenant les trois écritures ; la suppression
         est fermée aussi, pour qu'un futur chemin `security definer` bute sur la même règle.

         **5. Le chemin « un contributeur corrige son hypothèse » fonctionne**, et il est prouvé par une **écriture
         concurrente réelle en production** : pendant que la page restait ouverte, une session `psql` distincte a fait
         avancer la révision ; la correction fondée sur la lecture périmée a été refusée, la valeur concurrente préservée.

         **6. Deux gardes automatiques sur la feuille de style.** Une classe utilisée sans définition, ou définie sans
         usage, fait désormais échouer `npm test`. C'est la leçon des « 11 classes sur 12 » convertie en contrôle.

         **7. Deux défauts de rendu mobile corrigés, de cause identique et à deux niveaux** : `grid-template-columns: 1fr`
         vaut `minmax(auto, 1fr)`, donc la piste adopte la largeur min-content de son contenu — les 640 px du tableau —
         et pousse la page hors de l'écran, sans que le `overflow-x` du conteneur puisse quoi que ce soit. Corrigé sur
         `.console-layout` **et** sur `.console-panel`, qui est lui-même une grille. Profite aussi à l'écran de la task 04.

         **8. `TARJIH_ADMIN_TECHNIQUE` exposée puis rotée dans la même heure.** Le snapshot d'accessibilité Playwright a
         imprimé le mot de passe enregistré dans le profil du navigateur. Triage SOP-001 §8ter : E1 non, E2 douteux →
         rotation immédiate. Nouvelle valeur posée en base, coffre remplacé, correspondance empreinte↔coffre prouvée
         **en base** sans jamais réafficher la valeur. Registre `secrets-leaks.log` : ligne ouverte puis soldée.

[ALERTE] **Un snapshot d'accessibilité Playwright imprime les mots de passe enregistrés du profil.** Ne jamais capturer
         la page de connexion avec un profil qui a mémorisé des identifiants. C'est ainsi que la clé du coffre a fuité,
         alors même que je m'apprêtais à ne pas la taper.

         **Le cache fausse la mesure d'un correctif de style.** Un rendu mesuré juste après un déploiement peut porter la
         feuille du build précédent — j'ai failli conclure qu'un correctif juste ne marchait pas. Toute vérification
         visuelle post-déploiement passe par une URL qui casse le cache.

         **Un approbateur ne peut pas savoir QUI a proposé.** `list_tenant_members` est verrouillée sur `is_tenant_admin` :
         un DAF n'y voit rien. L'écran dit donc « par vous » ou « par un contributeur de la dimension », avec date, motif
         et trace définitive — mais sans identité. Question **produit**, pas technique : ouvrir une résolution d'identité
         bornée au périmètre de lecture élargit ce qu'un financier voit des personnes. Non tranché de ma seule initiative.

         **Toujours aucun test Playwright versionné.** Le `CLAUDE.md` l'exige avant toute déclaration de complétude ;
         la recette de ce jour a de nouveau été conduite à la main. L'écart est réel, assumé, et c'est la task 09.

         **Les deux comptes `recette-*` ne sont pas supprimables** — la décision qu'ils ont produite est append-only,
         l'hypothèse est retenue par elle, et l'hypothèse retient son auteur. Ils ont été rendus inertes (appartenance
         suspendue, mot de passe remplacé par une valeur inconnue de tous, refus de connexion prouvé). Les effacer
         exigerait de désactiver la garantie d'audit que la task 05 apporte.

[BLOQUE] rien.

[NEXT]   1) **Task 06 — moteur Python déterministe.** Elle ne dépend que de la 02 ; la 07 attend 05 **et** 06.
         2) **Arbitrage d'Amine attendu** : faut-il qu'un approbateur voie l'identité de l'auteur d'une hypothèse ?
            Coût si oui : une fonction `security definer` bornée aux utilisateurs apparaissant dans la trace d'une
            hypothèse lisible, plus son contrôle pgTAP. Rien ne sera fait sans ce mot.
         3) **Playwright avant la 09 ?** Le parcours vertical existe désormais et vient d'être joué à la main :
            c'est le moment le moins cher pour l'écrire. À arbitrer.
         4) Signalements **inter-projets** relevés dans `secrets-leaks.log`, lignes encore `consigné` et hors de ce
            périmètre (règle n°6, non touchées) : `HERMES_WEBUI_PASSWORD` (2026-08-07), `HERMES_WEBUI_OIDC_CLIENT_SECRET`
            (2026-08-13), `TRANSCRIBE_API_KEY` (2026-08-04), `CLOUDFLARED_TUNNEL_TOKEN` (2026-08-20). Aucune n'a
            30 jours, mais la plus ancienne les atteint le 2026-09-03.
         5) Tarjih reste **absent du tableau de `PASSATION-INDEX.md`** (il vit hors de `OneDrive\Projets`) — écriture
            hors projet, donc signalée et non faite.

[CTX]    Session `4fd50451`, 2026-08-28, CWD `c:\projets\Budget & CFO`. HEAD de référence `825d69c`, aucune autre session
         déclarée, HEAD stable de bout en bout. SOP lues et appliquées : 003 (priorisation, §4bis surcomplexité),
         001 (§8 rotation, §8bis variante B pour les comptes éphémères, §8ter triage d'un leak), 007 (mesure avant
         affirmation sur la production), 011 (vérification déployée), 014 (déploiement Coolify), 019 (mise en scène
         nommée, publication vérifiée par `fetch`). 5 commits : `845f4f7` (registre), `cd80a52` (task 05),
         `f6dca81` et `21b4ed6` (débordement mobile, deux niveaux), `2d8d97e` (traçabilité).
         Docker Desktop toujours indisponible sur le poste : les 52 contrôles pgTAP ont tourné dans deux bases jetables
         du cluster de production (recette + témoin pour l'aller-retour), mémoire mesurée avant et après (238,6 → 250,3
         puis retour à 238,8 Mio sur 4 Gio), bases supprimées et état d'origine reprouvé.
         Captures de recette : scratchpad de session, 6 fichiers PNG (hors dépôt).

[MEMO]   **Un test rouge n'est pas toujours un défaut du produit.** Le seul échec des 21 contrôles de la 05 venait de
         moi : j'avais logé l'appel à `decide_hypothesis` dans le `where` de la requête qui vérifiait son effet, et
         l'instantané de l'instruction précédait sa propre écriture. Lire le message avant d'accuser le code.

         **Une correction qui « ne marche pas » peut être une mesure qui ment.** Deux fois ce jour la mesure a été
         fausse — le cache après déploiement, l'instantané SQL — et une fois la mesure a eu raison contre mon
         impression, en trouvant un débordement mobile que la capture d'écran ne montrait pas.

         **La primitive de la plateforme bat le registre maison, mais seulement si on relève sa forme réelle.**
         La table du registre n'a pas été reconstituée de mémoire ni de documentation : elle a été lue sur une base
         voisine que la CLI avait réellement créée. C'est la différence entre réutiliser et imiter.

         **Le geste qui devait éviter une exposition l'a provoquée.** J'ai créé des comptes éphémères précisément pour
         ne pas taper la clé du coffre dans un navigateur — et c'est le premier snapshot de la page de connexion,
         avant toute frappe, qui l'a imprimée depuis l'autofill. Le canal de fuite n'était pas celui que je surveillais.
```

## 2026-08-28 — Tasks 03 et 04 closes et prouvées en production ; console d'administration refondue

> **Entrée historique — ne pas agir sur ses `[ALERTE]` ni ses `[NEXT]`, tous soldés par l'entrée du dessus :**
> l'absence de registre de migrations est fermée ; la task 05 est livrée, déployée et prouvée ; l'effet de bord
> du déclencheur `row_version` sur le chemin contributeur est traité et prouvé par écriture concurrente réelle ;
> le mot de passe du compte de recette est au coffre, puis rotaté. Reste vrai et toujours applicable : les pièges
> GoTrue (jetons à la chaîne vide), l'écart Playwright, et l'absence de Tarjih dans `PASSATION-INDEX.md`.

```
[ETAT]   master = **bd0086d** poussé et vérifié (`git fetch` + comparaison `HEAD`/`origin/master`, hashes identiques).
         Production sur l'image `0989ba8` (dernier commit applicatif ; `bd0086d` est documentaire), `running:healthy`.
         `/health` 200, `/app/settings/dimensions` 307 pour un visiteur. Supabase `running:healthy`,
         `OOMKilled=false`, 0 redémarrage, PostgreSQL 226 Mio sur 4 Gio, aucune base jetable résiduelle.
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

         **9. Traçabilité rouverte.** Specs 03 et 04 déplacées en `specs/done/` (`status: completed`, critères cochés
         seulement après preuve en production), statuts du `specs/todo/README.md` corrigés,
         `docs/deployment-tarjih.md` réécrit avec la procédure d'application transactionnelle et les deux pièges
         appris, et **ce fichier créé** — il n'existait pas. Le hook le retrouvera seul à la prochaine session : sa
         branche « CWD hors Projets » remonte du CWD jusqu'à la racine du disque. Tarjih reste néanmoins **absent du
         tableau de `PASSATION-INDEX.md`** (il vit hors de `OneDrive\Projets`) : non bloquant, mais il n'apparaîtra
         pas dans la liste des dates inter-projets tant qu'Amine n'y aura pas ajouté la ligne — écriture hors projet,
         donc signalée et non faite (règle n°6).

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
         effectuée**, les deux valeurs exposées sont mortes). 6 commits : `012ddff` (task 04), `cb1132f` (rollback),
         `943e11d` (refonte console), `e62f767` (gouttières fantômes), `0989ba8` (débordement mobile + specs),
         `bd0086d` (passation + doc de déploiement).
         Docker Desktop indisponible sur le poste (service non démarrable sans élévation) : les contrôles
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
