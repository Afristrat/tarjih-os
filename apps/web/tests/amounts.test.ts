/**
 * Contrôles de l'arithmétique des montants.
 *
 * Ils existent parce que le total de la consolidation a longtemps été calculé
 * en `Number` : une addition de flottants sur des montants à six décimales, dans
 * un produit dont la convention interdit les flottants pour les montants.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  amountFromRow,
  formatAmount,
  fromMicros,
  percentChange,
  subtractAmounts,
  sumAmounts,
  toMicros,
} from "../src/lib/budgets/amounts.ts";

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

test("une variation se calcule sans flottant et se dit à une décimale", () => {
  // La dégradation mesurée le 2026-09-08 : un résultat de 1 365 000 tombé de
  // 1 890 000, soit −27,8 % — quand le total en `Number` affichait −8,7 %.
  assert.equal(percentChange("1890000.000000", "1365000.000000"), "-27.8");
  assert.equal(percentChange("1440000.000000", "1040000.000000"), "-27.8");
  assert.equal(percentChange("100.000000", "100.000000"), "0.0");
  assert.equal(percentChange("100.000000", "150.000000"), "50.0");
  assert.equal(percentChange("200.000000", "201.000000"), "0.5");
  assert.equal(percentChange("3.000000", "4.000000"), "33.3", "arrondi au plus proche");
  assert.equal(percentChange("3.000000", "2.000000"), "-33.3");
  assert.equal(percentChange("1000.000000", "999.960000"), "0.0", "un écart sous la décimale ne s'invente ni chiffre ni signe");
});

test("une variation sans base ne se calcule pas", () => {
  assert.equal(percentChange("0.000000", "10.000000"), null, "rapport à zéro");
  assert.equal(percentChange("oups", "10.000000"), null);
  assert.equal(percentChange("10.000000", ""), null);
});

test("un montant qui arrive en nombre est refusé : il a déjà perdu sa précision", () => {
  // PostgREST sérialise un `numeric` en nombre JSON ; `JSON.parse` le fait
  // passer par un double, et 123456789012345678.123457 devient
  // 123456789012345680. Un `String()` après coup ne rend pas les chiffres perdus :
  // le montant doit arriver en texte (`amount::text`), sinon c'est une erreur
  // de programmation, pas une donnée à afficher.
  assert.equal(amountFromRow("123456789012345678.123457", "budget_values.amount"), "123456789012345678.123457");
  assert.throws(() => amountFromRow(123456789012345680, "budget_values.amount"), /budget_values\.amount.*texte/);
  assert.throws(() => amountFromRow(null, "budget_value_sources.amount"), /budget_value_sources\.amount/);
});

test("un montant se met en forme sans passer par un flottant", () => {
  // Au-delà de 2⁵³, `Number` arrondit ; la chaîne est donnée telle quelle à Intl.
  assert.equal(formatAmount("123456789012345678.123457", "MAD"), "123 456 789 012 345 678,12 MAD");
  assert.equal(formatAmount("1440000.000000", "MAD"), "1 440 000,00 MAD");
  assert.equal(formatAmount("-0.5", "MAD"), "-0,50 MAD");
  // Un texte qui n'est pas un montant est rendu tel quel, jamais « NaN ».
  assert.equal(formatAmount("illisible", "MAD"), "illisible");
});
