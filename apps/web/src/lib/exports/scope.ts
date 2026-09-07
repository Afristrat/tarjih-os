/**
 * Périmètre d'un export, et son empreinte.
 *
 * ATTENTION — CE MODULE DÉCIDE, il ne se contente pas de refléter la base.
 *
 * Ailleurs dans le produit, `hasDimensionPermission` est un miroir de la RLS :
 * il évite de proposer ce que la base refusera, sans jamais rien autoriser.
 * Ici, non. La RLS de `budget_values` filtre sur la permission `read`
 * (`budget_values_select_scope`) ; elle ne connaît pas `export`. Un contributeur
 * qui a `can_read` sur une dimension mais pas `can_export` verrait donc ses
 * lignes remonter d'une requête ordinaire — et partir dans le fichier.
 *
 * C'est ce que le critère « le dataset est filtré côté serveur avant création du
 * classeur » vise exactement. Le filtre posé ici est la première barrière ; la
 * RLS reste la seconde, et n'est pas retirée pour autant.
 */

import { createHash } from "node:crypto";

// Chemins relatifs avec extension, et non l'alias `@/` : `npm test` exécute ces
// modules tels quels, sans le résolveur d'alias de Next.
import type { ActiveTenantContext } from "../auth/session.ts";
import {
  dimensionsFor,
  type DimensionGrantRow,
  type DimensionRow,
} from "../budgets/scope.ts";

/**
 * Les dimensions que cet utilisateur a le droit d'EXPORTER.
 *
 * Un DAF ou un DG exporte tout son tenant ; un contributeur, seulement ce qui
 * lui a été explicitement attribué (`archi.md:75`).
 */
export function exportableDimensions(
  context: ActiveTenantContext,
  grants: readonly DimensionGrantRow[],
  dimensions: readonly DimensionRow[],
): DimensionRow[] {
  return dimensionsFor(context, grants, dimensions, "export");
}

/**
 * Empreinte du périmètre effectivement exporté.
 *
 * Elle répond à une question d'audit : « cet export couvrait quoi ? ». Les
 * identifiants sont triés, parce que l'ordre dans lequel PostgreSQL les a rendus
 * n'est pas une propriété du périmètre — deux exports du même périmètre doivent
 * porter la même empreinte, sinon elle ne compare rien.
 *
 * La colonne `exports.scope_hash` impose `^[0-9a-f]{64}$`.
 */
export function scopeHash(versionId: string, dimensionIds: readonly string[]): string {
  const canonique = JSON.stringify({
    dimension_ids: [...dimensionIds].sort(),
    version_id: versionId,
  });

  return createHash("sha256").update(canonique, "utf8").digest("hex");
}
