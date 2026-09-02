"""Moteur de calcul déterministe de Tarjih.

Surface publique volontairement étroite : le backend n'a besoin que de
`calculate`, de la version du moteur et du type d'erreur à journaliser.
"""

from tarjih_calculation.contracts import (
    MODELS,
    BudgetValue,
    CalculationResult,
    SnapshotError,
)
from tarjih_calculation.engine import ENGINE_VERSION, calculate

__all__ = [
    "ENGINE_VERSION",
    "MODELS",
    "BudgetValue",
    "CalculationResult",
    "SnapshotError",
    "calculate",
]
