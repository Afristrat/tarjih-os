import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeMemberships,
  resolveMembership,
  type TenantMembership,
} from "../src/lib/auth/access.ts";

const ACTIVE_A: TenantMembership = {
  createdAt: "2026-01-01T00:00:00.000Z",
  isTenantAdmin: false,
  role: "contributor",
  status: "active",
  tenantId: "tenant-a",
};

test("un utilisateur sans membership actif est refusé", () => {
  assert.deepEqual(resolveMembership([], undefined), { kind: "no-membership" });
});

test("un membre uniquement suspendu est identifié explicitement", () => {
  assert.deepEqual(
    resolveMembership([{ ...ACTIVE_A, status: "suspended" }], undefined),
    { kind: "suspended" },
  );
});

test("un identifiant de tenant libre est ignoré", () => {
  assert.deepEqual(resolveMembership([ACTIVE_A], "tenant-intrus"), {
    kind: "active",
    membership: ACTIVE_A,
  });
});

test("un tenant demandé est accepté uniquement lorsqu’il appartient au membre", () => {
  const activeB: TenantMembership = {
    ...ACTIVE_A,
    createdAt: "2026-02-01T00:00:00.000Z",
    role: "daf",
    tenantId: "tenant-b",
  };

  assert.deepEqual(resolveMembership([ACTIVE_A, activeB], "tenant-b"), {
    kind: "active",
    membership: activeB,
  });
});

test("les lignes Supabase invalides ne deviennent jamais des autorisations", () => {
  assert.deepEqual(normalizeMemberships([{ tenant_id: "tenant-a", role: "super-admin" }]), []);
});

test("l’administration du tenant est indépendante du rôle financier", () => {
  assert.deepEqual(
    normalizeMemberships([
      {
        created_at: "2026-01-01T00:00:00.000Z",
        is_tenant_admin: true,
        role: "dg",
        status: "active",
        tenant_id: "tenant-a",
      },
    ]),
    [{ ...ACTIVE_A, isTenantAdmin: true, role: "dg" }],
  );
});
