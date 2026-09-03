import type { ActiveTenantContext } from "@/lib/auth/session";
// Chemin relatif, et non l'alias `@/` : `npm test` exécute ce module tel quel,
// sans le résolveur d'alias de Next. Un import de type survit à l'alias parce
// qu'il est effacé à la compilation ; un import de valeur, non.
import { readHypothesisFacts } from "./hypothesis-value.ts";

export type DimensionPermission = "approve" | "contribute" | "export" | "read";

export type DimensionGrantRow = {
  can_approve: boolean;
  can_contribute: boolean;
  can_export: boolean;
  can_read: boolean;
  dimension_id: string;
};

export type DimensionRow = {
  code: string;
  id: string;
  kind: string;
  name: string;
};

export const HYPOTHESIS_STATUSES = ["proposed", "approved", "rejected"] as const;

export const VERSION_STATUSES = [
  "draft",
  "calculating",
  "ready",
  "published",
  "superseded",
  "failed",
] as const;

const GRANT_FIELD: Record<DimensionPermission, keyof DimensionGrantRow> = {
  approve: "can_approve",
  contribute: "can_contribute",
  export: "can_export",
  read: "can_read",
};

const HYPOTHESIS_LABELS: Record<string, string> = {
  approved: "Approuvée",
  proposed: "Proposée",
  rejected: "Rejetée",
};

const VERSION_LABELS: Record<string, string> = {
  calculating: "Calcul en cours",
  draft: "Brouillon",
  failed: "En échec",
  published: "Publiée",
  ready: "Prête",
  superseded: "Remplacée",
};

// Miroir exact de `private.has_dimension_permission` : un DAF ou un DG tient ses
// droits de son rôle et n'a aucune ligne de grant, un contributeur n'a que ce que
// la sienne porte, et l'administration technique n'ouvre rien de financier.
//
// Ce miroir sert uniquement à ne PAS proposer ce que la base refusera : il ne
// décide rien. L'autorité reste la RLS, qui réévalue le droit à chaque requête ;
// un écran qui se tromperait ici afficherait un formulaire de trop, jamais une
// donnée de trop.
export function hasDimensionPermission(
  context: ActiveTenantContext,
  grants: readonly DimensionGrantRow[],
  dimensionId: string,
  permission: DimensionPermission,
): boolean {
  if (context.role === "daf" || context.role === "dg") {
    return true;
  }

  return grants.some(
    (candidate) => candidate.dimension_id === dimensionId && candidate[GRANT_FIELD[permission]] === true,
  );
}

export function dimensionsFor(
  context: ActiveTenantContext,
  grants: readonly DimensionGrantRow[],
  dimensions: readonly DimensionRow[],
  permission: DimensionPermission,
): DimensionRow[] {
  return dimensions.filter((dimension) =>
    hasDimensionPermission(context, grants, dimension.id, permission),
  );
}

// Un statut inconnu se dit tel quel plutôt que de disparaître : mieux vaut un
// écran qui montre un état qu'il ne sait pas nommer qu'un écran qui l'efface.
export function hypothesisStatusLabel(status: string): string {
  return HYPOTHESIS_LABELS[status] ?? status;
}

export function versionStatusLabel(status: string): string {
  return VERSION_LABELS[status] ?? status;
}

// Un montant n'est jamais reconstruit : il est stocké en `jsonb` sous la forme
// `{ type: "decimal", value: "1234.5678" }`, et c'est cette chaîne-là qui est
// affichée. Passer par un nombre JavaScript la ferait transiter par un flottant
// binaire, où 0.10 cesse d'être 0.10.
// Trois tons seulement : ce qui attend une main humaine, ce qui est acquis, ce
// qui est refusé ou en échec. Un état non répertorié est traité comme en
// attente : il n'est jamais présenté comme acquis par défaut.
export type StateTone = "acquis" | "attente" | "refus";

const HYPOTHESIS_TONES: Record<string, StateTone> = {
  approved: "acquis",
  proposed: "attente",
  rejected: "refus",
};

const VERSION_TONES: Record<string, StateTone> = {
  calculating: "attente",
  draft: "attente",
  failed: "refus",
  published: "acquis",
  ready: "acquis",
  superseded: "refus",
};

export function hypothesisStatusTone(status: string): StateTone {
  return HYPOTHESIS_TONES[status] ?? "attente";
}

export function versionStatusTone(status: string): StateTone {
  return VERSION_TONES[status] ?? "attente";
}

/**
 * Montant lisible d'une hypothèse, quelle que soit la forme de son `value`.
 *
 * La lecture est déléguée à `hypothesis-value`, qui connaît les formes du
 * moteur ainsi que la forme historique restée en base. Le repli sur le JSON
 * brut est conservé : une hypothèse d'une forme inattendue doit rester visible,
 * pas disparaître de l'écran.
 */
export function formatHypothesisValue(value: unknown): string {
  return readHypothesisFacts(value).amount ?? (JSON.stringify(value) ?? "");
}

// Le refus vient de la base, qui distingue ses cas par des SQLSTATE ; l'écran
// se contente de les traduire. Deviner le motif à partir du texte du message
// serait une reconstitution, alors que le code est déjà la raison.
const DECISION_NOTICE_BY_SQLSTATE: Record<string, string> = {
  "22023": "decision-invalid",
  "40001": "decision-conflict",
  "55000": "decision-closed",
  P0002: "decision-out-of-scope",
};

export function decisionNoticeFor(sqlState: string | undefined): string {
  return (sqlState && DECISION_NOTICE_BY_SQLSTATE[sqlState]) ?? "decision-failed";
}
