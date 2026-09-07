"""L'empreinte d'entrée ne doit dépendre que de ce qui produit les chiffres.

Une version publiée est immuable et se prouve par son `input_hash` : rejouer son
snapshot doit retrouver la même empreinte, sinon la promesse d'auditabilité est
creuse. Or le snapshot embarque aujourd'hui TOUT le référentiel du tenant
(`apps/web/src/lib/calculation/snapshot.ts`), y compris des comptes, des
périodes et des dimensions qu'aucune hypothèse ne cite.

Conséquence mesurée en production le 2026-09-06 : la version `c6033eb3` ne
retrouvait plus son empreinte alors qu'aucun de ses chiffres n'avait bougé — son
tenant avait simplement gagné un compte et une période depuis.

Ces contrôles décrivent le DÉFAUT, pas la correction : ils tiennent quelle que
soit la façon dont on le referme (restreindre le snapshot au référentiel
réellement cité, ou conserver le snapshot d'entrée avec la version publiée).
Données entièrement fictives, aucune donnée de tenant réel.
"""

from __future__ import annotations

import unittest
from copy import deepcopy
from typing import Any

from tarjih_calculation import calculate

from test_engine import snapshot

UNUSED_ACCOUNT = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
UNUSED_PERIOD = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
UNUSED_DIMENSION = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"


def _with_unused_reference(**extra: list[dict[str, Any]]) -> dict[str, Any]:
    """Le même snapshot, augmenté d'un objet de référentiel que rien ne cite."""
    enriched = deepcopy(snapshot())
    for key, rows in extra.items():
        enriched[key] = [*enriched[key], *rows]
    return enriched


class ReferentielNonCite(unittest.TestCase):
    """Ajouter au tenant un objet inutilisé ne doit rien changer à l'empreinte."""

    def setUp(self) -> None:
        self.origine = calculate(snapshot())

    def _assert_meme_empreinte(self, augmente: dict[str, Any], quoi: str) -> None:
        rejeu = calculate(augmente)

        # Les chiffres sont bien les mêmes : la divergence d'empreinte, s'il y en
        # a une, est donc parasite et non le signe d'un calcul différent.
        self.assertEqual(rejeu.output_hash, self.origine.output_hash, quoi)
        self.assertEqual(
            [(v.dimension_id, v.account_id, v.period_id, v.amount) for v in rejeu.values],
            [(v.dimension_id, v.account_id, v.period_id, v.amount) for v in self.origine.values],
            quoi,
        )

        self.assertEqual(
            rejeu.input_hash,
            self.origine.input_hash,
            f"{quoi} : l'empreinte d'entrée change alors qu'aucun chiffre ne bouge,"
            " donc une version publiée cesse d'être reproductible",
        )

    def test_un_compte_que_rien_ne_cite_ne_change_pas_l_empreinte(self) -> None:
        self._assert_meme_empreinte(
            _with_unused_reference(
                accounts=[
                    {
                        "id": UNUSED_ACCOUNT,
                        "code": "44",
                        "statement": "balance_sheet",
                        "normal_balance": "debit",
                    }
                ]
            ),
            "un compte ajouté au référentiel",
        )

    def test_une_periode_que_rien_ne_cite_ne_change_pas_l_empreinte(self) -> None:
        self._assert_meme_empreinte(
            _with_unused_reference(
                periods=[{"id": UNUSED_PERIOD, "starts_on": "2026-07-01", "ends_on": "2026-09-30"}]
            ),
            "une période ajoutée au référentiel",
        )

    def test_une_dimension_que_rien_ne_cite_ne_change_pas_l_empreinte(self) -> None:
        self._assert_meme_empreinte(
            _with_unused_reference(
                dimensions=[{"id": UNUSED_DIMENSION, "code": "rd", "kind": "department"}]
            ),
            "une dimension ajoutée au référentiel",
        )


class ReferentielCite(unittest.TestCase):
    """Ce que les hypothèses citent, lui, doit rester DANS l'empreinte.

    Sans ces contrôles, vider entièrement le référentiel de l'empreinte ferait
    passer la classe précédente : on aurait supprimé le symptôme en supprimant la
    preuve.
    """

    def setUp(self) -> None:
        self.origine = calculate(snapshot())

    def test_la_nature_d_un_compte_cite_fait_partie_de_l_empreinte(self) -> None:
        modifie = deepcopy(snapshot())
        # Le compte « 61 » est celui que l'hypothèse cite. On change une de ses
        # propriétés que l'hypothèse NE cite PAS : renommer son code aurait fait
        # bouger l'empreinte par l'hypothèse elle-même, qui est hachée en entier,
        # et le contrôle aurait été vert sans rien prouver.
        modifie["accounts"][1]["normal_balance"] = "credit"

        self.assertNotEqual(calculate(modifie).input_hash, self.origine.input_hash)

    def test_les_bornes_d_une_periode_citee_font_partie_de_l_empreinte(self) -> None:
        modifie = deepcopy(snapshot())
        modifie["periods"][0]["ends_on"] = "2026-04-30"

        self.assertNotEqual(calculate(modifie).input_hash, self.origine.input_hash)

    def test_le_type_d_une_dimension_citee_fait_partie_de_l_empreinte(self) -> None:
        modifie = deepcopy(snapshot())
        modifie["dimensions"][0]["kind"] = "product"

        self.assertNotEqual(calculate(modifie).input_hash, self.origine.input_hash)


class TemoinDeDiscrimination(unittest.TestCase):
    """Le contrôle ci-dessus doit rougir quand un chiffre change RÉELLEMENT."""

    def test_un_montant_modifie_change_bien_l_empreinte(self) -> None:
        origine = calculate(snapshot())

        modifie = deepcopy(snapshot())
        modifie["hypotheses"][0]["value"]["amounts"][0]["amount"] = "1000.51"
        rejeu = calculate(modifie)

        self.assertNotEqual(rejeu.input_hash, origine.input_hash)
        self.assertNotEqual(rejeu.output_hash, origine.output_hash)


if __name__ == "__main__":
    unittest.main()
