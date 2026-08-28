# Tasks — Tarjih

Total : 10 tâches, environ 32 heures estimées. Les estimations servent au découpage technique, pas à une promesse calendaire.

| # | Titre | Priorité | Heures | Dépend | Statut |
|---:|---|:---:|---:|---|:---:|
| 01 | Initialiser l’application web | P0 | 2 | — | ✅ |
| 02 | Créer le schéma multi-tenant et les RLS | P0 | 4 | 01 | ✅ |
| 03 | Implémenter l’authentification et le tenant actif | P0 | 3 | 02 | ✅ |
| 04 | Administrer dimensions et autorisations | P0 | 4 | 03 | ✅ |
| 05 | Gérer versions et hypothèses budgétaires | P0 | 4 | 04 | ✅ |
| 06 | Construire le moteur Python déterministe | P0 | 4 | 02 | ⬜ |
| 07 | Publier les calculs et la consolidation | P0 | 4 | 05, 06 | ⬜ |
| 08 | Générer les exports soumis au RBAC | P1 | 3 | 07 | ⬜ |
| 09 | Valider le parcours vertical dans le navigateur | P0 | 3 | 07 | ⬜ |
| 10 | Préparer le déploiement preview | P1 | 1 | 08, 09 | ⬜ |

Chaque tâche doit se terminer avec lint, typecheck, tests et build sans erreur sur les fichiers concernés.
