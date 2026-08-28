import type { ActiveTenantContext } from "@/lib/auth/session";

export function canManageFinance(context: ActiveTenantContext): boolean {
  return context.role === "daf" || context.role === "dg";
}

export function canManageTenant(context: ActiveTenantContext): boolean {
  return context.isTenantAdmin;
}

export function roleLabel(context: ActiveTenantContext): string {
  const financialRole = {
    contributor: "Contributeur",
    daf: "DAF",
    dg: "DG",
    tenant_admin: "Administrateur technique",
  }[context.role];

  return context.isTenantAdmin ? `${financialRole} · Administration` : financialRole;
}
