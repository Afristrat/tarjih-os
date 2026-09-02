"""Contrôles du moteur. Données entièrement fictives, aucune donnée de tenant réel."""

from __future__ import annotations

import unittest
from copy import deepcopy
from decimal import Decimal
from typing import Any

from tarjih_calculation import ENGINE_VERSION, SnapshotError, calculate

TENANT = "11111111-1111-4111-8111-111111111111"
VERSION = "22222222-2222-4222-8222-222222222222"
DEPARTMENT = "33333333-3333-4333-8333-333333333333"
PRODUCT = "44444444-4444-4444-8444-444444444444"
SALES_ACCOUNT = "55555555-5555-4555-8555-555555555555"
COST_ACCOUNT = "66666666-6666-4666-8666-666666666666"
Q1 = "77777777-7777-4777-8777-777777777777"
Q2 = "88888888-8888-4888-8888-888888888888"
HYP_A = "99999999-9999-4999-8999-999999999999"
HYP_B = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"


def snapshot(model: str = "direct", hypotheses: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    """Snapshot fictif minimal, valide par défaut."""
    return {
        "engine_version": ENGINE_VERSION,
        "model": model,
        "tenant_id": TENANT,
        "version_id": VERSION,
        "currency": "MAD",
        "accounts": [
            {
                "id": SALES_ACCOUNT,
                "code": "70",
                "statement": "income_statement",
                "normal_balance": "credit",
            },
            {
                "id": COST_ACCOUNT,
                "code": "61",
                "statement": "income_statement",
                "normal_balance": "debit",
            },
        ],
        "periods": [
            {"id": Q1, "starts_on": "2026-01-01", "ends_on": "2026-03-31"},
            {"id": Q2, "starts_on": "2026-04-01", "ends_on": "2026-06-30"},
        ],
        "dimensions": [
            {"id": DEPARTMENT, "code": "ops", "kind": "department"},
            {"id": PRODUCT, "code": "saas", "kind": "product"},
        ],
        "hypotheses": hypotheses if hypotheses is not None else [direct_hypothesis()],
    }


def direct_hypothesis(
    hypothesis_id: str = HYP_A,
    dimension_id: str = DEPARTMENT,
    account_code: str = "61",
    amount: str = "1000.50",
    period_id: str = Q1,
) -> dict[str, Any]:
    return {
        "id": hypothesis_id,
        "dimension_id": dimension_id,
        "parameter_key": "charges.loyer",
        "unit": "MAD",
        "status": "approved",
        "value": {
            "account_code": account_code,
            "amounts": [{"period_id": period_id, "amount": amount}],
        },
    }


class DirectModel(unittest.TestCase):
    def test_montant_publie_tel_quel(self) -> None:
        result = calculate(snapshot())
        self.assertEqual(len(result.values), 1)
        value = result.values[0]
        self.assertEqual(value.amount, Decimal("1000.500000"))
        self.assertEqual(value.dimension_id, DEPARTMENT)
        self.assertEqual(value.account_id, COST_ACCOUNT)
        self.assertEqual(value.period_id, Q1)

    def test_deux_hypotheses_sur_le_meme_triplet_s_additionnent(self) -> None:
        result = calculate(
            snapshot(
                hypotheses=[
                    direct_hypothesis(amount="1000.50"),
                    direct_hypothesis(hypothesis_id=HYP_B, amount="99.50"),
                ]
            )
        )
        self.assertEqual(len(result.values), 1)
        self.assertEqual(result.values[0].amount, Decimal("1100.000000"))

    def test_compte_inconnu_refuse(self) -> None:
        with self.assertRaises(SnapshotError) as caught:
            calculate(snapshot(hypotheses=[direct_hypothesis(account_code="99")]))
        self.assertEqual(caught.exception.code, "account_unknown")

    def test_montant_flottant_refuse(self) -> None:
        payload = snapshot()
        payload["hypotheses"][0]["value"]["amounts"][0]["amount"] = 1000.5
        with self.assertRaises(SnapshotError) as caught:
            calculate(payload)
        self.assertEqual(caught.exception.code, "amount_not_exact")


class Determinisme(unittest.TestCase):
    def test_deux_executions_donnent_la_meme_empreinte(self) -> None:
        first = calculate(snapshot())
        second = calculate(snapshot())
        self.assertEqual(first.input_hash, second.input_hash)
        self.assertEqual(first.output_hash, second.output_hash)
        self.assertRegex(first.input_hash, r"^[0-9a-f]{64}$")
        self.assertRegex(first.output_hash, r"^[0-9a-f]{64}$")

    def test_ordre_de_lecture_sans_effet_sur_l_empreinte(self) -> None:
        payload = snapshot(
            hypotheses=[
                direct_hypothesis(amount="10"),
                direct_hypothesis(hypothesis_id=HYP_B, amount="20", period_id=Q2),
            ]
        )
        permuted = deepcopy(payload)
        permuted["hypotheses"].reverse()
        permuted["accounts"].reverse()
        permuted["periods"].reverse()
        self.assertEqual(calculate(payload).input_hash, calculate(permuted).input_hash)
        self.assertEqual(calculate(payload).output_hash, calculate(permuted).output_hash)

    def test_ecriture_equivalente_du_montant_sans_effet(self) -> None:
        left = calculate(snapshot(hypotheses=[direct_hypothesis(amount="10")]))
        right = calculate(snapshot(hypotheses=[direct_hypothesis(amount="10.000000")]))
        self.assertEqual(left.output_hash, right.output_hash)

    def test_montant_different_change_l_empreinte(self) -> None:
        left = calculate(snapshot(hypotheses=[direct_hypothesis(amount="10")]))
        right = calculate(snapshot(hypotheses=[direct_hypothesis(amount="10.000001")]))
        self.assertNotEqual(left.output_hash, right.output_hash)


class Gouvernance(unittest.TestCase):
    def test_hypothese_non_approuvee_refusee(self) -> None:
        payload = snapshot()
        payload["hypotheses"][0]["status"] = "proposed"
        with self.assertRaises(SnapshotError) as caught:
            calculate(payload)
        self.assertEqual(caught.exception.code, "hypothesis_not_approved")

    def test_hypothese_rejetee_refusee(self) -> None:
        payload = snapshot()
        payload["hypotheses"][0]["status"] = "rejected"
        with self.assertRaises(SnapshotError) as caught:
            calculate(payload)
        self.assertEqual(caught.exception.code, "hypothesis_not_approved")

    def test_version_de_moteur_incompatible_refusee(self) -> None:
        payload = snapshot()
        payload["engine_version"] = "9.9.9"
        with self.assertRaises(SnapshotError) as caught:
            calculate(payload)
        self.assertEqual(caught.exception.code, "engine_version_mismatch")

    def test_devise_non_iso_refusee(self) -> None:
        payload = snapshot()
        payload["currency"] = "dirham"
        with self.assertRaises(SnapshotError) as caught:
            calculate(payload)
        self.assertEqual(caught.exception.code, "currency_invalid")


class CostCenterModel(unittest.TestCase):
    def test_charge_sur_departement_acceptee(self) -> None:
        result = calculate(snapshot(model="cost_center"))
        self.assertEqual(result.values[0].amount, Decimal("1000.500000"))

    def test_compte_de_produit_refuse(self) -> None:
        with self.assertRaises(SnapshotError) as caught:
            calculate(
                snapshot(model="cost_center", hypotheses=[direct_hypothesis(account_code="70")])
            )
        self.assertEqual(caught.exception.code, "model_scope")

    def test_dimension_non_departement_refusee(self) -> None:
        with self.assertRaises(SnapshotError) as caught:
            calculate(
                snapshot(model="cost_center", hypotheses=[direct_hypothesis(dimension_id=PRODUCT)])
            )
        self.assertEqual(caught.exception.code, "model_scope")


def volume_price(period_id: str = Q1, volume: str = "100", unit_price: str = "12.5") -> dict[str, Any]:
    return {
        "id": HYP_A,
        "dimension_id": PRODUCT,
        "parameter_key": "ventes.licences",
        "unit": "MAD",
        "status": "approved",
        "value": {
            "driver": "volume_price",
            "account_code": "70",
            "periods": [{"period_id": period_id, "volume": volume, "unit_price": unit_price}],
        },
    }


def percent_of(rate: str = "0.35", base_code: str = "70") -> dict[str, Any]:
    return {
        "id": HYP_B,
        "dimension_id": PRODUCT,
        "parameter_key": "charges.commissions",
        "unit": "ratio",
        "status": "approved",
        "value": {
            "driver": "percent_of",
            "account_code": "61",
            "base_account_code": base_code,
            "rate": rate,
            "period_ids": [Q1],
        },
    }


class DriverModel(unittest.TestCase):
    def test_volume_fois_prix(self) -> None:
        result = calculate(snapshot(model="driver", hypotheses=[volume_price()]))
        self.assertEqual(result.values[0].amount, Decimal("1250.000000"))

    def test_taux_applique_a_une_base_resolue(self) -> None:
        result = calculate(snapshot(model="driver", hypotheses=[volume_price(), percent_of()]))
        amounts = {value.account_id: value.amount for value in result.values}
        self.assertEqual(amounts[SALES_ACCOUNT], Decimal("1250.000000"))
        self.assertEqual(amounts[COST_ACCOUNT], Decimal("437.500000"))

    def test_ordre_des_hypotheses_sans_effet_sur_le_taux(self) -> None:
        direct_order = calculate(snapshot(model="driver", hypotheses=[volume_price(), percent_of()]))
        reverse_order = calculate(
            snapshot(model="driver", hypotheses=[percent_of(), volume_price()])
        )
        self.assertEqual(direct_order.output_hash, reverse_order.output_hash)

    def test_taux_sans_base_refuse(self) -> None:
        with self.assertRaises(SnapshotError) as caught:
            calculate(snapshot(model="driver", hypotheses=[percent_of()]))
        self.assertEqual(caught.exception.code, "base_missing")

    def test_taux_en_points_de_pourcentage_refuse(self) -> None:
        with self.assertRaises(SnapshotError) as caught:
            calculate(snapshot(model="driver", hypotheses=[volume_price(), percent_of(rate="35")]))
        self.assertEqual(caught.exception.code, "rate_out_of_range")

    def test_inducteur_inconnu_refuse(self) -> None:
        payload = snapshot(model="driver", hypotheses=[volume_price()])
        payload["hypotheses"][0]["value"]["driver"] = "magie"
        with self.assertRaises(SnapshotError) as caught:
            calculate(payload)
        self.assertEqual(caught.exception.code, "driver_unknown")

    def test_arrondi_a_six_decimales(self) -> None:
        result = calculate(
            snapshot(
                model="driver",
                hypotheses=[volume_price(volume="3", unit_price="0.3333335")],
            )
        )
        self.assertEqual(result.values[0].amount, Decimal("1.000001"))


class Identites(unittest.TestCase):
    def test_conservation_des_montants(self) -> None:
        result = calculate(
            snapshot(
                hypotheses=[
                    direct_hypothesis(amount="10.25"),
                    direct_hypothesis(hypothesis_id=HYP_B, amount="4.75", period_id=Q2),
                ]
            )
        )
        self.assertEqual(
            sum(value.amount for value in result.values), Decimal("15.000000")
        )

    def test_periode_hors_snapshot_refusee(self) -> None:
        with self.assertRaises(SnapshotError) as caught:
            calculate(snapshot(hypotheses=[direct_hypothesis(period_id=TENANT)]))
        self.assertEqual(caught.exception.code, "period_unknown")

    def test_montant_hors_domaine_refuse(self) -> None:
        with self.assertRaises(SnapshotError) as caught:
            calculate(snapshot(hypotheses=[direct_hypothesis(amount="1" + "0" * 19)]))
        self.assertEqual(caught.exception.code, "amount_overflow")

    def test_trop_de_decimales_refuse(self) -> None:
        with self.assertRaises(SnapshotError) as caught:
            calculate(snapshot(hypotheses=[direct_hypothesis(amount="1.1234567")]))
        self.assertEqual(caught.exception.code, "amount_scale")


if __name__ == "__main__":
    unittest.main()
