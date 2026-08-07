---
task_id: 01
title: Initialiser l’application web
status: completed
priority: P0
estimated_hours: 2
prd_features: [Cycle budgétaire gouverné de bout en bout]
archi_sections: [Structure des dossiers, Pages V1, Pipeline de validation]
depends_on: []
project_type: web-saas
created: 2026-08-07
---

# Task 01 : Initialiser l’application web

## Acceptance criteria

- [x] Next.js fonctionne dans `apps/web` avec TypeScript strict, App Router, Tailwind et ESLint.
- [x] Les commandes `lint`, `typecheck`, `test` et `build` existent et passent.
- [x] La page d’accueil explique la première tranche Tarjih sans prétendre que les fonctions différées existent.
- [x] Un test minimal vérifie le contenu du cœur de page, complété par une validation navigateur desktop et mobile.

## Requirements

- utiliser l’initialiseur officiel stable ;
- ne pas ajouter de bibliothèque UI, de grille, d’état ou d’IA ;
- configurer le workspace npm racine uniquement si nécessaire aux commandes communes.

## Files

- `package.json` — commandes du dépôt ;
- `apps/web/` — application Next.js ;
- `apps/web/src/app/page.tsx` — première page produit.

## Rules

- `~/.claude/rules/typescript.md` ;
- `CLAUDE.md` ;
- Ponytail full.
