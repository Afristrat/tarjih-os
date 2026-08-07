# Cadrage NP — Tarjih

## État du cadrage

- Phase : 1 — Interrogatoire adaptatif
- Stade déclaré : idée — démarrage du projet
- Niveau imposé : L99 de bout en bout
- Date d’ouverture : 2026-08-07

## Intention initiale

Construire une plateforme multi-tenant de gestion budgétaire dans laquelle chaque tenant dispose de son propre modèle financier. Les utilisateurs contribuent selon des droits limités à certaines dimensions, tandis que le directeur général consolide et pilote l’ensemble.

Le système envisagé sépare trois responsabilités :

1. l’IA propose des hypothèses ;
2. l’utilisateur valide explicitement ces hypothèses ;
3. Python exécute ensuite les calculs et alimente le modèle de façon déterministe.

Après calcul des ratios et des résultats, l’IA peut produire des interprétations et des recommandations, clairement séparées des données financières calculées.

## Éléments structurants déjà exprimés

- Plateforme multi-tenant.
- Un modèle financier isolé par tenant.
- Droits d’accès par utilisateur et par dimension budgétaire.
- Consolidation globale réservée au directeur général ou à des rôles habilités.
- Calculs financiers déterministes exécutés par Python.
- Validation humaine obligatoire avant l’intégration d’une hypothèse proposée par l’IA.
- IA réutilisée en aval pour l’analyse et les recommandations.
- Excel envisagé comme livrable ou support financier propre à chaque tenant.
- Question ouverte sur la nécessité de générer physiquement un fichier Excel et sur son maintien éventuel côté serveur.
- Tout export doit appliquer le RBAC du demandeur : un responsable marketing ne peut exporter que les dimensions, mesures et périodes auxquelles il a accès ; les rôles DAF et DG peuvent disposer d’une vue consolidée complète selon la matrice d’autorisation du tenant.

## Hypothèses à valider

- Le fichier Excel est-il la source de vérité opérationnelle, un artefact généré, ou une interface d’import/export ?
- Le budget est-il préparé directement dans la plateforme, directement dans Excel, ou dans les deux ?
- Le périmètre initial vise-t-il le budget annuel uniquement ou également le réalisé, le forecast et les trois états financiers intégrés ?
- Les dimensions portent-elles sur les départements, centres de coûts, business units, projets, entités juridiques, produits ou une combinaison configurable ?

## Red flags initiaux

1. **Données financières sensibles** : le cloisonnement multi-tenant, la traçabilité et les autorisations au niveau des dimensions sont des exigences centrales, pas des options de finition.
2. **Excel comme source de vérité potentielle** : les éditions concurrentes, les versions de fichiers, les formules modifiées et les consolidations peuvent compromettre le déterminisme recherché.
3. **Responsabilité des recommandations IA** : une recommandation doit conserver ses données sources, sa version de prompt, son niveau de confiance et son statut de validation ; elle ne doit jamais devenir silencieusement une donnée comptable.
4. **Périmètre L99** : vouloir couvrir dès la première version tous les business models, secteurs et niveaux de sophistication reproduirait le problème du prompt initial.
5. **Captivité comme mécanisme de rétention** : empêcher ou compliquer la récupération du modèle financier risque d’affaiblir la confiance. La rétention devrait venir de la valeur cumulative du produit, tout en maintenant une exportabilité contrôlée.
6. **Fuite par export** : masquer des feuilles, colonnes ou cellules dans Excel ne constitue pas un contrôle d’accès. Le périmètre autorisé doit être filtré côté serveur avant la génération du classeur ; aucune donnée interdite ne doit être incluse dans le fichier, ses feuilles masquées, ses formules, ses caches, ses métadonnées ou ses sources embarquées.

## Première position d’architecture à éprouver

La piste la plus robuste semble être : base de données structurée comme source de vérité, moteur Python versionné pour les calculs, génération d’un classeur Excel déterministe par tenant et par version budgétaire, plutôt qu’un fichier Excel vivant utilisé comme base de données primaire.

Cette position n’est pas encore une décision. Elle doit être confrontée aux usages réels et au mode de collaboration attendu.

Une variante plus légère doit être évaluée : aucun classeur persistant par défaut, mais une représentation structurée conservée en base et un export Excel/PDF généré à la demande à partir d’un snapshot immuable.

### Principe provisoire d’export sécurisé

1. Authentifier l’utilisateur et le tenant.
2. Résoudre les autorisations effectives par rôle, dimension, mesure, période, scénario et niveau d’agrégation.
3. Construire côté serveur un dataset strictement limité à ce périmètre.
4. Générer le classeur uniquement à partir de ce dataset filtré.
5. Journaliser le demandeur, le périmètre, la version du budget, la version du moteur et l’empreinte du fichier.
6. Appliquer une durée de conservation et une URL de téléchargement limitée dans le temps.

Le rôle ne doit pas être l’unique mécanisme : la matrice d’autorisation doit rester configurable par tenant. Les droits complets du DAF et du DG sont une politique par défaut proposée, pas une règle codée en dur.

## Réponses de l’interrogatoire

### Stade réel du projet

Le projet commence. Aucun code, aucune maquette et aucun utilisateur réel n’ont été déclarés à ce stade.

### Matière déjà acquise depuis le prompt initial

Le prompt initial est retenu comme expression du périmètre fonctionnel cible : plateforme de pilotage budgétaire et financier adaptée au Maroc, multi-business-model, multi-financement, multi-devise, avec revenus, coûts, RH, CAPEX, BFR, trois états financiers, Budget/Actual/Forecast, scénarios, unit economics, cockpit, contrôles et audit.

Les précisions ultérieures remplacent toutefois l’hypothèse d’un simple classeur universel : la cible devient une plateforme multi-tenant, avec calcul Python déterministe, validation humaine des hypothèses proposées par l’IA, analyses aval assistées par IA et exports soumis au RBAC.

### Information encore absente du prompt

Le premier segment payant et son processus budgétaire actuel ne sont pas identifiés. Le prompt vise simultanément TPE, PME, ETI, de nombreux secteurs et plusieurs destinataires ; cela décrit un marché très large, mais ne permet pas encore de définir une première version ni un canal d’acquisition.

### Correction de segmentation

L’effectif n’est pas retenu comme critère d’éligibilité : une structure de deux associés fortement automatisée peut avoir une activité, des flux et des besoins de financement complexes. Le produit doit donc rester accessible aux très petites équipes.

La segmentation à éprouver repose plutôt sur la complexité du pilotage :

- **Solo ou équipe fondatrice** : construction guidée, peu de contributeurs, forte assistance sur les hypothèses ;
- **Organisation fonctionnelle** : contributions par département, centres de coûts, validations et consolidation ;
- **Groupe ou structure complexe** : entités, devises, scénarios, consolidations et autorisations avancées.

Ces profils peuvent utiliser le même noyau de calcul, avec des parcours, modules et contrôles progressivement activés. L’inclusivité concerne l’accès au produit ; elle n’oblige pas à livrer toute la complexité à chaque utilisateur.

### Promesse fonctionnelle indivisible

L’utilisateur refuse de réduire la promesse à une seule des trois capacités suivantes : produire un budget fiable, consolider les contributions et piloter en continu Budget/Actual/Forecast. Elles constituent une boucle unique et doivent être pensées ensemble au niveau L99.

La boucle cible à éprouver devient :

1. traduire la stratégie et les objectifs en hypothèses mesurables ;
2. proposer, documenter et faire valider les hypothèses ;
3. construire le budget à partir de drivers causaux ;
4. distribuer les contributions selon le RBAC et les dimensions ;
5. orchestrer validations, arbitrages et consolidation ;
6. intégrer les réalisations depuis des sources vérifiables ;
7. expliquer les écarts Budget/Actual/Forecast ;
8. produire un rolling forecast et des scénarios ;
9. détecter les tensions de trésorerie, marges, BFR et financement ;
10. transformer les analyses en décisions, responsables et échéances ;
11. conserver l’audit trail des hypothèses, validations, versions et décisions ;
12. réinjecter les enseignements dans le cycle budgétaire suivant.

Le niveau L99 qualifie la cohérence, la robustesse, la traçabilité et la profondeur de cette boucle. Il ne dispense pas de définir l’ordre de construction et de validation du produit.

### Processus actuel à remplacer

Le fonctionnement dominant confirmé est fragmenté : fichiers Excel distribués, échanges par e-mail, données réalisées exportées depuis la comptabilité, consolidation manuelle par le DAF et analyses tardives.

Dans une minorité de cas, certaines données sont déjà accessibles par API. Le produit doit donc prendre en charge deux voies d’alimentation :

- imports contrôlés pour le cas dominant ;
- connecteurs API pour les systèmes compatibles.

Les deux voies doivent converger vers un même contrat de données et subir les mêmes contrôles de schéma, période, devise, tenant, doublons, exhaustivité, réconciliation et provenance. Une donnée reçue par API n’est pas considérée comme correcte du seul fait qu’elle est automatisée.

### Couche de diagnostic, simulation et exécution stratégique

La plateforme ne doit pas s’arrêter à la production des états financiers et à l’analyse descriptive. Elle doit relier les résultats à des leviers opérationnels, simuler leur effet et permettre de convertir les hypothèses retenues en plans d’action suivis.

Capacités demandées :

- analyse approfondie des ratios et de leurs causes ;
- arbres de décomposition tels que DuPont sur quatre à cinq niveaux lorsque les données disponibles le permettent ;
- navigation d’un ratio vers ses drivers financiers puis opérationnels ;
- simulateurs interactifs présentant hypothèses, impacts attendus, délais, coûts, risques et gains estimés ;
- expérience engageante inspirée de la gamification, sans transformer des décisions financières en jeu ni masquer l’incertitude ;
- recommandations d’actions et de stratégies adaptées aux patterns de business models du référentiel, annoncé comme contenant 56 modèles et restant à vérifier à la source ;
- prise en charge de plusieurs business models simultanés ;
- agrégation et arbitrage des actions proposées à travers plusieurs modèles économiques ;
- conversion des hypothèses validées en plans d’action comportant responsable, échéance, dépendances, ressources, KPI cible, scénario, statut et résultat observé ;
- boucle de comparaison entre gain estimé et gain réellement obtenu.

### Séparation des responsabilités

- **Moteur déterministe** : calcul des ratios, arbres de décomposition, impacts des simulations, consolidations, détection des doubles comptes et réconciliations.
- **IA** : génération de pistes, contextualisation, explication, formulation de stratégies et proposition de plans d’action.
- **Humain habilité** : validation des hypothèses, choix des actions, arbitrage des conflits et engagement des ressources.

### Modèle d’agrégation à concevoir

Les 56 patterns ne doivent pas produire 56 bibliothèques d’actions isolées. Ils doivent être reliés à une taxonomie commune de leviers, par exemple : prix, volume, mix, rétention, acquisition, conversion, fréquence, productivité, capacité, coût unitaire, BFR, CAPEX, financement et risque.

Une action peut servir plusieurs business models. Son impact consolidé ne doit pas être obtenu par une simple somme : le moteur doit gérer chevauchements, dépendances, incompatibilités, contraintes de capacité, délais, coûts d’exécution et effets croisés afin d’éviter le double comptage des gains.

### Formulation produit validée globalement

> Une plateforme multi-tenant de pilotage financier et stratégique qui transforme les données et hypothèses validées en budgets, consolidations, forecasts et diagnostics, puis permet de simuler, arbitrer, convertir et suivre des stratégies adaptées aux modèles économiques de chaque entreprise, avec calculs déterministes, RBAC dimensionnel et IA contrôlée.

Cette formulation est validée comme vision centrale à un niveau global. Les mécanismes détaillés restent à spécifier dans le modèle de données, les décisions d’architecture et le backlog L99.

### Référentiel BusinessModels vérifié

Source lue le 2026-08-07 : https://docs.google.com/spreadsheets/d/1CCMQTS1FnGpSAHt8f5d5TfNHNjL8PeeWbcg0cd1BwCA/edit

- Fichier : `BusinessModels`
- Onglet : `BusinessModelsPatterns`
- Contenu constaté : 56 modèles numérotés de 1 à 56
- Colonnes effectivement renseignées : 15, de `ID` à `Scalabilite_Score`

### Modèle de revenus recommandé pour la plateforme

Le modèle recommandé est hybride mais lisible :

1. **Socle — SaaS Tiered** : abonnement récurrent par tenant, mensuel ou annuel.
2. **Croissance — Pay-as-you-grow** : le prix évolue avec la complexité réellement administrée, principalement le nombre d’entités juridiques ou de périmètres consolidés.
3. **Consommation — Usage-Based borné** : dépassements ou packs pour les coûts variables mesurables tels que calculs intensifs, connecteurs premium, stockage historique et consommation IA. L’usage ne doit pas rendre la facture centrale imprévisible.
4. **Implémentation — Retainer ou frais de mise en service** : paramétrage initial, mapping comptable, reprise de données, formation et accompagnement, distincts de la licence.
5. **Canal partenaires — White Label / Portfolio** : offre dédiée aux cabinets comptables, DAF externalisés et intégrateurs gérant plusieurs tenants clients.
6. **Entreprise — contrat négocié** : groupes complexes, SSO, SLA, hébergement ou conformité spécifiques et accompagnement renforcé.

### Principes de pricing proposés

- Ne pas facturer principalement par siège : le modèle économique ne doit pas décourager la contribution budgétaire ni pousser au partage de comptes.
- Inclure la boucle complète Budget/Actual/Forecast dans tous les plans ; différencier surtout la capacité, le nombre d’entités, l’automatisation, les intégrations, la gouvernance et le niveau de service.
- Ne pas utiliser le freemium comme moteur principal : les données financières, l’onboarding et la confiance créent un coût initial important. Préférer un environnement de démonstration avec données synthétiques ou un pilote encadré.
- Ne pas adopter un success fee comme revenu principal : l’attribution d’un gain financier à une recommandation est contestable et créerait un conflit d’intérêts. Il peut rester exceptionnel dans une prestation de conseil séparée.
- Permettre un abonnement mensuel, mais favoriser contractuellement l’annuel par une remise explicite et un onboarding amorti.

### Points de comparaison vérifiés

- Cube présente des paliers Bronze/Silver/Gold, mais annonce des utilisateurs et dimensions illimités ; les différences portent notamment sur workflows, intégrations et support : https://www.cubesoftware.com/pricing
- Fathom facture principalement selon le nombre d’entreprises connectées, inclut des utilisateurs illimités et propose une offre Portfolio destinée aux cabinets : https://www.fathomhq.com/pricing

Ces précédents soutiennent le choix d’une unité de valeur centrée sur le tenant, les entités et la profondeur opérationnelle plutôt que sur le nombre brut d’utilisateurs.

## Actif produit — `30-claude-prompts-for-cf-os.md`

Fichier source lu : `C:\projets\Budget & CFO\30-claude-prompts-for-cf-os.md`

Le fichier couvre 30 cas d’usage répartis entre FP&A, trésorerie, reporting et clôture, fiscalité, conformité, risque et contrôles, M&A, allocation du capital, communication financière, ESG et transformation de la fonction finance.

### Effet sur la proposition de valeur

Cet actif élargit la cible fonctionnelle d’une plateforme budgétaire vers **Tarjih**, une plateforme complète de pilotage et d’arbitrage financier. Toutefois, les prompts bruts ne doivent pas être vendus comme fonctionnalité centrale : ils sont copiables, dépendants du contexte fourni manuellement et insuffisamment gouvernés pour des usages financiers sensibles.

Chaque prompt doit devenir une **mission financière gouvernée** comportant :

- objectif et décision attendue ;
- données requises et contrôle de disponibilité ;
- périmètre RBAC ;
- calculs déterministes préalables ;
- sources et traçabilité ;
- instructions IA versionnées ;
- sortie structurée ;
- niveau de confiance et limites ;
- validation humaine ;
- conversion éventuelle en scénario ou plan d’action ;
- mesure du résultat réellement obtenu.

### Correction nécessaire des prompts

Les calculs, ratios, échéanciers, forecasts, consolidations et impacts ne doivent pas être confiés directement au LLM comme certains prompts bruts le suggèrent. Python produit les chiffres et leurs preuves ; l’IA explique, contextualise, propose et rédige.

Les missions réglementaires, fiscales, comptables, M&A et communication externe exigent des contrôles supplémentaires, des sources datées et une validation par une personne qualifiée. Elles ne peuvent pas être présentées comme des réponses automatiquement fiables.

Le nom `Claude` ne doit pas devenir une dépendance produit. Les missions doivent être définies dans un format indépendant du fournisseur de modèle, avec adaptateurs par LLM et tests de qualité.

### Correction — les prompts sont des composants internes

Les prompts ne sont ni vendus, ni affichés, ni copiables par l’utilisateur. Ils font partie de workflows internes exécutés par la plateforme. La proposition de valeur porte sur le résultat gouverné de la mission, pas sur l’instruction utilisée pour piloter le modèle.

Les prompts internes doivent être refondus au niveau L99 avec la skill `prompt-engineer-pro` : déterminisme d’abord, sorties structurées natives, contexte borné, défense contre les injections directes et indirectes, validation des sorties, limites d’agentivité, traçabilité et golden sets d’évaluation.

## Gouvernance L99 des hypothèses

### Principe

Python calcule uniquement après validation d’hypothèses fiabilisées et vérifiables. L’IA peut proposer ou challenger une hypothèse, mais ne peut ni l’approuver, ni lui attribuer silencieusement le statut de donnée fiable, ni déclencher seule son utilisation dans un budget officiel.

### Cycle de vie obligatoire

1. **Besoin détecté** : le moteur identifie une variable requise absente ou périmée.
2. **Proposition** : l’IA, une règle métier, un import ou un utilisateur propose une valeur, une plage ou une distribution.
3. **Qualification** : type, unité, devise, période, granularité, dimension, scénario et méthode d’estimation sont explicités.
4. **Preuves** : sources internes et externes datées, observations historiques, comparables et méthode de calcul sont rattachés.
5. **Challenge indépendant** : recherche de contre-preuves, incohérences, biais, dépendances et sensibilité du modèle.
6. **Score de qualité** : complétude des preuves, récence, fiabilité des sources, dispersion et matérialité sont calculées par règles déterministes.
7. **Décision humaine** : un utilisateur habilité accepte, modifie, rejette ou demande une preuve supplémentaire.
8. **Gel de version** : l’hypothèse approuvée reçoit une version immuable, un approbateur, une date, un périmètre et une échéance de révision.
9. **Calcul** : Python accepte uniquement les versions approuvées compatibles avec le tenant, le scénario, la période et les dimensions du calcul.
10. **Observation** : le réalisé est comparé à l’hypothèse ; l’écart alimente son historique de fiabilité et la prochaine révision.

### Statuts proposés

`missing → proposed → evidenced → challenged → pending_approval → approved → active → superseded | expired | rejected`

Seuls `approved` et `active` peuvent alimenter un calcul officiel. Un mode bac à sable peut utiliser `proposed` ou `challenged`, mais ses résultats doivent être explicitement marqués comme simulation non approuvée.

### Métadonnées minimales

- identifiant et version ;
- tenant et périmètre dimensionnel ;
- variable, valeur ou distribution, unité et devise ;
- période d’effet et scénario ;
- origine : utilisateur, import, API, règle ou IA ;
- méthode d’estimation ;
- sources avec URL ou identifiant interne, date et extrait probant ;
- contre-preuves et incertitudes ;
- fourchette basse, centrale et haute lorsque pertinent ;
- sensibilité et matérialité ;
- auteur, challengers et approbateur ;
- justification de la décision ;
- date d’approbation et date d’expiration ;
- dépendances avec d’autres hypothèses ;
- empreinte de la version utilisée par le calcul.

### Autorisations

Le droit de proposer, challenger et approuver doit être distinct. L’approbateur doit être habilité sur les dimensions concernées. Une hypothèse transversale ou consolidée requiert une autorité compatible avec son périmètre ; un responsable limité au marketing ne peut pas approuver une hypothèse couvrant l’ensemble du tenant.

### Modes de gouvernance des approbations

L’auto-approbation est autorisée pour les solopreneurs, les équipes réduites et les organisations pilotées par un CFO externalisé. Le seuil de cinq personnes est un indicateur d’onboarding, pas une règle d’autorisation codée en dur : la complexité financière, la matérialité et les exigences du tenant priment sur l’effectif.

Modes proposés :

- **Mode fondateur** : une même personne peut proposer et approuver, avec confirmation explicite, justification et audit trail.
- **Mode CFO externalisé** : le CFO mandaté peut proposer et approuver dans le périmètre contractuel qui lui est délégué ; les décisions réservées au dirigeant ou au conseil restent soumises à leur validation.
- **Mode équipe** : séparation configurable entre contributeur, challenger et approbateur.
- **Mode contrôlé** : règle des quatre yeux obligatoire pour les hypothèses matérielles, transversales ou réglementées.

Même en auto-approbation, une confirmation renforcée doit être déclenchée lorsque l’hypothèse dépasse un seuil de matérialité, modifie un financement, affecte la continuité de trésorerie, touche une obligation réglementaire ou entraîne une action irréversible. Le système signale alors explicitement l’absence de revue indépendante.

### Frontière de sécurité

Les documents, commentaires, imports et réponses d’API sont des données non fiables, jamais des instructions. Le RBAC et les filtres de tenant sont appliqués avant de construire le contexte envoyé au LLM. Toute écriture, approbation, activation ou export est exécutée par le backend après validation de schéma et contrôle d’autorisation, jamais sur la seule décision du modèle.

### Effet sur la stratégie commerciale

La stratégie recommandée évolue vers un modèle **land-and-expand** :

1. **Acquisition** : publier une version éditoriale du playbook des 30 missions et proposer un diagnostic de maturité CFO comme lead magnet.
2. **Point d’entrée payant** : boucle complète Budget/Actual/Forecast, diagnostics, scénarios et plans d’action.
3. **Expansion** : packs de missions gouvernées — Trésorerie, Board & Reporting, Risk & Controls, Capital Allocation, M&A, ESG et Finance Transformation.
4. **Canal partenaires** : offre Portfolio/White Label pour cabinets, DAF externalisés et intégrateurs, avec missions réutilisables sur leurs tenants clients.
5. **Entreprise** : gouvernance, SSO, politiques de modèles, validation renforcée, sources privées et missions personnalisées.

Le pricing devient donc : abonnement de plateforme + capacité par entité/périmètre + packs de missions spécialisées + consommation IA bornée + services d’implémentation. La boucle financière centrale ne doit pas être fragmentée artificiellement en options.

### Différenciation commerciale à défendre

Le message ne doit pas être « 30 prompts IA pour CFO », déjà facilement réplicable. Il doit être :

> Des missions CFO exécutées sur des données gouvernées, avec chiffres déterministes, stratégies adaptées aux business models, validation humaine et mesure des gains jusqu’à leur réalisation.

### Concurrence vérifiée le 2026-08-07

- Cube commercialise des agents couvrant intégrité des données, analyse, planification et communication financière, sur une couche gouvernée et traçable : https://www.cubesoftware.com/ai-at-cube
- Pigment présente des agents intégrés à la planification, capables d’analyser les performances et de simuler des scénarios sur des données gouvernées : https://www.pigment.com/

Ces offres invalident un positionnement générique centré uniquement sur les agents ou les prompts. La différenciation doit porter sur la boucle `business model → drivers → diagnostic → stratégie → plan d’action → gain constaté`, l’accessibilité aux structures de toute taille et l’adaptation au contexte marocain.

## Moat Hunt anticipé

À la demande de l’utilisateur, la skill `moat-hunter` a été exécutée avant la fin du cadrage NP.

Le job universel retenu est : transformer des signaux incomplets et contradictoires en décisions coordonnées, vérifiables et révisables avant que le risque ne devienne une crise.

Conclusion : la bibliothèque des business models et les workflows CFO sont des actifs utiles mais reproductibles. Le moat potentiel réside dans une mémoire probatoire cumulative reliant hypothèses, preuves, approbations, calculs, décisions, actions et résultats observés.

Priorités issues du scoreur :

1. grade de preuve des hypothèses — 13/15 ;
2. passeport de fiabilité des sources, méthodes et hypothèses — 13/15 ;
3. flight recorder financier et débrief des décisions — 12/15 ;
4. protocole d’alerte financière gradué — 11/15 ;
5. time-out et check-back avant activation matérielle — 11/15.

Rapport complet : `docs/moat-hunt-2026-08-07.md`.

## Intégration Saqr et Bassira

Les rôles publics ont été vérifiés le 2026-08-07 : Saqr se présente comme une veille IA fondée sur X, Reddit et arXiv avec scoring LLM ; Bassira se présente comme une plateforme de prospective stratégique qui stress-teste les décisions et anticipe les réactions.

Correction structurante apportée par l’utilisateur : Saqr, Bassira et Tarjih sont des plateformes indépendantes. Saqr et Bassira sont consommables sous leurs contrats et abonnements respectifs ; aucune de leurs prestations n’est incluse implicitement dans Tarjih. L’intégration doit vérifier à la fois le RBAC de l’utilisateur et l’`entitlement` contractuel du tenant avant tout appel.

Durant les interactions, Tarjih met systématiquement en avant, de manière contextuelle, ce que Saqr et Bassira pourraient apporter à la décision. Si le tenant n’est pas abonné, aucune prestation n’est exécutée : seule une proposition de valeur avec parcours de souscription ou de prise de contact est présentée. Si le tenant est abonné, la prestation peut être déclenchée dans la limite de ses droits et avec partage minimal des données.

Architecture retenue à éprouver :

- Saqr assure principalement une veille continue — surveillance, collecte, qualification, scoring, synthèse, alertes et capitalisation — dont la recherche ponctuelle de preuves ou de signaux pour une décision constitue un mode de consommation ;
- Bassira produit des scénarios stratégiques et effets de second ordre ;
- Tarjih conserve l’autorité sur le RBAC, le registre d’hypothèses, la validation humaine et les calculs Python.

Une sortie Saqr ou Bassira ne peut jamais devenir directement une hypothèse active. Elle entre avec le statut `proposed`, accompagnée de ses preuves et incertitudes.

Le contrat Saqr `research-from-seed` est documenté et asynchrone, mais l’authentification actuelle mono-utilisateur (`x-api-key` + `x-proxy-user-id`) est incompatible avec une exposition directe aux tenants. Un broker serveur-à-serveur et un contrat multi-mandat versionné sont requis avant la production.

Spécification complète : `docs/integration-saqr-bassira.md`.

### Retour de l’utilisateur sur le processus NP

L’utilisateur considère le prompt initial suffisamment clair et ne souhaite pas répéter les éléments déjà fournis. Les questions suivantes doivent donc porter uniquement sur les inconnues structurantes qui ne peuvent pas être déduites du contenu existant.

## Direction de naming

L’appellation de travail « CFO OS » est rejetée : elle est générique, technocentrée et ne reflète ni l’identité arabe de la famille Saqr–Bassira ni la fonction réelle de la plateforme.

Le futur nom doit :

- être un terme arabe authentique dont le sens décrit réellement la plateforme ;
- couvrir la budgétisation, la modélisation, la consolidation, la simulation et l’aide à la décision, sans réduire le produit à la comptabilité ;
- rester cohérent avec Saqr et Bassira tout en désignant une plateforme indépendante ;
- être prononçable en français, en arabe et dans un environnement international ;
- réussir ultérieurement les vérifications de marque, de dénomination sociale, de domaines et de conflits commerciaux.

Décision de naming prise par l’utilisateur le 2026-08-07 :

- **nom de la plateforme : Tarjih — ترجيح** ;
- **nom de domaine officiel prévu : `tarjih-os.com`** ;
- statut du domaine : non enregistré selon la consultation RDAP Verisign effectuée le 2026-08-07, mais réservation restant à effectuer par l’utilisateur et à vérifier de nouveau au moment de l’achat ;
- « OS » appartient au domaine et peut servir de descripteur architectural, sans obligation de l’intégrer au logotype principal.

Tarjih désigne ici la mise en balance de plusieurs éléments afin de faire ressortir celui qui est le plus solide. Le nom décrit la chaîne centrale du produit : confronter des hypothèses, les documenter, calculer leurs effets et éclairer l’arbitrage humain. L’adoption du nom de produit ne remplace pas les futures recherches juridiques de disponibilité de marque, de dénomination sociale et de conflits commerciaux.

## Décision — parcours d’activation commercial

Décision validée par l’utilisateur le 2026-08-07 : Tarjih propose deux modes d’activation reposant sur le même moteur L99 et donnant accès à la même profondeur fonctionnelle.

### Activation autonome guidée

Destinée notamment aux solopreneurs, associés et équipes réduites. L’IA accompagne la configuration et propose les hypothèses, mais chaque hypothèse reste soumise à une validation explicite avant tout calcul déterministe.

### Activation assistée et facturée

Destinée notamment aux organisations, groupes, cabinets partenaires et configurations avec CFO externalisé. Elle couvre la structure organisationnelle, le RBAC, les dimensions, les business models, les imports, les règles de consolidation et les contrôles de cohérence.

### Premier résultat attendu dans les deux modes

1. modèle économique simple ou composite ;
2. données historiques importées par Excel, saisie ou API ;
3. budget et forecast déterministes ;
4. registre d’hypothèses validées ;
5. états financiers et trésorerie ;
6. ratios et arbre DuPont ;
7. première simulation de décision ;
8. plan d’action avec responsables et échéances.

La segmentation commerciale ne doit donc jamais créer une version fonctionnellement dégradée pour les petites structures. Elle différencie surtout capacité, nombre d’entités, profondeur de gouvernance, collaboration, intégrations, accompagnement et consommation des missions.

## Décision — architecture des offres

Décision validée par l’utilisateur le 2026-08-07 :

1. **Tarjih Autonome** — une entité, gouvernance légère et activation guidée ;
2. **Tarjih Collaboratif** — plusieurs contributeurs, RBAC par dimension et circuits de validation ;
3. **Tarjih Contrôlé** — multi-entités, consolidation, gouvernance renforcée, audit et intégrations ;
4. **Tarjih Portfolio** — CFO externalisés, cabinets et gestion de plusieurs tenants sous mandats séparés.

Les quatre offres conservent le moteur L99 complet. La différenciation porte sur la capacité, le nombre d’entités et de périmètres, la gouvernance, les intégrations, l’accompagnement et les volumes de missions, jamais sur l’exclusion des fonctions financières fondamentales.

## Décision — moteur commercial initial

Décision validée par l’utilisateur le 2026-08-07 :

- **Tarjih Portfolio** constitue le principal moteur commercial initial par l’intermédiaire des CFO externalisés, cabinets et partenaires capables d’apporter plusieurs tenants ;
- **Tarjih Autonome** reste disponible directement en ligne en self-service ;
- **Tarjih Collaboratif** et **Tarjih Contrôlé** suivent un parcours de vente et d’onboarding assisté ;
- cette priorité de distribution n’exclut aucun segment de la cible et ne réduit pas la profondeur L99 des autres offres.

La métrique de valeur recommandée combine entités ou dossiers actifs, profondeur de gouvernance et de consolidation, intégrations, volumes de missions et accompagnement. Le nombre d’utilisateurs ne constitue pas la métrique principale.

### Correction du pricing Portfolio

Le 2026-08-07, l’utilisateur a rejeté à juste titre une première grille trop basse, ancrée sur le coût et sur des logiciels de reporting plutôt que sur la valeur créée. Cette grille a été retirée intégralement.

Tarjih Portfolio doit être valorisé selon la capacité économique créée chez le CFO externalisé ou le cabinet : mandats supplémentaires gérables, marge par mandat, nouveaux services facturables, temps qualifié libéré, rétention et risques évités. Le modèle retenu associe une licence annuelle de console Portfolio aux abonnements autonomes de chaque tenant administré et aux services avancés. Les montants v0.1 constituent des ancres commerciales assumées, destinées à être vendues puis ajustées à partir des objections et résultats réels ; la doctrine est documentée dans `docs/pricing-hypotheses.md`.

Correction supplémentaire demandée par l’utilisateur : Tarjih a une vocation internationale. Le Maroc peut être un marché de lancement, mais ne justifie aucun coefficient de réduction, aucune division implicite par dix et aucune dévalorisation du price book mondial. Les bandes chiffrées en MAD ont été retirées. Le prix international sera fixé par la valeur et validé par marché ; la devise locale ne sert qu’à faciliter la facturation, sauf preuve indépendante justifiant une politique locale distincte.

### Price book international de lancement

À la suite d’une seconde correction de l’utilisateur — le retrait total des prix après le sous-pricing n’est pas une réponse exploitable — un price book international v0.1 est adopté comme ancre commerciale à vendre et à tester :

- Tarjih Autonome : 490 €/mois ou 4 900 €/an ;
- Tarjih Collaboratif : 1 490 €/mois ou 14 900 €/an ;
- Tarjih Contrôlé : à partir de 4 900 €/mois, engagement annuel ;
- Tarjih Portfolio : 30 000 €/an pour la console partenaire, abonnements des tenants en supplément ;
- Tarjih Portfolio White Label : à partir de 120 000 €/an, abonnements des tenants et déploiement en supplément.

Cette grille est validée par l’utilisateur le 2026-08-07. Elle constitue désormais le price book international v0.1 de Tarjih. Les tests commerciaux peuvent conduire à la maintenir, l’augmenter ou la restructurer ; toute baisse devra être justifiée par une preuve de marché et une contrepartie explicite.

Chaque entreprise cliente conserve et finance son propre tenant. Le CFO externalisé ou cabinet finance la console Portfolio et facture séparément ses honoraires humains. Cette séparation évite que Portfolio serve de contournement tarifaire et permet à Tarjih de monétiser simultanément l’infrastructure partenaire et la valeur produite pour chaque entreprise.

Le détail des capacités, activations, options de protection et règles commerciales figure dans `docs/pricing-hypotheses.md`.

## Décision — propriété du tenant et garde-fous des mandats délégués

Décision validée par l’utilisateur le 2026-08-07 : l’entreprise cliente reste propriétaire de son tenant et de ses données, y compris dans les offres Portfolio et en marque blanche. Le CFO externalisé, le cabinet ou tout autre partenaire agit exclusivement sous un mandat d’accès limité, traçable, révocable et défini par périmètre.

### Protection contre les modifications et suppressions déléguées

Les contrôles suivants s’appliquent à tout administrateur délégué, quelle que soit son appellation commerciale :

- chaque création, modification, suppression et restauration est attribuée, horodatée et versée dans un journal d’audit non modifiable par le délégataire ;
- les versions antérieures et éléments supprimés restent restaurables selon une durée de protection de 30, 60 ou 90 jours ;
- le délégataire ne peut ni réduire cette durée ni purger lui-même les éléments protégés ;
- la révocation du mandat par le tenant coupe immédiatement les nouveaux accès sans effacer l’historique ;
- les suppressions en masse exigent une authentification renforcée et l’approbation explicite d’un représentant habilité du tenant distinct de l’auteur de la demande ;
- l’auteur délégué d’une suppression en masse ne peut jamais approuver sa propre demande ;
- la demande présente avant approbation le périmètre exact, le nombre d’objets, les dépendances, les conséquences et la date de purge définitive ;
- tant que la durée de restauration n’est pas échue, l’opération reste une suppression logique réversible, jamais une destruction physique immédiate ;
- toute restauration est elle-même auditée et soumise au RBAC du tenant.

### Packaging recommandé

- **socle de sécurité inclus** : restauration pendant 30 jours pour toutes les offres, afin que la sécurité minimale ne dépende pas de la capacité à payer ;
- **protection renforcée en option** : fenêtres de 60 ou 90 jours, politiques personnalisées, approbateurs multiples, exports de preuve, alertes avancées et accompagnement de restauration ;
- la durée de conservation du journal d’audit est distincte de la fenêtre opérationnelle de restauration et devra être définie selon les obligations contractuelles et réglementaires applicables.

Cette formule — 30 jours inclus, 60/90 jours en service additionnel — est validée par l’utilisateur le 2026-08-07.

Ce mécanisme protège l’entreprise contre l’erreur, l’abus de mandat et la suppression malveillante, sans transférer la propriété des données au partenaire ni à Tarjih.
