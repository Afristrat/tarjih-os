---
task_id: 05
title: Gérer versions et hypothèses budgétaires
status: pending
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

- [ ] Le DAF crée une version candidate et assigne des contributions.
- [ ] Un contributeur propose uniquement dans une dimension autorisée.
- [ ] Le DAF accepte, modifie ou rejette avec une décision append-only.
- [ ] Le contrôle optimiste empêche tout écrasement silencieux.
- [ ] Une version publiée reste immuable.

## Files

- `apps/web/src/lib/budgets/` ;
- `apps/web/src/app/app/budgets/` ;
- `apps/web/src/app/app/hypotheses/`.

## Rules

- `~/.claude/rules/supabase.md` ;
- `~/.claude/rules/typescript.md`.
