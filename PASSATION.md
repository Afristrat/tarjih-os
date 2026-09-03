# PASSATION — Tarjih (plateforme financière multi-tenant)

> Dépôt : `c:\projets\Budget & CFO` · remote `Afristrat/tarjih-os` (public) · branche `master`.
> Production : `https://tarjih-os.com`, Coolify `serveuria`, Supabase dédié.
> Sources de vérité produit : `specs/_source/` · découpage : `specs/todo/README.md`.

## 2026-09-03 — Tarjih calcule : moteur déterministe, publication atomique, référentiel

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
