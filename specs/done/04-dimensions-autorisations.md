---
task_id: 04
title: Administrer dimensions et autorisations
status: completed
priority: P0
estimated_hours: 4
prd_features: [Isolation multi-tenant et RBAC dimensionnel]
archi_sections: [Matrice V1, Pages V1]
depends_on: [03]
project_type: web-saas
created: 2026-08-07
---

# Task 04 : Administrer dimensions et autorisations

## Acceptance criteria

- [x] L’administrateur crée une dimension et attribue des droits fins.
- [x] L’administrateur technique ne voit aucun chiffre sans grant financier.
- [x] La révocation prend effet à la prochaine requête.
- [x] Les mutations sont auditées.

## Files

- `apps/web/src/app/app/settings/` ;
- `apps/web/src/lib/authorization/` ;
- migrations Supabase complémentaires si nécessaires.

## Rules

- `~/.claude/rules/supabase.md` ;
- `~/.claude/rules/typescript.md`.
