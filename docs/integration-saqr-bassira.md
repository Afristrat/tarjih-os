# Intégration Saqr × Bassira × Tarjih

## Statut

- Date : 2026-08-07
- Nature : architecture conceptuelle vérifiée contre les interfaces documentées de Saqr
- Mutation de Saqr/Bassira : aucune, lecture seule stricte
- Limite : aucun contrat API Bassira n’a été vérifié dans cette session ; il reste à formaliser dans la session propriétaire de Bassira

## Indépendance commerciale et contractuelle

Saqr, Bassira et Tarjih sont trois plateformes indépendantes. Tarjih ne les embarque pas implicitement dans son abonnement et ne revendique ni leurs fonctionnalités ni leurs données comme des capacités natives.

- chaque plateforme conserve son propre contrat, son abonnement, ses conditions d’utilisation, sa facturation et son support ;
- une prestation Saqr ou Bassira n’est exécutée que si le tenant dispose du droit contractuel correspondant ;
- l’activation de l’intégration est explicite et révocable ;
- la souscription à une plateforme n’autorise jamais automatiquement le partage de données avec une autre ;
- Tarjih contrôle les habilitations techniques d’intégration, mais Saqr et Bassira restent responsables de leurs prestations respectives.

Pendant les interactions de l’utilisateur, Tarjih met systématiquement en évidence l’apport pertinent de Saqr et de Bassira. Cette mise en avant reste contextuelle : elle indique ce que chaque plateforme pourrait apporter à la décision en cours, l’état de l’abonnement et l’action disponible. Sans souscription, aucun appel n’est exécuté ; l’utilisateur voit une proposition de valeur et un parcours de souscription ou de prise de contact. Avec souscription, il peut lancer la prestation dans la limite de ses droits.

Quatre configurations doivent donc être supportées sans dégrader le cœur de Tarjih :

1. Tarjih seul ;
2. Tarjih avec Saqr ;
3. Tarjih avec Bassira ;
4. Tarjih avec Saqr et Bassira.

## Rôles non négociables

### Saqr — Veille et intelligence informationnelle

Saqr assure avant tout une veille continue : surveillance de sources et de thèmes, collecte, qualification, scoring, synthèse, détection d’évolutions, alertes et capitalisation. La recherche ponctuelle de signaux ou de preuves pour une décision n’est qu’un mode de consommation de cette veille. Saqr fournit des éléments informationnels candidats, leur provenance, leur fraîcheur, leur qualité et leurs limites.

Saqr ne doit jamais :

- approuver une hypothèse du tenant ;
- accéder au budget complet d’un tenant ;
- calculer les états financiers ;
- transformer automatiquement un signal en hypothèse active ;
- recevoir des données confidentielles inutiles à la recherche.

### Bassira — Strategic Foresight

Bassira stress-teste une décision : parties prenantes, réactions possibles, effets de second ordre, scénarios adverses, signaux précurseurs et conditions d’invalidation.

Bassira ne doit jamais :

- produire le chiffre financier officiel ;
- modifier une hypothèse approuvée ;
- exécuter une action métier ;
- présenter une projection stratégique comme un fait ;
- contourner le RBAC de Tarjih.

### Tarjih — autorité de décision financière

Tarjih reste :

- la source de vérité des données financières ;
- le registre des hypothèses et preuves ;
- le moteur Python déterministe ;
- l’autorité RBAC ;
- l’orchestrateur des validations ;
- le système de suivi des décisions et gains observés.

## Boucle cible

1. Un utilisateur ouvre un `decision_case`.
2. Tarjih identifie les hypothèses manquantes ou fragiles.
3. Le backend applique RBAC, minimisation et classification des données.
4. Si le tenant est abonné à Saqr et a activé l’intégration, Tarjih interroge la veille existante ou déclenche une recherche complémentaire désensibilisée.
5. Saqr retourne un `evidence_pack` issu de la veille, éventuellement enrichi par une recherche à la demande, avec sources, signaux, alertes, synthèses, audit et télémétrie.
6. Tarjih vérifie les URLs, dates, doublons, périmètres et grades de preuve.
7. Si le tenant est abonné à Bassira et a activé l’intégration, Bassira reçoit un `decision_brief` contenant uniquement le contexte autorisé et les preuves vérifiées.
8. Bassira retourne un `scenario_pack` : scénarios, acteurs, réactions, causalités, déclencheurs et contre-arguments.
9. Ces éléments deviennent des hypothèses `proposed`, jamais `approved`.
10. Un humain habilité accepte, modifie ou rejette chaque hypothèse.
11. Python simule exclusivement les hypothèses approuvées.
12. Bassira peut interpréter les résultats déterministes et proposer des stratégies.
13. Le décideur effectue le time-out, arbitre et approuve le plan d’action.
14. Tarjih compare ensuite gains attendus et résultats observés.
15. Un feedback agrégé et non confidentiel peut améliorer la fiabilité des sources et méthodes.

## Orchestration selon les souscriptions

Tarjih maintient un registre d’`entitlements` séparé du RBAC métier. Le RBAC répond à « quelles données cet utilisateur peut-il voir ou transmettre ? » ; l’`entitlement` répond à « quelles prestations le tenant a-t-il contractuellement le droit de consommer ? ». Les deux contrôles sont obligatoires avant tout appel.

| Souscription active | Parcours exécuté | Mise en avant pendant l’interaction |
|---|---|---|
| Aucune | Hypothèses internes → validation → Python | Apport potentiel de Saqr et de Bassira, sans appel externe |
| Saqr | Veille/preuves Saqr → validation → Python | Apport complémentaire de Bassira pour le stress-test stratégique |
| Bassira | Contexte autorisé → scénarios Bassira → validation → Python | Apport complémentaire de Saqr pour étayer les hypothèses |
| Saqr + Bassira | Veille Saqr → scénarios Bassira → validation → Python | Valeur produite par chaque plateforme et consommation contractuelle |

La mise en avant systématique ne doit pas devenir une bannière publicitaire répétitive. Elle prend la forme d’une carte contextuelle attachée à la décision : lacune informationnelle détectée, apport attendu, provenance du service, statut contractuel, coût ou quota connu et consentement requis.

## Architecture

```text
Sources externes
      ↓
     Saqr
      ↓ evidence_pack
Evidence Gateway de Tarjih
      ↓ preuves vérifiées
   Bassira
      ↓ scenario_pack
Registre d’hypothèses
      ↓ validation humaine
Moteur Python déterministe
      ↓ impacts financiers
Bassira — interprétation stratégique
      ↓
Plan d’action approuvé
      ↓
Réalisé et calibration
```

## Contrat Saqr déjà documenté

Le point d’entrée pertinent est `research-from-seed` :

- `POST` asynchrone avec `seed`, langue, secteur, profondeur, profil de sortie et clé d’idempotence ;
- réponse `202` avec `session_id` ;
- polling `GET` jusqu’à `completed` ou `failed` ;
- résultat comprenant stratégie de recherche, topics, signaux, audit qualité, avertissements culturels, qualité de scoring et télémétrie.

Source locale lue : `C:\projets\Saqr\docs\bridges\prompt-integration-bassira-miroshark.md`.

## Blocage Saqr avant production

L’interface documentée actuelle de Saqr est mono-utilisateur et repose sur `x-api-key` plus `x-proxy-user-id`. Elle ne doit pas être exposée directement aux tenants de Tarjih.

Une intégration de production exige un broker serveur-à-serveur qui :

- authentifie le service appelant ;
- ne fait jamais confiance à un `tenant_id` fourni par le client ;
- applique une politique de finalité et de minimisation ;
- génère une clé d’idempotence ;
- associe la requête à un `decision_case_id` opaque ;
- journalise accès, coût, version du contrat et résultat ;
- filtre et valide les sorties avant stockage ;
- empêche tout retour de données entre tenants.

À terme, Saqr doit exposer un contrat de consommation multi-mandat versionné, mais son corpus externe partagé ne doit contenir aucune donnée budgétaire confidentielle des tenants.

## Contrats de données proposés

### `research_request`

- `decision_case_id` opaque ;
- `research_question` désensibilisée ;
- `sector` et géographie ;
- `time_horizon` ;
- catégories de sources autorisées ;
- exigences de fraîcheur ;
- niveau minimal de fiabilité ;
- langue ;
- clé d’idempotence.

### `evidence_pack`

- `evidence_id` ;
- affirmation testée ;
- URL ou identifiant de source ;
- date de publication et date de collecte ;
- extrait probant ;
- fiabilité de la source ;
- crédibilité du contenu ;
- incertitude ;
- preuves contradictoires ;
- périmètre géographique et sectoriel ;
- avertissements et limites ;
- empreinte du contenu ;
- version du pipeline Saqr.

### `decision_brief` pour Bassira

- décision à stress-tester ;
- options envisagées ;
- business models actifs ;
- objectifs et contraintes ;
- horizon ;
- parties prenantes connues ;
- hypothèses proposées et grades de preuve ;
- résultats déterministes disponibles ;
- données explicitement interdites ;
- profondeur de simulation autorisée.

### `scenario_pack`

- scénario et logique causale ;
- acteurs et réactions possibles ;
- effets de premier, deuxième et troisième ordre ;
- hypothèses nécessaires ;
- déclencheurs observables ;
- signaux d’invalidation ;
- risques et opportunités ;
- éléments de preuve utilisés ;
- incertitude et limites ;
- actions candidates ;
- questions restant sans réponse.

## Sécurité et gouvernance

- Les appels sont exclusivement serveur-à-serveur ; aucune clé Saqr/Bassira n’atteint le navigateur.
- Tarjih filtre le contexte avant chaque appel selon tenant, utilisateur, dimension, mesure et finalité.
- Les documents et contenus externes sont balisés comme données non fiables afin de neutraliser les injections indirectes.
- Chaque sortie passe une validation JSON Schema et des contrôles déterministes.
- Les hypothèses générées restent `proposed` jusqu’à approbation humaine.
- Une recommandation Bassira ne peut déclencher directement aucune écriture, export ou action.
- Les logs ne contiennent pas les payloads financiers complets ; ils conservent identifiants, empreintes, décisions d’autorisation et métriques.
- Le feedback vers Saqr porte sur la qualité des sources et signaux, jamais sur les chiffres confidentiels du tenant.

## Proposition de valeur combinée, sans fusion des produits

> Saqr maintient la veille sur ce qui change dans le monde et peut documenter une décision ; Bassira explore ce que cette décision pourrait provoquer ; Tarjih décide quelles hypothèses sont recevables, calcule leurs effets exacts et mesure les résultats réels. Chaque prestation reste fournie sous le contrat propre de la plateforme concernée.

## Risque stratégique

Si les trois produits ne font que s’appeler sans partager une boucle d’apprentissage gouvernée, l’intégration est une simple feature. Elle devient un moat seulement si la fiabilité des sources, la qualité des scénarios, les décisions et les résultats observés améliorent progressivement les futures analyses, sans compromettre l’isolation des tenants.
