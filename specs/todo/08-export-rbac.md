---
task_id: 08
title: Générer les exports soumis au RBAC
status: done
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

- [x] Le dataset est filtré côté serveur avant création du classeur.
- [x] Le fichier ne contient aucune donnée interdite dans feuilles, formules, caches ou métadonnées.
- [x] Empreinte, demandeur, version et périmètre sont journalisés.
- [x] Les exports DAF/DG et contributeur sont couverts par des tests distincts.

## Files

- ~~`services/calculation/src/tarjih_calculation/export.py`~~ — **écart assumé, ce fichier
  n'existe pas.** Le moteur Python ne reçoit aucun contexte utilisateur (`archi.md`) : il ne peut
  donc pas filtrer selon un périmètre, et son cœur est tenu à zéro dépendance. Toute la génération
  vit côté web, où l'identité du demandeur est connue ;
- `apps/web/src/lib/exports/` — `scope.ts` (périmètre et `scope_hash`), `workbook.ts` (classeur
  déterministe) ;
- `apps/web/src/app/api/exports/[versionId]/route.ts` — l'endpoint, et les deux écrans qui le
  portent (consolidation, version budgétaire) ;
- `apps/web/tests/exports.test.ts` (10 contrôles), `supabase/tests/10_export_rbac.test.sql`
  (10 contrôles), `apps/web/e2e/export-rbac.spec.ts` (6 parcours joués contre la production).

## Ce que la recette navigateur a trouvé et que l'unitaire ne pouvait pas voir

Le premier passage contre la production a rendu un classeur ne portant que ses en-têtes. Un
`numeric` revient de PostgREST en NOMBRE JSON — il a déjà traversé un flottant binaire — et le
garde de l'endpoint, qui exigeait du texte, écartait chaque ligne en silence. Deux corrections :
le cast `amount::text` dans la requête, et le refus d'un export dont le compte de lignes ne
retombe pas sur celui de la requête. Un fichier reçu, signé et faux est pire qu'une erreur.

## Rules

- `~/.claude/rules/supabase.md` ;
- Ponytail full, sans bibliothèque Excel avant vérification de la dépendance disponible.
