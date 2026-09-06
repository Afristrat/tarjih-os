"""Rejeu d'une version déjà publiée.

Une version publiée est immuable et son snapshot d'entrée n'a jamais été
conservé : seule son EMPREINTE l'a été. Rejouer consiste donc à reconstruire la
matière depuis la base, la recalculer, et n'accepter le résultat que si
l'empreinte retrouve celle du run. Sans ce témoin, on ne reconstruirait pas
l'origine d'un chiffre : on en inventerait une plausible.

Données entièrement fictives, aucune donnée de tenant réel.
"""

from __future__ import annotations

import unittest
from typing import Any

from tarjih_calculation import ENGINE_VERSION, calculate
from tarjih_calculation.replay import replay_published

TENANT = "11111111-1111-4111-8111-111111111111"
VERSION = "22222222-2222-4222-8222-222222222222"
DEPARTMENT = "33333333-3333-4333-8333-333333333333"
COST_ACCOUNT = "66666666-6666-4666-8666-666666666666"
Q1 = "77777777-7777-4777-8777-777777777777"
HYP_A = "99999999-9999-4999-8999-999999999999"


def _payload() -> dict[str, Any]:
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
        "hypotheses": [
            {
                "id": HYP_A,
                "dimension_id": DEPARTMENT,
                "parameter_key": "charges.loyer",
                "unit": "MAD",
                "status": "approved",
                "value": {
                    "account_code": "61",
                    "amounts": [{"period_id": Q1, "amount": "1200.50"}],
                },
            }
        ],
    }


def _extrait(input_hash: str) -> dict[str, Any]:
    return {
        "version_id": VERSION,
        "tenant_id": TENANT,
        "run_id": "55555555-5555-4555-8555-555555555555",
        "input_hash": input_hash,
        "payload": _payload(),
    }


class Rejeu(unittest.TestCase):
    def test_une_empreinte_retrouvee_autorise_l_ecriture_des_parts(self) -> None:
        attendu = calculate(_payload()).input_hash

        sources, rapport = replay_published([_extrait(attendu)])

        self.assertEqual(len(sources), 1)
        self.assertEqual(sources[0]["hypothesis_id"], HYP_A)
        self.assertEqual(sources[0]["version_id"], VERSION)
        # Forme canonique, comme pour l'API : les zéros de fin ne portent
        # aucune information et deux graphies du même montant doivent se lire
        # de la même façon.
        self.assertEqual(sources[0]["amount"], "1200.5")
        self.assertEqual(rapport[0]["verdict"], "reconstruite")

    def test_une_empreinte_qui_diverge_n_ecrit_rien(self) -> None:
        """Le cas qui compte : les hypothèses ne produisent plus le même budget.

        Écrire quand même serait raconter une origine que rien ne prouve. Le
        rejeu doit se taire pour cette version-là, et le dire.
        """
        sources, rapport = replay_published([_extrait("0" * 64)])

        self.assertEqual(sources, [])
        self.assertEqual(rapport[0]["verdict"], "empreinte-divergente")

    def test_un_snapshot_que_le_moteur_refuse_n_ecrit_rien(self) -> None:
        extrait = _extrait("0" * 64)
        extrait["payload"]["hypotheses"][0]["status"] = "proposed"

        sources, rapport = replay_published([extrait])

        self.assertEqual(sources, [])
        self.assertEqual(rapport[0]["verdict"], "refuse-par-le-moteur")
        self.assertEqual(rapport[0]["code"], "hypothesis_not_approved")


if __name__ == "__main__":
    unittest.main()
