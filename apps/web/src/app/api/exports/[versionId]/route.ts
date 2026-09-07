/**
 * Export d'une consolidation publiée, borné au périmètre du demandeur.
 *
 * Un endpoint HTTP et non une Server Action : `specs/_source/archi.md:135` les
 * réserve au contrat du service Python, aux exports et aux futurs webhooks. Une
 * Server Action ne peut de toute façon pas rendre un fichier binaire.
 *
 * L'ordre des opérations n'est pas indifférent. La trace est écrite AVANT que le
 * fichier ne parte : un export remis sans journal serait exactement ce que le
 * critère « empreinte, demandeur, version et périmètre sont journalisés » existe
 * pour empêcher, et l'inverse — une trace sans fichier — est sans danger.
 */

import { createHash } from "node:crypto";

import { requireActiveTenant } from "@/lib/auth/session";
import { type DimensionGrantRow, type DimensionRow } from "@/lib/budgets/scope";
import { exportableDimensions, scopeHash } from "@/lib/exports/scope";
import { buildWorkbook, type ExportRow } from "@/lib/exports/workbook";
import { createClient } from "@/lib/supabase/server";

const TYPE_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Durée de validité de la trace. Aucun artefact n'est stocké — le stockage
 * objet est une décision différée (`archi.md:210`) — mais la contrainte
 * `expires_at > created_at` doit être honorée, et une version publiée étant
 * immuable, redemander cet export pendant cette fenêtre rend le même fichier. */
const VALIDITE_MS = 24 * 60 * 60 * 1000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function refus(message: string, statut: number): Response {
  // Aucun détail sur ce qui existe : un message qui distinguerait « version
  // inconnue » de « version d'un autre tenant » serait un oracle d'existence.
  return new Response(JSON.stringify({ error: message }), {
    headers: { "content-type": "application/json; charset=utf-8" },
    status: statut,
  });
}

function texte(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ versionId: string }> },
): Promise<Response> {
  const tenant = await requireActiveTenant();
  const { versionId } = await context.params;
  const supabase = await createClient();

  const { data: rawVersion, error: versionError } = await supabase
    .from("budget_versions")
    .select("id, version_no, status")
    .eq("id", versionId)
    .eq("tenant_id", tenant.tenantId)
    .maybeSingle();

  if (versionError || !isRecord(rawVersion) || typeof rawVersion.version_no !== "number") {
    return refus("Export indisponible pour cette version.", 404);
  }

  // Seule une version publiée porte des montants : exporter un brouillon
  // rendrait un fichier vide en laissant croire à un budget à zéro.
  if (rawVersion.status !== "published") {
    return refus("Seule une version publiée s'exporte.", 409);
  }

  const [dimensionsResult, grantsResult] = await Promise.all([
    supabase.from("dimensions").select("id, kind, code, name").eq("tenant_id", tenant.tenantId),
    supabase
      .from("dimension_grants")
      .select("dimension_id, can_read, can_contribute, can_approve, can_export")
      .eq("tenant_id", tenant.tenantId)
      .eq("user_id", tenant.userId),
  ]);

  if (dimensionsResult.error || grantsResult.error) {
    return refus("Export indisponible pour cette version.", 404);
  }

  const dimensions = (dimensionsResult.data ?? []) as DimensionRow[];
  const grants = (grantsResult.data ?? []) as DimensionGrantRow[];
  const autorisees = exportableDimensions(tenant, grants, dimensions);

  if (autorisees.length === 0) {
    return refus("Aucun périmètre d'export ne vous est attribué.", 403);
  }

  const idsAutorises = autorisees.map((dimension) => dimension.id);

  // LE filtrage. `budget_values` est protégée par une RLS fondée sur la
  // permission `read` : sans ce `in`, une dimension lisible mais NON exportable
  // remonterait et partirait dans le fichier.
  const { data: rawValues, error: valuesError } = await supabase
    .from("budget_values")
    .select("dimension_id, account_id, period_id, amount, currency")
    .eq("tenant_id", tenant.tenantId)
    .eq("version_id", versionId)
    .in("dimension_id", idsAutorises);

  if (valuesError) {
    return refus("Export indisponible pour cette version.", 404);
  }

  const [accountsResult, periodsResult] = await Promise.all([
    supabase.from("financial_accounts").select("id, code, name").eq("tenant_id", tenant.tenantId),
    supabase.from("periods").select("id, starts_on, ends_on").eq("tenant_id", tenant.tenantId),
  ]);

  const nomDimension = new Map(autorisees.map((dimension) => [dimension.id, dimension.name]));

  const libelleCompte = new Map<string, string>();
  for (const row of accountsResult.data ?? []) {
    const id = isRecord(row) ? texte(row.id) : null;
    const code = isRecord(row) ? texte(row.code) : null;
    const nom = isRecord(row) ? texte(row.name) : null;
    if (id && code && nom) {
      libelleCompte.set(id, `${code} · ${nom}`);
    }
  }

  const libellePeriode = new Map<string, string>();
  for (const row of periodsResult.data ?? []) {
    const id = isRecord(row) ? texte(row.id) : null;
    const debut = isRecord(row) ? texte(row.starts_on) : null;
    const fin = isRecord(row) ? texte(row.ends_on) : null;
    if (id && debut && fin) {
      libellePeriode.set(id, `${debut} → ${fin}`);
    }
  }

  const lignes: ExportRow[] = [];
  for (const row of rawValues ?? []) {
    if (!isRecord(row)) {
      continue;
    }
    const dimensionId = texte(row.dimension_id);
    const accountId = texte(row.account_id);
    const periodId = texte(row.period_id);
    const montant = texte(row.amount);
    const devise = texte(row.currency);
    const nom = dimensionId ? nomDimension.get(dimensionId) : undefined;

    // Une ligne dont la dimension n'est pas dans le périmètre autorisé ne peut
    // pas exister ici — la requête l'a écartée, et la RLS avant elle. Si elle
    // existait malgré tout, la laisser tomber vaut mieux que l'écrire.
    if (!dimensionId || !accountId || !periodId || !montant || !devise || !nom) {
      continue;
    }

    lignes.push({
      account: libelleCompte.get(accountId) ?? accountId,
      amount: montant,
      currency: devise,
      dimension: nom,
      dimensionId,
      period: libellePeriode.get(periodId) ?? periodId,
    });
  }

  const fichier = await buildWorkbook(lignes);
  const empreinteFichier = createHash("sha256").update(fichier).digest("hex");
  const empreintePerimetre = scopeHash(versionId, idsAutorises);
  const expiration = new Date(Date.now() + VALIDITE_MS).toISOString();

  // Un DAF ou un DG exporte le tenant entier : sa trace ne cite aucune
  // dimension, et la RLS d'insertion n'accepte `dimension_id is null` que de
  // lui. Un contributeur laisse une trace PAR dimension emportée, ce qui dit
  // exactement ce qui est parti plutôt qu'un périmètre résumé.
  const traces =
    tenant.role === "daf" || tenant.role === "dg"
      ? [{ dimension_id: null }]
      : idsAutorises.map((id) => ({ dimension_id: id }));

  const { error: traceError } = await supabase.from("exports").insert(
    traces.map((trace) => ({
      ...trace,
      expires_at: expiration,
      file_hash: empreinteFichier,
      requested_by: tenant.userId,
      scope_hash: empreintePerimetre,
      status: "ready",
      tenant_id: tenant.tenantId,
      version_id: versionId,
    })),
  );

  if (traceError) {
    return refus("Export non journalisé : aucun fichier n'a été produit.", 500);
  }

  return new Response(new Uint8Array(fichier), {
    headers: {
      "cache-control": "no-store",
      "content-disposition":
        `attachment; filename="tarjih-consolidation-v${rawVersion.version_no}.xlsx"`,
      "content-type": TYPE_XLSX,
      // De quoi vérifier le fichier reçu contre la trace journalisée.
      "x-tarjih-file-hash": empreinteFichier,
    },
  });
}
