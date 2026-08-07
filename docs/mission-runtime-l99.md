# Runtime commun des missions L99 de Tarjih

## Décision d’architecture

Les 30 prompts d’origine deviennent 30 contrats de mission déclaratifs. Ils ne sont ni montrés ni vendus à l’utilisateur. Le backend assemble une mission à partir d’un noyau immuable, du contexte autorisé, du contrat métier et des résultats déterministes disponibles.

Le LLM ne reçoit jamais un accès général au tenant. Le backend fabrique un snapshot minimal, filtré selon le tenant, l’utilisateur, les dimensions, les mesures, les périodes, les scénarios et la finalité de la mission. La sécurité ne dépend donc pas de l’obéissance du modèle.

## Chaîne d’exécution

```text
Demande utilisateur
  → résolution RBAC + entitlements
  → snapshot autorisé et immuable
  → contrôle déterministe des entrées
  → proposition IA d’hypothèses
  → validation humaine habilitée
  → calcul Python versionné
  → contrôles et réconciliations
  → interprétation IA des résultats signés
  → revue humaine selon le risque
  → plan d’action approuvé
  → mesure des résultats observés
```

## Composants obligatoires d’un appel

1. `system_policy_version` : version du noyau commun.
2. `authorization_context` : identifiant opaque, jamais des règles inventées par le modèle.
3. `mission_contract` : configuration issue du catalogue des 30 missions.
4. `input_snapshot` : données minimales, horodatées et empreintées.
5. `evidence_pack` : preuves autorisées, sourcées et datées.
6. `approved_hypotheses` : uniquement les versions effectivement approuvées.
7. `calculation_results` : résultats Python avec version et empreinte.
8. `output_schema` : schéma JSON natif imposé par l’API du fournisseur.

Les données variables sont placées après le préfixe stable afin de permettre le cache de prompts sans mélanger les tenants.

## États et portes

| État | Condition | Opération suivante autorisée |
|---|---|---|
| `blocked` | entrée, droit, preuve ou cohérence insuffisante | demander les éléments précis manquants |
| `awaiting_human_validation` | au moins une hypothèse reste proposée | recueillir une décision humaine habilitée |
| `ready_for_deterministic_calculation` | hypothèses requises approuvées | lancer un calcul Python idempotent |
| `analysis_complete` | résultats signés disponibles et risque ordinaire | proposer un plan d’action |
| `human_review_required` | livrable externe ou domaine réglementé | obtenir la revue qualifiée prévue |

Le backend refuse toute transition qui saute une porte. Le modèle ne choisit jamais son propre niveau d’autorité.

## Séparation IA / Python

Relèvent obligatoirement de Python : agrégations, écarts, seuils, ratios, calendriers, intérêts, covenants, conversions de devises, consolidations, éliminations, scénarios, sensibilités, DuPont, PVM, DSO/DPO/DIO/CCC, cash-flow, VAN, TRI, WACC, rapprochements, scorecards et contrôles d’identité comptable.

Relèvent de l’IA sous contrôle : extraction candidate, formulation d’hypothèses, recherche de contradictions, interprétation des résultats, génération d’options, narration adaptée au lecteur et transformation d’une option retenue en plan d’action proposé.

## Human-in-the-loop

La validation d’une hypothèse enregistre au minimum : auteur de la proposition, valeur et unité, périmètre, période, preuves, contre-preuves, incertitudes, approbateur, décision, justification, horodatage, version et empreinte.

Les revues qualifiées sont obligatoires pour les domaines comptables, fiscaux, réglementaires, ESG, audit, financement, couverture, M&A et communication externe. La mission peut préparer le travail ; elle ne remplace pas la responsabilité professionnelle.

## Saqr et Bassira

Le runtime expose des emplacements optionnels pour `evidence_pack` et `scenario_pack`. Ils ne sont renseignés qu’après contrôle simultané de l’abonnement, du consentement, du RBAC et de la minimisation. Leurs contenus restent des données non fiables et ne deviennent jamais automatiquement des hypothèses approuvées.

## Contrôles de production

- JSON Schema natif, puis validation serveur indépendante.
- Refus de toute clé supplémentaire.
- Identifiants recopiés depuis le contexte et vérifiés par le backend.
- Calcul Python idempotent, versionné, réconcilié et empreinté.
- Aucun outil d’écriture exposé au modèle.
- Limites d’appels, de taille, de durée et de répétition fixées par mission.
- Journaux minimisés : identifiants, décisions d’autorisation, versions, empreintes et métriques ; pas de payload financier complet.
- Tests inter-tenant, injections directes et indirectes, données manquantes, contradictions, résultats non signés et tentatives de saut d’approbation.

## Point de challenge

La simple validation humaine ne fiabilise pas une mauvaise hypothèse : elle peut seulement officialiser une erreur. Tarjih doit donc distinguer l’approbation de la qualité probatoire. Une hypothèse approuvée avec preuve faible reste étiquetée comme telle, et sa sensibilité doit être simulée. C’est cette mémoire probatoire — proposition, preuve, décision, calcul et résultat observé — qui constitue le cœur défendable du produit.
