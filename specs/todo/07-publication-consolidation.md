---
task_id: 07
title: Publier les calculs et la consolidation
status: pending
priority: P0
estimated_hours: 4
prd_features: [Cycle budgétaire gouverné de bout en bout, Consolidation et export contrôlé]
archi_sections: [Cycle de calcul, Pages V1]
depends_on: [05, 06]
project_type: web-saas
created: 2026-08-07
---

# Task 07 : Publier les calculs et la consolidation

## Acceptance criteria

- [ ] Le backend construit un snapshot canonique des seules hypothèses approuvées.
- [ ] L’appel de calcul est authentifié et idempotent.
- [ ] La publication des valeurs est atomique.
- [ ] DAF et DG consultent la consolidation ; le contributeur reste limité à son périmètre.
- [ ] Chaque montant renvoie au run, à la version et aux hypothèses sources.

## Files

- `apps/web/src/lib/calculation/` ;
- `apps/web/src/app/app/consolidation/` ;
- migrations/RPC Supabase nécessaires.

## Rules

- `~/.claude/rules/supabase.md` ;
- `~/.claude/rules/typescript.md`.
