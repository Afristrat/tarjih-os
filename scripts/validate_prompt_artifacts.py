"""Contrôles statiques minimaux des artefacts de missions Tarjih."""

from __future__ import annotations

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def load_json(relative_path: str) -> object:
    path = ROOT / relative_path
    return json.loads(path.read_text(encoding="utf-8"))


def validate_catalog() -> None:
    catalog = load_json("prompts/missions/catalog.json")
    assert isinstance(catalog, dict)
    missions = catalog["missions"]
    assert len(missions) == 30
    expected_ids = [f"M{index:02d}" for index in range(1, 31)]
    assert [mission["mission_id"] for mission in missions] == expected_ids

    required = {
        "mission_id",
        "version",
        "title",
        "domain",
        "risk_level",
        "objective",
        "required_inputs",
        "deterministic_tasks",
        "ai_tasks",
        "hypothesis_parameters",
        "human_reviews",
        "output_artifacts",
        "external_services",
        "execution_limits",
    }
    for mission in missions:
        assert set(mission) == required, mission["mission_id"]
        assert re.fullmatch(r"M(?:0[1-9]|[12][0-9]|30)", mission["mission_id"])
        assert mission["deterministic_tasks"]
        assert mission["ai_tasks"]
        assert mission["human_reviews"]
        limits = mission["execution_limits"]
        assert 1 <= limits["max_model_calls"] <= 6
        assert 0 <= limits["max_external_calls"] <= 4
        assert 10 <= limits["timeout_seconds"] <= 300


def validate_schemas() -> None:
    schema_paths = sorted((ROOT / "schemas").glob("*.schema.json"))
    assert len(schema_paths) == 3
    for path in schema_paths:
        schema = json.loads(path.read_text(encoding="utf-8"))
        assert schema["$schema"] == "https://json-schema.org/draft/2020-12/schema"
        assert schema["additionalProperties"] is False

    try:
        import jsonschema
    except ImportError:
        return

    for path in schema_paths:
        jsonschema.Draft202012Validator.check_schema(
            json.loads(path.read_text(encoding="utf-8"))
        )

    mission_schema = load_json("schemas/mission-contract.schema.json")
    catalog = load_json("prompts/missions/catalog.json")
    validator = jsonschema.Draft202012Validator(mission_schema)
    for mission in catalog["missions"]:
        validator.validate(mission)


def validate_runtime() -> None:
    system_prompt = (ROOT / "prompts/runtime/system.md").read_text(encoding="utf-8")
    required_phrases = [
        "N’invente jamais",
        "N’effectue aucun calcul financier",
        "Ne transforme jamais une hypothèse proposée en hypothèse approuvée",
        "Ne lance aucun export",
        "JSON Schema",
    ]
    for phrase in required_phrases:
        assert phrase in system_prompt

    golden_set = load_json("evals/runtime-golden-set.json")
    cases = golden_set["cases"]
    assert len(cases) >= 10
    assert sum(case["type"] == "adversarial" for case in cases) >= 4
    assert len({case["id"] for case in cases}) == len(cases)


def main() -> None:
    validate_catalog()
    validate_schemas()
    validate_runtime()
    print("PASS — artefacts Tarjih valides : 30 missions, 3 schémas, runtime et golden set.")


if __name__ == "__main__":
    main()
