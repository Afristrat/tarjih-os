---
task_id: 10
title: Préparer le déploiement preview
status: pending
priority: P1
estimated_hours: 1
prd_features: [Cycle budgétaire gouverné de bout en bout]
archi_sections: [Environnements, Déploiement et secrets]
depends_on: [08, 09]
project_type: web-saas
created: 2026-08-07
---

# Task 10 : Préparer le déploiement preview

## Acceptance criteria

- [ ] La CI exécute lint, typecheck, tests et build.
- [ ] L’environnement preview ne contient que des données synthétiques.
- [ ] Les variables secrètes restent hors du dépôt et des logs.
- [ ] Les health checks web et calcul sont documentés.

## Files

- configuration CI ;
- configurations Vercel/Railway strictement nécessaires ;
- documentation de déploiement.

## Rules

- `CLAUDE.md` ;
- protocole global anti-fuite des secrets.
