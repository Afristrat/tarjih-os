import assert from "node:assert/strict";
import test from "node:test";

import { decimalValue, normalizedCode } from "../src/lib/forms/values.ts";

test("un libellé accentué devient un code stable", () => {
  assert.equal(normalizedCode("Direction générale"), "DIRECTION_GENERALE");
});

test("un montant reste une chaîne décimale exacte", () => {
  assert.deepEqual(decimalValue(" 1200,50 "), { type: "decimal", value: "1200.50" });
  assert.equal(decimalValue("12e3"), null);
  assert.equal(decimalValue("1.1234567"), null);
});
