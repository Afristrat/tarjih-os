import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDirectValue,
  buildPercentOfValue,
  buildVolumePriceValue,
  isCalculable,
  readHypothesisFacts,
  rebuildValue,
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

test("une hypothèse portant plusieurs périodes le dit au lieu de n'en montrer qu'une", () => {
  // L'écran n'affiche que la première période. Tant qu'aucun chemin n'en produit
  // deux, le raccourci tient — mais s'il en arrivait une, un affichage tronqué
  // SANS le dire ferait prendre une part pour le tout, sur un chiffre financier.
  const deuxPeriodes = {
    account_code: "61",
    amounts: [
      { period_id: PERIOD, amount: "10" },
      { period_id: "99999999-9999-4999-8999-999999999999", amount: "20" },
    ],
  };

  assert.equal(readHypothesisFacts(deuxPeriodes).periodCount, 2);
  assert.equal(readHypothesisFacts(buildDirectValue("61", PERIOD, "10")).periodCount, 1);
});

test("un taux se construit avec sa base, et refuse ce que le moteur refuserait", () => {
  assert.deepEqual(buildPercentOfValue("6136", "712", PERIOD, "0.05"), {
    account_code: "6136",
    base_account_code: "712",
    driver: "percent_of",
    period_ids: [PERIOD],
    rate: "0.05",
  });

  // Les bornes du moteur (`resolvers.RATE_MIN`/`RATE_MAX`), vérifiées ici pour
  // que le refus tombe à la saisie et non à la publication — où il ferait
  // échouer le calcul de toute la version, hypothèses des autres comprises.
  assert.equal(buildPercentOfValue("6136", "712", PERIOD, "35"), null, "35 n'est pas 35 %");
  assert.equal(buildPercentOfValue("6136", "712", PERIOD, "-10.5"), null);
  assert.deepEqual(buildPercentOfValue("6136", "712", PERIOD, "10"), {
    account_code: "6136",
    base_account_code: "712",
    driver: "percent_of",
    period_ids: [PERIOD],
    rate: "10",
  });

  // Un compte qui serait sa propre base ne se résoudrait jamais.
  assert.equal(buildPercentOfValue("712", "712", PERIOD, "0.05"), null);
  assert.equal(buildPercentOfValue("6136", "", PERIOD, "0.05"), null);
  assert.equal(buildPercentOfValue("6136", "712", PERIOD, "cinq pour cent"), null);
});

// Corriger ou décider un chiffre reconstruit la valeur autour des faits déjà
// en base : compte, période, inducteur, base. Jusqu'au 2026-09-13, la
// reconstruction ne connaissait que deux formes — un taux corrigé devenait une
// saisie directe dans une version « inducteurs », que le moteur aurait refusée
// à la publication, hypothèses des autres comprises.
test("une correction garde la forme de l'hypothèse : un taux reste un taux, sur la même base", () => {
  const champs = (valeurs: Record<string, string>) => (nom: string) => valeurs[nom] ?? null;

  const taux = readHypothesisFacts(buildPercentOfValue("6136", "712", PERIOD, "0.05"));
  assert.equal(taux.baseAccountCode, "712");
  assert.deepEqual(rebuildValue(taux, champs({ rate: "0.06", value: "999" })), {
    account_code: "6136",
    base_account_code: "712",
    driver: "percent_of",
    period_ids: [PERIOD],
    rate: "0.06",
  });
  assert.equal(rebuildValue(taux, champs({ rate: "35" })), null, "hors bornes : refusé ici aussi");

  const inducteur = readHypothesisFacts(buildVolumePriceValue("712", PERIOD, "320", "4500"));
  assert.equal(inducteur.baseAccountCode, null);
  assert.deepEqual(
    rebuildValue(inducteur, champs({ volume: "340", unit_price: "4500" })),
    buildVolumePriceValue("712", PERIOD, "340", "4500"),
  );

  const direct = readHypothesisFacts(buildDirectValue("61", PERIOD, "10"));
  assert.deepEqual(rebuildValue(direct, champs({ value: "12.50" })), buildDirectValue("61", PERIOD, "12.50"));
  assert.deepEqual(
    rebuildValue(direct, champs({ replacement_value: "12.50" }), "replacement_value"),
    buildDirectValue("61", PERIOD, "12.50"),
  );

  // Sans compte ni période, rien ne se reconstruit : l'écran refuse plutôt que
  // d'écrire une valeur que le moteur rejettera plus tard.
  assert.equal(rebuildValue(readHypothesisFacts({ type: "decimal", value: "1" }), champs({ value: "2" })), null);
});
