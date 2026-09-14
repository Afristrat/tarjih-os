---
task_id: 10
title: Déploiement Coolify et intégration continue
status: done
priority: P1
estimated_hours: 1
prd_features: [Cycle budgétaire gouverné de bout en bout]
archi_sections: [Environnements, Déploiement et secrets]
depends_on: [08, 09]
project_type: web-saas
created: 2026-08-07
completed: 2026-09-14
---

# Task 10 : Déploiement Coolify et intégration continue

Cadrée le 2026-08-07 comme « déploiement preview » sur Vercel/Railway ; ces cibles n’ont jamais existé — la production est Coolify sur `serveuria` depuis la task 02. Recadrée et close le 2026-09-14 sur la cible réelle (`specs/_source/archi.md`, « Environnements »).

## Acceptance criteria

- [x] La CI exécute lint, typecheck, tests et build — `.github/workflows/ci.yml` : web (Node 22), moteur (Python 3.13, `ruff` + `mypy --strict` + `unittest`) et base de données (chaîne complète du schéma rejouée sur `supabase/postgres:15.8.1.085`, l’image de production). Trois jobs verts sur `master`.
- [x] Aucune donnée réelle hors production — la CI part d’une base vide et n’y pose que le jeu de recette avec des mots de passe factices ; les recettes navigateur jouent sur les tenants `e2e00000-…`, synthétiques et isolés par la RLS. Il n’y a pas d’environnement de preview, et pas de besoin mesuré d’en avoir un.
- [x] Les variables secrètes restent hors du dépôt et des logs — la CI ne porte aucun secret ; les secrets applicatifs vivent dans Coolify ; les comptes de recette viennent du coffre par le broker, jamais d’une ligne de commande.
- [x] Les health checks web et calcul sont documentés — `docs/deployment-tarjih.md`, « Sondes de santé ».

## Files

- `.github/workflows/ci.yml`, `scripts/db-gates.sh`, `scripts/db-gates-cluster.sh` ;
- `docs/deployment-tarjih.md` ;
- `specs/_source/stack.md` et `archi.md` alignés sur la cible réelle.

## Rules

- `CLAUDE.md` ;
- protocole global anti-fuite des secrets.
