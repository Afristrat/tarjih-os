import assert from "node:assert/strict";
import test from "node:test";

import { productPillars } from "../src/lib/product.ts";

test("la première tranche expose ses quatre responsabilités sans IA opérationnelle", () => {
  assert.deepEqual(
    productPillars.map(({ title }) => title),
    [
      "Périmètre maîtrisé",
      "Hypothèses gouvernées",
      "Calcul déterministe",
      "Consolidation traçable",
    ],
  );
  assert.equal(
    productPillars.some(({ title }) => title.includes("IA")),
    false,
  );
});
