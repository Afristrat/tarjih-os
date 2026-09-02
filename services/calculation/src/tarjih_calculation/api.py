"""Exposition HTTP du moteur.

Volontairement mince : le cœur reste une fonction pure et importable sans
FastAPI (`engine.calculate`), cette couche ne fait que le rendre joignable par
Next.js. Elle ne décide rien — ni les droits, ni le tenant, ni la publication.

Le service ne parle jamais à Supabase et ne reçoit aucun cookie utilisateur : le
backend lui présente un snapshot déjà filtré et se charge d'écrire le résultat
(`specs/_source/archi.md:100`).
"""

from __future__ import annotations

import hmac
import os
from typing import Any

from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.responses import JSONResponse

from tarjih_calculation.canonical import normalize_amount
from tarjih_calculation.contracts import SnapshotError
from tarjih_calculation.engine import ENGINE_VERSION, calculate

app = FastAPI(title="Tarjih — moteur de calcul", version=ENGINE_VERSION)


def _expected_key() -> str:
    """Clé de service attendue, lue à chaque appel.

    Lue à l'appel et non à l'import : un démarrage sans variable doit échouer
    sur la première requête avec un message clair, pas planter le conteneur au
    boot avec une trace d'import.
    """
    key = os.environ.get("CALCULATION_SERVICE_TOKEN", "")
    if not key:
        raise HTTPException(
            status_code=503, detail="service_key_absent: le service n'est pas configuré"
        )
    return key


@app.get("/health")
def health() -> dict[str, str]:
    """Sonde de disponibilité. N'expose ni configuration ni secret."""
    return {"status": "ok", "engine_version": ENGINE_VERSION}


@app.post("/calculate")
async def calculate_endpoint(
    request: Request, x_service_key: str = Header(default="")
) -> JSONResponse:
    # `compare_digest` plutôt que `==` : la comparaison naïve s'arrête au premier
    # octet différent et laisse mesurer la clé par le temps de réponse.
    if not hmac.compare_digest(x_service_key, _expected_key()):
        raise HTTPException(status_code=401, detail="unauthorized")

    try:
        payload: Any = await request.json()
    except ValueError:
        raise HTTPException(status_code=400, detail="payload_invalid: JSON illisible") from None

    try:
        result = calculate(payload)
    except SnapshotError as error:
        # 422 et non 500 : le snapshot est refusé, le service fonctionne. Le
        # backend a besoin du code pour marquer le run en échec sans le deviner.
        return JSONResponse(
            status_code=422, content={"code": error.code, "message": error.message}
        )

    return JSONResponse(
        status_code=200,
        content={
            "engine_version": result.engine_version,
            "model": result.model,
            "input_hash": result.input_hash,
            "output_hash": result.output_hash,
            "values": [
                {
                    "dimension_id": value.dimension_id,
                    "account_id": value.account_id,
                    "period_id": value.period_id,
                    # Les montants repartent en chaîne, comme ils sont arrivés :
                    # un nombre JSON les ferait passer par un flottant côté Node.
                    "amount": normalize_amount(value.amount),
                }
                for value in result.values
            ],
        },
    )
