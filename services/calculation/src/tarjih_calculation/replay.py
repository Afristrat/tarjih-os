"""Rejeu d'une version budgétaire déjà publiée.

Une version publiée est immuable, et le snapshot qui a produit ses chiffres n'a
jamais été conservé : `calculation_runs` n'en garde que l'EMPREINTE. Reconstruire
l'origine de ses montants suppose donc de refaire la matière depuis la base, de
la recalculer, et de ne rien accepter tant que l'empreinte recalculée ne retrouve
pas celle du run.

C'est ce témoin qui sépare une reconstruction PROUVÉE d'une reconstitution
plausible. Sans lui, on écrirait sous un montant intangible une origine que rien
ne garantit — exactement le genre d'affirmation que ce produit existe pour
refuser.

Aucun accès base ici : ce module reçoit des extraits et rend des parts. Ce qui
les lit et les écrit vit dans `scripts/reconstruire-sources.py`.
"""

from __future__ import annotations

from typing import Any

from tarjih_calculation.canonical import format_exact
from tarjih_calculation.contracts import SnapshotError
from tarjih_calculation.engine import calculate


def replay_published(
    extracts: list[dict[str, Any]],
) -> tuple[list[dict[str, str]], list[dict[str, str]]]:
    """Rejoue des versions publiées et rend les parts que l'on peut prouver.

    Chaque extrait porte le `payload` reconstruit et l'`input_hash` du run qui a
    publié la version. Rend deux choses : les parts à écrire, et un rapport qui
    dit ce qu'il est advenu de CHAQUE version — y compris celles qu'on renonce à
    reconstruire, qui sont les plus importantes à voir.
    """
    sources: list[dict[str, str]] = []
    report: list[dict[str, str]] = []

    for extract in extracts:
        version_id = str(extract["version_id"])
        expected = str(extract["input_hash"])

        try:
            result = calculate(extract["payload"])
        except SnapshotError as error:
            report.append(
                {
                    "version_id": version_id,
                    "verdict": "refuse-par-le-moteur",
                    "code": error.code,
                    "detail": error.message,
                }
            )
            continue

        if result.input_hash != expected:
            report.append(
                {
                    "version_id": version_id,
                    "verdict": "empreinte-divergente",
                    "code": "input_hash_mismatch",
                    "detail": f"attendue {expected}, recalculée {result.input_hash}",
                }
            )
            continue

        for source in result.sources:
            sources.append(
                {
                    "version_id": version_id,
                    "dimension_id": source.dimension_id,
                    "account_id": source.account_id,
                    "period_id": source.period_id,
                    "hypothesis_id": source.hypothesis_id,
                    "amount": format_exact(source.amount),
                }
            )

        report.append(
            {
                "version_id": version_id,
                "verdict": "reconstruite",
                "code": "",
                "detail": f"{len(result.sources)} part(s), empreinte retrouvée",
            }
        )

    return sources, report
