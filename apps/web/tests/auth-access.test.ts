import assert from "node:assert/strict";
import test from "node:test";

import {
  signInFailureReason,
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

test("une panne du service d’authentification n’est pas annoncée comme un mot de passe faux", () => {
  // Constaté en production : GoTrue rendait un 500 et l’écran affichait « mot de
  // passe incorrect ». L’utilisateur change alors un mot de passe correct, par
  // un flux de réinitialisation qui passe par le service en panne.
  assert.equal(signInFailureReason({ status: 500 }), "service-unavailable");
  assert.equal(signInFailureReason({ status: 503 }), "service-unavailable");
});

test("des identifiants refusés restent des identifiants refusés", () => {
  // Le refus ne distingue JAMAIS « adresse inconnue » de « mot de passe faux » :
  // cela permettrait d’énumérer les comptes. Distinguer une panne n’expose rien.
  assert.equal(signInFailureReason({ status: 400 }), "invalid-credentials");
  assert.equal(signInFailureReason({ status: 401 }), "invalid-credentials");
});

test("une erreur sans statut est traitée comme une panne, pas comme un refus", () => {
  // Une panne réseau n’a pas de statut. La prendre pour un refus ferait douter
  // l’utilisateur de son mot de passe alors que rien ne l’a vérifié.
  assert.equal(signInFailureReason({}), "service-unavailable");
  assert.equal(signInFailureReason({ status: undefined }), "service-unavailable");
});
