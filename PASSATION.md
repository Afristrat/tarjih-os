# PASSATION — Tarjih (plateforme financière multi-tenant)

> Dépôt : `c:\projets\Budget & CFO` · remote `Afristrat/tarjih-os` (public) · branche `master`.
> Production : `https://tarjih-os.com`, Coolify `serveuria`, Supabase dédié.
> Sources de vérité produit : `specs/_source/` · découpage : `specs/todo/README.md`.

## 2026-09-16 — ALERTES 1, 5 et 8 FERMÉES ; clé technique supprimée ; l'échec de connexion est situé hors du serveur

```
[ETAT]
  Repo      : `HEAD` == `origin/master` == **`bc34c7b`** (+ extraction `formulaire.ts` + entrée
              documentaire), worktree PROPRE.
  Prod      : `tarjih-web` sur **`bc34c7b`** (`healthy`) · `tarjih-calculation` sur `9abc801`.
  Base prod : **migration `20260916120000 annotate_hypotheses` APPLIQUÉE** (rollback éprouvé en
              transaction annulée avant : colonne 0, registre 0 ; puis `-1`), 12 migrations au
              registre, **174 pgTAP verts contre la production** (13 fichiers, dont `13` 12/12).
  CI        : verte jusqu'à `bc34c7b` (3 jobs ; base vide : 12 migrations, 174 contrôles,
              11 rollbacks, schéma identique à l'octet).
  Gates     : typecheck 0 (tsc + mypy) · lint 0 · **91 Node** (+8) · 43 Python · build OK ·
              **Playwright 38 pas (6 recettes), tous verts contre `https://tarjih-os.com` sur
              `bc34c7b`** (7,5 min), **rejoués 38/38 après l'extraction de `formulaire.ts`** (6,5 min).
  Coffre    : **`TARJIH_ADMIN_TECHNIQUE` SUPPRIMÉE** (double autorisation SOP-001, « oui »
              d'Amine, 337 → 336 clés, sauvegarde `secrets.env.dpapi.bak-20260916-134411`).
  Tasks     : 01→10 ✅. ALERTES 1, 4, 5, 8 fermées. Restent 9 (non ouverte) et 10 (décision).

[FAIT]
  1. **ALERTE 1 fermée (`a33e0c8`)** — et la passation du 15/09 la MINORAIT (« sans conséquence
     mesurée ») : la recette écrite AVANT le correctif, jouée contre la prod sur `dd49056`,
     a montré un montant publié 98 765 432 109 876,543210 affiché **« …876,55 MAD »**
     (rouge prouvé), pour « …876,54 » réels. La perte dépend des décimales, pas du seul
     ordre de grandeur : `numeric(24, 6)` porte jusqu'à 24 chiffres, un double en garde 15-16.
     · `budget_values.amount`, `budget_value_sources.amount` et les quatre montants de
       `compare_version_values` sont demandés en `::text` (`.select("… amount::text")`, et
       `.rpc(...).select("… delta_percent::text")` — PostgREST accepte le cast en `select`
       aussi sur une fonction set-returning ; le client type alors « objet ou tableau »,
       normalisé par `Array.isArray`).
     · `amountFromRow(raw, colonne)` (`lib/budgets/amounts.ts`) LÈVE si un montant n'arrive
       pas en texte : un cast perdu est une erreur de programmation, ni une valeur à afficher
       ni une ligne à ignorer (un total amputé ment autant qu'un total faux).
     · `asValueComparison` rend `null` si un montant est un nombre (forme inconnue).
     · UN `formatAmount` partagé donne la chaîne décimale à `Intl.NumberFormat` (exact, ECMA-402
       v3, Node 22, TS 5.9 : garde `value is \`${number}\``) ; les deux copies locales de
       `page.tsx` et `ecart.tsx` sont supprimées. `formatPercent` : commentaire mis à jour
       (la décimale est complétée par sûreté, plus par nécessité).
     · Tests Node : `amountFromRow` refuse un nombre, `formatAmount` exact au-delà de 2⁵³,
       comparaison à montants numériques rejetée.
     · **Recette `precision-des-montants.spec.ts`** (5 pas) : charge de 20 chiffres
       significatifs saisie, approuvée, publiée ; centimes affichés comparés à ceux qu'un
       double donnerait ; total des charges ; part d'origine jugée EN VALEUR (`lire()` +
       micro-unités) parce que `budget_value_sources.amount` est un `numeric` SANS échelle :
       le moteur rend `…,54321` pour `…,543210` (`c186c6b`).
  2. **Échec de connexion `/login` (11/09, 15/09) : situé hors du serveur, par preuve.**
     Trace du 15/09 lue par script (horodatages et noms d'appels seulement, jamais les
     paramètres) : `goto /login` parti à ~19:59:52Z, `ERR_CONNECTION_CLOSED` après 31 s.
     Croisé avec le serveur : (a) dernier déploiement web `1cca2a8` terminé 19:10:34Z, soit
     **50 min avant** — l'hypothèse « juste après un déploiement » est FAUSSE ; (b) tunnel
     `cloudflared-nahda` : 4 connexions QUIC perdues et ré-enregistrées 19:54:14 → 19:54:23Z,
     puis silence jusqu'à 20:03Z ; (c) Traefik (`--accesslog=true`) : **0 requête Tarjih
     entre 19:57 et 20:00Z**, alors que 12 puis 42 requêtes d'autres hôtes passaient, dont des
     scanners publics (`/etc/passwd`, `/.env`, `xmlrpc.php`) — donc le tunnel et l'origine
     servaient l'Internet à cet instant ; (d) les logins de la recette réapparaissent à 20:01Z.
     Conclusion : la connexion a été fermée entre le poste (réseau 10.143.x, 100-1 400 ms ce
     soir-là) et la bordure Cloudflare ; rien à corriger côté produit ni infra. Même signature
     que le 11/09 (aucun `/token` reçu par GoTrue). Aucune garde ajoutée à la recette : un
     `retries` masquerait une vraie panne.
  3. **ALERTE 5, partie technique, fermée (`c799a1f`) : l'export porte les origines.** Seconde
     feuille « Origines » du classeur (Dimension, Compte, Période, Hypothèse, Part, Devise), une
     ligne par part, jamais arrondie, dont la somme est le montant de la feuille
     « Consolidation ». Les origines sont demandées pour les seuls montants DÉJÀ retenus (le
     périmètre est décidé une fois, les parts en héritent par l'id du montant) ; une origine
     illisible refuse l'export comme un montant illisible ; une clé manquante garde l'id.
     Tests Node (feuille présente, libellés et parts écrits, libellé « =… » reste du texte) ;
     recette `export-rbac` vérifie la feuille sur le service déployé.
  4. **ALERTE 8 fermée (`b21b272`) : le contributeur dit pourquoi.** Migration
     `20260916120000_annotate_hypotheses` : colonne `hypotheses.note` (facultative, 1..2000,
     blanc refusé), recopiée par `open_budget_version` avec la ligne, HORS snapshot d'entrée
     (colonnes nommées) donc `input_hash` inchangé. pgTAP `13` (12 contrôles) : écrite et
     corrigée par l'auteur tant que proposée, figée après décision par la politique existante
     (`hypotheses_update_contributor`, 0 ligne touchée sans erreur), invisible sans `read` sur
     la dimension, recopiée à la reprise, absente reste absente. Rollback restaure l'ancienne
     fonction et supprime la colonne (AVEC son contenu — documenté). Écran : textarea sur la
     proposition et la correction ; « Justification de l'auteur » sur l'écran de décision
     (`.hypothesis-note`, `white-space: pre-line`). Recette `parcours-vertical` : l'auteur
     écrit une note, le DAF la lit avant de décider.
  5. **ALERTE 5, partie produit, fermée (`bc34c7b`) — décision d'Amine : « visible ».**
     Séparation des devoirs rendue visible, pas imposée (un tenant peut n'avoir qu'un membre
     habilité). `lib/budgets/self-decisions.ts` : prédicat pur `selfDecidedHypotheses`
     (3 tests) + `SELF_DECIDED_LABEL` = « Décidée par son auteur ». Badge `state-tag`
     `data-tone="vigilance"` (nouveau ton, CSS + commentaire de `scope.ts` ajusté) sur chaque
     décision de la page de détail où `decided_by = proposed_by`, et sur la ligne de la liste
     de la version (lecture de `proposed_by` + des `hypothesis_decisions` des lignes décidées,
     sous la RLS du lecteur). PRD : cas limite obligatoire ajouté. Recette
     `separation-des-devoirs` (3 pas) : le DAF approuve sa ligne (badge sur la décision et sur
     la liste) puis celle du contributeur (aucun badge).
  6. **Dette déclenchée puis soldée** : le marqueur `ponytail` de `modeles-de-calcul.spec.ts`
     fixait l'extraction de `formulaire()` « au cinquième fichier de recette » ; les recettes 5
     et 6 sont nées aujourd'hui → `e2e/formulaire.ts` partagé, six copies retirées, marqueur
     retiré. Marqueurs `ponytail` restants (2) : `hypothesis-value.ts:180` (multi-périodes,
     plafond et déclencheur toujours valides) et `20260809090100…sql:72` (résolu par
     `20260902120000`, migration immuable).
  7. Résidus soldés : Mnemo `store_memory` (atome `edcf29d2…`, cercle `PASSATION Tarjih`) ;
     brouillon SOP-030 copié hors `%TEMP%` vers
     `C:\Users\amans\OneDrive\Projets\SOP-brouillons\SOP-030-chaine-de-gates-exigee-par-le-systeme.md`
     (id et titre renumérotés) et signalé à la session sop dans `PASSATION-INDEX.md` (L28).
  8. Coffre : `TARJIH_ADMIN_TECHNIQUE` supprimée en deux temps (jeton `62df0dac`), coffre
     réécrit et revalidé par le loader, `secrets.index` régénéré (336), mémoire projet
     `reference-inventaire-cles-tarjih.md` mise à jour. Le compte reste banni en base.

[ALERTE]
  1. ~~`numeric` via PostgREST~~ FERMÉE (cf. [FAIT] 1). L'export (`route.ts`) l'avait déjà.
  2. ~~`TARJIH_ADMIN_TECHNIQUE`~~ SUPPRIMÉE ce jour.
  3. Toujours ouverts, et ce sont des DÉCISIONS, plus des chantiers : **ALERTE 10** (RBAC par
     dimension : un scénario confidentiel exige une dimension dédiée — Amine n'a pas répondu à
     ce point le 16/09, il reste à trancher avant tout client réel) ; 9 (scénarios parallèles :
     non ouverte, aucun tenant ne l'a mesuré, anti-pattern « avant nécessité prouvée »).
  4. Bruit vu en passant dans `coolify-proxy` : ACME 429 en boucle pour `nizam-os.com`,
     `api.nizam-os.com`, `nahj.ma`, `coolify.ai-mpower.com` (15/09 19:57Z) — hors périmètre
     Tarjih, non traité ici ; à signaler à la session infra si pas déjà connu.
  5. Le broker rend exit 1 après un passage Playwright pourtant « 5 passed » (pipeline
     `Select-String`) : lire la ligne de bilan, pas le code de sortie du broker.

[NEXT]
  1. **ALERTE 10, un mot d'Amine** : « dimension dédiée suffit » → alerte close, documentée dans
     `specs/_source/archi.md` (matrice RBAC) ; sinon cadrage d'un RBAC par scénario (chantier
     de plusieurs sessions, à ne pas ouvrir sans ce mot).
  2. Rien d'autre d'entamé. Prochain chantier technique seulement sur besoin mesuré (ALERTE 9),
     ou sur les vrais chiffres d'Afrique Stratégie (version SUIVANTE du tenant réel, jamais une
     correction).

[CTX]
  Session `018JVMAt…` (reprise après /clear, id local `77964096`), 2026-09-16. Commits :
  `a33e0c8` (ALERTE 1), `c186c6b`, `9bab5d6` (recette), `be9d146` (doc), `c799a1f` (export
  origines), `b21b272` (ALERTE 8), `44f14b4` (doc), `bc34c7b` (ALERTE 5 visible), puis
  l'extraction `formulaire.ts` et cette entrée. Fichiers neufs :
  `apps/web/e2e/precision-des-montants.spec.ts`, `apps/web/e2e/separation-des-devoirs.spec.ts`,
  `apps/web/e2e/formulaire.ts`, `apps/web/src/lib/budgets/self-decisions.ts` (+ test),
  `supabase/migrations/20260916120000_annotate_hypotheses.sql` (+ rollback + `tests/13_…`).
  Appliquer une migration en prod : `cat migration.sql | ssh … 'docker exec -i
  supabase-db-f10v8td71bwii32blb9lalfk psql -U postgres -d postgres --set=client_encoding=UTF8
  -1 -v ON_ERROR_STOP=1 -q -f -'` ; épreuve avant : `begin; <migration> <rollback> rollback;`. Versions de recette du jour (tenant e2e) :
  cycles « Précision <horodatage> », comptes `PRC<horodatage>`, périodes en 2031.
  Coolify : `application_deployment_queues q join applications a on a.id::text =
  q.application_id`, horodatages UTC. Traefik : `docker logs coolify-proxy --since … --until …`,
  routeur `http-0-l3fov9fbnjvrgt5ly75b7g5r@docker`, pas d'en-tête Host dans la ligne.
  Tunnel : `journalctl -u cloudflared-nahda` (service hôte, pas un conteneur).
  Reste inchangé : entrée du 2026-09-15/16, [CTX] ; entrée du 2026-09-14, [CTX].

[MEMO]
  1. **Une alerte « sans conséquence mesurée » n'a pas été mesurée.** Écrire la recette qui
     l'exhibe AVANT de coder : ici elle a rougi en production du premier coup.
  2. **La perte de précision d'un double se cache derrière l'arrondi d'affichage** ; il faut
     un montant dont les CENTIMES diffèrent pour qu'un contrôle prouve quelque chose.
  3. **Juger une valeur, pas sa graphie** : un `numeric` sans échelle rend `…,54321` pour
     `…,543210`.
  4. **Un `Write` puis un heredoc bash avalent `\u00A0`** : les échappements s'écrivent par
     `chr(92)`, et se vérifient à l'octet (`od -c`), pas à l'œil.
  5. **Exonérer un serveur se prouve par le trafic des AUTRES** : si des scanners passaient
     par le même tunnel à la seconde de l'échec, l'origine n'était pas la cause.
  6. **Un marqueur `ponytail` avec déclencheur est une dette à échéance** : le déclencheur
     (« cinquième fichier ») s'est produit sous ma main ; le vérifier à chaque fichier neuf,
     pas au `/ponytail-debt` suivant.
```

---

## 2026-09-15/16 — ALERTE 4 FERMÉE et prouvée dans un navigateur : comparer deux versions, approuver l'identique d'un geste

```
[ETAT]
  Repo      : `HEAD` == `origin/master` == **`dd49056`** (+ entrée documentaire), worktree PROPRE.
  Prod      : `tarjih-web` sur **`dd49056`** (`healthy`) · `tarjih-calculation` sur `9abc801`.
  Base prod : **migration `20260915090000 compare_two_versions` APPLIQUÉE** (rollback éprouvé en
              transaction annulée avant, `-1`), 11 migrations au registre, **162 pgTAP verts contre
              la production** (12 fichiers, dont `12_compare_two_versions` 22/22).
  CI        : verte (base vide : 11 migrations, 162 contrôles, 10 rollbacks, schéma identique à
              l'octet) ; à confirmer sur `dd49056` (`gh run list --limit 1`).
  Gates     : typecheck 0 · lint 0 (+ règle `no-use-before-define` activée) · **83 Node** · 43 Python
              · build OK · **Playwright 30/30 contre `https://tarjih-os.com` sur `dd49056`**
              (4 recettes, 4,6 min).
  Tasks     : 01→10 ✅. **ALERTE 4 fermée.**

[FAIT]
  1. **Migration `20260915090000_compare_two_versions` (`5feca66`)** — trois fonctions :
     · `compare_version_hypotheses(base, cible)` `security invoker` : jointure `(dimension_id,
       parameter_key)`, `identical` (value ET unit égaux) / `changed` / `added` / `removed` ;
       côté publié = approuvées seules, côté non publié = non rejetées. Conséquence assumée et
       testée : une ligne proposée-jamais-décidée en v1 publiée, reprise en v2, est « ajoutée ».
     · `compare_version_values(base, cible)` `security invoker` : jointure `(dimension, compte,
       période)`, `delta` et `delta_percent` en `numeric` exact (round 1 décimale), refuse
       (55000) si l'une n'est pas publiée. 1 440 000 → 1 040 000 = −27,8 %.
     · `approve_identical_hypotheses(base, cible, motif)` `security definer` : pour chaque ligne
       identique à une ligne APPROUVÉE de la base, encore proposée, sur une dimension où
       l'appelant a `approve` → `decide_hypothesis` (une décision par ligne, motif, transaction
       unique). Refuse cible publiée (55000), motif vide (22023), tenant étranger (P0002).
       Rend le nombre approuvé (contributeur : 0, aucune décision écrite).
     pgTAP `12` : 22 contrôles (anonyme, tiers, inter-tenant, périmètre du contributeur borné par
     RLS, comparaison complète DAF, v1/v2 publiées, auto-comparaison vide, montants exacts, geste
     = 2 lignes, statuts/révisions/décisions nominatives, rejeu = 0, base intacte). Rollback
     `.down.sql`. Chaîne du schéma verte en base jetable dès le 2e passage.
  2. **Écran (`5feca66` + correctifs)** — `/app/consolidation/[id]?with=<uuid>` : section « Écart »
     (`ecart.tsx`, helpers purs dans `lib/budgets/comparison.ts` testés Node), base = `?with=`
     sinon `parent_version_id` ; **sans filiation ni `?with=`, seul le sélecteur s'affiche** (le
     repli « précédente par numéro » mettait face à face deux modèles de calcul : retiré,
     `34a190a`). Sélecteur GET sur les versions du cycle ; `input_hash` égaux annoncés ; niveau 1
     avec les TERMES (`320 × 4500`, `0.05 × compte`) + statuts des deux côtés + synthèse « N
     identiques · M modifiées… » ; formulaire du geste (motif pré-rempli, « Approuver la/les N
     ligne(s) identique(s) ») si cible non publiée et ≥ 1 approuvable ; niveau 2 si les deux
     publiées : tableau + Total produits / Total charges / Résultat des deux côtés, delta et
     variation (`percentChange`, bigint, testé : −27,8 %). Notices `identical-approved`,
     `identical-none`, `identical-failed`, `compare-unknown`. Action `approveIdentical`.
  3. **Trois défauts trouvés par la recette navigateur, tous corrigés à la racine :**
     · `1cca2a8` — ERREUR SERVEUR sur toute version ayant une sœur : le tri de la comparaison
       lisait `dimensionNames`/`accountCodes`/`periodStarts` AVANT leur `const` (zone morte
       temporelle dans une closure, invisible au typecheck). Bloc déplacé après les index ;
       **règle ESLint `@typescript-eslint/no-use-before-define` (variables) activée** — rouge
       prouvé sur le défaut, verte après.
     · `34a190a` — le test « rien n'est publié malgré le refus » cherchait le code du compte dans
       TOUTE ligne de la page et le trouvait dans les termes d'une hypothèse de la section Écart :
       test recentré sur la table des montants + état vide ; et repli par numéro retiré (cf. 2).
     · `929adbd` — **le formulaire du geste était `display: none`** : `.console-panel > form
       { display:none }` (règle pour les formulaires porteurs des grilles de droits) masquait
       tout formulaire enfant d'un panneau. Présent dans le HTML servi, invisible dans le DOM,
       introuvable par Playwright (`box: null`). Règle restreinte à `form[id^="grant-"]`.
       Diagnostiqué par une sonde Playwright jetable (supprimée) : `isVisible()` + `getComputedStyle`.
     · `dd49056` — `montantPublie()` cherchait « la ligne du compte » sur toute la page (l'Écart
       la cite deux fois) : recentré sur `.data-table:not(.ecart-table)` ; et la variation
       arrivait « 20 % » au lieu de « 20,0 % » : **PostgREST sérialise `numeric` en nombre
       JSON** (`20.0` → `20`), `formatPercent` garantit la décimale lui-même.
       Passages : 28/30 → 29/30 (geste vert) → **30/30**.
  4. Recette `modeles-de-calcul` étendue : pas « le DAF lit l'écart avec la version 1 et approuve
     d'un geste » (synthèse « 1 identique · 1 modifiée », termes des deux taux, geste → ligne
     approuvée dans CETTE version, modifiée toujours proposée, bouton disparu) ; pas final : niveau
     2 après publication (+20,0 % sur la charge, 0,0 % sur le produit, résultat −1,1 %).
  5. Réseau du poste dégradé toute la session (IP 10.143.x, 100–1 400 ms vers le LAN, SSH qui
     expire par intermittence) : un passage entier de recette est tombé en `ERR_CONNECTION_CLOSED`
     sur `/login` (4 workers, juste après un déploiement) — même signature que l'échec inexpliqué
     du 11/09 ; trace conservée `%TEMP%\trace-login-closed-2026-09-15.zip`. Serveur, stack
     Supabase et tunnel étaient sains (`lawh.ma` 200 au même instant). Non conclu (SOP-007).

[ALERTE]
  1. **`numeric` traverse PostgREST en nombre JSON** : tout `String(row.amount)` du web repose
     sur la précision double (~9·10¹⁵) — vrai depuis l'origine pour `budget_values.amount`, pas
     seulement pour la variation. Sans conséquence mesurée aujourd'hui (montants < 10¹²) ; à
     traiter si un montant dépasse 15 chiffres significatifs (cast `::text` côté SQL).
  2. Frottement « approuver l'identique » : FERMÉ par le geste (ALERTE 2 close intégralement).
  3. `TARJIH_ADMIN_TECHNIQUE` toujours au coffre (clé d'un compte banni) — attend un « oui ».
  4. **SOP-029 est prise** (délégation inversée, brouillon, session sop) : le brouillon de la
     session Tarjih « chaîne de gates exigée par le système » (scratchpad
     `…\d2ee79d5-…\scratchpad\SOP-029-chaine-de-gates-exigee-par-le-systeme.md`) doit être
     importé sous **SOP-030** par la session sop. ÉPHÉMÈRE tant que non importé.
  5. Toujours ouverts : ALERTE 5 (auto-approbation, export sans origines), 8 (annotation
     contributeur), 9 (scénarios parallèles), 10 (RBAC par dimension) ; échec de connexion
     11/09 + 15/09 (deux occurrences, non reproduites à la main).
  6. `MEMORY.md` du projet a perdu la ligne d'index de `feedback-gates-configurees-pas-lancees.md`
     (fichier toujours présent) — à réindexer.

[NEXT]
  1. `store_memory` Mnemo (cercle `PASSATION Tarjih`) — non fait cette session (serveur MCP
     en délai d'attente au démarrage).
  2. ALERTE 5 (proposition du 13/09 : rendre visible « décidée par son auteur »
     plutôt qu'interdire — tenant réel à UN membre), puis 8/9/10 sur besoin mesuré.

[CTX]
  Session `018JVMAt…`, 2026-09-15/16. Commits : `5feca66` (ALERTE 4), `1cca2a8`, `34a190a`,
  `929adbd`, `dd49056`. Fichiers neufs : `supabase/migrations/20260915090000_compare_two_versions.sql` (+
  rollback + `tests/12_…`), `apps/web/src/app/app/consolidation/[versionId]/ecart.tsx`,
  `apps/web/src/lib/budgets/comparison.ts`, `apps/web/tests/ecart.test.ts`.
  Versions de recette du jour (tenant e2e, cycle « Modèles 1789506516208 ») : v1 driver publiée
  `a3c9a08a…`, v4 reprise brouillon `01b28ef0…` (2 lignes proposées, rien décidé).
  Vérifier la migration en prod : `select version from supabase_migrations.schema_migrations
  order by 1 desc limit 1` → `20260915090000`.
  Lire une trace Playwright sans interface : `unzip trace.zip`, `0-trace.trace` (JSON par ligne,
  `type: before/after/log`, `callId`), `resources/*.html` = instantanés DOM.
  Reste inchangé : entrée du 2026-09-14, [CTX] ; entrée du 2026-09-06, [CTX].

[MEMO]
  1. **Le HTML servi n'est pas l'écran.** Un élément peut être dans la réponse et absent du
     rendu (`display:none` hérité d'une règle trop large) : quand un locateur ne trouve pas ce
     que le HTML montre, mesurer `isVisible()` et `getComputedStyle` avant d'accuser le locateur.
  2. **Un sélecteur CSS par position (`.panel > form`) encode une intention par accident** ;
     la règle doit nommer ce qu'elle vise (`form[id^="grant-"]`).
  3. **La zone morte temporelle passe le typecheck** : une `const` lue dans une closure avant sa
     ligne casse à l'exécution, seulement quand la branche s'exécute. `no-use-before-define`
     (variables) la voit ; elle est désormais exigée.
  4. **Un test qui cherche « aucune ligne avec X » sur toute la page casse dès qu'un autre
     tableau cite X légitimement** : cibler la table qui porte l'invariant.
  5. **Pas de repli deviné** : sans filiation, ne pas choisir « la précédente » à la place de
     l'utilisateur — deux modèles de calcul face à face sans le dire, c'est un mensonge d'écran.
```

---

## 2026-09-14 — Chaque gate est exigée, plus seulement lancée : CI, ruff/mypy configurés, chaîne du schéma rejouée sur une base vide

```
[ETAT]
  Repo      : `HEAD` == `origin/master` == **`9abc801`** (+ entrée documentaire), worktree PROPRE.
  Prod      : `tarjih-web` sur `70066ac` (aucun changement du web depuis) ·
              **`tarjih-calculation` sur `9abc801`**, `healthy` (source reformatée et
              `pyproject.toml` modifié : le build de l'image prouve que `.[api]` s'installe
              encore ; recette `modeles-de-calcul` rejouée après : 12/12, mêmes chiffres).
  CI        : **`.github/workflows/ci.yml` — trois jobs VERTS** sur `master`
              (`gh run view 34807594070`) : web 35 s · calculation 23 s · database 1 min 22.
              Aucune annotation (actions sur leurs majeures v7).
  Gates     : `npm run lint` / `typecheck` / `test` / `build` couvrent désormais LES DEUX
              piles : typecheck 0 (tsc + mypy --strict, 16 fichiers Python) · lint 0 (eslint +
              ruff check + ruff format --check) · 78 Node · 43 Python · artefacts de prompts ·
              build OK · **140 pgTAP joués = 140 planifiés sur une base VIDE** (CI, image
              `supabase/postgres:15.8.1.085` = prod ; et base jetable du cluster réel) ·
              29 Playwright verts contre la prod (4,2 min, rejoués ce jour AVANT le chantier).
  Registre  : 10 migrations, inchangé. Tenant réel : inchangé (DG admin, seul membre).
  Tasks     : **01→10 ✅ — le découpage est terminé.** La 10 a été recadrée (`9ee47c2`) sur la
              cible réelle (Coolify, pas Vercel/Railway) puis close : CI, synthétique seulement
              hors production, secrets hors dépôt, sondes de santé documentées et vérifiées.

[FAIT]
  1. **Audit « rien laissé derrière ? » rejoué par système, pas par mémoire** : tout vert, MAIS
     deux résidus : `.playwright-mcp/` (17 fichiers du 28/08, 5 instantanés portant l'ANCIEN
     mot de passe d'`admin.technique` en clair — valeur morte : rotée le 28/08, compte banni)
     → supprimé ; registre de fuites ligne 92 encore « consigné » alors qu'Amine avait tranché
     (pas de re-rotation) → ligne de clôture posée. Puis Amine : « mypy/ruff configurés nulle
     part, c'est une grosse dette en soi, idem la chaîne des gates » — exact, et j'avais
     minoré. Chantier ouvert et fermé dans la session, AVANT ALERTE 4.
  2. **Gates déclarées (`33824b8`)** : `ruff.toml` à la racine (tout le Python : moteur, tests,
     `scripts/`, LF forcé), `[tool.mypy] strict` + `files = src, tests, ../../scripts`,
     `mypy_path`, extras `dev` épinglés (httpx, jsonschema, mypy, ruff, types-jsonschema).
     6 fichiers reformatés, un `isinstance` fusionné, `scripts/validate_prompt_artifacts.py`
     typé (jsonschema OBLIGATOIRE : l'ancien `try/except ImportError` rendait la validation
     des schémas dépendante de l'état du poste). Scripts npm racine enchaînant les deux piles ;
     dépendance morte `supabase` (CLI jamais utilisée) retirée, `node_modules` racine purgé.
     Prérequis documenté : `pip install -e "services/calculation[api,dev]"`.
  3. **`scripts/db-gates.sh` — la chaîne du schéma rejouée sur une base VIDE, première fois
     depuis la création du projet** : socle minimal → 10 migrations chacune dans SA
     transaction → registre exact → 140 pgTAP jusqu'à leur plan → seed (mots de passe
     factices) → 9 retours arrière en ordre inverse → `pg_dump --schema-only` IDENTIQUE À
     L'OCTET à l'état d'après la première migration, registre à 1 ligne. Ce rejeu a révélé
     ce que le socle devait porter pour être fidèle à la plateforme (relevé en prod, pas
     supposé) : `search_path` de la base, `usage` sur `extensions` pour `authenticated`,
     **privilèges par défaut de `postgres` pour anon/authenticated/service_role** (sans eux
     le rollback de `20260906140000` n'est pas un inverse exact et `03_schema_invariants` ne
     surveille rien), `auth.identities` (forme relevée), `auth.users` pré-GoTrue de l'image
     complétée colonne par colonne, propriétaire `supabase_auth_admin` quand l'exécutant peut.
     `scripts/db-gates-cluster.sh` (`npm run test:db`) le joue dans une base JETABLE du
     cluster réel par SSH (`TARJIH_SSH`), supprimée quoi qu'il arrive : 55 s, prouvé 8 fois,
     0 base résiduelle, mémoire 30 → 58 Mio (cache).
  4. **CI** : trois jobs, versions de la prod (Node 22, Python 3.13, image db exacte, env du
     service `db` du Compose Supabase avec valeurs factices). Deux itérations rouges avant le
     vert, toutes deux sur le socle (l'image n'a pas `postgres` superutilisateur ; `auth.users`
     y existe dans sa forme d'origine) — chaque fois re-prouvé dans le cluster avant de pousser.
  5. **Moteur redéployé sur `9abc801`** (`deploy?uuid=tuxybsaq9adb6txew2rc6zkr`, ~3 min) :
     image taguée du sha, `healthy`, puis `e2e/modeles-de-calcul.spec.ts` 12/12 en 2,2 min
     contre la prod — 1 440 000 / 72 000 / 86 400 inchangés. Le web n'a pas bougé (`70066ac`).
  6. **Sources de vérité alignées (`9ee47c2`)**, sur demande d'Amine (« le DG est admin ou
     pas ? il faut s'aligner ; je n'ai ni Vercel ni Railway, pourquoi ça traîne ? ») :
     `CLAUDE.md`, `specs/_source/stack.md` et `archi.md` ne citent plus Vercel/Railway que
     comme cadrage jamais mis en service ; « Environnements » = poste / CI / production
     (pas de preview : la CI et les tenants de recette en tiennent lieu) ; la matrice dit
     désormais que l'administration est un drapeau orthogonal au rôle et que **le DG du
     tenant réel administre** (relevé en base : `is_tenant_admin = t`). Task 10 close.
  7. Docs à l'état réel : `docs/deployment-tarjih.md` (section « Gates » neuve ; table
     « Comptes » relevée en base ce jour — l'ancienne disait `admin.technique` actif et le DG
     non admin), `services/calculation/README.md`, `CLAUDE.md` (commandes), task 10.

[ENCOURS]
  Rien.

[ALERTE]
  1. Inchangées : geste « approuver l'identique » (à construire avec ALERTE 4 — la mesure
     existe : 10 lignes sur 16 identiques le 08/09 sur le tenant réel), reprise par défaut,
     ALERTE 4 (cadrage commité `1f3503b`), 5, 8, 9, 10, échec de connexion du 11/09.
  2. `TARJIH_ADMIN_TECHNIQUE` toujours au coffre : Amine a demandé « supprimer quoi ? » —
     réponse donnée (la clé seule, le compte reste banni en base pour la provenance) ; PAS de
     « oui » reçu → non supprimée (SOP-001 §8quater, double autorisation).
  3. `mypy` met ~3 min sur le poste (disque saturé, signalement L41) contre 23 s en CI :
     `npm run typecheck` local est lent, pas cassé.
  4. Les recettes Playwright restent HORS CI (comptes du coffre, prod, télescopage sur les
     tenants de recette) : elles se jouent depuis le poste avant chaque déploiement.

[NEXT]
  1. **ALERTE 4 — comparer deux versions**, niveau 1 puis 2, geste « approuver l'identique »
     inclus (cadrage inchangé : entrée du 2026-09-13, [NEXT] 1). Avec pgTAP `12_…` : la CI
     le jouera sur base vide dès le push.
  2. **SOP-029 proposée** (brouillon L99 complet, extraction du chantier) : écrite dans le
     scratchpad de la session — PAS dans `C:\projets\sop`, dont le worktree était sale (5
     fichiers modifiés par sa session propriétaire ; règle n°6, SOP-019). **ÉPHÉMÈRE** tant
     que la session sop ne l'a pas importée : chemin donné dans la réponse du 2026-09-14.

[CTX]
  Session `018JVMAt…` (suite de `532a0472`), 2026-09-13/14. Commits : `33824b8` (gates + CI),
  deux correctifs du socle, actions v7, puis cette entrée. Nouveaux fichiers : `ruff.toml`,
  `.github/workflows/ci.yml`, `scripts/db-gates.sh`, `scripts/db-gates-cluster.sh`.
  Suivre la CI : `gh run list --limit 1` puis `gh run watch <id> --exit-status`.
  Base jetable à la main (si le script ne convient pas) : `create database x` dans
  `supabase-db-f10v8td71bwii32blb9lalfk`, socle en `-U postgres` (superutilisateur de SA base),
  `drop database x` ensuite — vérifier `select datname from pg_database where datname like 'tarjih%'`.
  Le broker coupe à 300 s : Playwright exige `-TimeoutSec 570`.
  Reste inchangé : entrée du 2026-09-06, [CTX].

[MEMO]
  1. **Une gate qui passe parce que je l'ai lancée n'est pas une gate.** Configuration
     versionnée + commande unique + CI, sinon c'est de la dette de premier rang (mémoire
     `feedback-gates-configurees-pas-lancees`).
  2. **Rejouer la chaîne depuis zéro trouve ce que la prod cache** : trois hypothèses
     implicites sur le socle (search_path, usage, privilèges par défaut) n'étaient vraies que
     parce que la plateforme les avait posées avant nous. Un test qui ne tourne que sur la
     base où il a été écrit ne teste pas ses propres prérequis.
  3. **Un `grep -rn … .` à la racine traverse `node_modules`** et dépasse le délai : toujours
     nommer les dossiers. Et `bash -n` sur un fichier UTF-8 : une apostrophe dans
     `${VAR:?message}` casse le parseur.
  4. **La valeur morte d'un secret reste un résidu** : la supprimer du poste, et ne pas la
     réimprimer en l'inspectant (mon `sed` de masquage supposait une quote finale absente).
```

---

## 2026-09-13 (suite) — ALERTE 2 fermée : une version suivante reprend la précédente ; le DG administre son tenant

```
[ETAT]
  Repo      : `HEAD` == `origin/master` == **`70066ac`** (+ entrée documentaire), worktree PROPRE.
  Prod      : `tarjih-web` sur **`70066ac`** (conteneur `l3fov9fbnjvrgt5ly75b7g5r-173744624417`,
              `healthy`) · `tarjih-calculation` sur `6b398e0` (inchangé).
  Gates     : typecheck 0 · lint 0 · **78 tests Node** · 43 Python · **140 pgTAP sur 10 fichiers**
              contre la production en begin/rollback · **29 tests Playwright** verts contre
              `https://tarjih-os.com` (4 recettes, 4,1 min).
  Registre  : 10 migrations, la dernière `20260913150000 open_a_version_from_the_previous_one`
              (rollback ÉPROUVÉ en transaction annulée avant application).
  Tenant réel: « Afrique Stratégie » `701819bb…` — UN membre, `a.mansouri@…`, `dg`,
              **`is_tenant_admin = true`** (décision d'Amine). `admin.technique` retiré et banni.
  Tasks     : 01→09 ✅ · 10 ⬜.

[FAIT]
  1. **Décisions d'Amine appliquées** : pas de re-rotation de `TARJIH_E2E_PW_DAF` ; le DG réel est
     administrateur de son tenant (« un DG peut et sera sûrement l'admin réel d'une
     organisation »). Aucun invariant de schéma ne s'y opposait : `is_tenant_admin` est un
     drapeau orthogonal au rôle (le `04` prouve que le pouvoir financier n'EMPORTE pas
     l'administration, pas qu'il l'exclut). `admin.technique` — 0 hypothèse, 0 décision,
     0 grant, 0 export — retiré du tenant puis banni. Prouvé dans un navigateur réel :
     badge « DG · Administration », écran « Dimensions et droits » atteint.
  2. **ALERTE 2 fermée (`70066ac`)** — `public.open_budget_version(cycle, modèle, source)`,
     `security definer`, atomique : version suivante + copies des hypothèses non rejetées de la
     source, **en `proposed` à la révision 1, au nom de leurs auteurs d'origine**, même modèle
     obligatoire, `parent_version_id` écrit. La source n'est pas touchée d'un octet.
     `createBudgetVersion` ne fait plus qu'appeler la fonction. L'écran n'a plus qu'UN sélecteur
     (« Reprendre la version N — modèle · état » / « Version vide — modèle »), reprise de la
     dernière version par défaut ; la liste dit « reprise de la version N ».
     **`parent_version_id` n'avait JAMAIS été écrit** (0 sur 32 versions) — et
     `budget_version_states.is_superseded` en dérivait depuis le 02/09 : troisième colonne
     morte du même type. Elle vit désormais : une version reprise rend sa source « remplacée ».
  3. **Défaut adjacent corrigé** : la fiche d'un taux (`percent_of`) n'offrait qu'un champ
     « Montant », et `rebuiltValue` reconstruisait la correction en `direct` dans une version
     `driver` — le moteur l'aurait refusée à la publication, hypothèses des autres comprises.
     Reconstruction extraite en fonction pure `rebuildValue` (garde compte, période, inducteur
     ET base), champ « Taux » sur la fiche (correction et décision), `baseAccountCode` ajouté
     aux faits et au corpus partagé `schemas/hypothesis-value.cases.json` (test pont vert des
     deux côtés).
  4. **Preuves** : 20 contrôles pgTAP (`11_open_version_from_previous`) — droits (contributeur
     42501, tenant étranger P0002), cycle étranger, modèle divergent, copie exacte, source
     intacte, l'auteur corrige sa ligne reprise, le DAF la décide, version vide, reprise d'un
     brouillon, anonyme sans droit. Recette navigateur : v2 ouverte depuis la v1 `driver`
     publiée → deux lignes « Proposée » → taux corrigé 0,05 → 0,06 → publication
     **1 440 000 / 86 400**. Le taux corrigé est resté un taux.

[ALERTE]
  1. **Le prochain frottement est connu et NON traité** : les copies reviennent en `proposed`,
     donc une version de 300 lignes reprise coûte 300 approbations une à une, même pour les
     lignes identiques. C'est voulu (une approbation est une décision dans SA version — `05`
     contrôle 14, `07` trace) mais le geste « approuver tout ce qui est identique à la source »
     n'existe pas. À construire SEULEMENT quand un tenant réel le mesure ; l'infrastructure est
     prête (`parent_version_id` + comparaison valeur à valeur).
  2. La reprise est proposée **par défaut** dès qu'une version existe dans le cycle. Sur le
     tenant réel, « Ouvrir une version » sans regarder le sélecteur reprend donc la dernière
     version — c'est l'usage attendu après publication, mais c'est un changement de défaut.
  3. `TARJIH_ADMIN_TECHNIQUE` est au coffre sans plus aucun objet (compte banni) : candidate à
     la suppression, SOP-001 §8quater (double autorisation) — non faite, à la main d'Amine.
  4. Toujours ouverts : ALERTE 4 (aucun comparatif de versions — la filiation écrite le rend
     désormais possible), 5 (séparation des devoirs, export sans origines), 8 (annotation
     contributeur), 9 (scénarios parallèles), 10 (RBAC par dimension) ; échec de connexion du
     11/09 sans cause (instrumenté, non reproduit en 4 passages).

[NEXT]
  1. **ALERTE 4 — comparer deux versions** (cadrage posé le 2026-09-13, réponse à « comment
     comparer ? » — validé par Amine : aucune objection reçue, à confirmer avant de coder) :
     · NIVEAU 1, hypothèses : jointure sur `(dimension_id, parameter_key)` (unicité garantie
       par contrainte) → identique / modifiée (afficher les TERMES : volume × prix, taux,
       montant — jamais un produit) / ajoutée / retirée-ou-rejetée. Approuvées des deux côtés si
       B publiée ; proposées incluses si B brouillon.
     · NIVEAU 2, montants publiés : jointure `(dimension, compte, période)`, delta et %, puis
       Total produits / Total charges / Résultat avec variation — arithmétique `bigint` de
       `amounts.ts`, jamais `Number` (piège mesuré le 08/09 : −8,7 % affiché pour −27,8 % réel).
       Seulement si les DEUX sont publiées.
     · Deux fonctions SQL set-returning `security invoker` sur les tables sous RLS (le
       périmètre d'un contributeur s'applique tout seul), pgTAP `12_…`. Écran
       `/app/consolidation/[id]?with=<uuid>`, `with = parent_version_id` par défaut.
     · Signal gratuit : `input_hash` égaux ⇒ entrées identiques, comparaison vide, le dire.
     · Ordre : NIVEAU 1 D'ABORD — il porte la clé du geste « approuver l'identique »
       (`decide_hypothesis` ligne à ligne en transaction, motif daté ; une décision par ligne,
       la trace `07` tient). Le niveau 2 seul redonnerait un chiffre sans explication.
  2. Task 10 (déploiement preview).

[CTX]
  Session `532a0472` (suite), 2026-09-13. Commits : `70066ac` (reprise + taux) + doc.
  Migration : appliquée en prod avec `-1` APRÈS épreuve du rollback ; les DIX pgTAP rejoués.
  Déploiement : `deploy?uuid=l3fov9fbnjvrgt5ly75b7g5r` ; ~5 min jusqu'au conteneur `healthy`
  sur le sha. La recette `ouvrirVersion(page, origine)` prend `empty:<modèle>` ou
  `resume:<uuid>` (`versionOriginValue`). Reste inchangé : entrée du 2026-09-06, [CTX].

[MEMO]
  1. **Une colonne prévue « pour plus tard » et jamais écrite, c'est la troisième cette
     semaine** (`calculation_model`, registre, `parent_version_id`). La requête « quelles
     colonnes n'ont qu'une valeur distincte en production ? » vaut un audit.
  2. **Reprendre ≠ hériter.** Copier une approbation aurait supprimé la ressaisie ET la
     décision ; le produit ne vend que la première.
  3. **Un défaut adjacent trouvé en lisant le fichier qu'on touche se corrige avec le chantier**
     (règle n°3) — et la recette qui joue le chantier doit passer PAR ce défaut, sinon la
     correction n'est qu'une croyance.
```

---

## 2026-09-12/13 — Rien d'entamé ne reste ouvert : ALERTE 7 fermée, `cost_center` joué dans un navigateur, coffre soldé

```
[ETAT]
  Repo      : `HEAD` == `origin/master` == **`ae6bda7`**, worktree PROPRE (vérifié).
  Prod      : `tarjih-web` sur **`fa38a46`** (conteneur `l3fov9fbnjvrgt5ly75b7g5r-…`, `healthy`,
              démarré le 2026-09-08) · `tarjih-calculation` sur `6b398e0`. Rien à redéployer :
              les commits de la session sont SQL (déjà appliqué), tests et recette.
  Gates     : typecheck 0 · lint 0 · **76 tests Node** (74 + 2) · **120 pgTAP** sur 9 fichiers,
              joués contre la PRODUCTION en begin/rollback, 0 échec · **26 tests Playwright**
              verts contre `https://tarjih-os.com` (4 recettes, 4,1 min).
  Registre  : 9 migrations, la dernière `20260910120000 check_the_decision_tenant`.
  Tasks     : 01→09 ✅ · 10 ⬜.

[FAIT]
  1. **La passation du 08/09 ne disait pas tout : deux chantiers avaient été entamés APRÈS elle**
     (10/09 et 11/09), jamais commités, jamais consignés. Les deux sont fermés.
  2. **ALERTE 7 fermée (`75b55f4`)** — les deux policies de `hypothesis_decisions` qualifient
     enfin les deux côtés du rapprochement. La migration était DÉJÀ en production (posée le
     10/09) mais **sans son inscription au registre** : la ligne `schema_migrations` avait été
     écrite à la main. Le fichier s'inscrit désormais lui-même, le rollback se désinscrit, et un
     test Node (`tests/migrations-registry.test.ts`) lit le dossier `supabase/migrations` pour
     exiger que chaque migration depuis `20260809090100` porte son insert et chaque rollback son
     delete — la convention ne repose plus sur la discipline du rédacteur (SOP-017). Rouge prouvé
     sur le fichier tel qu'il était, vert après. 3 contrôles pgTAP ajoutés au `05` (24).
  3. **NEXT 3 fermé (`ae6bda7`)** — `e2e/modeles-de-calcul.spec.ts`, 9 étapes en série :
     `driver` publie **1 440 000** (320 × 4 500) et **72 000** (5 % d'une base que le moteur
     venait de calculer) sans qu'aucun montant soit saisi ; un taux hors bornes est refusé à la
     saisie ; **`cost_center` a tourné dans un navigateur pour la PREMIÈRE fois** : refus du
     compte de produit à la publication, version restée brouillon, rien de publié, puis
     publication d'une charge à 2 500,00.
  4. **Renormalisation LF (`288a263`)** : le `.gitattributes` de `87b0674` n'avait jamais été
     suivi d'un `git add --renormalize` — 34 fichiers restaient en CRLF dans l'index et toute
     édition produisait un diff de la taille du fichier. Commit dédié, `--ignore-cr-at-eol` vide.
  5. **Coffre soldé** : `TARJIH_E2E_PW_DAF` rotée (48 car. générés localement, empreinte
     `crypt/bf` posée dans une transaction auto-vérifiée, coffre via `add-secret -Value`
     in-process, connexion navigateur prouvée par la recette). `recette-contrib-05` et
     `recette-daf-05` **bannis** (`banned_until = infinity`) : plus membres d'aucun tenant depuis
     le 28/08 mais auteurs d'une hypothèse et d'une décision dans la version brouillon
     `aa2977d8…` du tenant réel — une décision ne s'efface pas, donc les comptes restent en
     base, fermés.

[ALERTE]
  1. **L'échec de connexion du 11/09 n'a PAS de cause établie.** Faits : URL `/login` NUE
     (chaque chemin d'échec de `login/actions.ts` ajoute `?error=`), alerte vide, **aucune
     requête `/token` reçue par GoTrue** ce jour-là hors la connexion scriptée de 20h44. Le seul
     état compatible : le POST n'est jamais parti ou jamais revenu (réseau/tunnel). Hypothèse
     « clic avant hydratation » RÉFUTÉE : le HTML servi porte `action=""` + `$ACTION_ID`, le POST
     natif s'exécute quand même. Non reproduit en trois passages. `connecter` dit désormais à
     l'échec si le POST a reçu une réponse et laquelle. **J'ai supprimé `test-results/` avant
     d'ouvrir le `trace.zip` du 11/09** (trace `retain-on-failure` active) : preuve perdue par ma
     faute. À la prochaine occurrence : ouvrir la trace AVANT tout nettoyage.
  2. **Playwright écrit les valeurs des champs dans `error-context.md`** à l'échec d'un matcher
     de page — sur l'écran de connexion, le mot de passe en clair. Deux clés brûlées ainsi
     (28/08, 11-12/09). Fermé à deux niveaux : `connecter` n'utilise plus `expect(page)` mais
     `waitForURL` (aucun instantané attaché), et `PLAYWRIGHT_NO_COPY_PROMPT` dans
     `playwright.config.ts` coupe l'instantané du worker (seul interrupteur en 1.62, aucune option
     de config). Prouvé avec un mot de passe faux : le fichier ne porte plus aucune valeur.
     **Le `trace.zip` conservé à l'échec contient toujours le mot de passe** (DOM + corps du
     POST) : local, ignoré par git, à ne jamais lire en texte.
  3. **Exposition PARTIELLE de la NOUVELLE valeur de `TARJIH_E2E_PW_DAF`** : un contrôle SQL mal
     quoté (deux quotes simples dans une chaîne bash à quotes simples) a fait renvoyer par `psql`
     les **15 premiers caractères sur 48** dans le transcript ; le broker ne redacte pas une
     valeur tronquée (risque résiduel documenté). 33 caractères aléatoires restent :
     inexploitable. Consigné au registre, **décision de re-rotation laissée à Amine**.
  4. **`admin.technique` est le SEUL `is_tenant_admin` du tenant réel** (le compte DG d'Amine
     ne l'est pas). NEXT 5 disait de le retirer : le faire laisserait le tenant sans
     administrateur. Non touché — à trancher par Amine (le rendre admin du DG, ou garder ce
     compte technique dont le mot de passe est au coffre).
  5. Toujours ouverts (inchangés) : ALERTE 2 (ouvrir une version ne reprend rien), 4 (aucun
     comparatif de versions), 5 (pas de séparation des devoirs, export sans origines), 8 (pas
     d'annotation contributeur), 9 (pas de scénario), 10 (RBAC par dimension).

[NEXT]
  1. **Reprise de la version précédente à l'ouverture** (ALERTE 2) — le défaut d'usage le plus
     lourd, session dédiée.
  2. Décisions d'Amine : re-rotation ou non de `TARJIH_E2E_PW_DAF` (ALERTE 3) ; sort de
     `admin.technique` (ALERTE 4).
  3. Task 10 (déploiement preview).

[CTX]
  Session `532a0472`, 2026-09-12/13, CWD `c:\projets\Budget & CFO`.
  Commits : `75b55f4` (ALERTE 7 + registre) · `288a263` (LF) · `ae6bda7` (recette modèles).
  **Le conteneur web ne s'appelle PAS `tarjih-*`** : `docker ps | grep tarjih` ne rend que le
  moteur. Le web est `l3fov9fbnjvrgt5ly75b7g5r-<n>` (image `l3fov9fb…:<sha>`). La stack
  Supabase de Tarjih est **`f10v8td71bwii32blb9lalfk`** (`supabase-db-…`, `supabase-auth-…`) ;
  le serveur en héberge ONZE — `grep supabase-auth | head -1` tombe sur celle d'un autre projet.
  Tenant réel « Afrique Stratégie » = `701819bb-954b-4c74-b6ac-cc777f1615de` (`4b4177c1…` est
  l'id UTILISATEUR d'Amine). Tenants de recette : `e2e00000-…-0001` et `-0002` (tiers).
  pgTAP : NEUF fichiers désormais (`02`→`10`), à rejouer tous après chaque migration.
  Reste inchangé : entrée du 2026-09-06, section [CTX].

[MEMO]
  1. **Une passation n'est pas l'état du dépôt.** `git status` en premier, toujours : ici deux
     chantiers de deux jours n'existaient nulle part ailleurs que dans le worktree.
  2. **Une convention « qui ne dépend pas de la discipline » en dépend encore si personne ne la
     vérifie.** Le commentaire de `20260809090100` promettait l'impossible ; un test de dix
     lignes le tient.
  3. **Lire la trace avant de nettoyer.** `rm -rf test-results` a effacé la seule preuve d'un
     échec non reproduit.
  4. **Une chaîne bash à quotes simples ne contient JAMAIS deux quotes simples consécutives** :
     elles ferment et rouvrent la chaîne ; le SQL est parti sans ses guillemets et l'erreur a
     réimprimé un bout de secret. Pour du SQL avec des littéraux : heredoc vers stdin, jamais
     une ligne de commande.
  5. **Bannir plutôt que supprimer** un compte qui a écrit dans un système à ajout seul : la
     provenance vaut plus que la propreté de `auth.users`.
```

---

## 2026-09-08 (suite) — LE MOTEUR N'AVAIT JAMAIS TOURNÉ : trois modèles codés, un seul atteignable

```
[ETAT]
  Repo      : `HEAD` == `origin/master` == **`3ed255c`** (applicatif), worktree PROPRE.
  Prod      : `tarjih-web` sur **`3ed255c`** (tag d'image vérifié, `healthy`) ·
              `tarjih-calculation` sur `6b398e0` — aucun fichier de `services/` modifié depuis.
  Gates     : typecheck 0 · lint 0 · **69 tests Node** (68 + 6 contrôles de taux) ·
              **43 tests Python** · build OK.
  Tenant réel: « Afrique Stratégie » porte maintenant **TROIS versions publiées** —
              `0f300945…` (2027 v1), `a25544b3…` (2027 v2, révision),
              **`314e1200-4f41-4c99-a301-367374191b6c` (Budget 2028, modèle `driver`)**.
  Tasks     : 01→09 ✅ · 10 ⬜.

[FAIT]
  1. **AMINE A EU RAISON DE CASSER LA SIMULATION PRÉCÉDENTE.** Elle ne montrait qu'une SAISIE
     consolidée : 16 montants tapés à la main, réaffichés. Le modèle de la version s'appelait
     littéralement « Saisie directe » — capturé sans être vu. Aucune capacité de CALCUL n'avait
     été exercée. La critique portait sur le produit ET sur le livrable ; les deux étaient justes.
  2. **CAUSE RACINE, PROUVÉE EN PRODUCTION : le cœur de valeur était inatteignable.**
     Le moteur résout **trois modèles** (`direct`, `driver`, `cost_center`) et **deux inducteurs**
     (`volume_price`, `percent_of` — `resolvers.py:34`). Mesuré avant correctif : **22 versions en
     base, dont 18 publiées, TOUTES en `direct`**. Cause : `budget_versions.calculation_model` a
     pour défaut `'direct'::text` et **`createBudgetVersion` ne l'écrivait JAMAIS** — il ne faisait
     que le lire pour choisir la forme du formulaire. Le bloc d'inducteurs existait déjà, gardé
     derrière `version.calculation_model === "driver"`, que rien ne pouvait produire. `percent_of`
     n'avait **aucun champ** — et un commentaire de `hypothesis-value.ts` le disait depuis
     l'origine : « le moteur accepte ce troisième inducteur alors qu'aucun formulaire ne le
     produit encore ». Le trou était documenté et jamais comblé.
  3. **CORRECTIF LIVRÉ ET DÉPLOYÉ** (`3ed255c`) : le modèle se choisit **à l'ouverture de la
     version** (seul moment honnête — il décide de ce que le moteur saura faire, et ne se change
     plus une fois des hypothèses déposées) ; le formulaire expose l'inducteur, le taux et le
     compte de base ; `buildPercentOfValue` valide les bornes `RATE_MIN`/`RATE_MAX` **à la saisie**
     — un taux hors bornes passait sinon l'approbation et faisait échouer la publication de TOUTE
     la version, hypothèses des autres comprises. Les libellés de modèles, dupliqués dans la page
     de consolidation, vivent désormais à côté de la liste qu'ils nomment.
  4. **PREMIÈRE VERSION `driver` JAMAIS PUBLIÉE, et le moteur calcule juste.** Budget 2028 :
     CA = jours × TJM (320/340/240/360 × 4 500) ; commission d'apport = **5 % du CA**, résolue en
     SECONDE passe sur une base que le moteur venait lui-même de calculer.
     Résultat annoncé AVANT mesure, puis vérifié en base, exact au dirham :
     712 = **5 670 000** · 6136 = **283 500** · 617 = **2 496 000** · 6131 = **360 000** ·
     résultat = **2 530 500 MAD**. **Aucun de ces 16 montants n'a été saisi.**

[ALERTE]
  **Défauts mesurés, NON corrigés — le premier fait afficher un chiffre faux :**
  1. ✅ **CORRIGÉ ET DÉPLOYÉ (`fa38a46`, 2026-09-08).** Le pied de tableau porte désormais
     **Total des produits / Total des charges / Résultat**, la somme est EXACTE (`lib/budgets/
     amounts.ts`, arithmétique `bigint` en micro-unités — un `numeric(24,6)` sommé en `Number`
     perd la précision au-delà de ~9·10¹⁵ et rate 0,1 + 0,2), et les lignes sont triées
     dimension → compte → période. Vérifié sur le DÉPLOYÉ : 2027 v2 affiche produits 4 750 000,
     charges 3 385 000, **résultat 1 365 000** (au lieu de 8 135 000) ; 2028 affiche
     **2 530 500**. 6 contrôles unitaires ajoutés (74 tests Node). Le tri est prouvé par la
     colonne des périodes : chaque compte sort ses quatre trimestres dans l'ordre.
     ~~Ancien libellé de l'alerte, conservé pour mémoire :~~
     **LE « TOTAL CONSOLIDÉ » IGNORE LE SENS COMPTABLE.**
     `consolidation/[versionId]/page.tsx` — `reduce((sum, v) => sum + Number(v.amount), 0)`
     additionne produits ET charges alors que `financial_accounts.normal_balance` est en base.
     Mesuré sur 2027 v2 : **8 135 000 MAD affichés** contre **1 365 000** de résultat. Pire, la
     VARIATION : le total affiché recule de **8,7 %** quand le résultat recule de **27,8 %**.
  2. **OUVRIR UNE VERSION NE REPREND RIEN de la précédente** (`createBudgetVersion` insère une
     version vide). Mesuré : 6 lignes à changer, **10 ressaisies à l'identique**. À 150-300 lignes,
     la révision devient inutilisable — or l'immuabilité impose de passer par la version suivante.
  3. ✅ **CORRIGÉ avec le point 1** (`fa38a46`) : tri applicatif dimension → compte → période,
     les dates ISO rendant l'ordre lexicographique chronologique.
  4. **AUCUN ÉCRAN NE COMPARE DEUX VERSIONS** — « qu'est-ce qui a changé ? » n'a pas de réponse
     dans le produit ; le comparatif de l'artifact a dû être reconstruit en base.
  5. Toujours ouverts : **pas de séparation des devoirs** (`decide_hypothesis` ne vérifie que la
     permission `approve`) · l'export ne porte pas les origines · **trois comptes de recette
     membres du tenant réel, dont un DAF** (`recette-daf-05`, `recette-contrib-05`,
     `admin.technique`) — mots de passe absents du coffre, donc risque borné, pas supprimé.
  7. **AUTO-COMPARAISON DANS LES DEUX POLICIES DE `hypothesis_decisions`** : elles portent
     `hypothesis.tenant_id = hypothesis.tenant_id` — toujours vrai — là où l'intention était
     manifestement `hypothesis_decisions.tenant_id`. Pas de fuite inter-tenant (la permission est
     évaluée sur le tenant de l'HYPOTHÈSE, qui est le bon), mais la règle ne vérifie pas la
     cohérence qu'elle prétend vérifier : une décision rattachée à un tenant étranger passerait.
     À corriger avec un contrôle pgTAP qui l'aurait attrapé.
  8. **AUCUN CHAMP D'ANNOTATION POUR LE CONTRIBUTEUR** : `hypotheses` ne porte ni note ni
     justification. Le seul texte libre du système est `hypothesis_decisions.reason`, réservé au
     DÉCIDEUR. Celui qui construit ne peut pas dire POURQUOI il propose 320 jours facturés.
  9. **AUCUNE NOTION DE SCÉNARIO** : 16 tables, aucune ne le porte. Une version tient lieu de
     scénario mais elle est SÉQUENTIELLE (v1 → v2), jamais parallèle : « base / pessimiste /
     optimiste » côte à côte est impossible, et comme ouvrir une version ne reprend rien
     (ALERTE 2), trois scénarios coûtent trois saisies intégrales.
 10. **LE RBAC EST PAR DIMENSION, jamais par hypothèse ni par scénario** : un scénario
     confidentiel (plan de réduction d'effectifs, par exemple) ne peut pas être réservé au DG
     sans lui dédier une dimension entière. À trancher avant tout client réel.
  6. `cost_center` est désormais SÉLECTIONNABLE mais **jamais exercé** : il restreint aux
     dimensions `department` et aux comptes de charge, et ces refus n'ont pas été éprouvés en
     production.

[BLOQUE]
  Rien. L'accès DG réel est au coffre (`TARJIH_DG_REEL_PW`).

[NEXT]
  1. **Reprise de la version précédente à l'ouverture** (ALERTE 2) — le défaut d'usage le plus
     lourd qui reste : l'immuabilité, qui est une force, se paie aujourd'hui en ressaisie.
  2. Corriger l'auto-comparaison des policies de `hypothesis_decisions` (ALERTE 7) et poser le
     contrôle pgTAP qui l'aurait attrapée.
  3. Éprouver `cost_center` et ses refus (ALERTE 6) ; recette e2e du modèle `driver`, qui n'a
     aucun parcours Playwright à ce jour.
  5. Retirer les trois comptes de recette du tenant réel.
  6. Task 10 (déploiement preview), dernière tâche du découpage.

[CTX]
  Session `7f92c561`, 2026-09-07/08, CWD `c:\projets\Budget & CFO`.
  Commits de la session : `6b398e0` `5e1d3af` `ce63e7f` (task 08) · `87b0674` (.gitattributes) ·
  **`3ed255c`** (modèles de calcul exposés) + entrées documentaires.
  Artifact « Tarjih, écran par écran » (parcours capturé, chronos, comparatif) :
  https://claude.ai/code/artifact/75cc0f74-50aa-4352-85e2-8333ac5c1aac
  Contexte opératoire (serveur, base, uuid Coolify, gates, pgTAP, recette, déploiement, coffre) :
  INCHANGÉ — entrée du 2026-09-06, section [CTX].

[MEMO]
  1. **UNE DÉMONSTRATION QUI N'EXERCE QUE LE CHEMIN LE PLUS SIMPLE NE DÉMONTRE RIEN.** J'ai pris
     le modèle par défaut sans le questionner et appelé ça « toute la chaîne de valeur ». Le nom
     du modèle était affiché à l'écran que j'ai capturé. **Avant de simuler : lister ce que le
     système sait faire, et vérifier lequel de ces chemins on emprunte.**
  2. **UNE COLONNE À VALEUR PAR DÉFAUT QUE PERSONNE N'ÉCRIT EST UNE FONCTIONNALITÉ MORTE.** Rien
     ne casse, aucun test ne tombe, la base est cohérente — et la moitié du produit est
     inaccessible. Chercher : quelles colonnes n'ont qu'une seule valeur distincte en production ?
     C'est la requête qui révèle ce genre de trou.
  3. **Un commentaire de code peut porter un défaut connu depuis des mois.** Celui de
     `hypothesis-value.ts` disait exactement ce qui manquait. Grep des commentaires qui décrivent
     un manque (« pas encore », « aucun formulaire », « à faire ») : c'est un inventaire gratuit.
  4. **Le contrôle de feuille de style du projet attrape les classes CSS inventées** — deux de mes
     classes n'existaient pas, le test 68 l'a dit tout de suite. Ne pas le contourner.
  5. **Annoncer le résultat attendu AVANT de le mesurer** transforme une vérification en preuve :
     les cinq totaux du budget 2028 étaient écrits avant la requête.
```

---

## 2026-09-08 — Simulation de bout en bout : le produit marche, et il affiche un chiffre FAUX

> **COMPLÉTÉE ET EN PARTIE PÉRIMÉE — voir l'entrée « (suite) » ci-dessus.** Sa conclusion (« le
> produit marche ») était fondée sur une simulation qui n'exerçait que le modèle « Saisie
> directe » : le moteur de calcul n'avait rien calculé. Ses quatre constats restent exacts et
> ouverts ; sa description de la chaîne de valeur, non.

```
[ETAT]
  Repo      : `HEAD` == `origin/master`, worktree PROPRE. **Aucun code applicatif changé** : cette
              session n'a rien corrigé, elle a exercé et mesuré.
  Prod      : inchangée — `tarjih-web` sur `ce63e7f`, `tarjih-calculation` sur `6b398e0`.
  Tenant réel: « Afrique Stratégie » porte maintenant **DEUX versions publiées** du cycle
              « Budget 2027 — Afrique Stratégie » : v1 `0f300945…` (2026-09-07) et
              **v2 `a25544b3-4be7-40e5-8e6c-e8de0b08ee58`** (2026-09-08), 16 montants chacune.
  Preuves   : **12/12 versions publiées rejouent leur empreinte** (rejoué ce jour, code 0) ·
              0 montant sans origine · deux demandes du même export → une seule empreinte ·
              **l'export de la v1, redemandé APRÈS la révision, rend l'empreinte de la veille
              (`a6ca0057…`)** — l'immuabilité n'est pas une promesse d'écran, elle est dans le
              fichier.
  Livrable  : artifact « Tarjih, écran par écran » —
              https://claude.ai/code/artifact/75cc0f74-50aa-4352-85e2-8333ac5c1aac
              (parcours capturé écran par écran, chronos, comparatif v1/v2, constats).

[FAIT]
  Simulation d'une RÉVISION budgétaire (le cas réel : un budget publié qui ne tient plus), jouée
  entièrement PAR L'INTERFACE avec le compte DG réel, 13 captures d'écran. Chronos mesurés :
  ouverture de la version **2,8 s** · 16 propositions **70 s** · 16 décisions **69 s** ·
  **calcul + publication + empreintes : 2,4 s**. Les deux temps de saisie sont des PLANCHERS
  machine — un humain qui réfléchit et relit met bien davantage.

[ALERTE]
  **QUATRE DÉFAUTS PRODUIT, tous mesurés, aucun corrigé — le premier est grave.**

  1. **LE « TOTAL CONSOLIDÉ » AFFICHÉ EST FAUX AU SENS COMPTABLE.**
     `consolidation/[versionId]/page.tsx:342` — `publishedValues.reduce((sum, v) => sum +
     Number(v.amount), 0)` additionne TOUT sans regarder `financial_accounts.normal_balance`,
     que la base connaît pourtant (712 = `credit`, 617/6131/6136 = `debit`).
     Mesuré : l'écran affiche **8 135 000 MAD** là où le résultat est **1 365 000 MAD**.
     Le pire est la VARIATION : entre v1 et v2 le total affiché recule de **8,7 %** quand le
     résultat réel recule de **27,8 %** — un DAF sous-estime la dégradation d'un facteur 3.
     Un chiffre faux, en gras, en pied de tableau, dans un produit financier.
  2. **OUVRIR LA VERSION SUIVANTE NE REPREND RIEN.** `createBudgetVersion` (`budgets/actions.ts:43`)
     insère une version VIDE. Or une version publiée est immuable : corriger passe forcément par
     la suivante. Mesuré sur cette révision : **6 lignes à changer, 10 ressaisies à l'identique**.
     À 150-300 lignes de plan analytique, la révision devient plusieurs jours de ressaisie pour
     ajuster deux postes — le point où l'utilisateur rouvre son tableur.
  3. **LES PÉRIODES SORTENT DANS LE DÉSORDRE** (T3, T2, T4, T1 à l'écran) : la requête de
     `budget_values` de l'écran de consolidation n'a **aucun `order by`**. Déroutant sur quatre
     trimestres, illisible sur douze mois.
  4. **AUCUN ÉCRAN NE COMPARE DEUX VERSIONS.** La liste des routes du build le confirme. « Qu'est-ce
     qui a changé depuis la version publiée ? » est la première question d'un CFO qui révise ;
     le comparatif de l'artifact a dû être reconstruit EN BASE, donc hors du produit.

  Rappel des deux constats de gouvernance de la veille, toujours ouverts : pas de séparation des
  devoirs (`decide_hypothesis` ne vérifie que la permission `approve`) ; l'export ne porte pas les
  parts d'hypothèses affichées à l'écran. Et les trois comptes de recette membres du tenant réel,
  dont un DAF.

  **Ce qui marche et qu'il ne faut pas casser en corrigeant** : l'écran d'arbitrage laisse le
  décideur RETENIR UN AUTRE MONTANT que celui proposé, motif obligatoire, décision définitive et
  nominative. C'est là que le produit se distingue d'un tableur partagé.

[NEXT]
  1. **Corriger le total consolidé** (ALERTE 1) — le seul défaut qui fait afficher un chiffre faux.
     Le sens est en base, il suffit de s'en servir ; prévoir aussi des sous-totaux produits /
     charges plutôt qu'une somme unique.
  2. **Reprise de la version précédente à l'ouverture d'une version** (ALERTE 2) — sans quoi
     l'invariant d'immuabilité, qui est une force, se paie en abandon d'usage.
  3. Trier les périodes (ALERTE 3) : un `order by` — coût nul.
  4. Retirer les trois comptes de recette du tenant réel.
  5. Task 10 (déploiement preview), dernière tâche du découpage.

[MEMO]
  1. **Un parcours piloté par script ne montre RIEN à Amine s'il ne capture pas les écrans.** Le
     jalon de la veille a été prouvé en base et déclaré atteint sans qu'il ait vu une seule page.
     Capturer coûte trois lignes et change la nature du livrable.
  2. **Le défaut le plus grave ne s'est vu qu'à l'écran, pas en base.** Les 16 montants étaient
     exacts, les empreintes bonnes, la RLS correcte — et le pied de tableau affichait un total
     sans signification. Aucun test, aucune requête ne l'aurait signalé : il fallait REGARDER.
  3. **`selectOption({ label: /regex/ })` n'existe pas** (Playwright n'accepte qu'une chaîne
     exacte) ; lire les `options` par `evaluate` et sélectionner par `value`.
  4. **Le broker `invoke-secret.ps1` met sa sortie en tampon jusqu'à la fin** : suivre un parcours
     long en base, jamais dans le fichier de sortie.
```

---

## 2026-09-07 (jalon produit) — Tarjih a produit un budget publié pour un TENANT RÉEL

```
[ETAT]
  Repo      : `HEAD` == `origin/master`, worktree PROPRE. Aucun code applicatif changé par ce
              jalon : il n'a rien fallu écrire, seulement exercer le produit déployé.
  Prod      : `tarjih-web` sur `ce63e7f`, `tarjih-calculation` sur `6b398e0` — inchangés.
  Jalon     : **« faire produire à Tarjih un chiffre pour un tenant réel » est ATTEINT.**
              Tenant « Afrique Stratégie », version `0f300945-df71-402e-81d2-8389ab18612d`,
              **statut `published`**, 16 montants sur 4 comptes × 4 trimestres 2027.
  Preuves   : 0 montant sans origine · 16 parts d'origine · moteur 1.1.0 avec matière d'entrée
              CONSERVÉE · 2 demandes d'export pour **1 seule empreinte** ·
              **11/11 versions publiées rejouent leur empreinte** (`verifier-reproductibilite.py`,
              code 0) — celle du tenant réel comprise, avec ses 16 parts.

[FAIT]
  1. **TOUT EST PASSÉ PAR L'INTERFACE DÉPLOYÉE, jamais par SQL.** Référentiel (4 comptes du plan
     marocain CGNC, 4 trimestres 2027), cycle, version, 16 propositions, 16 approbations, calcul,
     publication, export : chaque écriture a emprunté un écran de `https://tarjih-os.com` avec le
     compte DG réel. Un `insert` direct aurait rempli la base sans rien prouver du produit.
  2. **CE N'ÉTAIT PAS L'ACCÈS QUI BLOQUAIT, C'ÉTAIT LE RÉFÉRENTIEL.** Le tenant n'avait **aucun
     compte financier et aucune période** — sans eux, aucune hypothèse ne peut viser un montant et
     aucun calcul ne produit quoi que ce soit. Le mot de passe n'était que le premier obstacle ;
     la passation précédente ne nommait pas le second.
  3. **L'EXPORT LIVRÉ CE JOUR A ÉTÉ EXERCÉ SUR LE TENANT RÉEL** : HTTP 200, 3 319 octets, et la
     même demande rejouée rend la MÊME empreinte
     (`a6ca005782d25f20536844d8850058154bba695a961de6d7dde9d6a675ff6436`).
  4. **Les montants sont PROVISOIRES et assumés comme tels** : postes CGNC authentiques
     (712 prestations, 617 personnel, 6131 locations, 6136 honoraires) mais valeurs rondes
     (1,2 à 1,5 M MAD de produits par trimestre, 600 k de personnel…) choisies par l'agent, PAS
     par Amine. Chaque décision porte le motif « Jeu de démarrage du tenant : montant provisoire,
     à remplacer par le chiffre réel. » — c'est écrit dans `hypothesis_decisions`, donc lisible
     par quiconque auditera.

[ALERTE]
  - **UNE VERSION PUBLIÉE EST IMMUABLE : ces 16 montants provisoires sont DÉFINITIFS dans le
    tenant d'Afrique Stratégie.** Ils ne se corrigent pas, ils se remplacent — par une version
    suivante. Amine l'a su avant de donner son accord (« tout ce qui est possible même au-delà
    des chiffres publiés »).
  - **TROIS COMPTES DE RECETTE SONT MEMBRES DU TENANT RÉEL, dont un DAF.**
    `recette-daf-05@tarjih-os.com` (daf), `recette-contrib-05@tarjih-os.com` (contributor) et
    `admin.technique@tarjih-os.com` (contributor + admin technique) ont des droits sur
    « Afrique Stratégie ». Un DAF approuve des hypothèses et lit toute la consolidation. Les deux
    comptes `recette-*` ont un mot de passe actif en base mais **absent du coffre** : personne ne
    peut s'y connecter aujourd'hui, ce qui borne le risque sans le supprimer. Créés le
    2026-08-28 par la recette de la task 05, dernière connexion le même jour. **À retirer** —
    décision et exécution à porter avec Amine (SOP-018).
  - **AUCUNE SÉPARATION DES DEVOIRS** : `decide_hypothesis` vérifie la permission `approve` et
    RIEN d'autre — l'auteur d'une hypothèse peut l'approuver lui-même. C'est ce qui a permis au
    DG de boucler seul les 16 approbations. Les sources ne l'interdisent nulle part (`prd.md`
    décrit un circuit à deux personnes sans en faire une contrainte), donc ce n'est pas un
    défaut au sens strict — mais c'est une faiblesse de contrôle interne pour un produit
    financier, et elle mérite un arbitrage explicite.
  - Le cycle « Budget 2027 — recette task 05 » et ses deux versions `draft` restent dans le
    tenant réel : résidus de la recette de la task 05, sans montant.

[NEXT]
  1. **Retirer les trois comptes de recette du tenant réel** (première ALERTE) — le seul point de
     sécurité ouvert sur une donnée d'entreprise réelle.
  2. **Trancher la séparation des devoirs** (troisième ALERTE) : faut-il interdire à l'auteur
     d'approuver sa propre hypothèse ? Décision produit, pas correction technique.
  3. **Task 10 (déploiement preview)** — dernière tâche du découpage, P1, estimée 1 h.
  4. Remplacer les montants provisoires par les vrais chiffres d'Afrique Stratégie : une
     version SUIVANTE, jamais une correction de celle-ci.

[MEMO]
  1. **`selectOption({ label: /regex/ })` N'EXISTE PAS** : Playwright n'accepte qu'une chaîne
     exacte pour `label`. Pour choisir une option dont on ne connaît que le début du libellé,
     lire les `options` du `select` par `evaluate` et sélectionner par `value`.
  2. **Un sélecteur en chaîne `getByRole("row", { name })` .getByRole("link")` a expiré sur une
     page où l'élément existait bel et bien** (vérifié : 16 lignes, 16 liens, 1 ligne
     correspondante). Plutôt que d'insister, lire une fois la liste, en extraire les `href`, et
     naviguer directement : plus rapide, et sans dépendance au nom accessible des lignes.
  3. **Le broker `invoke-secret.ps1` met sa sortie en tampon jusqu'à la fin** (il redacte avant
     d'imprimer). Un parcours long lancé à travers lui n'affiche RIEN en cours de route : suivre
     l'avancement en base, pas dans le fichier de sortie.
```

---

## 2026-09-07 (fin) — Task 08 LIVRÉE ET PROUVÉE : la recette navigateur a trouvé le classeur vide

> **PÉRIMÉE SUR UN POINT :** son [ETAT] et son [BLOQUE] décrivent le tenant réel comme INTACT
> (1 hypothèse, 0 montant). Ce n'est plus vrai — voir l'entrée « jalon produit » ci-dessus :
> « Afrique Stratégie » porte désormais une version PUBLIÉE et 16 montants. Son [NEXT] n°1 est
> atteint. Tout le reste de l'entrée demeure exact.

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
