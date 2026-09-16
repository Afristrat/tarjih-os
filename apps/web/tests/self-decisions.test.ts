import assert from "node:assert/strict";
import test from "node:test";

import { selfDecidedHypotheses } from "../src/lib/budgets/self-decisions.ts";

/**
 * La séparation des devoirs n'est pas imposée : le tenant réel n'a qu'un
 * membre, interdire à l'auteur d'approuver sa ligne le bloquerait. Elle est
 * rendue VISIBLE — décision d'Amine du 2026-09-16 — et c'est ce prédicat qui
 * porte le badge « Décidée par son auteur » partout où une décision se lit.
 */

const AUTEUR = "u-auteur";
const APPROBATEUR = "u-approbateur";

test("une hypothèse décidée par celui qui l'a proposée est signalée", () => {
  const marquees = selfDecidedHypotheses(
    [
      { id: "h1", proposed_by: AUTEUR },
      { id: "h2", proposed_by: AUTEUR },
      { id: "h3", proposed_by: APPROBATEUR },
    ],
    [
      { decided_by: AUTEUR, hypothesis_id: "h1" },
      { decided_by: APPROBATEUR, hypothesis_id: "h2" },
      { decided_by: APPROBATEUR, hypothesis_id: "h3" },
    ],
  );

  assert.deepEqual([...marquees].sort(), ["h1", "h3"]);
});

test("une décision par un autre, puis une par l'auteur, marque la ligne", () => {
  // Une ligne rejetée par un approbateur puis re-décidée par son auteur porte
  // bien une décision de son auteur : le badge dit « au moins une ».
  const marquees = selfDecidedHypotheses(
    [{ id: "h1", proposed_by: AUTEUR }],
    [
      { decided_by: APPROBATEUR, hypothesis_id: "h1" },
      { decided_by: AUTEUR, hypothesis_id: "h1" },
    ],
  );

  assert.deepEqual([...marquees], ["h1"]);
});

test("sans décision, rien n'est marqué ; une décision orpheline ne marque rien", () => {
  assert.deepEqual([...selfDecidedHypotheses([{ id: "h1", proposed_by: AUTEUR }], [])], []);
  assert.deepEqual(
    [...selfDecidedHypotheses([], [{ decided_by: AUTEUR, hypothesis_id: "h1" }])],
    [],
  );
});
