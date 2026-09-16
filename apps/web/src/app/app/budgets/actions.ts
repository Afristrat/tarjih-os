"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireActiveTenant } from "@/lib/auth/session";
import { canManageFinance } from "@/lib/authorization/capabilities";
import { CALCULATION_MODELS, decisionNoticeFor, readVersionOrigin } from "@/lib/budgets/scope";
import {
  buildDirectValue,
  buildPercentOfValue,
  buildVolumePriceValue,
  readHypothesisFacts,
  rebuildValue,
} from "@/lib/budgets/hypothesis-value";
import { requiredText } from "@/lib/forms/values";
import { createClient } from "@/lib/supabase/server";

const DECISIONS = ["approved", "rejected"] as const;

export async function createBudgetCycle(formData: FormData): Promise<never> {
  const context = await requireActiveTenant();
  if (!canManageFinance(context)) {
    redirect("/app?error=forbidden");
  }

  const name = requiredText(formData, "name", 160);
  if (!name) {
    redirect("/app/budgets?error=invalid-cycle");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("budget_cycles")
    .insert({ name, status: "open", tenant_id: context.tenantId });

  if (error) {
    redirect("/app/budgets?error=cycle-creation-failed");
  }

  revalidatePath("/app/budgets");
  redirect("/app/budgets?success=cycle-created");
}

export async function createBudgetVersion(formData: FormData): Promise<never> {
  const context = await requireActiveTenant();
  if (!canManageFinance(context)) {
    redirect("/app?error=forbidden");
  }

  const cycleId = requiredText(formData, "cycle_id", 64);
  if (!cycleId) {
    redirect("/app/budgets?error=invalid-cycle");
  }

  // Une seule décision à l'ouverture : partir de rien, sur un modèle choisi, ou
  // reprendre une version du cycle — qui impose alors son modèle. Le modèle
  // décide de ce que le moteur SAIT faire de cette version et ne se change plus
  // une fois des hypothèses déposées ; tant qu'aucun écran ne le renseignait,
  // deux des trois modèles étaient codés, testés, et inatteignables.
  const origin = readVersionOrigin(requiredText(formData, "origin", 64));
  if (!origin) {
    redirect("/app/budgets?error=invalid-model");
  }

  const supabase = await createClient();

  // Le modèle d'une reprise est lu en base, pas soumis : la fonction refuse
  // toute divergence, et l'écran n'a rien à savoir de plus que la source.
  let model = origin.kind === "empty" ? origin.model : null;
  if (origin.kind === "resume") {
    const { data: source } = await supabase
      .from("budget_versions")
      .select("calculation_model")
      .eq("id", origin.sourceVersionId)
      .eq("tenant_id", context.tenantId)
      .eq("cycle_id", cycleId)
      .maybeSingle();
    model = typeof source?.calculation_model === "string" ? source.calculation_model : null;
  }

  if (!model || !CALCULATION_MODELS.includes(model)) {
    redirect("/app/budgets?error=invalid-model");
  }

  // Version et hypothèses reprises tiennent dans une transaction en base, qui
  // porte aussi les contrôles de droit et de cycle : voir la migration
  // `20260913150000_open_a_version_from_the_previous_one`.
  const { data, error } = await supabase.rpc("open_budget_version", {
    requested_model: model,
    source_version_id: origin.kind === "resume" ? origin.sourceVersionId : null,
    target_cycle_id: cycleId,
  });

  if (error || typeof data !== "string") {
    redirect("/app/budgets?error=version-creation-failed");
  }

  revalidatePath("/app/budgets");
  redirect(
    `/app/budgets/${data}?success=${origin.kind === "resume" ? "version-resumed" : "version-created"}`,
  );
}

export async function proposeHypothesis(formData: FormData): Promise<never> {
  const context = await requireActiveTenant();

  const versionId = requiredText(formData, "version_id", 64);
  if (!versionId) {
    redirect("/app/budgets?error=invalid-hypothesis");
  }

  const dimensionId = requiredText(formData, "dimension_id", 64);
  const parameterKey = requiredText(formData, "parameter_key", 160);
  const unit = requiredText(formData, "unit", 32);
  const accountCode = requiredText(formData, "account_code", 64);
  const periodId = requiredText(formData, "period_id", 64);
  // Facultative : la colonne refuse le blanc, pas l'absence. Une note trop
  // longue vaut absence ici, et la colonne la refuserait de toute façon.
  const note = requiredText(formData, "note", 2000);

  // La forme de la valeur dépend du modèle de la version, et le modèle est lu
  // en base plutôt que soumis par le formulaire : une hypothèse ne choisit pas
  // la façon dont la version sera calculée.
  const supabase = await createClient();
  const { data: versionRow } = await supabase
    .from("budget_versions")
    .select("calculation_model")
    .eq("id", versionId)
    .eq("tenant_id", context.tenantId)
    .maybeSingle();

  const model =
    versionRow && typeof versionRow.calculation_model === "string"
      ? versionRow.calculation_model
      : null;

  // En modèle « driver », l'hypothèse dit AUSSI par quel inducteur elle se
  // calcule. Les deux que le moteur connaît ne se saisissent pas pareil : un
  // volume et un prix pour l'un, un taux et un compte de base pour l'autre.
  const driver = requiredText(formData, "driver", 32) ?? "volume_price";

  const value =
    accountCode && periodId && model
      ? model === "driver"
        ? driver === "percent_of"
          ? buildPercentOfValue(
              accountCode,
              requiredText(formData, "base_account_code", 64) ?? "",
              periodId,
              requiredText(formData, "rate", 64) ?? "",
            )
          : buildVolumePriceValue(
              accountCode,
              periodId,
              requiredText(formData, "volume", 64) ?? "",
              requiredText(formData, "unit_price", 64) ?? "",
            )
        : buildDirectValue(accountCode, periodId, requiredText(formData, "value", 64) ?? "")
      : null;

  if (!dimensionId || !parameterKey || !unit || !value) {
    redirect(`/app/budgets/${versionId}?error=invalid-hypothesis`);
  }

  // Aucun contrôle de droit ici : la politique `hypotheses_insert_contributor`
  // exige la permission `contribute` sur la dimension visée et réévalue ce
  // droit à l'écriture. L'écran ne propose que les dimensions autorisées pour
  // ne pas offrir un formulaire condamné, il ne décide de rien.
  const { error } = await supabase.from("hypotheses").insert({
    dimension_id: dimensionId,
    note,
    parameter_key: parameterKey,
    proposed_by: context.userId,
    status: "proposed",
    tenant_id: context.tenantId,
    unit,
    value,
    version_id: versionId,
  });

  if (error) {
    redirect(`/app/budgets/${versionId}?error=hypothesis-creation-failed`);
  }

  revalidatePath(`/app/budgets/${versionId}`);
  redirect(`/app/budgets/${versionId}?success=hypothesis-created`);
}

/**
 * Lit les faits d'une hypothèse en base et reconstruit sa valeur autour d'eux
 * (`rebuildValue`) : compte, période, inducteur et base ne changent pas, seul
 * le terme saisi change. `null` si l'hypothèse est introuvable, illisible ou
 * si le chiffre saisi ne passe pas — l'écran refuse alors d'écrire.
 */
async function rebuiltValue(
  supabase: Awaited<ReturnType<typeof createClient>>,
  hypothesisId: string,
  formData: FormData,
  amountField = "value",
): Promise<Record<string, unknown> | null> {
  const { data } = await supabase
    .from("hypotheses")
    .select("value")
    .eq("id", hypothesisId)
    .maybeSingle();

  return rebuildValue(
    readHypothesisFacts(data?.value),
    (name) => requiredText(formData, name, 64),
    amountField,
  );
}

export async function updateHypothesis(formData: FormData): Promise<never> {
  await requireActiveTenant();

  const hypothesisId = requiredText(formData, "hypothesis_id", 64);
  if (!hypothesisId) {
    redirect("/app/budgets?error=invalid-hypothesis");
  }

  const target = `/app/hypotheses/${hypothesisId}`;
  const unit = requiredText(formData, "unit", 32);
  const note = requiredText(formData, "note", 2000);
  const rawRowVersion = requiredText(formData, "row_version", 16);
  const rowVersion = rawRowVersion ? Number.parseInt(rawRowVersion, 10) : Number.NaN;

  const supabase = await createClient();

  // Une correction ne déplace pas une hypothèse : son compte et sa période
  // restent ceux qui ont été proposés et soumis à décision. Seul le chiffre
  // change, et la valeur est donc reconstruite autour des faits existants.
  const value = await rebuiltValue(supabase, hypothesisId, formData);

  if (!unit || !value || !Number.isSafeInteger(rowVersion)) {
    redirect(`${target}?error=invalid-hypothesis`);
  }

  // Le contrôle optimiste tient en deux moitiés indissociables : on n'écrit que
  // sur la révision qu'on a lue (`eq`), et on écrit celle qui lui succède, ce
  // que le déclencheur `hypotheses_enforce_write` exige. Zéro ligne touchée
  // signifie qu'un autre a écrit entre-temps — jamais que rien ne s'est passé.
  const { data, error } = await supabase
    .from("hypotheses")
    .update({ note, row_version: rowVersion + 1, unit, value })
    .eq("id", hypothesisId)
    .eq("row_version", rowVersion)
    .select("id");

  if (error) {
    redirect(`${target}?error=${decisionNoticeFor(error.code)}`);
  }

  if (!data || data.length === 0) {
    redirect(`${target}?error=decision-conflict`);
  }

  revalidatePath(target);
  redirect(`${target}?success=hypothesis-updated`);
}

export async function decideHypothesis(formData: FormData): Promise<never> {
  // La décision elle-même est arbitrée par `decide_hypothesis` côté PostgreSQL :
  // droit d'approbation, état courant, concurrence et motif y sont vérifiés
  // ensemble. Cet appel ne fait que refuser un visiteur non authentifié avant
  // la requête et traduire le refus que la base renvoie.
  await requireActiveTenant();

  const hypothesisId = requiredText(formData, "hypothesis_id", 64);
  if (!hypothesisId) {
    redirect("/app/budgets?error=invalid-hypothesis");
  }

  const target = `/app/hypotheses/${hypothesisId}`;
  const decisionValue = requiredText(formData, "decision", 16);
  const decision = DECISIONS.find((candidate) => candidate === decisionValue);
  const reason = requiredText(formData, "reason", 500);
  const rawRowVersion = requiredText(formData, "row_version", 16);
  const rawReplacement = requiredText(formData, "replacement_value", 64);
  const rowVersion = rawRowVersion ? Number.parseInt(rawRowVersion, 10) : Number.NaN;

  if (!decision || !reason || !Number.isSafeInteger(rowVersion)) {
    redirect(`${target}?error=decision-invalid`);
  }

  const supabase = await createClient();

  // Un approbateur peut corriger le chiffre, jamais le compte ni la période :
  // il approuve l'hypothèse qui lui a été soumise, pas une autre.
  const replacement = rawReplacement
    ? await rebuiltValue(supabase, hypothesisId, formData, "replacement_value")
    : null;

  // Une valeur de remplacement saisie mais illisible ne doit pas se muer en
  // « pas de remplacement » : l'approbation porterait alors sur la valeur
  // proposée, sans que personne ne l'ait voulu.
  if (rawReplacement && !replacement) {
    redirect(`${target}?error=invalid-hypothesis`);
  }
  const { error } = await supabase.rpc("decide_hypothesis", {
    decision_reason: reason,
    expected_row_version: rowVersion,
    replacement_unit: requiredText(formData, "replacement_unit", 32),
    replacement_value: replacement,
    requested_decision: decision,
    target_hypothesis_id: hypothesisId,
  });

  if (error) {
    redirect(`${target}?error=${decisionNoticeFor(error.code)}`);
  }

  revalidatePath(target);
  redirect(`${target}?success=decision-recorded`);
}
