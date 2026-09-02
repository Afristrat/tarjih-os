"""Sérialisation canonique et empreintes.

`input_hash` et `output_hash` ne servent à rien s'ils dépendent de l'ordre dans
lequel PostgreSQL a rendu les lignes : deux exécutions du même budget doivent
produire la même empreinte, y compris si le `select` a changé d'ordre entre
temps. Toute collection est donc triée par une clé stable avant hachage, et les
montants sont normalisés — `10`, `10.0` et `10.000000` désignent le même budget
et doivent donner la même empreinte.

Les colonnes cibles sont contraintes par `~ '^[0-9a-f]{64}$'` : SHA-256 en
minuscules, rien d'autre.
"""

from __future__ import annotations

import hashlib
import json
from decimal import Decimal
from typing import Any

from tarjih_calculation.contracts import AMOUNT_SCALE, BudgetValue, Snapshot


def normalize_amount(amount: Decimal) -> str:
    """Rend un montant sous une forme unique, à l'échelle de `numeric(24, 6)`.

    `quantize` fixe l'échelle ; le `+ Decimal(0)` qui suit retire le zéro négatif
    (`-0.000000`), qui hacherait différemment de `0.000000` alors qu'il désigne
    exactement le même montant.
    """
    quantized = amount.quantize(Decimal(1).scaleb(-AMOUNT_SCALE)) + Decimal(0)
    return format(quantized, "f")


def _digest(payload: Any) -> str:
    encoded = json.dumps(
        payload,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        allow_nan=False,
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _canonical_value(raw: Any) -> Any:
    """Réécrit un `value` d'hypothèse en forme hachable et stable.

    Un `float` est refusé plus haut par `require_amount`, mais un `value` jsonb
    peut en contenir dans un champ que le résolveur n'utilise pas : le convertir
    en chaîne ici évite qu'une représentation binaire fasse varier l'empreinte
    d'un budget par ailleurs identique.
    """
    if isinstance(raw, float):
        return format(Decimal(str(raw)), "f")
    if isinstance(raw, dict):
        return {str(key): _canonical_value(value) for key, value in sorted(raw.items())}
    if isinstance(raw, list):
        return [_canonical_value(item) for item in raw]
    return raw


def snapshot_hash(snapshot: Snapshot) -> str:
    """Empreinte de la matière d'entrée, indépendante de l'ordre de lecture."""
    payload = {
        "engine_version": snapshot.engine_version,
        "model": snapshot.model,
        "tenant_id": snapshot.tenant_id,
        "version_id": snapshot.version_id,
        "currency": snapshot.currency,
        "accounts": sorted(
            (
                {
                    "id": account.id,
                    "code": account.code,
                    "statement": account.statement,
                    "normal_balance": account.normal_balance,
                }
                for account in snapshot.accounts
            ),
            key=lambda item: item["id"],
        ),
        "periods": sorted(
            (
                {"id": period.id, "starts_on": period.starts_on, "ends_on": period.ends_on}
                for period in snapshot.periods
            ),
            key=lambda item: item["id"],
        ),
        "dimensions": sorted(
            (
                {"id": dimension.id, "code": dimension.code, "kind": dimension.kind}
                for dimension in snapshot.dimensions
            ),
            key=lambda item: item["id"],
        ),
        "hypotheses": sorted(
            (
                {
                    "id": hypothesis.id,
                    "dimension_id": hypothesis.dimension_id,
                    "parameter_key": hypothesis.parameter_key,
                    "unit": hypothesis.unit,
                    "status": hypothesis.status,
                    "value": _canonical_value(hypothesis.value),
                }
                for hypothesis in snapshot.hypotheses
            ),
            key=lambda item: item["id"],
        ),
    }
    return _digest(payload)


def values_hash(values: tuple[BudgetValue, ...]) -> str:
    """Empreinte du résultat publiable, sur la clé unique de `budget_values`."""
    payload = sorted(
        (
            {
                "dimension_id": value.dimension_id,
                "account_id": value.account_id,
                "period_id": value.period_id,
                "amount": normalize_amount(value.amount),
            }
            for value in values
        ),
        key=lambda item: (item["dimension_id"], item["account_id"], item["period_id"]),
    )
    return _digest(payload)
