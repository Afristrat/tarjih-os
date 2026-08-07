import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  normalizeMemberships,
  resolveMembership,
  TENANT_COOKIE_NAME,
  type TenantRole,
} from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";

export type ActiveTenantContext = {
  baseCurrency: string;
  name: string;
  role: TenantRole;
  tenantId: string;
  userEmail: string;
  userId: string;
};

type TenantRow = {
  baseCurrency: string;
  id: string;
  name: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeTenant(value: unknown): TenantRow | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    typeof value.base_currency !== "string"
  ) {
    return null;
  }

  return {
    baseCurrency: value.base_currency,
    id: value.id,
    name: value.name,
  };
}

export async function requireActiveTenant(): Promise<ActiveTenantContext> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login?reason=authentication-required");
  }

  const { data, error: membershipError } = await supabase
    .from("tenant_memberships")
    .select("tenant_id, role, status, created_at")
    .eq("user_id", user.id);

  if (membershipError) {
    throw new Error("Impossible de vérifier les appartenances de l’utilisateur.");
  }

  const cookieStore = await cookies();
  const requestedTenantId = cookieStore.get(TENANT_COOKIE_NAME)?.value;
  const resolution = resolveMembership(normalizeMemberships(data), requestedTenantId);

  if (resolution.kind === "suspended") {
    redirect("/login?reason=suspended");
  }

  if (resolution.kind === "no-membership") {
    redirect("/login?reason=no-membership");
  }

  const { data: tenantData, error: tenantError } = await supabase
    .from("tenants")
    .select("id, name, base_currency")
    .eq("id", resolution.membership.tenantId)
    .single();
  const tenant = normalizeTenant(tenantData);

  if (tenantError || !tenant) {
    throw new Error("Le tenant actif n’est plus accessible.");
  }

  return {
    baseCurrency: tenant.baseCurrency,
    name: tenant.name,
    role: resolution.membership.role,
    tenantId: tenant.id,
    userEmail: user.email ?? "Utilisateur Tarjih",
    userId: user.id,
  };
}
