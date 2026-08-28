export const TENANT_COOKIE_NAME = "tarjih_tenant_id";

export const TENANT_ROLES = ["contributor", "daf", "dg", "tenant_admin"] as const;

export type TenantRole = (typeof TENANT_ROLES)[number];

export type TenantMembership = {
  createdAt: string;
  isTenantAdmin: boolean;
  role: TenantRole;
  status: "active" | "invited" | "suspended";
  tenantId: string;
};

export type MembershipResolution =
  | { kind: "active"; membership: TenantMembership }
  | { kind: "no-membership" }
  | { kind: "suspended" };

function isTenantRole(value: unknown): value is TenantRole {
  return typeof value === "string" && TENANT_ROLES.some((role) => role === value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isMembershipStatus(
  value: unknown,
): value is TenantMembership["status"] {
  return value === "active" || value === "invited" || value === "suspended";
}

export function normalizeMemberships(value: unknown): TenantMembership[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((row: unknown) => {
    if (!isRecord(row)) {
      return [];
    }

    if (
      typeof row.tenant_id !== "string" ||
      typeof row.created_at !== "string" ||
      !isTenantRole(row.role) ||
      !isMembershipStatus(row.status)
    ) {
      return [];
    }

    return [
      {
        createdAt: row.created_at,
        isTenantAdmin: row.is_tenant_admin === true,
        role: row.role,
        status: row.status,
        tenantId: row.tenant_id,
      },
    ];
  });
}

export function resolveMembership(
  memberships: readonly TenantMembership[],
  requestedTenantId: string | undefined,
): MembershipResolution {
  const activeMemberships = memberships
    .filter((membership) => membership.status === "active")
    .toSorted((left, right) => left.createdAt.localeCompare(right.createdAt));

  if (activeMemberships.length === 0) {
    return memberships.some((membership) => membership.status === "suspended")
      ? { kind: "suspended" }
      : { kind: "no-membership" };
  }

  const requestedMembership = activeMemberships.find(
    (membership) => membership.tenantId === requestedTenantId,
  );

  return {
    kind: "active",
    membership: requestedMembership ?? activeMemberships[0],
  };
}
