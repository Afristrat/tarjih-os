import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDirectValue,
  buildVolumePriceValue,
  isCalculable,
  readHypothesisFacts,
} from "../src/lib/budgets/hypothesis-value.ts";
import { normalizedCode } from "../src/lib/forms/values.ts";

const PERIOD = "77777777-7777-4777-8777-777777777777";

test("un libellé accentué devient un code stable", () => {
  assert.equal(normalizedCode("Direction générale"), "DIRECTION_GENERALE");
});

// Ces contrôles portaient sur `decimalValue`, qui produisait un montant sans
// dire sur quoi il portait. La règle demeure — un montant reste une chaîne
// décimale exacte — mais elle s'applique désormais à la valeur que le moteur
// sait lire.
test("un montant reste une chaîne décimale exacte", () => {
  assert.deepEqual(buildDirectValue("61", PERIOD, " 1200,50 "), {
    account_code: "61",
    amounts: [{ amount: "1200.50", period_id: PERIOD }],
  });
  assert.equal(buildDirectValue("61", PERIOD, "12e3"), null);
  assert.equal(buildDirectValue("61", PERIOD, "1.1234567"), null);
});

test("un inducteur porte son volume et son prix, jamais leur produit", () => {
  assert.deepEqual(buildVolumePriceValue("70", PERIOD, "100", "12.5"), {
    account_code: "70",
    driver: "volume_price",
    periods: [{ period_id: PERIOD, unit_price: "12.5", volume: "100" }],
  });
  assert.equal(buildVolumePriceValue("70", PERIOD, "100", "abc"), null);
});

test("une hypothèse relue rend le compte et la période qu'elle vise", () => {
  const facts = readHypothesisFacts(buildDirectValue("61", PERIOD, "10"));
  assert.equal(facts.accountCode, "61");
  assert.equal(facts.periodId, PERIOD);
  assert.equal(facts.amount, "10");
  assert.equal(facts.driver, null);
});

// La forme historique est encore en base : elle doit rester affichable, mais
// jamais passer pour calculable — elle ne dit ni le compte ni la période.
test("la forme historique reste lisible mais n'est pas calculable", () => {
  const legacy = { type: "decimal", value: "1200.50" };
  assert.equal(readHypothesisFacts(legacy).amount, "1200.50");
  assert.equal(readHypothesisFacts(legacy).accountCode, null);
  assert.equal(isCalculable(legacy), false);
  assert.equal(isCalculable(buildDirectValue("61", PERIOD, "10")), true);
});
