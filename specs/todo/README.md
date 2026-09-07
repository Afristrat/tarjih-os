# Tasks — Tarjih

Total : 10 tâches, environ 32 heures estimées. Les estimations servent au découpage technique, pas à une promesse calendaire.

| # | Titre | Priorité | Heures | Dépend | Statut |
|---:|---|:---:|---:|---|:---:|
| 01 | Initialiser l’application web | P0 | 2 | — | ✅ |
| 02 | Créer le schéma multi-tenant et les RLS | P0 | 4 | 01 | ✅ |
| 03 | Implémenter l’authentification et le tenant actif | P0 | 3 | 02 | ✅ |
| 04 | Administrer dimensions et autorisations | P0 | 4 | 03 | ✅ |
| 05 | Gérer versions et hypothèses budgétaires | P0 | 4 | 04 | ✅ |
| 06 | Construire le moteur Python déterministe | P0 | 4 | 02 | ✅ |
| 07 | Publier les calculs et la consolidation | P0 | 4 | 05, 06 | ✅ |
| 08 | Générer les exports soumis au RBAC | P1 | 3 | 07 | ✅ |
| 09 | Valider le parcours vertical dans le navigateur | P0 | 3 | 07 | ✅ |
| 10 | Préparer le déploiement preview | P1 | 1 | 08, 09 | ⬜ |

Légende : ✅ terminée · 🟨 partielle, reste identifié ci-dessous · ⬜ non commencée.

Chaque tâche doit se terminer avec lint, typecheck, tests et build sans erreur sur les fichiers concernés.

## Restes identifiés

Aucun sur les tâches terminées. La traçabilité d'un montant vers ses hypothèses
sources, dernier reste de la 07, est livrée le 2026-09-06 : voir la task pour ce
qu'elle garantit et pour le sort des versions publiées avant elle.

La **08** est close le 2026-09-07 : le filtrage d'export ne repose pas sur la RLS — celle de
`budget_values` porte sur `read` et ignore `export` — c'est donc du code applicatif qui décide
seul, et la preuve qui compte est la recette navigateur contre la production, pas l'unitaire.
Elle a d'ailleurs trouvé un classeur vide que dix contrôles verts n'avaient pas vu.

Reste la tâche non commencée : **10** (déploiement preview).

Rangement : les specs 01 à 05 vivent dans `specs/done/` avec `status: completed` ; les 06, 07,
08 et 09, terminées elles aussi, sont restées ici avec `status: done`. Le tableau ci-dessus fait
foi tant que les deux conventions coexistent.
