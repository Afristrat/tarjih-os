"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireActiveTenant } from "@/lib/auth/session";
import { canManageFinance } from "@/lib/authorization/capabilities";
import { normalizedCode, requiredText } from "@/lib/forms/values";
import { createClient } from "@/lib/supabase/server";

const STATEMENTS = ["income_statement", "balance_sheet", "cash_flow", "kpi"] as const;
const NORMAL_BALANCES = ["debit", "credit", "none"] as const;

// Une date de calendrier, pas un instant : une période budgétaire ne dépend pas
// du fuseau de celui qui la saisit.
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const TARGET = "/app/settings/reference";

function isoDate(formData: FormData, field: string): string | null {
  const value = requiredText(formData, field, 10);
  if (!value || !DATE_PATTERN.test(value)) {
    return null;
  }

  // `Date.parse` accepte « 2027-02-31 » et le décale au 3 mars : le seul contrôle
  // fiable est de reformater la date lue et de la comparer à la saisie.
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value
    ? null
    : value;
}

export async function createFinancialAccount(formData: FormData): Promise<never> {
  const context = await requireActiveTenant();

  // Le contrôle vit d'abord dans la RLS (`accounts_manage_finance`) ; celui-ci
  // évite un aller-retour perdu, il ne le remplace pas.
  if (!canManageFinance(context)) {
    redirect("/app?error=forbidden");
  }

  const name = requiredText(formData, "name", 160);
  const requestedCode = requiredText(formData, "code", 64);
  const code = requestedCode ? normalizedCode(requestedCode) : name ? normalizedCode(name) : null;
  const statementValue = requiredText(formData, "statement", 32);
  const balanceValue = requiredText(formData, "normal_balance", 16);
  const statement = STATEMENTS.find((candidate) => candidate === statementValue);
  const normalBalance = NORMAL_BALANCES.find((candidate) => candidate === balanceValue);

  if (!name || !code || !statement || !normalBalance) {
    redirect(`${TARGET}?error=invalid-account`);
  }

  const supabase = await createClient();
  const { error } = await supabase.from("financial_accounts").insert({
    code,
    name,
    normal_balance: normalBalance,
    statement,
    tenant_id: context.tenantId,
  });

  if (error) {
    redirect(`${TARGET}?error=account-creation-failed`);
  }

  revalidatePath(TARGET);
  redirect(`${TARGET}?success=account-created`);
}

export async function createPeriod(formData: FormData): Promise<never> {
  const context = await requireActiveTenant();

  if (!canManageFinance(context)) {
    redirect("/app?error=forbidden");
  }

  const startsOn = isoDate(formData, "starts_on");
  const endsOn = isoDate(formData, "ends_on");

  if (!startsOn || !endsOn) {
    redirect(`${TARGET}?error=invalid-period`);
  }

  // La contrainte `ends_on >= starts_on` existe en base ; la dire ici permet
  // d'expliquer l'erreur au lieu d'afficher un échec d'insertion opaque.
  if (endsOn < startsOn) {
    redirect(`${TARGET}?error=period-reversed`);
  }

  const supabase = await createClient();
  const { error } = await supabase.from("periods").insert({
    ends_on: endsOn,
    starts_on: startsOn,
    tenant_id: context.tenantId,
  });

  if (error) {
    redirect(`${TARGET}?error=period-creation-failed`);
  }

  revalidatePath(TARGET);
  redirect(`${TARGET}?success=period-created`);
}
