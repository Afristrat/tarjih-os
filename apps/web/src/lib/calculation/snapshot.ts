/**
 * Construction du snapshot canonique envoyé au moteur.
 *
 * Le filtrage se fait ici, jamais dans le moteur : Python ne choisit pas le
 * tenant et ne connaît pas les droits (`specs/_source/archi.md:100`). Les
 * lectures passent par le client authentifié de l'appelant, donc la RLS
 * s'applique — un snapshot ne peut pas contenir ce que l'appelant n'a pas le
 * droit de lire.
 *
 * À n'importer que depuis du code serveur.
 */

import { createClient } from "@/lib/supabase/server";

export type SnapshotFailure = {
  reason:
    | "version-introuvable"
    | "version-publiee"
    | "aucune-hypothese-approuvee"
    | "referentiel-incomplet"
    | "lecture-refusee";
};

export type SnapshotSuccess = {
  model: string;
  payload: Record<string, unknown>;
  versionId: string;
};

export type SnapshotResult = SnapshotFailure | SnapshotSuccess;

export function isSnapshotFailure(result: SnapshotResult): result is SnapshotFailure {
  return "reason" in result;
}

/** Version du moteur attendue. Doit suivre `ENGINE_VERSION` côté Python. */
export const EXPECTED_ENGINE_VERSION = "1.0.0";

type VersionRow = {
  calculation_model: string;
  id: string;
  status: string;
  tenant_id: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asVersionRow(value: unknown): VersionRow | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.tenant_id !== "string" ||
    typeof value.status !== "string" ||
    typeof value.calculation_model !== "string"
  ) {
    return null;
  }

  return {
    calculation_model: value.calculation_model,
    id: value.id,
    status: value.status,
    tenant_id: value.tenant_id,
  };
}

export async function buildSnapshot(
  versionId: string,
  tenantId: string,
  currency: string,
): Promise<SnapshotResult> {
  const supabase = await createClient();

  const { data: rawVersion, error: versionError } = await supabase
    .from("budget_versions")
    .select("id, tenant_id, status, calculation_model")
    .eq("id", versionId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (versionError) {
    return { reason: "lecture-refusee" };
  }

  const version = asVersionRow(rawVersion);
  if (!version) {
    return { reason: "version-introuvable" };
  }

  // Une version publiée est immuable : la recalculer n'aurait aucun effet et
  // laisserait croire le contraire à celui qui a cliqué.
  if (version.status === "published") {
    return { reason: "version-publiee" };
  }

  const [accounts, periods, dimensions, hypotheses] = await Promise.all([
    supabase
      .from("financial_accounts")
      .select("id, code, statement, normal_balance")
      .eq("tenant_id", tenantId),
    supabase.from("periods").select("id, starts_on, ends_on").eq("tenant_id", tenantId),
    supabase.from("dimensions").select("id, code, kind").eq("tenant_id", tenantId),
    // Le filtre sur `approved` est doublé côté moteur, qui refuse le snapshot
    // s'il en trouve une autre. Deux gardes valent mieux qu'une pour la règle
    // qui décide de ce qui devient un chiffre officiel.
    supabase
      .from("hypotheses")
      .select("id, dimension_id, parameter_key, unit, status, value")
      .eq("tenant_id", tenantId)
      .eq("version_id", versionId)
      .eq("status", "approved"),
  ]);

  if (accounts.error || periods.error || dimensions.error || hypotheses.error) {
    return { reason: "lecture-refusee" };
  }

  if (!accounts.data?.length || !periods.data?.length || !dimensions.data?.length) {
    return { reason: "referentiel-incomplet" };
  }

  if (!hypotheses.data?.length) {
    return { reason: "aucune-hypothese-approuvee" };
  }

  return {
    model: version.calculation_model,
    payload: {
      accounts: accounts.data,
      currency,
      dimensions: dimensions.data,
      engine_version: EXPECTED_ENGINE_VERSION,
      hypotheses: hypotheses.data,
      model: version.calculation_model,
      periods: periods.data,
      tenant_id: tenantId,
      version_id: versionId,
    },
    versionId,
  };
}
