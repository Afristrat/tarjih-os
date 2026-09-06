"""Contrôles de la couche HTTP du moteur.

Elle ne décide rien, mais elle est le seul endroit où le résultat quitte Python :
une clé oubliée ici rend la traçabilité invisible au reste du produit sans faire
échouer un seul test du cœur. Données entièrement fictives.
"""

from __future__ import annotations

import os
import unittest
from typing import Any

from fastapi.testclient import TestClient

from tarjih_calculation import ENGINE_VERSION
from tarjih_calculation.api import app

CLE = "cle-de-test-sans-valeur-reelle"

TENANT = "11111111-1111-4111-8111-111111111111"
VERSION = "22222222-2222-4222-8222-222222222222"
DEPARTMENT = "33333333-3333-4333-8333-333333333333"
COST_ACCOUNT = "66666666-6666-4666-8666-666666666666"
Q1 = "77777777-7777-4777-8777-777777777777"
HYP_A = "99999999-9999-4999-8999-999999999999"
HYP_B = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"


def _hypothese(hypothesis_id: str, amount: str) -> dict[str, Any]:
    return {
        "id": hypothesis_id,
        "dimension_id": DEPARTMENT,
        "parameter_key": f"charges.{hypothesis_id[:4]}",
        "unit": "MAD",
        "status": "approved",
        "value": {"account_code": "61", "amounts": [{"period_id": Q1, "amount": amount}]},
    }


def _snapshot() -> dict[str, Any]:
    return {
        "engine_version": ENGINE_VERSION,
        "model": "direct",
        "tenant_id": TENANT,
        "version_id": VERSION,
        "currency": "MAD",
        "accounts": [
            {
                "id": COST_ACCOUNT,
                "code": "61",
                "statement": "income_statement",
                "normal_balance": "debit",
            }
        ],
        "periods": [{"id": Q1, "starts_on": "2026-01-01", "ends_on": "2026-03-31"}],
        "dimensions": [{"id": DEPARTMENT, "code": "ops", "kind": "department"}],
        "hypotheses": [_hypothese(HYP_A, "1000.50"), _hypothese(HYP_B, "99.50")],
    }


class Calculate(unittest.TestCase):
    def setUp(self) -> None:
        self._ancienne_cle = os.environ.get("CALCULATION_SERVICE_TOKEN")
        os.environ["CALCULATION_SERVICE_TOKEN"] = CLE
        self.client = TestClient(app)

    def tearDown(self) -> None:
        if self._ancienne_cle is None:
            os.environ.pop("CALCULATION_SERVICE_TOKEN", None)
        else:
            os.environ["CALCULATION_SERVICE_TOKEN"] = self._ancienne_cle

    def test_la_reponse_porte_la_part_de_chaque_hypothese(self) -> None:
        reponse = self.client.post(
            "/calculate", json=_snapshot(), headers={"X-Service-Key": CLE}
        )

        self.assertEqual(reponse.status_code, 200)
        corps = reponse.json()
        self.assertEqual(len(corps["values"]), 1)
        self.assertEqual(corps["values"][0]["amount"], "1100.000000")
        # Forme canonique : les zéros de fin ne portent pas d'information et
        # deux graphies du même montant doivent donner la même chaîne.
        self.assertEqual(
            sorted(
                (source["hypothesis_id"], source["amount"]) for source in corps["sources"]
            ),
            [(HYP_A, "1000.5"), (HYP_B, "99.5")],
        )
        for source in corps["sources"]:
            self.assertEqual(source["dimension_id"], DEPARTMENT)
            self.assertEqual(source["account_id"], COST_ACCOUNT)
            self.assertEqual(source["period_id"], Q1)

    def test_une_part_garde_ses_decimales_quand_le_montant_publie_est_arrondi(self) -> None:
        """Le cas qui rend la traçabilité utile : un produit volume × prix.

        Le montant publié est arrondi à six décimales ; la part, elle, doit
        rester exacte, sinon l'origine du chiffre serait racontée avec une
        précision que le calcul n'a jamais eue.
        """
        payload = _snapshot()
        payload["model"] = "driver"
        payload["hypotheses"] = [
            {
                "id": HYP_A,
                "dimension_id": DEPARTMENT,
                "parameter_key": "ventes.volume",
                "unit": "MAD",
                "status": "approved",
                "value": {
                    "account_code": "61",
                    "driver": "volume_price",
                    "periods": [
                        {"period_id": Q1, "volume": "3.3333333", "unit_price": "7.7777777"}
                    ],
                },
            }
        ]

        reponse = self.client.post("/calculate", json=payload, headers={"X-Service-Key": CLE})

        self.assertEqual(reponse.status_code, 200)
        corps = reponse.json()
        self.assertEqual(corps["values"][0]["amount"], "25.925925")
        # 33333333 x 77777777 = 2592592540740741, verifie par calcul entier.
        self.assertEqual(corps["sources"][0]["amount"], "25.92592540740741")


if __name__ == "__main__":
    unittest.main()
