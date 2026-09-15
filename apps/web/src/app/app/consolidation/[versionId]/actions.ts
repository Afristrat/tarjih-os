"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireActiveTenant } from "@/lib/auth/session";
import { canManageFinance } from "@/lib/authorization/capabilities";
import { decisionNoticeFor } from "@/lib/budgets/scope";
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
    // Les parts partent avec les montants : la fonction SQL écrit les deux dans
    // la même transaction, ou n'écrit rien. Aucun montant publié ne peut donc
    // exister sans que l'on sache dire de quelles hypothèses il vient.
    computed_sources: outcome.sources.map((source) => ({
      account_id: source.accountId,
      amount: source.amount,
      dimension_id: source.dimensionId,
      hypothesis_id: source.hypothesisId,
      period_id: source.periodId,
    })),
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
    // La matière d'entrée EXACTE, celle que le moteur vient d'empreinter. Sans
    // elle, `input_hash` ne prouve que son propre calcul : rejouer la version
    // supposerait de refaire sa matière depuis un référentiel qui, lui, a
    // continué de vivre — ce qui a déjà rendu une version publiée irrejouable.
    submitted_snapshot: snapshot.payload,
    target_version_id: versionId,
  });

  if (error) {
    redirect(`${target}?error=calculation-write-failed`);
  }

  revalidatePath(target);
  revalidatePath("/app/budgets");
  redirect(`${target}?success=calculation-published`);
}

/**
 * Approuve, dans cette version, chaque proposition identique à une hypothèse
 * approuvée de la version de base.
 *
 * Tout l'arbitrage est dans `public.approve_identical_hypotheses` : les deux
 * versions, l'état de la cible, le périmètre d'approbation ligne par ligne, et
 * une décision par ligne via `decide_hypothesis`, dans une transaction. Cet
 * appel refuse un visiteur non autorisé avant la requête et traduit le résultat.
 */
export async function approveIdentical(formData: FormData): Promise<never> {
  const context = await requireActiveTenant();
  const versionId = requiredText(formData, "version_id", 64);
  const baseVersionId = requiredText(formData, "base_version_id", 64);
  const reason = requiredText(formData, "reason", 500);

  if (!versionId) {
    redirect("/app/budgets?error=calculation-forbidden");
  }

  // Le retour garde la version comparée : l'écran se rouvre sur le même écart.
  function back(outcome: "error" | "success", notice: string): never {
    const query = new URLSearchParams({ [outcome]: notice });
    if (baseVersionId) {
      query.set("with", baseVersionId);
    }
    redirect(`/app/consolidation/${versionId}?${query.toString()}`);
  }

  if (!canManageFinance(context)) {
    back("error", "calculation-forbidden");
  }

  if (!baseVersionId || !reason) {
    back("error", "decision-invalid");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("approve_identical_hypotheses", {
    base_version_id: baseVersionId,
    decision_reason: reason,
    target_version_id: versionId,
  });

  if (error) {
    const notice = decisionNoticeFor(error.code);
    back("error", notice === "decision-failed" ? "identical-failed" : notice);
  }

  revalidatePath(`/app/consolidation/${versionId}`);
  back("success", typeof data === "number" && data > 0 ? "identical-approved" : "identical-none");
}
