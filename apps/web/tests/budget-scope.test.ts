import assert from "node:assert/strict";
import test from "node:test";

import type { ActiveTenantContext } from "../src/lib/auth/session.ts";
import {
  HYPOTHESIS_STATUSES,
  VERSION_STATUSES,
  decisionNoticeFor,
  dimensionsFor,
  formatHypothesisValue,
  hasDimensionPermission,
  hypothesisStatusLabel,
  hypothesisStatusTone,
  versionStatusLabel,
  versionStatusTone,
  type DimensionGrantRow,
} from "../src/lib/budgets/scope.ts";

const BASE: ActiveTenantContext = {
  baseCurrency: "MAD",
  isTenantAdmin: false,
  name: "Tenant",
  role: "contributor",
  tenantId: "tenant-a",
  userEmail: "membre@tarjih-os.com",
  userId: "user-1",
};

const VENTES = { code: "VENTES", id: "dim-ventes", kind: "department", name: "Ventes" };
const ACHATS = { code: "ACHATS", id: "dim-achats", kind: "department", name: "Achats" };

function grant(overrides: Partial<DimensionGrantRow> = {}): DimensionGrantRow {
  return {
    can_approve: false,
    can_contribute: false,
    can_export: false,
    can_read: false,
    dimension_id: VENTES.id,
    ...overrides,
  };
}

test("un DAF tient ses droits de son rôle, sans aucune ligne de grant", () => {
  const daf = { ...BASE, role: "daf" as const };
  assert.equal(hasDimensionPermission(daf, [], VENTES.id, "contribute"), true);
  assert.equal(hasDimensionPermission(daf, [], ACHATS.id, "approve"), true);
});

test("un DG tient également ses droits de son rôle", () => {
  const dg = { ...BASE, role: "dg" as const };
  assert.equal(hasDimensionPermission(dg, [], ACHATS.id, "read"), true);
});

test("un administrateur technique sans grant n’obtient aucun droit financier", () => {
  const admin = { ...BASE, isTenantAdmin: true, role: "tenant_admin" as const };
  for (const permission of ["read", "contribute", "approve", "export"] as const) {
    assert.equal(
      hasDimensionPermission(admin, [], VENTES.id, permission),
      false,
      `l’administration ne doit jamais ouvrir « ${permission} »`,
    );
  }
});

test("un contributeur n’obtient que ce que son grant porte, permission par permission", () => {
  const grants = [grant({ can_contribute: true, can_read: true })];
  assert.equal(hasDimensionPermission(BASE, grants, VENTES.id, "contribute"), true);
  assert.equal(hasDimensionPermission(BASE, grants, VENTES.id, "read"), true);
  assert.equal(hasDimensionPermission(BASE, grants, VENTES.id, "approve"), false);
  assert.equal(hasDimensionPermission(BASE, grants, VENTES.id, "export"), false);
});

test("lire une dimension n’autorise pas à y proposer", () => {
  const grants = [grant({ can_read: true })];
  assert.equal(hasDimensionPermission(BASE, grants, VENTES.id, "contribute"), false);
});

test("un grant sur une dimension n’ouvre rien sur une autre", () => {
  const grants = [grant({ can_contribute: true, dimension_id: ACHATS.id })];
  assert.equal(hasDimensionPermission(BASE, grants, VENTES.id, "contribute"), false);
});

test("le formulaire de proposition n’offre que les dimensions réellement contribuables", () => {
  const grants = [grant({ can_contribute: true, can_read: true }), grant({ can_read: true, dimension_id: ACHATS.id })];
  assert.deepEqual(
    dimensionsFor(BASE, grants, [VENTES, ACHATS], "contribute").map((dimension) => dimension.id),
    [VENTES.id],
  );
});

test("aucun statut de la base ne peut arriver brut à l’écran", () => {
  for (const status of HYPOTHESIS_STATUSES) {
    assert.notEqual(hypothesisStatusLabel(status), status, `« ${status} » doit être traduit`);
  }
  for (const status of VERSION_STATUSES) {
    assert.notEqual(versionStatusLabel(status), status, `« ${status} » doit être traduit`);
  }
});

test("un statut inconnu se dit sans mentir plutôt que de disparaître", () => {
  assert.equal(hypothesisStatusLabel("archived"), "archived");
  assert.equal(versionStatusLabel("archived"), "archived");
});

test("chaque statut porte un ton, et un statut inconnu n’est jamais présenté comme acquis", () => {
  assert.equal(hypothesisStatusTone("approved"), "acquis");
  assert.equal(hypothesisStatusTone("rejected"), "refus");
  assert.equal(versionStatusTone("published"), "acquis");
  assert.equal(versionStatusTone("failed"), "refus");
  assert.equal(hypothesisStatusTone("archived"), "attente");
  assert.equal(versionStatusTone("archived"), "attente");
});

test("un montant reste la chaîne exacte qui a été saisie, sans passer par un flottant", () => {
  assert.equal(formatHypothesisValue({ type: "decimal", value: "1234.567890" }), "1234.567890");
  assert.equal(formatHypothesisValue({ type: "decimal", value: "0.10" }), "0.10");
});

test("une valeur d’une autre forme s’affiche telle qu’elle est stockée", () => {
  assert.equal(formatHypothesisValue(0.08), "0.08");
  assert.equal(formatHypothesisValue(null), "null");
  assert.equal(formatHypothesisValue({ type: "decimal" }), '{"type":"decimal"}');
});

test("chaque refus de la base a son mot, pris de son propre code", () => {
  assert.equal(decisionNoticeFor("40001"), "decision-conflict");
  assert.equal(decisionNoticeFor("55000"), "decision-closed");
  assert.equal(decisionNoticeFor("P0002"), "decision-out-of-scope");
  assert.equal(decisionNoticeFor("22023"), "decision-invalid");
});

test("un refus non répertorié ne se déguise pas en refus connu", () => {
  assert.equal(decisionNoticeFor("42501"), "decision-failed");
  assert.equal(decisionNoticeFor(undefined), "decision-failed");
});
