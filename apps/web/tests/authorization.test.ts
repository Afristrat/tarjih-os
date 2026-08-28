import assert from "node:assert/strict";
import test from "node:test";

import {
  canManageFinance,
  canManageTenant,
  roleLabel,
} from "../src/lib/authorization/capabilities.ts";
import type { ActiveTenantContext } from "../src/lib/auth/session.ts";

function context(overrides: Partial<ActiveTenantContext>): ActiveTenantContext {
  return {
    baseCurrency: "MAD",
    isTenantAdmin: false,
    name: "Tenant test",
    role: "contributor",
    tenantId: "tenant-a",
    userEmail: "test@example.com",
    userId: "user-a",
    ...overrides,
  };
}

test("un administrateur technique n’obtient aucun droit financier implicite", () => {
  const technicalAdmin = context({ isTenantAdmin: true });
  assert.equal(canManageTenant(technicalAdmin), true);
  assert.equal(canManageFinance(technicalAdmin), false);
});

test("un DG peut aussi administrer sans confondre ses deux capacités", () => {
  const founder = context({ isTenantAdmin: true, role: "dg" });
  assert.equal(canManageFinance(founder), true);
  assert.equal(canManageTenant(founder), true);
  assert.equal(roleLabel(founder), "DG · Administration");
});
