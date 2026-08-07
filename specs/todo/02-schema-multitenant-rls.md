---
task_id: 02
title: Créer le schéma multi-tenant et les RLS
status: pending
priority: P0
estimated_hours: 4
prd_features: [Isolation multi-tenant et RBAC dimensionnel]
archi_sections: [Modèle de données V1, Contraintes de base, Autorisation PostgreSQL]
depends_on: [01]
project_type: web-saas
created: 2026-08-07
---

# Task 02 : Créer le schéma multi-tenant et les RLS

## Acceptance criteria

- [ ] Une migration crée les tables V1, contraintes, fonctions privées et index.
- [ ] RLS est activée sur chaque table exposée.
- [ ] Les tests SQL prouvent l’isolation inter-tenant et le refus par défaut.
- [ ] Audit et décisions ne peuvent être modifiés ou supprimés par un utilisateur applicatif.

## Files

- `supabase/migrations/` — schéma versionné ;
- `supabase/tests/` — tests RLS négatifs et positifs.

## Rules

- `~/.claude/rules/supabase.md` ;
- `specs/_source/archi.md`.
