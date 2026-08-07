---
project_id: tarjih
project_name: Tarjih
created: 2026-08-07
---

# Discovery — Tarjih

## Problème / besoin

Les organisations pilotent encore fréquemment leur budget au moyen de fichiers Excel distribués, d’échanges par e-mail, d’exports comptables et de consolidations manuelles. Elles manquent d’une boucle continue reliant hypothèses vérifiables, Budget, Actual, Forecast, consolidation, analyse des écarts, simulations et plans d’action.

Tarjih doit remplacer cette fragmentation par une source de vérité multi-tenant, des calculs Python déterministes et une gouvernance explicite des contributions, validations et décisions.

## Utilisateurs cibles

- solopreneurs et équipes de moins de cinq personnes ayant déjà une complexité financière réelle ;
- organisations fonctionnelles dont les responsables contribuent uniquement sur leurs dimensions autorisées ;
- DAF et DG responsables de la consolidation et de l’arbitrage ;
- groupes multi-entités ;
- CFO externalisés et cabinets administrant plusieurs tenants sous mandats séparés et révocables.

La V1 doit prouver un parcours complet pour une organisation, avec au minimum trois profils : contributeur dimensionnel, DAF et DG.

## Contraintes

- niveau de qualité cible : L99 de bout en bout, sans sacrifier l’ordre de livraison ;
- données financières strictement isolées par tenant ;
- RBAC au niveau des dimensions, mesures, périodes, scénarios et entités ;
- aucun calcul financier officiel confié au LLM ;
- validation humaine préalable de toute hypothèse proposée par l’IA ;
- imports et exports Excel contrôlés côté serveur ;
- vocation internationale, avec localisation marocaine comme premier contexte fonctionnel et non comme plafond commercial ;
- budget, délai de V1 et infrastructure disponible non encore fixés ; ils ne sont pas inventés.

## Prior art et fonctionnement actuel

Le substitut principal déclaré est un assemblage de classeurs Excel, e-mails, exports comptables et consolidation manuelle. Le classeur `Budget_Performance_Maroc_L99.xlsx` matérialise une partie du modèle cible, mais ne fournit ni collaboration transactionnelle, ni isolation multi-tenant, ni RBAC serveur, ni piste de validation complète.

Des logiciels FP&A existent sur le marché, mais l’étude concurrentielle produit par produit reste à réaliser avant de figer un positionnement comparatif. Tarjih ne doit donc pas prétendre à une différenciation non encore démontrée.

## Job to Be Done

Quand une organisation prépare ou révise son plan financier, elle veut distribuer les contributions selon les responsabilités, valider des hypothèses explicites et consolider des résultats exacts, afin de décider et d’agir sans perdre la traçabilité entre données, hypothèses, calculs et résultats observés.

## Signaux établis et hypothèses à valider

### Signaux établis dans le cadrage

- le produit doit couvrir la boucle Budget, Actual et Forecast ;
- le nombre de salariés n’est pas un critère suffisant de complexité ;
- chaque entreprise reste propriétaire de son tenant ;
- le CFO externalisé agit sous mandat et ne possède pas les données du client ;
- la rétention doit provenir de la valeur cumulative, pas d’un blocage des exports.

### Hypothèses commerciales encore non prouvées

- le canal Portfolio est le meilleur moteur d’acquisition initial ;
- les offres et prix validés produisent un taux de conversion acceptable ;
- les utilisateurs adopteront une plateforme transactionnelle à la place de leur classeur vivant ;
- le niveau de profondeur L99 peut être rendu accessible sans onboarding excessif.

Ces hypothèses exigent des preuves de marché et ne doivent pas être confondues avec des exigences produit.

## Insight de construction

Le premier incrément ne doit pas être un dashboard décoratif ni une reproduction complète du classeur. Il doit prouver la chaîne d’autorité la plus risquée : un contributeur saisit une hypothèse sur une dimension autorisée, un DAF la valide, Python recalcule un budget versionné et un DG consulte la consolidation. Si cette chaîne n’est pas sûre et exacte, aucune couche IA, simulation avancée ou connecteur externe ne peut compenser le défaut.
