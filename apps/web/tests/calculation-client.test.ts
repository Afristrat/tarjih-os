import assert from "node:assert/strict";
import test from "node:test";

import { readCalculationBody } from "../src/lib/calculation/client.ts";

const DIMENSION = "11111111-1111-4111-8111-111111111111";
const ACCOUNT = "22222222-2222-4222-8222-222222222222";
const PERIOD = "33333333-3333-4333-8333-333333333333";
const HYPOTHESIS = "44444444-4444-4444-8444-444444444444";

function corps(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    engine_version: "1.0.0",
    input_hash: "a".repeat(64),
    output_hash: "b".repeat(64),
    values: [
      {
        dimension_id: DIMENSION,
        account_id: ACCOUNT,
        period_id: PERIOD,
        amount: "1100.000000",
      },
    ],
    sources: [
      {
        dimension_id: DIMENSION,
        account_id: ACCOUNT,
        period_id: PERIOD,
        hypothesis_id: HYPOTHESIS,
        amount: "1100",
      },
    ],
    ...extra,
  };
}

test("un résultat porte la part de chaque hypothèse dans chaque montant", () => {
  const outcome = readCalculationBody(200, true, corps());

  assert.equal(outcome.status, "calculated");
  if (outcome.status !== "calculated") {
    return;
  }
  assert.deepEqual(outcome.sources, [
    {
      accountId: ACCOUNT,
      amount: "1100",
      dimensionId: DIMENSION,
      hypothesisId: HYPOTHESIS,
      periodId: PERIOD,
    },
  ]);
});

test("un résultat sans origine est refusé plutôt que publié", () => {
  const sansSources = corps();
  delete sansSources.sources;

  const outcome = readCalculationBody(200, true, sansSources);

  // Publier des montants dont on ne sait plus dire d'où ils viennent est
  // exactement le défaut que la task 07 ferme : mieux vaut ne rien publier.
  assert.equal(outcome.status, "unavailable");
});

test("une part sans hypothèse nommée est refusée", () => {
  const outcome = readCalculationBody(
    200,
    true,
    corps({
      sources: [
        { dimension_id: DIMENSION, account_id: ACCOUNT, period_id: PERIOD, amount: "1100" },
      ],
    }),
  );

  assert.equal(outcome.status, "unavailable");
});

test("un snapshot refusé reste un refus, pas une panne", () => {
  const outcome = readCalculationBody(422, false, {
    code: "hypothesis_not_approved",
    message: "une hypothèse non approuvée",
  });

  assert.equal(outcome.status, "refused");
  if (outcome.status !== "refused") {
    return;
  }
  assert.equal(outcome.code, "hypothesis_not_approved");
});
