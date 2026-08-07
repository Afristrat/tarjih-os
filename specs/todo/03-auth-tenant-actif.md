---
task_id: 03
title: Implémenter l’authentification et le tenant actif
status: pending
priority: P0
estimated_hours: 3
prd_features: [Isolation multi-tenant et RBAC dimensionnel]
archi_sections: [Authentification, Pages V1]
depends_on: [02]
project_type: web-saas
created: 2026-08-07
---

# Task 03 : Implémenter l’authentification et le tenant actif

## Acceptance criteria

- [ ] Connexion et déconnexion fonctionnent avec Supabase SSR.
- [ ] Toute page `/app` vérifie l’utilisateur côté serveur.
- [ ] Le tenant actif provient des memberships autorisés, jamais d’un identifiant libre.
- [ ] Les parcours non authentifié et membre suspendu sont testés.

## Files

- `apps/web/src/lib/supabase/` ;
- `apps/web/src/lib/auth/` ;
- `apps/web/src/app/login/` ;
- `apps/web/src/app/app/`.

## Rules

- `~/.claude/rules/supabase.md` ;
- `~/.claude/rules/typescript.md`.
