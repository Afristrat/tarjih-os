"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireActiveTenant } from "@/lib/auth/session";
import { canManageFinance } from "@/lib/authorization/capabilities";
import { requestCalculation } from "@/lib/calculation/client";
import { buildSnapshot, isSnapshotFailure } from "@/lib/calculation/snapshot";
import { requiredText } from "@/lib/forms/values";
import { createClient } from "@/lib/supabase/server";

const SNAPSHOT_NOTICES: Record<string, string> = {
  "aucune-hypothese-approuvee": "calculation-empty",
  "lecture-refusee": "calculation-forbidden",
  "referentiel-incomplet": "calculation-reference-missing",
  "version-introuvable": "calculation-forbidden",
  "version-publiee": "calculation-version-published",
};

/**
 * Calcule une version puis publie le résultat.
 *
 * L'écriture est faite par `public.publish_calculation`, qui pose le run, ses
 * valeurs et la publication dans une seule transaction. Un échec en cours de
 * route ne laisse donc aucune version partiellement publiée
 * (`specs/_source/archi.md:97-98`).
 */
export async function publishCalculation(formData: FormData): Promise<never> {
  const context = await requireActiveTenant();
  const versionId = requiredText(formData, "version_id", 64);

  if (!versionId) {
    redirect("/app/budgets?error=calculation-forbidden");
  }

  const target = `/app/consolidation/${versionId}`;

  // Le contrôle vit aussi dans la fonction SQL : celui-ci évite un aller-retour
  // au moteur, il ne le remplace pas. Un rôle affiché n'est jamais une garantie.
  if (!canManageFinance(context)) {
    redirect(`${target}?error=calculation-forbidden`);
  }

  const snapshot = await buildSnapshot(versionId, context.tenantId, context.baseCurrency);
  if (isSnapshotFailure(snapshot)) {
    redirect(`${target}?error=${SNAPSHOT_NOTICES[snapshot.reason] ?? "calculation-refused"}`);
  }

  const outcome = await requestCalculation(snapshot.payload);

  if (outcome.status === "unavailable") {
    redirect(`${target}?error=calculation-unavailable`);
  }

  if (outcome.status === "refused") {
    redirect(`${target}?error=calculation-refused`);
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("publish_calculation", {
    computed_values: outcome.values.map((value) => ({
      account_id: value.accountId,
      amount: value.amount,
      currency: context.baseCurrency,
      dimension_id: value.dimensionId,
      period_id: value.periodId,
    })),
    submitted_engine_version: outcome.engineVersion,
    submitted_input_hash: outcome.inputHash,
    submitted_output_hash: outcome.outputHash,
    target_version_id: versionId,
  });

  if (error) {
    redirect(`${target}?error=calculation-write-failed`);
  }

  revalidatePath(target);
  revalidatePath("/app/budgets");
  redirect(`${target}?success=calculation-published`);
}
