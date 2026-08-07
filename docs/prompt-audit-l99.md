# Audit L99 — 30 workflows CFO

## Périmètre

- Source : `C:\projets\Budget & CFO\30-claude-prompts-for-cf-os.md`
- Méthode : skill `prompt-engineer-pro`
- Date : 2026-08-07
- Statut : audit initial, avant refonte

## Verdict

Le fichier est un bon inventaire éditorial de missions CFO, mais il n’est pas exploitable en production sous sa forme actuelle. Les 30 blocs sont des prompts manuels destinés au copier-coller ; la plateforme exige au contraire des workflows internes, structurés, gouvernés, sécurisés, évaluables et indépendants du fournisseur de LLM.

Le validateur statique de la skill retourne `47/60 — 78,3 % — acceptable` sur le fichier complet. Ce résultat n’est pas retenu comme preuve de qualité : l’outil a analysé le document comme un prompt unique et ne teste ni le RBAC, ni le grounding, ni la séparation déterministe/IA, ni l’agentivité, ni l’exactitude financière.

## Défauts transversaux P0

1. Des calculs financiers exacts sont confiés au LLM.
2. Les hypothèses ne suivent aucun cycle de preuve, challenge et approbation.
3. Aucun schéma de sortie machine n’est imposé.
4. Aucun contrôle RBAC ou de cloisonnement tenant/dimension n’est défini.
5. Les pièces jointes sont traitées comme contexte, sans défense contre l’injection indirecte.
6. Les sources réglementaires, fiscales, comptables et ESG ne sont ni imposées, ni datées, ni vérifiées.
7. Les valeurs absentes ne déclenchent pas un état bloquant explicite ; le modèle peut combler les trous.
8. Aucun seuil d’agentivité, nombre maximal d’outils, timeout ou règle de confirmation n’est prévu.
9. Aucune sortie ne sépare faits, calculs, hypothèses, inférences et recommandations.
10. Aucun golden set, test adversarial, test de non-régression ou métrique de qualité n’existe.
11. Les prompts sont liés nominalement à Claude alors que le produit doit rester multi-modèle.
12. Les recommandations ne sont pas systématiquement converties en scénarios chiffrés puis en plans d’action approuvés.

## Classification des 30 missions

| ID | Mission | Déterministe obligatoire | Usage IA autorisé | Contrôle L99 dominant |
|---:|---|---|---|---|
| 1 | Budget Review & Variance | écarts, matérialité, bridges | causes candidates, narration, actions | preuves par variance |
| 2 | Driver-Based Forecast | formules, cohérence, simulations | proposition de drivers | validation des hypothèses |
| 3 | Scenario Planning | états financiers et sensibilités | scénarios candidats, narration | scénarios approuvés et versionnés |
| 4 | Management Reporting | chiffres, tableaux, KPI | résumé et talking points | traçabilité de chaque chiffre |
| 5 | 13-Week Cash Flow | calendrier et cash hebdomadaire | leviers de trésorerie | réconciliation bancaire et approbation |
| 6 | Working Capital | DSO, DPO, DIO, CCC, cash unlock | diagnostic et initiatives | benchmarks sourcés et datés |
| 7 | Credit Facilities | échéanciers, intérêts, covenants | synthèse et options | extraction vérifiée des contrats |
| 8 | FX Hedging | expositions et scénarios | options de politique | sources de marché et validation experte |
| 9 | Close Acceleration | durées, dépendances, chemin critique | redesign du processus | propriétaires et contrôles internes |
| 10 | Accounting Memo | écritures et tests de cohérence | analyse et rédaction | RAG officiel, citations, validation qualifiée |
| 11 | MD&A | chiffres et variations | narration | revue juridique et IR |
| 12 | PBC Tracker | échéances, statuts, complétude | catégorisation et risques | autorisations documentaires |
| 13 | Effective Tax Rate | réconciliation et simulations | opportunités candidates | fiscalité sourcée et validation qualifiée |
| 14 | Transfer Pricing | matrices et contrôles | analyse des risques | sources officielles actuelles |
| 15 | Regulatory Change | échéances et applicability tests | synthèse et plan | vigueur et juridiction vérifiées |
| 16 | Enterprise Risk Register | scores et agrégations | identification et formulation | approbation des propriétaires de risque |
| 17 | Control Gap Analysis | matrice et couverture | détection de lacunes | confidentialité et revue contrôle interne |
| 18 | Fraud & Anomaly | tests analytiques | scénarios de fraude et priorisation | faux positifs, confidentialité, escalade |
| 19 | Target Screening | scoring et filtres | critères et synthèse | sources M&A et conflits d’intérêts |
| 20 | Quality of Earnings | ajustements, bridges, BFR | identification de red flags | preuves et validation transactionnelle |
| 21 | Capital Allocation | WACC, VAN, TRI, contraintes | principes et arbitrages candidats | hypothèses de coût du capital |
| 22 | Post-Merger Integration | jalons et dépendances | planification et risques | validation des responsables |
| 23 | Earnings Call | chiffres et cohérence guidance | script et Q&A | revue IR/juridique obligatoire |
| 24 | Board Pre-Read | tableaux et indicateurs | synthèse et questions | RBAC conseil et traçabilité |
| 25 | Shareholder Letter | chiffres et comparatifs | rédaction | revue juridique et communication externe |
| 26 | ESG Readiness | scorecard et gaps | synthèse et roadmap | référentiel en vigueur et assurance |
| 27 | Carbon Accounting | calculs d’émissions | catégorisation des sources | facteurs d’émission versionnés |
| 28 | Finance Transformation | coûts, séquencement, KPI | roadmap et dépendances | business case approuvé |
| 29 | Pricing & Margin Defense | décomposition PVM/FX/coûts | actions tarifaires candidates | simulations, élasticité, contrats |
| 30 | Finance AI Strategy | scoring et portefeuille | vision et priorisation | gouvernance IA et ROI vérifiable |

## Architecture cible commune

Chaque mission doit être compilée à partir de blocs communs plutôt que réécrite comme un méga-prompt indépendant :

1. politique système immuable ;
2. contexte tenant déjà filtré par le backend ;
3. contrat de mission versionné ;
4. registre d’hypothèses et preuves autorisées ;
5. résultats déterministes signés par le moteur Python ;
6. données non fiables balisées comme données, jamais comme instructions ;
7. sortie JSON conforme à un schéma natif ;
8. validation backend de la sortie ;
9. étape humaine obligatoire selon la matérialité et le risque ;
10. journal d’audit et métriques d’évaluation.

## Techniques retenues

- **Deterministic-first** : tout calcul testable par assertion reste dans Python.
- **Prompt chaining** : collecte/contrôle → proposition → vérification → synthèse → action.
- **Chain-of-Verification** : questions de vérification indépendantes et recherche de contre-preuves.
- **Structured outputs** : JSON Schema natif et validation serveur.
- **Hardening niveau 3** : données financières, outils d’écriture, confirmation humaine et limites d’agentivité.
- **Golden sets** : cas normaux, incomplets, contradictoires, adversariaux et inter-tenant.

## Refonte v1 réalisée

La première refonte de production est matérialisée par les artefacts suivants :

- `prompts/runtime/system.md` : politique commune immuable ;
- `prompts/runtime/mission-request.md` : gabarit d’assemblage des données variables ;
- `prompts/missions/catalog.json` : 30 contrats de mission versionnés ;
- `schemas/mission-contract.schema.json` : contrat machine d’une mission ;
- `schemas/hypothesis-proposal.schema.json` : contrat d’une hypothèse proposée ;
- `schemas/mission-output.schema.json` : enveloppe de sortie traçable ;
- `evals/runtime-golden-set.json` : cas nominaux, limites, critiques et adversariaux ;
- `scripts/validate_prompt_artifacts.py` : contrôle statique minimal exécutable.

Le fichier d’origine reste intact comme source éditoriale. Il ne doit pas être exécuté directement en production.

## Vérifications du 2026-08-07

- 30 contrats présents, identifiants continus `M01` à `M30` ;
- 30/30 contrats conformes au JSON Schema ;
- trois schémas JSON valides en draft 2020-12 ;
- runtime et golden set conformes aux invariants statiques ;
- politique système évaluée par le validateur de `prompt-engineer-pro` à `59/60`, soit `98,33 %`.

Ces contrôles prouvent la cohérence statique des artefacts, pas la qualité réelle d’un fournisseur LLM. La mise en production reste conditionnée à l’exécution du golden set sur les modèles retenus, à des tests inter-tenant et à une revue sécurité.
