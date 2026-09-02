"""Contrat d'entrée et de sortie du moteur.

Le moteur ne reçoit jamais de cookie, ne choisit jamais le tenant et ne relit
jamais la base : tout ce qu'il connaît tient dans le snapshot que le backend lui
transmet, déjà filtré par les droits (`specs/_source/archi.md:100`). Ce module
décrit cette matière et la valide ; il ne calcule rien.

Les montants sont des `Decimal`, jamais des flottants : la colonne cible est un
`numeric(24, 6)` et une addition binaire y introduirait un écart silencieux.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import Any, Final

# Modèles de calcul offerts au tenant. Ils partagent un seul pipeline : seule la
# résolution d'une hypothèse en montants change (cf. `resolvers.py`).
MODELS: Final[tuple[str, ...]] = ("direct", "cost_center", "driver")

STATEMENTS: Final[tuple[str, ...]] = (
    "income_statement",
    "balance_sheet",
    "cash_flow",
    "kpi",
)
NORMAL_BALANCES: Final[tuple[str, ...]] = ("debit", "credit", "none")

# Bornes de `numeric(24, 6)` : 24 chiffres significatifs dont 6 décimales.
AMOUNT_SCALE: Final[int] = 6
AMOUNT_MAX: Final[Decimal] = Decimal(10) ** 18 - Decimal(1) / (Decimal(10) ** AMOUNT_SCALE)

_UUID_RE: Final[re.Pattern[str]] = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
)
_CURRENCY_RE: Final[re.Pattern[str]] = re.compile(r"^[A-Z]{3}$")
_ENGINE_VERSION_RE: Final[re.Pattern[str]] = re.compile(r"^\d+\.\d+\.\d+$")


class SnapshotError(ValueError):
    """Snapshot refusé : le moteur ne calcule pas sur une matière douteuse.

    `code` est stable et destiné au backend ; `message` est destiné au journal.
    """

    def __init__(self, code: str, message: str) -> None:
        super().__init__(f"{code}: {message}")
        self.code = code
        self.message = message


@dataclass(frozen=True, slots=True)
class Account:
    id: str
    code: str
    statement: str
    normal_balance: str


@dataclass(frozen=True, slots=True)
class Period:
    id: str
    starts_on: str
    ends_on: str


@dataclass(frozen=True, slots=True)
class Dimension:
    id: str
    code: str
    kind: str


@dataclass(frozen=True, slots=True)
class Hypothesis:
    id: str
    dimension_id: str
    parameter_key: str
    unit: str
    status: str
    value: dict[str, Any]


@dataclass(frozen=True, slots=True)
class Snapshot:
    engine_version: str
    model: str
    tenant_id: str
    version_id: str
    currency: str
    accounts: tuple[Account, ...]
    periods: tuple[Period, ...]
    dimensions: tuple[Dimension, ...]
    hypotheses: tuple[Hypothesis, ...]


@dataclass(frozen=True, slots=True)
class BudgetValue:
    """Une ligne publiable, telle que `public.budget_values` l'attend."""

    dimension_id: str
    account_id: str
    period_id: str
    amount: Decimal


@dataclass(frozen=True, slots=True)
class CalculationResult:
    engine_version: str
    model: str
    input_hash: str
    output_hash: str
    values: tuple[BudgetValue, ...]


def _parse_exact(raw: Any, where: str) -> Decimal:
    """Lit un nombre exact du snapshot, ou lève.

    Les nombres arrivent en chaîne et non en nombre JSON : `0.1` n'a pas de
    représentation binaire exacte, et un budget ne tolère pas cet écart. Un
    `float` est donc refusé à la frontière plutôt que converti en silence.
    """
    if isinstance(raw, bool) or isinstance(raw, float):
        raise SnapshotError("amount_not_exact", f"{where} : nombre non exact ({raw!r})")
    if isinstance(raw, int):
        raw = str(raw)
    if not isinstance(raw, str) or not raw.strip():
        raise SnapshotError("amount_invalid", f"{where} : nombre absent ou illisible")
    try:
        parsed = Decimal(raw.strip())
    except InvalidOperation as error:
        raise SnapshotError("amount_invalid", f"{where} : nombre illisible ({raw!r})") from error
    if not parsed.is_finite():
        raise SnapshotError("amount_not_finite", f"{where} : nombre non fini")
    return parsed


def require_amount(raw: Any, where: str) -> Decimal:
    """Convertit un montant publiable : exact, et tenant dans `numeric(24, 6)`."""
    amount = _parse_exact(raw, where)
    exponent = amount.as_tuple().exponent
    if isinstance(exponent, int) and -exponent > AMOUNT_SCALE:
        raise SnapshotError("amount_scale", f"{where} : plus de {AMOUNT_SCALE} décimales")
    if abs(amount) > AMOUNT_MAX:
        raise SnapshotError("amount_overflow", f"{where} : montant hors de numeric(24, 6)")
    return amount


def require_factor(raw: Any, where: str) -> Decimal:
    """Convertit un inducteur : volume, prix unitaire, taux.

    Un inducteur n'est pas un montant publiable et n'a donc pas à tenir dans
    l'échelle de `numeric(24, 6)` : un prix au litre ou un taux horaire porte
    légitimement plus de six décimales. C'est le produit final qui est arrondi à
    l'échelle de la colonne, une seule fois, au moment de l'agrégation.
    """
    factor = _parse_exact(raw, where)
    if abs(factor) > AMOUNT_MAX:
        raise SnapshotError("factor_overflow", f"{where} : inducteur hors des bornes calculables")
    return factor


def _require_mapping(raw: Any, where: str) -> dict[str, Any]:
    if not isinstance(raw, dict):
        raise SnapshotError("field_invalid", f"{where} : objet attendu")
    return raw


def _require_str(source: dict[str, Any], key: str, where: str) -> str:
    raw = source.get(key)
    if not isinstance(raw, str) or not raw.strip():
        raise SnapshotError("field_missing", f"{where} : champ « {key} » absent ou vide")
    return raw.strip()


def _require_uuid(source: dict[str, Any], key: str, where: str) -> str:
    value = _require_str(source, key, where)
    if not _UUID_RE.match(value):
        raise SnapshotError("uuid_invalid", f"{where} : « {key} » n'est pas un uuid")
    return value


def _require_list(source: dict[str, Any], key: str) -> list[Any]:
    raw = source.get(key)
    if not isinstance(raw, list):
        raise SnapshotError("field_missing", f"snapshot : « {key} » doit être une liste")
    return raw


def _require_choice(value: str, allowed: tuple[str, ...], key: str, where: str) -> str:
    if value not in allowed:
        raise SnapshotError(
            "value_unexpected", f"{where} : « {key} » vaut « {value} », attendu {allowed}"
        )
    return value


def _unique(ids: list[str], what: str) -> None:
    if len(set(ids)) != len(ids):
        raise SnapshotError("duplicate_id", f"snapshot : deux {what} portent le même id")


def parse_snapshot(payload: Any) -> Snapshot:
    """Valide le snapshot et le fige. Toute anomalie lève, aucune n'est corrigée."""
    payload = _require_mapping(payload, "snapshot")

    engine_version = _require_str(payload, "engine_version", "snapshot")
    if not _ENGINE_VERSION_RE.match(engine_version):
        raise SnapshotError(
            "engine_version_invalid", "snapshot : « engine_version » attendu en x.y.z"
        )

    model = _require_choice(
        _require_str(payload, "model", "snapshot"), MODELS, "model", "snapshot"
    )
    currency = _require_str(payload, "currency", "snapshot")
    if not _CURRENCY_RE.match(currency):
        raise SnapshotError("currency_invalid", "snapshot : « currency » attendu en ISO 4217")

    accounts = tuple(
        Account(
            id=_require_uuid(item, "id", "compte"),
            code=_require_str(item, "code", "compte"),
            statement=_require_choice(
                _require_str(item, "statement", "compte"), STATEMENTS, "statement", "compte"
            ),
            normal_balance=_require_choice(
                _require_str(item, "normal_balance", "compte"),
                NORMAL_BALANCES,
                "normal_balance",
                "compte",
            ),
        )
        for item in (
            _require_mapping(raw, "compte") for raw in _require_list(payload, "accounts")
        )
    )
    periods = tuple(
        Period(
            id=_require_uuid(item, "id", "période"),
            starts_on=_require_str(item, "starts_on", "période"),
            ends_on=_require_str(item, "ends_on", "période"),
        )
        for item in (
            _require_mapping(raw, "période") for raw in _require_list(payload, "periods")
        )
    )
    dimensions = tuple(
        Dimension(
            id=_require_uuid(item, "id", "dimension"),
            code=_require_str(item, "code", "dimension"),
            kind=_require_str(item, "kind", "dimension"),
        )
        for item in (
            _require_mapping(raw, "dimension") for raw in _require_list(payload, "dimensions")
        )
    )
    hypotheses = tuple(
        Hypothesis(
            id=_require_uuid(item, "id", "hypothèse"),
            dimension_id=_require_uuid(item, "dimension_id", "hypothèse"),
            parameter_key=_require_str(item, "parameter_key", "hypothèse"),
            unit=_require_str(item, "unit", "hypothèse"),
            status=_require_str(item, "status", "hypothèse"),
            value=_require_mapping(item.get("value"), "hypothèse : « value »"),
        )
        for item in (
            _require_mapping(raw, "hypothèse") for raw in _require_list(payload, "hypotheses")
        )
    )

    _unique([account.id for account in accounts], "comptes")
    _unique([period.id for period in periods], "périodes")
    _unique([dimension.id for dimension in dimensions], "dimensions")
    _unique([hypothesis.id for hypothesis in hypotheses], "hypothèses")

    return Snapshot(
        engine_version=engine_version,
        model=model,
        tenant_id=_require_uuid(payload, "tenant_id", "snapshot"),
        version_id=_require_uuid(payload, "version_id", "snapshot"),
        currency=currency,
        accounts=accounts,
        periods=periods,
        dimensions=dimensions,
        hypotheses=hypotheses,
    )
