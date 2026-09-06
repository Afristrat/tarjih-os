import assert from "node:assert/strict";
import test from "node:test";

import { enCentimes, lire, somme } from "../e2e/montants.ts";

/**
 * La recette juge une addition affichée. Si ces fonctions se trompent, elle
 * déclare juste une addition fausse — l'erreur la plus coûteuse possible pour un
 * contrôle. D'où ces tests : ils mesurent l'instrument de mesure.
 */

test("un montant affiché est lu avec la précision qu’il porte", () => {
  assert.deepEqual(lire("30,01 MAD"), { echelle: 2, valeur: BigInt(3001) });
  assert.deepEqual(lire("10,005"), { echelle: 3, valeur: BigInt(10005) });
  assert.deepEqual(lire("7"), { echelle: 0, valeur: BigInt(7) });
});

test("les espaces de milliers d’Intl ne trompent pas la lecture", () => {
  // Espace insécable puis espace insécable étroite : les deux formes qu'`Intl`
  // produit selon l'environnement. Une seule gérée, et le test lirait « 1,20 ».
  assert.deepEqual(lire("1 200,50 MAD"), { echelle: 2, valeur: BigInt(120050) });
  assert.deepEqual(lire("1 200,50 MAD"), { echelle: 2, valeur: BigInt(120050) });
});

test("un montant négatif garde son signe", () => {
  assert.deepEqual(lire("-0,25"), { echelle: 2, valeur: -BigInt(25) });
  assert.equal(enCentimes(lire("-0,25")), -25);
});

test("un texte sans chiffre est refusé plutôt que lu comme zéro", () => {
  // Un « — » lu comme 0 ferait passer une origine vide pour une addition juste.
  assert.throws(() => lire("—"), /montant illisible/);
});

test("des montants de précisions différentes s’additionnent exactement", () => {
  assert.deepEqual(somme(["10,005", "20,005"]), { echelle: 3, valeur: BigInt(30010) });
  assert.deepEqual(somme(["1 200,50 MAD", "0,005"]), { echelle: 3, valeur: BigInt(1200505) });
});

test("l’addition ne passe jamais par un flottant", () => {
  // 0,1 + 0,2 vaut 0,30000000000000004 en flottant. Ici, exactement 0,3.
  assert.deepEqual(somme(["0,1", "0,2"]), { echelle: 1, valeur: BigInt(3) });

  // Au-delà de ce qu'un double représente sans perte.
  assert.deepEqual(somme(["25,92592540740741", "0,00000000000001"]), {
    echelle: 14,
    valeur: BigInt(2592592540740742),
  });
});

test("l’arrondi en centimes est commercial, comme celui du moteur", () => {
  assert.equal(enCentimes(lire("10,005")), 1001);
  assert.equal(enCentimes(lire("10,004")), 1000);
  assert.equal(enCentimes(lire("-10,005")), -1001);
  assert.equal(enCentimes(lire("30,010")), 3001);
});

test("le cas qui a fait rougir la recette", () => {
  // Deux parts de 10,005 et 20,005 : arrondies SÉPARÉMENT elles font 30,02 ;
  // additionnées puis arrondies, 30,01 — le montant réellement publié.
  const separement = enCentimes(lire("10,005")) + enCentimes(lire("20,005"));
  assert.equal(separement, 3002);
  assert.equal(enCentimes(somme(["10,005", "20,005"])), 3001);
});

test("une liste vide est refusée plutôt que comptée pour zéro", () => {
  assert.throws(() => somme([]), /aucun montant/);
});
