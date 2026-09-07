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
from collections.abc import Sequence
from decimal import Decimal
from typing import Any

from tarjih_calculation.contracts import BudgetValue, Snapshot, to_publishable
from tarjih_calculation.resolvers import Contribution


def normalize_amount(amount: Decimal) -> str:
    """Rend un montant publiable sous une forme unique, à l'échelle de la colonne.

    L'arrondi appartient à `to_publishable` : cette fonction ne fait que le
    mettre en chaîne. Elle ne convient pas à un montant qui doit rester exact —
    une part d'hypothèse, par exemple : voir `format_exact`.
    """
    return format(to_publishable(amount), "f")


def format_exact(amount: Decimal) -> str:
    """Met un montant en chaîne SANS rien arrondir ni tronquer.

    Les parts d'hypothèses ne sont pas des montants publiables : leur exactitude
    est ce qui rend vraie l'égalité « arrondi de la somme des parts = montant
    publié ». Les passer par `normalize_amount` les amputerait en silence.

    La notation scientifique (`1E+3`), que `str()` produit selon l'exposant, est
    écartée : la colonne cible est un `numeric` et le lecteur est un humain.
    """
    return format(amount.normalize() + Decimal(0), "f")


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


def snapshot_hash(snapshot: Snapshot, contributions: Sequence[Contribution]) -> str:
    """Empreinte de la matière d'entrée, indépendante de l'ordre de lecture.

    Elle ne porte QUE le référentiel que les hypothèses citent réellement. Le
    snapshot, lui, transporte tout celui du tenant : sans ce filtrage, ajouter un
    compte qu'aucun calcul ne touche changeait l'empreinte d'entrée, et une
    version publiée cessait d'être reproductible sans qu'aucun de ses chiffres
    n'ait bougé — mesuré en production sur la version `c6033eb3`, dont le tenant
    avait simplement gagné un compte et une période depuis sa publication.

    Le périmètre se déduit des CONTRIBUTIONS, jamais d'une relecture des champs
    d'une hypothèse : un résolveur qui cite un compte produit forcément une
    contribution dessus (y compris le compte de base d'un `percent_of`, qui doit
    exister en première passe sous peine de `base_missing`). Cette dérivation ne
    peut donc pas se désynchroniser des résolveurs, ce qu'une liste de champs
    tenue à la main ferait au premier modèle ajouté.

    Ce qui reste dans l'empreinte est ce qui décrit les objets cités — le code
    d'un compte, les bornes d'une période. Les modifier change bien l'empreinte :
    ce n'est plus du bruit, c'est une matière d'entrée différente.
    """
    used_accounts = {contribution.account_id for contribution in contributions}
    used_periods = {contribution.period_id for contribution in contributions}
    used_dimensions = {contribution.dimension_id for contribution in contributions}

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
                if account.id in used_accounts
            ),
            key=lambda item: item["id"],
        ),
        "periods": sorted(
            (
                {"id": period.id, "starts_on": period.starts_on, "ends_on": period.ends_on}
                for period in snapshot.periods
                if period.id in used_periods
            ),
            key=lambda item: item["id"],
        ),
        "dimensions": sorted(
            (
                {"id": dimension.id, "code": dimension.code, "kind": dimension.kind}
                for dimension in snapshot.dimensions
                if dimension.id in used_dimensions
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
