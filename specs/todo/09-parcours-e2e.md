---
task_id: 09
title: Valider le parcours vertical dans le navigateur
status: done
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

- [x] Playwright couvre contributeur → DAF → calcul → DG.
- [x] Un test négatif tente un accès inter-tenant et échoue sans fuite d’existence.
- [x] Un test prouve qu’une hypothèse proposée n’est jamais calculée.
- [x] Le navigateur ne présente aucune erreur console sur le parcours.

## Files

- `apps/web/e2e/` ;
- configuration Playwright.

## Rules

- `~/.claude/rules/typescript.md` ;
- `CLAUDE.md`.

## Comment la lancer

La recette vise le domaine **déployé**, jamais un serveur local (SOP-011). Les mots de passe des
quatre comptes vivent au coffre ; le broker les injecte le temps de l'exécution :

```powershell
& 'C:\Users\amans\.claude\scripts\invoke-secret.ps1' -TimeoutSec 900 `
  -Keys TARJIH_E2E_PW_CONTRIB,TARJIH_E2E_PW_DAF,TARJIH_E2E_PW_DG,TARJIH_E2E_PW_INTRUS `
  -Command 'Set-Location "C:\projets\Budget & CFO\apps\web"; node ./node_modules/playwright/cli.js test'
```

`E2E_BASE_URL` surcharge l'adresse le jour où un environnement de preview existera.

Le jeu de comptes se (re)pose avec `supabase/seed/e2e-recette.sql`, dont les marqueurs de mot de
passe sont remplacés au moment de l'exécution depuis le coffre. Il est réexécutable : chaque
passage réécrit les mots de passe et ne duplique rien.
