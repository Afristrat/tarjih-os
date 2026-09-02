"""Cœur de calcul : une fonction pure, un snapshot, un résultat.

Aucun accès réseau, aucune horloge, aucun aléa, aucun état global — c'est ce qui
rend `output_hash` reproductible. FastAPI n'apparaît pas ici et n'apparaîtra que
si le besoin d'exposition est prouvé (task 06 : « cœur pur avant FastAPI »).
"""

from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Final

from tarjih_calculation import identities
from tarjih_calculation.canonical import snapshot_hash, values_hash
from tarjih_calculation.contracts import (
    AMOUNT_SCALE,
    BudgetValue,
    CalculationResult,
    Hypothesis,
    Snapshot,
    SnapshotError,
    parse_snapshot,
)
from tarjih_calculation.resolvers import Contribution, resolve

ENGINE_VERSION: Final[str] = "1.0.0"

# Un produit volume × prix dépasse presque toujours six décimales : la valeur
# publiable doit donc être arrondie à l'échelle de la colonne. L'arrondi
# commercial (0,5 s'éloigne de zéro) est la convention retenue, explicitement,
# faute de règle métier dans les specs.
# ponytail: convention d'arrondi provisoire ; à réexaminer quand le modèle
# économique pilote sera tranché (specs/_source/prd.md:138).
_QUANTUM: Final[Decimal] = Decimal(1).scaleb(-AMOUNT_SCALE)


def _approved_only(snapshot: Snapshot) -> tuple[Hypothesis, ...]:
    """Refuse le snapshot s'il contient autre chose que des hypothèses approuvées.

    Le backend est censé n'envoyer que les hypothèses approuvées
    (`specs/_source/archi.md:91`). En recevoir une autre est un défaut d'amont :
    la filtrer en silence publierait un budget amputé sans que personne ne le
    sache, ce qui est pire qu'un échec visible.
    """
    unapproved = [item.id for item in snapshot.hypotheses if item.status != "approved"]
    if unapproved:
        raise SnapshotError(
            "hypothesis_not_approved",
            f"{len(unapproved)} hypothèse(s) non approuvée(s) dans le snapshot :"
            f" {', '.join(sorted(unapproved))}",
        )
    return snapshot.hypotheses


def _aggregate(contributions: list[Contribution]) -> tuple[BudgetValue, ...]:
    """Somme les contributions sur la clé unique de `budget_values`.

    Deux hypothèses peuvent viser le même triplet — deux lignes de charge sur le
    même compte, par exemple. Elles s'additionnent ; elles ne se remplacent pas.
    """
    totals: dict[tuple[str, str, str], Decimal] = {}
    for contribution in contributions:
        key = (contribution.dimension_id, contribution.account_id, contribution.period_id)
        totals[key] = totals.get(key, Decimal(0)) + contribution.amount

    return tuple(
        BudgetValue(
            dimension_id=dimension_id,
            account_id=account_id,
            period_id=period_id,
            # `+ Decimal(0)` retire le zéro négatif, qui hacherait différemment.
            amount=amount.quantize(_QUANTUM, rounding=ROUND_HALF_UP) + Decimal(0),
        )
        for (dimension_id, account_id, period_id), amount in sorted(totals.items())
    )


def calculate(payload: Any) -> CalculationResult:
    """Calcule un budget. Même entrée, même sortie, même empreinte — toujours."""
    snapshot = parse_snapshot(payload)
    if snapshot.engine_version != ENGINE_VERSION:
        raise SnapshotError(
            "engine_version_mismatch",
            f"snapshot destiné au moteur {snapshot.engine_version},"
            f" moteur présent en {ENGINE_VERSION}",
        )

    input_hash = snapshot_hash(snapshot)
    contributions = resolve(snapshot, _approved_only(snapshot))
    values = _aggregate(contributions)
    identities.check(snapshot, contributions, values)

    return CalculationResult(
        engine_version=ENGINE_VERSION,
        model=snapshot.model,
        input_hash=input_hash,
        output_hash=values_hash(values),
        values=values,
    )
