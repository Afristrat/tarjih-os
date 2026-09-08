/**
 * Contrôles de l'arithmétique des montants.
 *
 * Ils existent parce que le total de la consolidation a longtemps été calculé
 * en `Number` : une addition de flottants sur des montants à six décimales, dans
 * un produit dont la convention interdit les flottants pour les montants.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { fromMicros, subtractAmounts, sumAmounts, toMicros } from "../src/lib/budgets/amounts.ts";

test("un montant fait l'aller-retour sans rien perdre", () => {
  for (const montant of ["0.000000", "1234.560000", "-90000.000000", "10.005000", "0.000001"]) {
    const micros = toMicros(montant);
    assert.notEqual(micros, null, montant);
    assert.equal(fromMicros(micros as bigint), montant);
  }

  // Les formes courtes sont complétées à l'échelle de la colonne.
  assert.equal(fromMicros(toMicros("1234.5") as bigint), "1234.500000");
  assert.equal(fromMicros(toMicros("7") as bigint), "7.000000");
});

test("une addition que le flottant raterait tombe juste", () => {
  // 0,1 + 0,2 vaut 0,30000000000000004 en flottant binaire.
  assert.equal(sumAmounts(["0.1", "0.2"]), "0.300000");

  // Au-delà de la précision d'un double (≈ 9·10¹⁵), le flottant perd le dernier
  // dirham ; la colonne `numeric(24, 6)`, elle, l'accepte.
  assert.equal(sumAmounts(["9007199254740993", "1"]), "9007199254740994.000000");
});

test("le budget publié se totalise au dirham près", () => {
  const produits = sumAmounts(["1440000.000000", "1530000.000000", "1080000.000000", "1620000.000000"]);
  const charges = sumAmounts([
    "72000.000000", "76500.000000", "54000.000000", "81000.000000",
    "624000.000000", "624000.000000", "624000.000000", "624000.000000",
    "90000.000000", "90000.000000", "90000.000000", "90000.000000",
  ]);

  assert.equal(produits, "5670000.000000");
  assert.equal(charges, "3139500.000000");
  assert.equal(subtractAmounts(produits as string, charges as string), "2530500.000000");
});

test("un montant illisible ne vaut pas zéro", () => {
  // Le confondre avec zéro ferait mentir un total en silence — le défaut même
  // que ce module corrige.
  assert.equal(toMicros("mille"), null);
  assert.equal(toMicros("1e6"), null, "la notation scientifique n'est pas une forme de la colonne");
  assert.equal(toMicros("1.1234567"), null, "sept décimales dépassent l'échelle");
  assert.equal(sumAmounts(["100.000000", "oups"]), null);
  assert.equal(subtractAmounts("100.000000", ""), null);
});

test("un résultat négatif reste lisible", () => {
  assert.equal(subtractAmounts("100.000000", "250.500000"), "-150.500000");
  assert.equal(sumAmounts(["-0.500000", "0.250000"]), "-0.250000");
});
