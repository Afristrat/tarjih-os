---
task_id: 08
title: Générer les exports soumis au RBAC
status: pending
priority: P1
estimated_hours: 3
prd_features: [Consolidation et export contrôlé]
archi_sections: [Invariants, Modèle de données V1]
depends_on: [07]
project_type: web-saas
created: 2026-08-07
---

# Task 08 : Générer les exports soumis au RBAC

## Acceptance criteria

- [ ] Le dataset est filtré côté serveur avant création du classeur.
- [ ] Le fichier ne contient aucune donnée interdite dans feuilles, formules, caches ou métadonnées.
- [ ] Empreinte, demandeur, version et périmètre sont journalisés.
- [ ] Les exports DAF/DG et contributeur sont couverts par des tests distincts.

## Files

- `services/calculation/src/tarjih_calculation/export.py` ;
- `apps/web/src/lib/exports/` ;
- tests d’export.

## Rules

- `~/.claude/rules/supabase.md` ;
- Ponytail full, sans bibliothèque Excel avant vérification de la dépendance disponible.
