---
project_id: tarjih
project_name: Tarjih
created: 2026-08-07
status: complete
---

# PRD V1 — Tarjih

## Vision

### Problème

Un budget réparti entre plusieurs responsables devient rapidement une collection de fichiers, de versions et de validations informelles. Le DAF consolide tardivement, le DG ne voit pas toujours l’origine des chiffres et les hypothèses peuvent changer sans preuve ni responsabilité claire.

### Solution

Tarjih fournit une boucle budgétaire transactionnelle : chaque utilisateur contribue uniquement sur son périmètre, les hypothèses suivent un circuit d’approbation, Python calcule une version budgétaire déterministe et les rôles habilités consultent une consolidation traçable.

### Proposition de valeur

Tarjih transforme des contributions budgétaires dispersées en une décision financière consolidée dont chaque hypothèse, droit, calcul et approbation peut être retracé.

## Audience V1

### Persona principal : DAF d’une organisation fonctionnelle

- coordonne les contributions de plusieurs responsables ;
- doit protéger les données financières entre fonctions ;
- consolide aujourd’hui des fichiers ou exports hétérogènes ;
- engage sa responsabilité sur la cohérence du budget transmis au DG ;
- basculera si la plateforme conserve la flexibilité d’Excel tout en supprimant les consolidations et validations manuelles.

### Personas secondaires

- contributeur fonctionnel : saisit uniquement les hypothèses de sa dimension ;
- DG : consulte la consolidation, arbitre et approuve une version ;
- administrateur du tenant : attribue les rôles et périmètres.

## Fonction centrale V1

### P0 — Cycle budgétaire gouverné de bout en bout

Un contributeur propose une hypothèse sur une dimension autorisée. Le DAF l’accepte, la modifie ou la rejette. Une hypothèse approuvée déclenche un calcul Python idempotent dans une version du budget. Le DG consulte ensuite la consolidation et son historique de décision.

**Valeur utilisateur :** remplacer la chaîne fichier–e-mail–consolidation par un flux contrôlé sans perdre la responsabilité humaine.

**Critères d’acceptation :**

- aucune hypothèse non approuvée n’entre dans un calcul officiel ;
- deux exécutions sur le même snapshot produisent le même résultat et la même empreinte ;
- chaque résultat consolidé permet de retrouver les hypothèses, calculs et approbations sources.

## Fonctions de soutien V1

### P1 — Isolation multi-tenant et RBAC dimensionnel

Le système limite lecture, contribution, approbation et export selon le tenant, le rôle et les dimensions attribuées. Les contrôles sont appliqués dans la base et le backend, jamais seulement dans l’interface.

**Critères d’acceptation :** zéro lecture ou mutation inter-tenant dans les tests ; un contributeur ne reçoit aucune donnée hors périmètre, y compris dans les agrégats et exports.

### P1 — Modèle financier versionné et moteur déterministe

La V1 conserve les périodes, dimensions, comptes, scénarios, hypothèses et valeurs calculées sous forme structurée. Python exécute les formules versionnées et publie un résultat seulement après contrôles de cohérence.

**Critères d’acceptation :** exactitude de 100 % sur les jeux de calcul de référence ; aucune formule officielle exécutée par un LLM ou dans le navigateur.

### P1 — Consolidation et export contrôlé

Le DAF et le DG consultent une version consolidée selon leurs droits. L’export Excel est généré à la demande depuis un snapshot filtré côté serveur et ne contient aucune donnée interdite, même masquée.

**Critères d’acceptation :** chaque export est empreinté et journalisé ; son contenu correspond exactement au périmètre autorisé du demandeur.

## Parcours principal

```text
1. L’administrateur crée le tenant, les dimensions et les attributions.
2. Le DAF ouvre une version budgétaire et assigne les contributions.
3. Le contributeur propose une hypothèse sur sa dimension.
4. Le DAF accepte, modifie ou rejette la proposition.
5. Python calcule les valeurs issues des seules hypothèses approuvées.
6. Le DG consulte la consolidation, les écarts et la piste de décision.
7. Un utilisateur habilité génère un export limité à son périmètre.
```

## Cas limites obligatoires

- une attribution est révoquée pendant une session : la prochaine opération est refusée ;
- deux utilisateurs modifient la même hypothèse : contrôle de version, aucun écrasement silencieux ;
- un calcul échoue : aucune version partielle n’est publiée ;
- une version approuvée est modifiée : création d’une nouvelle version, jamais réécriture de l’historique ;
- un export est demandé par un responsable fonctionnel : seules ses données autorisées sont matérialisées ;
- une suppression en masse est demandée par un CFO externalisé : aucune exécution sans approbation distincte du tenant.

## Hors périmètre de la première tranche exécutable

- IA générative et 30 missions CFO : le noyau financier doit fonctionner sans elles ;
- Saqr et Bassira : les contrats d’intégration restent documentés, aucun connecteur initial ;
- les 56 business models complets : la V1 prouve le moteur extensible sur un modèle pilote ;
- DuPont à cinq niveaux et gamification : ajoutés après disponibilité de données financières fiables ;
- consolidation statutaire avancée, fiscalité multi-juridiction et normes complètes ;
- marque blanche Portfolio et facturation ;
- connecteurs ERP multiples : premier flux par import contrôlé ;
- application mobile native.

Ces exclusions ordonnent la livraison ; elles ne réduisent pas la cible L99 finale.

## Mesures de réussite V1

### Qualité système

- 100 % des tests de cloisonnement tenant et RBAC passent ;
- 100 % des calculs de référence sont exacts et reproductibles ;
- 100 % des mutations financières produisent une trace d’audit ;
- zéro publication de résultat à partir d’une hypothèse non approuvée.

### Valeur d’usage à mesurer en pilote

- un cycle de contribution–validation–calcul–consolidation est terminé sans échange de fichier ;
- le DAF peut retrouver la provenance d’un montant consolidé en moins de deux minutes ;
- le contributeur ne voit aucun montant hors de son mandat ;
- l’export d’un même snapshot est reproductible.

Les cibles de conversion, rétention et revenu ne seront fixées qu’après premiers pilotes payants ; les inventer maintenant créerait une fausse précision.

## Risques majeurs

| Risque | Impact | Réponse V1 |
|---|---|---|
| Modèle L99 trop large | retard et incohérence | tranche verticale complète avant extension |
| RBAC contourné par agrégat ou export | fuite financière | RLS, filtrage serveur et tests négatifs |
| moteur Python divergent de la base | chiffres contradictoires | snapshots immuables, versions et empreintes |
| expérience moins flexible qu’Excel | rejet utilisateur | import/export fidèle et saisie tabulaire simple |
| validation humaine de mauvaise qualité | faux sentiment de sécurité | conserver le grade de preuve et les sensibilités |

## Questions non bloquantes

- quel modèle économique pilote sert de premier jeu de formules métier ?
- quelles dimensions minimales doivent être préconfigurées sans être codées en dur ?
- quel premier format comptable d’import offre le meilleur accès aux pilotes ?
- quels rôles peuvent approuver une version finale en plus du DAF et du DG ?

## Timeline

Aucune date arbitraire n’est inscrite. La première étape est terminée lorsque la tranche verticale passe ses tests de sécurité, de calcul et de parcours navigateur ; une date commerciale ne doit pas remplacer cette définition de « terminé ».
