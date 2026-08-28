"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireActiveTenant } from "@/lib/auth/session";
import { canManageTenant } from "@/lib/authorization/capabilities";
import { normalizedCode, requiredText } from "@/lib/forms/values";
import { createClient } from "@/lib/supabase/server";

const DIMENSION_KINDS = ["entity", "department", "project", "product", "channel", "geography"] as const;

export async function createDimension(formData: FormData): Promise<never> {
  const context = await requireActiveTenant();
  if (!canManageTenant(context)) {
    redirect("/app?error=forbidden");
  }

  const name = requiredText(formData, "name", 160);
  const requestedCode = requiredText(formData, "code", 64);
  const kindValue = requiredText(formData, "kind", 32);
  const kind = DIMENSION_KINDS.find((candidate) => candidate === kindValue);
  const code = requestedCode ? normalizedCode(requestedCode) : name ? normalizedCode(name) : null;

  if (!name || !code || !kind) {
    redirect("/app/settings/dimensions?error=invalid-dimension");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("dimensions").insert({
    code,
    kind,
    name,
    tenant_id: context.tenantId,
  });

  if (error) {
    redirect("/app/settings/dimensions?error=creation-failed");
  }

  revalidatePath("/app/settings/dimensions");
  redirect("/app/settings/dimensions?success=dimension-created");
}

export async function saveDimensionGrant(formData: FormData): Promise<never> {
  const context = await requireActiveTenant();
  if (!canManageTenant(context)) {
    redirect("/app?error=forbidden");
  }

  const userId = requiredText(formData, "user_id", 64);
  const dimensionId = requiredText(formData, "dimension_id", 64);
  if (!userId || !dimensionId) {
    redirect("/app/settings/dimensions?error=invalid-grant");
  }

  const permissions = {
    can_approve: formData.get("can_approve") === "on",
    can_contribute: formData.get("can_contribute") === "on",
    can_export: formData.get("can_export") === "on",
    can_read: formData.get("can_read") === "on",
  };
  const supabase = await createClient();
  const hasPermission = Object.values(permissions).some(Boolean);

  const result = hasPermission
    ? await supabase.from("dimension_grants").upsert({
        ...permissions,
        dimension_id: dimensionId,
        tenant_id: context.tenantId,
        user_id: userId,
      })
    : await supabase
        .from("dimension_grants")
        .delete()
        .eq("tenant_id", context.tenantId)
        .eq("user_id", userId)
        .eq("dimension_id", dimensionId);

  if (result.error) {
    redirect("/app/settings/dimensions?error=grant-failed");
  }

  revalidatePath("/app/settings/dimensions");
  redirect("/app/settings/dimensions?success=grant-saved");
}
