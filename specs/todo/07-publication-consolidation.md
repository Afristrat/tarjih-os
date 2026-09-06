---
task_id: 07
title: Publier les calculs et la consolidation
status: done
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
- [x] Chaque montant renvoie au run, à la version et aux hypothèses sources.

## Files

- `apps/web/src/lib/calculation/` ;
- `apps/web/src/app/app/consolidation/` ;
- migrations/RPC Supabase nécessaires.

## Rules

- `~/.claude/rules/supabase.md` ;
- `~/.claude/rules/typescript.md`.

## Traçabilité d'un montant (2026-09-06)

`public.budget_value_sources` porte la part EXACTE de chaque hypothèse dans chaque
montant publié. Trois propriétés la rendent utilisable :

- **elle est exacte, pas arrondie** — un `numeric` sans échelle, là où le montant
  publié est un `numeric(24, 6)`. L'arrondi de la somme des parts d'un montant
  égale ce montant : le moteur le garantit (`identity_sources`) et
  `publish_calculation` le vérifie avant de valider la transaction ;
- **elle ne peut pas manquer** — l'ancienne fonction à cinq paramètres, qui
  publiait sans origine, est supprimée. Un montant sans part fait échouer la
  publication, comme une part qui ne se rattache à aucun montant ou qui cite
  l'hypothèse d'une autre version ;
- **elle ne se réécrit pas** — un trigger refuse toute mise à jour et toute
  suppression, y compris par un chemin `security definer`.

Les versions publiées AVANT cette migration ont été reconstruites par rejeu du
moteur, et seulement là où l'empreinte recalculée retrouvait
`calculation_runs.input_hash` (`scripts/reconstruire-sources.py`). Une
reconstruction sans ce témoin aurait été une reconstitution plausible, pas une
preuve.

L'écran de consolidation expose l'origine sous chaque montant.
