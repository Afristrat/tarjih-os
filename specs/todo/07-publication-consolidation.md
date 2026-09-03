---
task_id: 07
title: Publier les calculs et la consolidation
status: partial
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

- [x] Le backend construit un snapshot canonique des seules hypothèses approuvées.
- [x] L’appel de calcul est authentifié et idempotent.
- [x] La publication des valeurs est atomique.
- [x] DAF et DG consultent la consolidation ; le contributeur reste limité à son périmètre.
- [ ] Chaque montant renvoie au run, à la version et aux hypothèses sources.

## Files

- `apps/web/src/lib/calculation/` ;
- `apps/web/src/app/app/consolidation/` ;
- migrations/RPC Supabase nécessaires.

## Rules

- `~/.claude/rules/supabase.md` ;
- `~/.claude/rules/typescript.md`.

## Reste (relevé le 2026-09-03, preuve système)

Le cinquième critère n'est pas rempli. `public.budget_values` porte `calculation_run_id` et
`version_id` — donc le run et la version — mais aucune colonne ni table ne relie un montant aux
hypothèses qui l'ont produit. Le moteur calcule pourtant cette information
(`resolvers.Contribution.hypothesis_id`) et l'abandonne au moment de l'agrégation, où plusieurs
contributions se fondent en un seul triplet publiable.

Conséquence : depuis un montant publié on remonte à sa version, donc à l'ensemble de ses hypothèses
approuvées — jamais à celles de ce montant précis. Sur une version qui en porte des dizaines, cela
ne répond pas à « d'où vient ce chiffre ».
