import assert from "node:assert/strict";
import test from "node:test";

import {
  asHypothesisComparison,
  asValueComparison,
  countApprovable,
  summarizeOutcomes,
} from "../src/lib/budgets/comparison.ts";

const ligne = (outcome: string, baseStatus: string | null, targetStatus: string | null) => ({
  base_status: baseStatus,
  base_unit: baseStatus ? "MAD" : null,
  base_value: baseStatus ? { amounts: [{ amount: "1", period_id: "p" }] } : null,
  dimension_id: "d",
  outcome,
  parameter_key: `${outcome}-${baseStatus ?? "x"}-${targetStatus ?? "x"}`,
  target_status: targetStatus,
  target_unit: targetStatus ? "MAD" : null,
  target_value: targetStatus ? { amounts: [{ amount: "1", period_id: "p" }] } : null,
});

test("une ligne de comparaison se relit telle que la base la rend, et rien d'autre", () => {
  const lue = asHypothesisComparison(ligne("changed", "approved", "proposed"));
  assert.ok(lue);
  assert.equal(lue.outcome, "changed");
  assert.equal(lue.baseStatus, "approved");
  assert.equal(lue.targetStatus, "proposed");

  // Un côté absent reste absent : « — » à l'écran, pas une valeur inventée.
  const ajoutee = asHypothesisComparison(ligne("added", null, "proposed"));
  assert.ok(ajoutee);
  assert.equal(ajoutee.baseStatus, null);
  assert.equal(ajoutee.baseValue, null);

  // Une forme inconnue ne devient pas une ligne : elle est écartée.
  assert.equal(asHypothesisComparison({ outcome: "teleported", dimension_id: "d", parameter_key: "k" }), null);
  assert.equal(asHypothesisComparison(null), null);
});

test("seules les lignes identiques à une approuvée de la base et encore proposées sont approuvables", () => {
  const lignes = [
    ligne("identical", "approved", "proposed"),
    ligne("identical", "approved", "proposed"),
    // Identique à une proposition jamais décidée : personne ne l'a approuvée.
    ligne("identical", "proposed", "proposed"),
    // Déjà décidée dans la cible.
    ligne("identical", "approved", "approved"),
    ligne("changed", "approved", "proposed"),
    ligne("added", null, "proposed"),
    ligne("removed", "approved", null),
  ]
    .map(asHypothesisComparison)
    .flatMap((row) => (row ? [row] : []));

  assert.equal(lignes.length, 7);
  assert.equal(countApprovable(lignes), 2);
  assert.equal(
    summarizeOutcomes(lignes),
    "4 identiques · 1 modifiée · 1 ajoutée · 1 retirée ou rejetée",
  );
  assert.equal(summarizeOutcomes([]), "");
});

test("un montant comparé reste une chaîne, et une absence reste une absence", () => {
  const lue = asValueComparison({
    account_id: "a",
    base_amount: "1440000.000000",
    currency: "MAD",
    delta: "-400000.000000",
    delta_percent: "-27.8",
    dimension_id: "d",
    period_id: "p",
    target_amount: "1040000.000000",
  });
  assert.ok(lue);
  assert.equal(lue.baseAmount, "1440000.000000");
  assert.equal(lue.deltaPercent, "-27.8");

  const nouvelle = asValueComparison({
    account_id: "a",
    base_amount: null,
    currency: "MAD",
    delta: null,
    delta_percent: null,
    dimension_id: "d",
    period_id: "p",
    target_amount: "5000.000000",
  });
  assert.ok(nouvelle);
  assert.equal(nouvelle.baseAmount, null);
  assert.equal(nouvelle.deltaPercent, null);
});
