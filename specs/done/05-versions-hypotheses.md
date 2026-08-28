---
task_id: 05
title: Gérer versions et hypothèses budgétaires
status: completed
priority: P0
estimated_hours: 4
prd_features: [Cycle budgétaire gouverné de bout en bout]
archi_sections: [Invariants, Modèle de données V1, Pages V1]
depends_on: [04]
project_type: web-saas
created: 2026-08-07
---

# Task 05 : Gérer versions et hypothèses budgétaires

## Acceptance criteria

- [x] Le DAF crée une version candidate et assigne des contributions.
- [x] Un contributeur propose uniquement dans une dimension autorisée.
- [x] Le DAF accepte, modifie ou rejette avec une décision append-only.
- [x] Le contrôle optimiste empêche tout écrasement silencieux.
- [x] Une version publiée reste immuable.

### Ce qui a été prouvé, et par quoi

« Assigne des contributions » ne désigne aucune table nouvelle : l'assignation
est le grant dimensionnel de la task 04. Le DAF ouvre le cycle et la version ;
qui peut y contribuer, et sur quelle dimension, est déjà décidé par les droits
fins. Vérifié en production : un contributeur portant le seul grant Marketing
n'a vu qu'une dimension dans son formulaire, quand le DAF en voyait cinq.

Le contrôle optimiste a été éprouvé par une écriture concurrente réelle, pendant
que la page restait ouverte : la correction fondée sur la lecture périmée a été
refusée et la valeur concurrente préservée. Ce n'est pas une simulation, la
seconde écriture venait d'une session psql distincte.

L'immuabilité d'une version publiée est prouvée par les contrôles pgTAP seuls, et
non au navigateur : rien ne publie encore une version, c'est la task 07. Le garde
existe et refuse aussi bien l'ajout d'une hypothèse que sa correction ou sa
suppression — un écran ne pouvait pas l'atteindre.

La trace de recette laissée en production est indélébile par construction : la
décision est append-only et l'hypothèse est retenue par elle. Le cycle a donc été
clos plutôt qu'effacé — effacer aurait exigé de désactiver la garantie même que
cette tâche apporte.

## Files

- `apps/web/src/lib/budgets/` ;
- `apps/web/src/app/app/budgets/` ;
- `apps/web/src/app/app/hypotheses/`.

## Rules

- `~/.claude/rules/supabase.md` ;
- `~/.claude/rules/typescript.md`.
