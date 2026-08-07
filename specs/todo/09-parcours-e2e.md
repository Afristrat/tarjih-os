---
task_id: 09
title: Valider le parcours vertical dans le navigateur
status: pending
priority: P0
estimated_hours: 3
prd_features: [Cycle budgétaire gouverné de bout en bout, Isolation multi-tenant et RBAC dimensionnel]
archi_sections: [Pipeline de validation]
depends_on: [07]
project_type: web-saas
created: 2026-08-07
---

# Task 09 : Valider le parcours vertical dans le navigateur

## Acceptance criteria

- [ ] Playwright couvre contributeur → DAF → calcul → DG.
- [ ] Un test négatif tente un accès inter-tenant et échoue sans fuite d’existence.
- [ ] Un test prouve qu’une hypothèse proposée n’est jamais calculée.
- [ ] Le navigateur ne présente aucune erreur console sur le parcours.

## Files

- `apps/web/e2e/` ;
- configuration Playwright.

## Rules

- `~/.claude/rules/typescript.md` ;
- `CLAUDE.md`.
