/**
 * Lecture des deux comparaisons que la base calcule (`compare_version_hypotheses`,
 * `compare_version_values`) et les deux comptes que l'écran en tire. Pure :
 * rien ici ne touche la base ni le DOM, et `node --test` le joue tel quel.
 */

export type ComparisonOutcome = "added" | "changed" | "identical" | "removed";

export type HypothesisComparison = {
  baseStatus: string | null;
  baseUnit: string | null;
  baseValue: unknown;
  dimensionId: string;
  outcome: ComparisonOutcome;
  parameterKey: string;
  targetStatus: string | null;
  targetUnit: string | null;
  targetValue: unknown;
};

export type ValueComparison = {
  accountId: string;
  baseAmount: string | null;
  currency: string;
  delta: string | null;
  deltaPercent: string | null;
  dimensionId: string;
  periodId: string;
  targetAmount: string | null;
};

export type ComparedVersion = {
  id: string;
  inputHash: string | null;
  status: string;
  versionNo: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isOutcome(value: unknown): value is ComparisonOutcome {
  return value === "added" || value === "changed" || value === "identical" || value === "removed";
}

/** Relit une ligne de `compare_version_hypotheses`, ou `null` si sa forme surprend. */
export function asHypothesisComparison(value: unknown): HypothesisComparison | null {
  if (
    !isRecord(value) ||
    typeof value.dimension_id !== "string" ||
    typeof value.parameter_key !== "string" ||
    !isOutcome(value.outcome)
  ) {
    return null;
  }

  return {
    baseStatus: typeof value.base_status === "string" ? value.base_status : null,
    baseUnit: typeof value.base_unit === "string" ? value.base_unit : null,
    baseValue: value.base_value,
    dimensionId: value.dimension_id,
    outcome: value.outcome,
    parameterKey: value.parameter_key,
    targetStatus: typeof value.target_status === "string" ? value.target_status : null,
    targetUnit: typeof value.target_unit === "string" ? value.target_unit : null,
    targetValue: value.target_value,
  };
}

/** Relit une ligne de `compare_version_values`. Les montants restent des chaînes. */
export function asValueComparison(value: unknown): ValueComparison | null {
  if (
    !isRecord(value) ||
    typeof value.dimension_id !== "string" ||
    typeof value.account_id !== "string" ||
    typeof value.period_id !== "string" ||
    typeof value.currency !== "string"
  ) {
    return null;
  }

  const amount = (raw: unknown): string | null =>
    raw === null || raw === undefined ? null : String(raw);

  return {
    accountId: value.account_id,
    baseAmount: amount(value.base_amount),
    currency: value.currency,
    delta: amount(value.delta),
    deltaPercent: amount(value.delta_percent),
    dimensionId: value.dimension_id,
    periodId: value.period_id,
    targetAmount: amount(value.target_amount),
  };
}

/**
 * Les lignes que le geste approuverait : identiques, approuvées côté base,
 * encore proposées côté cible. Le périmètre d'approbation de l'appelant est
 * réévalué en base au moment du geste ; ce compte est une annonce, pas une
 * promesse.
 */
export function countApprovable(rows: readonly HypothesisComparison[]): number {
  return rows.filter(
    (row) =>
      row.outcome === "identical" && row.baseStatus === "approved" && row.targetStatus === "proposed",
  ).length;
}

/** Une phrase de synthèse : « 3 identiques · 1 modifiée · 2 ajoutées ». */
export function summarizeOutcomes(rows: readonly HypothesisComparison[]): string {
  const counts = new Map<ComparisonOutcome, number>();
  for (const row of rows) {
    counts.set(row.outcome, (counts.get(row.outcome) ?? 0) + 1);
  }

  const parts: string[] = [];
  const order: ComparisonOutcome[] = ["identical", "changed", "added", "removed"];
  const plural: Record<ComparisonOutcome, [string, string]> = {
    added: ["ajoutée", "ajoutées"],
    changed: ["modifiée", "modifiées"],
    identical: ["identique", "identiques"],
    removed: ["retirée ou rejetée", "retirées ou rejetées"],
  };
  for (const outcome of order) {
    const count = counts.get(outcome) ?? 0;
    if (count > 0) {
      parts.push(`${count} ${plural[outcome][count > 1 ? 1 : 0]}`);
    }
  }

  return parts.join(" · ");
}
