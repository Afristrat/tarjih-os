"""Contrôles d'identité financière.

Le moteur préfère ne rien rendre plutôt que rendre un budget incohérent : un
échec ici remonte au backend, qui n'écrira aucune valeur et marquera le run en
échec (`specs/_source/archi.md:97-98`).

Ces contrôles portent sur ce que le calcul garantit vraiment — conservation des
montants, unicité de la clé publiable, respect du domaine `numeric(24, 6)`,
appartenance au référentiel du snapshot. Ils ne valident pas la pertinence
économique d'un modèle : cela relève des formules, pas de l'arithmétique.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Final

from tarjih_calculation.contracts import (
    AMOUNT_MAX,
    AMOUNT_SCALE,
    BudgetValue,
    Snapshot,
    SnapshotError,
)
from tarjih_calculation.resolvers import Contribution

# Chaque ligne publiée est arrondie à l'échelle de la colonne ; la somme des
# arrondis peut donc s'écarter de l'arrondi de la somme d'une demi-unité de
# dernière décimale par ligne. Au-delà, l'écart ne vient plus de l'arrondi.
_ROUNDING_UNIT: Final[Decimal] = Decimal(1).scaleb(-AMOUNT_SCALE)


def _fail(code: str, message: str) -> None:
    raise SnapshotError(code, message)


def check(
    snapshot: Snapshot, contributions: list[Contribution], values: tuple[BudgetValue, ...]
) -> None:
    """Vérifie le résultat avant publication. Lève à la première incohérence."""
    account_ids = {account.id for account in snapshot.accounts}
    period_ids = {period.id for period in snapshot.periods}
    dimension_ids = {dimension.id for dimension in snapshot.dimensions}

    seen: set[tuple[str, str, str]] = set()
    for value in values:
        key = (value.dimension_id, value.account_id, value.period_id)
        if key in seen:
            _fail(
                "identity_duplicate",
                "deux valeurs visent la même dimension, le même compte et la même"
                " période : la clé unique de budget_values serait violée",
            )
        seen.add(key)

        if value.dimension_id not in dimension_ids:
            _fail("identity_scope", "une valeur porte une dimension hors du snapshot")
        if value.account_id not in account_ids:
            _fail("identity_scope", "une valeur porte un compte hors du snapshot")
        if value.period_id not in period_ids:
            _fail("identity_scope", "une valeur porte une période hors du snapshot")

        if not value.amount.is_finite():
            _fail("identity_amount", "une valeur n'est pas un montant fini")
        if abs(value.amount) > AMOUNT_MAX:
            _fail("identity_overflow", "une valeur dépasse le domaine numeric(24, 6)")
        exponent = value.amount.as_tuple().exponent
        if isinstance(exponent, int) and -exponent > AMOUNT_SCALE:
            _fail("identity_scale", "une valeur porte plus de six décimales")

    # Conservation : rien ne se perd ni ne se crée entre les contributions et les
    # lignes publiées, à la dérive d'arrondi près.
    total_in = sum((item.amount for item in contributions), Decimal(0))
    total_out = sum((value.amount for value in values), Decimal(0))
    tolerance = _ROUNDING_UNIT * len(values) if values else Decimal(0)
    if abs(total_out - total_in) > tolerance:
        _fail(
            "identity_conservation",
            f"la somme publiée s'écarte de la somme calculée de {total_out - total_in}",
        )
