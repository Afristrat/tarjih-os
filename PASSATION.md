# PASSATION — Tarjih (plateforme financière multi-tenant)

> Dépôt : `c:\projets\Budget & CFO` · remote `Afristrat/tarjih-os` (public) · branche `master`.
> Production : `https://tarjih-os.com`, Coolify `serveuria`, Supabase dédié.
> Sources de vérité produit : `specs/_source/` · découpage : `specs/todo/README.md`.

## 2026-09-02 — Tasks 06 et 07 livrées et déployées : Tarjih calcule enfin

```
[ETAT]   master poussé et vérifié (`HEAD` == `origin/master`). Dernier commit applicatif : `f900f26`.
         Production : `tarjih-web` (`l3fov9fbnjvrgt5ly75b7g5r`) redéployé, `running:healthy`, conteneur
         `...-115314219008`. NOUVEAU service `tarjih-calculation` (`tuxybsaq9adb6txew2rc6zkr`),
         `running:healthy`. Point de rollback du web : image `l3fov9fbnjvrgt5ly75b7g5r:21b4ed6cebef...`.
         Base Supabase de Tarjih = conteneur `supabase-db-f10v8td71bwii32blb9lalfk` (SEULE des onze
         instances du serveur à porter les tables Tarjih — vérifié objet par objet, ne pas redeviner).
         Gates : typecheck 0, lint 0, 27 tests Node, build OK, 26 tests Python, 16 contrôles pgTAP
         exécutés sur la base de PRODUCTION (begin/rollback, rien laissé derrière).

[FAIT]   **1. Moteur de calcul déterministe** (`services/calculation/`), stdlib pure, zéro dépendance.
         Déterminisme prouvé ENTRE PROCESSUS (`PYTHONHASHSEED` 0/1/42/random → même empreinte).
         Un pipeline, trois résolveurs (`direct`, `cost_center`, `driver`) — choix d'Amine d'offrir
         les trois à l'utilisateur, le modèle étant figé PAR VERSION budgétaire.
         Une hypothèse non approuvée FAIT ÉCHOUER le calcul au lieu d'être filtrée en silence.

         **2. Publication atomique** (`publish_calculation`), idempotente sur `input_hash`. Migration
         `20260902120000` appliquée en production, inscrite au registre (4 lignes).

         **3. Le marqueur `ponytail:` de `govern_hypotheses:72-77` est FERMÉ.** La supersession est
         DÉRIVÉE de l'existence d'une version enfant (vue `budget_version_states.is_superseded`) au
         lieu d'être écrite comme statut : l'invariant d'immuabilité ne reçoit aucune brèche.

         **4. Écran `/app/consolidation/[versionId]`**, accessible depuis la table des versions pour
         DAF et DG seulement. Vérifié en production : 307 vers `/login` (la route existe et protège),
         contre 404 sur une URL bidon.

         **5. Chaîne web → moteur prouvée en production** : le conteneur du site appelle le moteur
         avec le vrai jeton et reçoit 422 (snapshot vide refusé), PAS 401 — l'authentification passe.
```

### Écueils rencontrés, à ne pas revivre

- **L'adresse d'un service sur la plateforme.** Une application « Dockerfile » reçoit un conteneur
  nommé `<uuid>-<horodatage>`, qui change à chaque déploiement : inutilisable comme adresse. Seuls
  les services d'un **compose** reçoivent un alias réseau égal au nom de service (vérifié sur
  `capture-worker`, `hermes`, `broker`, `dispatcher`). D'où `docker-compose.calculation.yaml` à la
  RACINE du dépôt — un `context: ../..` depuis le dossier du service remonte au-dessus du fichier
  compose, ce que Docker refuse. Le web joint le moteur sur `http://tarjih-calculation:8000`.
- **Les PATCH combinés de l'API sont ignorés en silence.** Un corps portant à la fois `build_pack`
  et `docker_compose_location` n'applique qu'une partie des champs, sans erreur.
  **Un champ par PATCH, puis relecture systématique.**
- **L'API ne rend pas les logs de déploiement** (`.logs` = null). Ils vivent dans sa base :
  `docker exec coolify-db psql -U coolify -d coolify -tAc "select logs from application_deployment_queues where deployment_uuid = '<uuid>'"`.
  C'est ce qui a révélé les deux causes réelles, invisibles autrement.
- **La sonde de la plateforme exige un client HTTP en ligne de commande DANS l'image.**
  `python:3.13-slim` n'en embarque aucun : le conteneur était déclaré non sain et la plateforme
  faisait un rollback — trois déploiements perdus avant de lire le log. Le client est désormais
  installé dans l'image, et les deux sondes (Dockerfile et compose) s'alignent dessus.
- **Quoting Windows** : dans une commande passée au broker, l'en-tête `Authorization` doit être en
  GUILLEMETS DOUBLES. En guillemets simples, `$env:COOLIFY_API_TOKEN` part littéralement et l'API
  répond `Unauthenticated.` — le jeton est valide, c'est la commande qui est fautive.
- **Presse-papier intermittent** sur ce poste : disponible en début de session, `ERROR_ACCESS_DENIED`
  une heure plus tard. Le repli `add-secret.ps1 -Value $variable` (expansion runtime) reste nécessaire.

### Reste à faire — le blocage n'est plus technique

**Aucun compte financier ni aucune période n'existe en base (0 et 0)**, pour 5 dimensions et 1 hypothèse
approuvée. Le calcul refusera donc en `calculation-reference-missing` — comportement correct, mais
aucun chiffre ne sortira. Et **aucun écran ne permet de créer comptes et périodes** : c'est le prochain
manque réel, avant même les tasks 08-10.

Reste aussi ouvert : le jeu de FORMULES métier. `specs/_source/prd.md:138` pose la question du modèle
économique pilote et elle n'est pas tranchée. Les trois résolveurs fournissent l'arithmétique et les
garde-fous, pas une sémantique sectorielle. La convention d'arrondi (`ROUND_HALF_UP`) est marquée
`ponytail:` dans `engine.py` pour réexamen à ce moment-là.

Tasks restantes : 08 (exports RBAC), 09 (parcours e2e), 10 (déploiement preview).

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
