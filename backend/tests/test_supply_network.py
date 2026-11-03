import json
from pathlib import Path
from fastapi.testclient import TestClient
from jsonschema import Draft202012Validator
from referencing import Registry, Resource
from referencing.jsonschema import DRAFT202012

from backend.app.main import app
from backend.app.services.fixtures import load_fixtures, snapshot_id, load_supply_network

ROOT = Path(__file__).resolve().parent.parent.parent
FIXTURES_DIR = ROOT / "fixtures"
SCHEMAS_DIR = ROOT / "contracts" / "schemas"

client = TestClient(app)


def test_get_supply_network_endpoint():
    response = client.get("/api/v1/supply-network")
    assert response.status_code == 200
    data = response.json()

    assert data["synthetic"] is True
    assert "Simulated" in data["disclaimer"]
    assert data["total_on_hand"] > 0
    assert data["total_in_transit"] >= 0

    node_ids = {node["node_id"] for node in data["nodes"]}
    assert "FAC-KAV-BLR" in node_ids
    assert "FAC-FABZ" in node_ids
    assert "FAC-A-PEN" in node_ids
    assert "FAC-B-CHB" in node_ids
    assert "FAC-C-BDG" in node_ids

    fabz = next(n for n in data["nodes"] if n["node_id"] == "FAC-FABZ")
    assert fabz["status"] == "disrupted"
    assert len(fabz["movement_history"]) > 0

    blr = next(n for n in data["nodes"] if n["node_id"] == "FAC-KAV-BLR")
    assert blr["status"] == "operational"
    assert blr["inventory_on_hand"] == 250
    assert blr["stock_in_transit"] == 900

    assert len(data["edges"]) > 0
    e1 = next(e for e in data["edges"] if e["edge_id"] == "E-001")
    assert e1["source"] == "FAC-A-PEN"
    assert e1["target"] == "FAC-KAV-BLR"
    assert e1["in_transit_qty"] == 900


def test_supply_network_schema_validation():
    data = load_supply_network(FIXTURES_DIR)
    schema_path = SCHEMAS_DIR / "supply_network.json"
    schema_doc = json.loads(schema_path.read_text(encoding="utf-8"))

    base_uri = "https://aegisshield.local/schemas/"
    resources = [
        (
            base_uri + p.name,
            Resource.from_contents(
                json.loads(p.read_text(encoding="utf-8-sig")),
                default_specification=DRAFT202012,
            ),
        )
        for p in sorted(SCHEMAS_DIR.glob("*.schema.json"))
    ]
    registry = Registry().with_resources(resources)

    validator = Draft202012Validator(
        {"$ref": f"{base_uri}supply_network.schema.json#/$defs/SupplyNetwork"},
        registry=registry,
    )
    errors = list(validator.iter_errors(data))
    assert not errors, f"Supply network fixture violates schema: {errors}"


def test_supply_network_does_not_leak_into_plan_inputs():
    plan_fx = load_fixtures(FIXTURES_DIR)
    assert "supply_network" not in plan_fx
    expected_snapshot = "sha256:d52c7ecc366a66470bd9e04cf43d4f913d31b729c5f2bf1ce3932622b9f3d6c0"
    assert snapshot_id(plan_fx) == expected_snapshot
