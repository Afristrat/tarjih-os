---
task_id: 10
title: Préparer le déploiement preview
status: in_progress
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

- [x] La CI exécute lint, typecheck, tests et build — `.github/workflows/ci.yml` (2026-09-14) : web (Node 22), moteur (Python 3.13, `ruff` + `mypy --strict` + `unittest`) et base de données (chaîne complète du schéma rejouée sur `supabase/postgres:15.8.1.085`, l’image de production).
- [ ] L’environnement preview ne contient que des données synthétiques. **À recadrer avant de coder** : la production est Coolify sur `serveuria`, pas Vercel/Railway ; un preview suppose soit une seconde stack Supabase, soit les tenants de recette `e2e00000-…` déjà en production. Choix d’infrastructure à trancher par Amine.
- [x] Les variables secrètes restent hors du dépôt et des logs — la CI ne porte aucun secret (les recettes Playwright, qui en demandent, restent hors CI) ; le jeu de recette lit les mots de passe depuis le coffre à l’exécution.
- [ ] Les health checks web et calcul sont documentés — `/health` web dans `docs/deployment-tarjih.md` ; le `HEALTHCHECK` du moteur n’est documenté que dans son `Dockerfile`.

## Files

- configuration CI ;
- configuration Coolify strictement nécessaire (la cible réelle ; `specs/_source/stack.md` cite encore Vercel/Railway) ;
- documentation de déploiement.

## Rules

- `CLAUDE.md` ;
- protocole global anti-fuite des secrets.
