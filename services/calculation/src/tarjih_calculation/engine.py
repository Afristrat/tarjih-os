"""Cœur de calcul : une fonction pure, un snapshot, un résultat.

Aucun accès réseau, aucune horloge, aucun aléa, aucun état global — c'est ce qui
rend `output_hash` reproductible. FastAPI n'apparaît pas ici et n'apparaîtra que
si le besoin d'exposition est prouvé (task 06 : « cœur pur avant FastAPI »).
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any, Final

from tarjih_calculation import identities
from tarjih_calculation.canonical import snapshot_hash, values_hash
from tarjih_calculation.contracts import (
    BudgetValue,
    CalculationResult,
    Hypothesis,
    Snapshot,
    SnapshotError,
    ValueSource,
    parse_snapshot,
    to_publishable,
)
from tarjih_calculation.resolvers import Contribution, resolve

# 1.1.0 : `input_hash` ne porte plus que le référentiel cité par les hypothèses.
# La version du moteur est ce qui EXPLIQUE qu'une même matière rende désormais
# une autre empreinte ; sans ce numéro, l'écart serait inexplicable pour qui
# audite un run ancien. Les runs `1.0.0` restent lisibles tels quels, ils ne sont
# simplement plus rejouables à l'identique par ce moteur-ci.
ENGINE_VERSION: Final[str] = "1.1.0"


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
            amount=to_publishable(amount),
        )
        for (dimension_id, account_id, period_id), amount in sorted(totals.items())
    )


def _sources(contributions: list[Contribution]) -> tuple[ValueSource, ...]:
    """Somme les contributions par hypothèse, sans arrondir.

    Une même hypothèse peut apporter plusieurs fois sur le même triplet (deux
    lignes de `amounts` sur la même période) : ses apports se cumulent en une
    seule part, sinon la traçabilité rendrait deux lignes pour une seule cause.
    """
    parts: dict[tuple[str, str, str, str], Decimal] = {}
    for contribution in contributions:
        key = (
            contribution.dimension_id,
            contribution.account_id,
            contribution.period_id,
            contribution.hypothesis_id,
        )
        parts[key] = parts.get(key, Decimal(0)) + contribution.amount

    return tuple(
        ValueSource(
            dimension_id=dimension_id,
            account_id=account_id,
            period_id=period_id,
            hypothesis_id=hypothesis_id,
            amount=amount,
        )
        for (dimension_id, account_id, period_id, hypothesis_id), amount in sorted(parts.items())
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

    # La résolution précède l'empreinte : celle-ci ne porte que le référentiel
    # réellement cité, et c'est la résolution qui dit lequel (`snapshot_hash`).
    contributions = resolve(snapshot, _approved_only(snapshot))
    input_hash = snapshot_hash(snapshot, contributions)
    values = _aggregate(contributions)
    sources = _sources(contributions)
    identities.check(snapshot, contributions, values, sources)

    return CalculationResult(
        engine_version=ENGINE_VERSION,
        model=snapshot.model,
        input_hash=input_hash,
        output_hash=values_hash(values),
        values=values,
        sources=sources,
    )
