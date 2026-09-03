---
task_id: 06
title: Construire le moteur Python déterministe
status: done
priority: P0
estimated_hours: 4
prd_features: [Modèle financier versionné et moteur déterministe]
archi_sections: [Cycle de calcul]
depends_on: [02]
project_type: api-backend
created: 2026-08-07
---

# Task 06 : Construire le moteur Python déterministe

## Acceptance criteria

- [x] Le cœur de calcul est une fonction pure recevant un snapshot typé.
- [x] Deux exécutions identiques produisent le même résultat et la même empreinte.
- [x] Les hypothèses non approuvées sont rejetées.
- [x] Les contrôles d’identité financière bloquent toute sortie incohérente.
- [x] Les tests n’utilisent que des données fictives.

## Files

- `services/calculation/pyproject.toml` ;
- `services/calculation/src/tarjih_calculation/` ;
- `services/calculation/tests/`.

## Rules

- Ponytail full : cœur pur avant FastAPI ;
- `specs/_source/archi.md`.
