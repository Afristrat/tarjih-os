"""Pont entre les deux jumeaux, côté moteur.

Jumeau de `apps/web/tests/hypothesis-value-bridge.test.ts` : les deux lisent le
même corpus, `schemas/hypothesis-value.cases.json`. L'interface y prouve qu'elle
produit et relit les formes déclarées ; ce fichier prouve que le moteur les
accepte — et qu'il refuse, avec le code annoncé, celles que l'interface doit
barrer à la saisie.

Modifier `resolvers.py` sans toucher au corpus fait rougir ici ; modifier le
corpus sans toucher à `hypothesis-value.ts` fait rougir là-bas. C'est tout
l'objet de ce fichier : rendre la divergence bruyante au lieu de silencieuse.

Données entièrement fictives, aucune donnée de tenant réel.
"""

from __future__ import annotations

import json
import unittest
from decimal import Decimal
from pathlib import Path
from typing import Any

from tarjih_calculation import ENGINE_VERSION, SnapshotError, calculate

CORPUS_PATH = Path(__file__).resolve().parents[3] / "schemas" / "hypothesis-value.cases.json"
CORPUS: dict[str, Any] = json.loads(CORPUS_PATH.read_text(encoding="utf-8"))
FIXTURES: dict[str, str] = CORPUS["fixtures"]

TENANT = "11111111-1111-4111-8111-111111111111"
VERSION = "22222222-2222-4222-8222-222222222222"


def _snapshot(model: str, hypotheses: list[dict[str, Any]]) -> dict[str, Any]:
    """Référentiel fictif partagé par tous les cas du corpus.

    Les identifiants viennent du corpus lui-même : un compte renommé d'un côté
    sans l'autre ne trouve plus sa contrepartie et le cas échoue.
    """
    return {
        "engine_version": ENGINE_VERSION,
        "model": model,
        "tenant_id": TENANT,
        "version_id": VERSION,
        "currency": "MAD",
        "accounts": [
            {
                "id": FIXTURES["salesAccount"],
                "code": "70",
                "statement": "income_statement",
                "normal_balance": "credit",
            },
            {
                "id": FIXTURES["costAccount"],
                "code": "61",
                "statement": "income_statement",
                "normal_balance": "debit",
            },
        ],
        "periods": [
            {"id": FIXTURES["q1"], "starts_on": "2026-01-01", "ends_on": "2026-03-31"},
            {"id": FIXTURES["q2"], "starts_on": "2026-04-01", "ends_on": "2026-06-30"},
        ],
        "dimensions": [
            {"id": FIXTURES["department"], "code": "ops", "kind": "department"},
            {"id": FIXTURES["product"], "code": "saas", "kind": "product"},
        ],
        "hypotheses": hypotheses,
    }


def _hypothesis(entry: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": entry["id"],
        "dimension_id": entry["dimensionId"],
        "parameter_key": "pont.corpus",
        "unit": "MAD",
        "status": "approved",
        "value": entry["value"],
    }


class Corpus(unittest.TestCase):
    def test_le_corpus_est_charge_et_non_vide(self) -> None:
        """Un corpus tronqué rendrait tout ce fichier vert sans rien mesurer."""
        self.assertTrue(CORPUS_PATH.is_file(), f"corpus introuvable : {CORPUS_PATH}")
        self.assertGreaterEqual(len(CORPUS["accepted"]), 5)
        self.assertGreaterEqual(len(CORPUS["rejected"]), 3)

    def test_les_formes_de_l_interface_sont_acceptees(self) -> None:
        for case in CORPUS["accepted"]:
            with self.subTest(case=case["name"]):
                result = calculate(
                    _snapshot(case["model"], [_hypothesis(item) for item in case["hypotheses"]])
                )
                produced = sorted(
                    (value.dimension_id, value.account_id, value.period_id, value.amount)
                    for value in result.values
                )
                expected = sorted(
                    (
                        item["dimensionId"],
                        item["accountId"],
                        item["periodId"],
                        Decimal(item["amount"]),
                    )
                    for item in case["values"]
                )
                self.assertEqual(produced, expected)

    def test_les_saisies_barrees_par_l_interface_sont_refusees(self) -> None:
        """Le moteur doit refuser, avec le code annoncé, ce que l'écran barre.

        Sans ce contrôle, l'interface pourrait durcir une règle que le moteur
        n'a pas — et refuser une saisie légitime au nom d'un danger imaginaire.
        """
        for case in CORPUS["rejected"]:
            with self.subTest(case=case["name"]):
                entry = {
                    "id": "99999999-9999-4999-8999-999999999999",
                    "dimensionId": case["dimensionId"],
                    "value": case["value"],
                }
                with self.assertRaises(SnapshotError) as raised:
                    calculate(_snapshot(case["model"], [_hypothesis(entry)]))
                self.assertEqual(raised.exception.code, case["engineError"])


if __name__ == "__main__":
    unittest.main()
