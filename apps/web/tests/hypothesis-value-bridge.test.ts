/**
 * Pont entre les deux jumeaux.
 *
 * `src/lib/budgets/hypothesis-value.ts` et
 * `services/calculation/src/tarjih_calculation/resolvers.py` décrivent la même
 * forme de données, dans deux langages, sans rien qui les relie. Jusqu'ici, en
 * modifier un seul cassait le calcul en silence côté écran — le moteur, lui,
 * refusait, mais après coup.
 *
 * Ce fichier et `services/calculation/tests/test_bridge.py` lisent LE MÊME
 * corpus (`schemas/hypothesis-value.cases.json`). Deux règles y sont vérifiées,
 * chacune d'un côté :
 *
 *   1. tout ce que l'interface PRODUIT, le moteur l'accepte ;
 *   2. tout ce que le moteur ACCEPTE, l'interface sait le relire — sans quoi
 *      elle affiche « non calculable » sur une hypothèse parfaitement valide.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildDirectValue,
  buildVolumePriceValue,
  isCalculable,
  readHypothesisFacts,
  type HypothesisFacts,
  type HypothesisValue,
} from "../src/lib/budgets/hypothesis-value.ts";

type Builder = { fn: string; args: string[] };

type CorpusHypothesis = {
  builder: Builder | null;
  facts: HypothesisFacts;
  value: HypothesisValue;
};

type Corpus = {
  accepted: { hypotheses: CorpusHypothesis[]; name: string }[];
  rejected: { builder: Builder; name: string }[];
};

const corpus = JSON.parse(
  readFileSync(new URL("../../../schemas/hypothesis-value.cases.json", import.meta.url), "utf8"),
) as Corpus;

/**
 * Rejoue un constructeur nommé dans le corpus.
 *
 * L'arité est vérifiée ici : un constructeur qui gagnerait un paramètre sans
 * que le corpus le sache doit échouer bruyamment, pas recevoir `undefined`.
 */
function invoke(builder: Builder): HypothesisValue | null {
  const [first, second, third, fourth] = builder.args;

  if (builder.fn === "buildDirectValue") {
    assert.equal(builder.args.length, 3, `${builder.fn} : trois arguments attendus`);
    return buildDirectValue(first ?? "", second ?? "", third ?? "");
  }

  if (builder.fn === "buildVolumePriceValue") {
    assert.equal(builder.args.length, 4, `${builder.fn} : quatre arguments attendus`);
    return buildVolumePriceValue(first ?? "", second ?? "", third ?? "", fourth ?? "");
  }

  throw new Error(`constructeur « ${builder.fn} » inconnu du pont`);
}

// Le corpus ne sert à rien s'il est vide : un fichier tronqué rendrait ce
// fichier vert sans rien mesurer.
test("le corpus partagé est chargé et non vide", () => {
  assert.ok(corpus.accepted.length >= 5, "au moins cinq formes acceptées");
  assert.ok(corpus.rejected.length >= 3, "au moins trois saisies refusées");
});

for (const scenario of corpus.accepted) {
  test(`forme acceptée par le moteur — ${scenario.name}`, () => {
    for (const hypothesis of scenario.hypotheses) {
      if (hypothesis.builder !== null) {
        assert.deepEqual(
          invoke(hypothesis.builder),
          hypothesis.value,
          "l'interface ne produit plus la forme que le moteur attend",
        );
      }

      assert.deepEqual(
        readHypothesisFacts(hypothesis.value),
        hypothesis.facts,
        "l'interface ne relit plus correctement une forme que le moteur accepte",
      );

      assert.equal(
        isCalculable(hypothesis.value),
        true,
        "l'écran déclarerait « non calculable » une hypothèse que le moteur calcule",
      );
    }
  });
}

for (const scenario of corpus.rejected) {
  test(`saisie que l'interface doit refuser — ${scenario.name}`, () => {
    assert.equal(
      invoke(scenario.builder),
      null,
      "l'interface laisse passer une valeur que le moteur refusera",
    );
  });
}
