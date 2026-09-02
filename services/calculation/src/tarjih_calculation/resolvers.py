"""Résolution d'une hypothèse approuvée en contributions chiffrées.

C'est le seul endroit où les trois modèles diffèrent. Ils partagent le reste du
pipeline — validation, agrégation, contrôles d'identité, empreinte — pour qu'il
n'existe jamais trois vérités financières concurrentes dans le produit.

- `direct`      : l'hypothèse porte le montant. Aucune sémantique ajoutée.
- `cost_center` : `direct`, restreint aux charges d'un département.
- `driver`      : le montant est dérivé d'un inducteur explicite, puis rejoint
                  le même socle.

Le résolveur ne connaît ni les droits ni la publication : il reçoit une matière
déjà filtrée et rend des contributions, rien de plus.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Any, Final

from tarjih_calculation.contracts import (
    Account,
    Dimension,
    Hypothesis,
    Snapshot,
    SnapshotError,
    require_amount,
    require_factor,
)

# Inducteurs reconnus. Toute autre valeur est refusée : un inducteur inconnu
# produirait un budget muet plutôt qu'une erreur.
DRIVERS: Final[tuple[str, ...]] = ("volume_price", "percent_of")

# Un taux hors de cet intervalle trahit presque toujours une saisie en points de
# pourcentage (« 35 » au lieu de « 0.35 »). Le refuser vaut mieux que publier un
# budget multiplié par cent.
RATE_MIN: Final[Decimal] = Decimal("-10")
RATE_MAX: Final[Decimal] = Decimal("10")


@dataclass(frozen=True, slots=True)
class Contribution:
    """Un apport d'une hypothèse sur un triplet publiable."""

    dimension_id: str
    account_id: str
    period_id: str
    amount: Decimal
    hypothesis_id: str


@dataclass(frozen=True, slots=True)
class _Index:
    accounts_by_code: dict[str, Account]
    period_ids: frozenset[str]
    dimensions_by_id: dict[str, Dimension]


def _index(snapshot: Snapshot) -> _Index:
    accounts_by_code: dict[str, Account] = {}
    for account in snapshot.accounts:
        if account.code in accounts_by_code:
            raise SnapshotError(
                "duplicate_account_code", f"deux comptes portent le code « {account.code} »"
            )
        accounts_by_code[account.code] = account
    return _Index(
        accounts_by_code=accounts_by_code,
        period_ids=frozenset(period.id for period in snapshot.periods),
        dimensions_by_id={dimension.id: dimension for dimension in snapshot.dimensions},
    )


def _account_of(index: _Index, value: dict[str, Any], key: str, where: str) -> Account:
    raw = value.get(key)
    if not isinstance(raw, str) or not raw.strip():
        raise SnapshotError("field_missing", f"{where} : « {key} » absent")
    account = index.accounts_by_code.get(raw.strip())
    if account is None:
        raise SnapshotError("account_unknown", f"{where} : compte « {raw} » hors du snapshot")
    return account


def _period_of(index: _Index, raw: Any, where: str) -> str:
    if not isinstance(raw, str) or raw not in index.period_ids:
        raise SnapshotError("period_unknown", f"{where} : période « {raw} » hors du snapshot")
    return raw


def _dimension_of(index: _Index, hypothesis: Hypothesis) -> Dimension:
    dimension = index.dimensions_by_id.get(hypothesis.dimension_id)
    if dimension is None:
        raise SnapshotError(
            "dimension_unknown",
            f"hypothèse {hypothesis.id} : dimension hors du snapshot",
        )
    return dimension


def _entries(value: dict[str, Any], key: str, where: str) -> list[dict[str, Any]]:
    raw = value.get(key)
    if not isinstance(raw, list) or not raw:
        raise SnapshotError("field_missing", f"{where} : « {key} » attendu, liste non vide")
    entries: list[dict[str, Any]] = []
    for item in raw:
        if not isinstance(item, dict):
            raise SnapshotError("field_invalid", f"{where} : « {key} » contient un non-objet")
        entries.append(item)
    return entries


def _resolve_direct(
    hypothesis: Hypothesis, index: _Index, *, charges_only: bool
) -> list[Contribution]:
    where = f"hypothèse {hypothesis.id}"
    account = _account_of(index, hypothesis.value, "account_code", where)

    if charges_only:
        dimension = _dimension_of(index, hypothesis)
        if dimension.kind != "department":
            raise SnapshotError(
                "model_scope",
                f"{where} : le modèle « cost_center » n'accepte que des dimensions"
                f" de type département, reçu « {dimension.kind} »",
            )
        if account.statement != "income_statement" or account.normal_balance != "debit":
            raise SnapshotError(
                "model_scope",
                f"{where} : le modèle « cost_center » n'accepte que des comptes de"
                f" charge, reçu « {account.code} »",
            )

    contributions: list[Contribution] = []
    for entry in _entries(hypothesis.value, "amounts", where):
        period_id = _period_of(index, entry.get("period_id"), where)
        contributions.append(
            Contribution(
                dimension_id=hypothesis.dimension_id,
                account_id=account.id,
                period_id=period_id,
                amount=require_amount(entry.get("amount"), where),
                hypothesis_id=hypothesis.id,
            )
        )
    return contributions


def _resolve_volume_price(hypothesis: Hypothesis, index: _Index) -> list[Contribution]:
    where = f"hypothèse {hypothesis.id}"
    account = _account_of(index, hypothesis.value, "account_code", where)
    contributions: list[Contribution] = []
    for entry in _entries(hypothesis.value, "periods", where):
        period_id = _period_of(index, entry.get("period_id"), where)
        volume = require_factor(entry.get("volume"), f"{where} (volume)")
        unit_price = require_factor(entry.get("unit_price"), f"{where} (prix unitaire)")
        contributions.append(
            Contribution(
                dimension_id=hypothesis.dimension_id,
                account_id=account.id,
                period_id=period_id,
                amount=volume * unit_price,
                hypothesis_id=hypothesis.id,
            )
        )
    return contributions


def _resolve_percent_of(
    hypothesis: Hypothesis, index: _Index, base: dict[tuple[str, str, str], Decimal]
) -> list[Contribution]:
    """Applique un taux à une base déjà résolue sur la même dimension.

    La base doit provenir de la première passe : un pourcentage d'un pourcentage
    créerait un ordre de calcul implicite, donc un résultat dépendant de l'ordre
    de lecture. Le moteur refuse plutôt que d'inventer une convention.
    """
    where = f"hypothèse {hypothesis.id}"
    account = _account_of(index, hypothesis.value, "account_code", where)
    base_account = _account_of(index, hypothesis.value, "base_account_code", where)
    rate = require_factor(hypothesis.value.get("rate"), f"{where} (taux)")
    if not RATE_MIN <= rate <= RATE_MAX:
        raise SnapshotError(
            "rate_out_of_range",
            f"{where} : taux « {rate} » hors bornes — un pourcentage s'écrit 0.35, pas 35",
        )

    raw_periods = hypothesis.value.get("period_ids")
    if not isinstance(raw_periods, list) or not raw_periods:
        raise SnapshotError("field_missing", f"{where} : « period_ids » attendu, liste non vide")

    contributions: list[Contribution] = []
    for raw_period in raw_periods:
        period_id = _period_of(index, raw_period, where)
        key = (hypothesis.dimension_id, base_account.id, period_id)
        if key not in base:
            raise SnapshotError(
                "base_missing",
                f"{where} : aucune base « {base_account.code} » sur cette dimension"
                f" et cette période — un taux ne s'applique pas à du vide",
            )
        contributions.append(
            Contribution(
                dimension_id=hypothesis.dimension_id,
                account_id=account.id,
                period_id=period_id,
                amount=base[key] * rate,
                hypothesis_id=hypothesis.id,
            )
        )
    return contributions


def _driver_of(hypothesis: Hypothesis) -> str:
    raw = hypothesis.value.get("driver")
    if not isinstance(raw, str) or raw not in DRIVERS:
        raise SnapshotError(
            "driver_unknown",
            f"hypothèse {hypothesis.id} : inducteur « {raw} » inconnu, attendu {DRIVERS}",
        )
    return raw


def resolve(snapshot: Snapshot, hypotheses: tuple[Hypothesis, ...]) -> list[Contribution]:
    """Résout les hypothèses selon le modèle du snapshot."""
    index = _index(snapshot)

    if snapshot.model in ("direct", "cost_center"):
        charges_only = snapshot.model == "cost_center"
        contributions: list[Contribution] = []
        for hypothesis in hypotheses:
            contributions.extend(_resolve_direct(hypothesis, index, charges_only=charges_only))
        return contributions

    # Modèle « driver » : deux passes. Les inducteurs autonomes d'abord, les
    # taux ensuite, pour qu'aucun résultat ne dépende de l'ordre de lecture.
    first_pass: list[Contribution] = []
    deferred: list[Hypothesis] = []
    for hypothesis in hypotheses:
        if _driver_of(hypothesis) == "percent_of":
            deferred.append(hypothesis)
        else:
            first_pass.extend(_resolve_volume_price(hypothesis, index))

    base: dict[tuple[str, str, str], Decimal] = {}
    for contribution in first_pass:
        key = (contribution.dimension_id, contribution.account_id, contribution.period_id)
        base[key] = base.get(key, Decimal(0)) + contribution.amount

    second_pass: list[Contribution] = []
    for hypothesis in deferred:
        second_pass.extend(_resolve_percent_of(hypothesis, index, base))
    return first_pass + second_pass
