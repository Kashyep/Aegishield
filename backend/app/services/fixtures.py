import hashlib, json
from pathlib import Path
from typing import Any
from jsonschema import Draft202012Validator
from referencing import Registry, Resource
from referencing.jsonschema import DRAFT202012


FIXTURE_SCHEMAS = {
    "scenario": "fixtures.schema.json#/$defs/ScenarioFile",
    "master_data": "fixtures.schema.json#/$defs/MasterDataFile",
    "orders": "fixtures.schema.json#/$defs/OrdersFile",
    "disruptions": "fixtures.schema.json#/$defs/DisruptionsFile",
    "supply_graph": "graph.schema.json#/$defs/SupplyGraph",
    "supplier_quotes": "fixtures.schema.json#/$defs/SupplierQuotesFile",
    "route_options": "fixtures.schema.json#/$defs/RouteOptionsFile",
    "inventory": "fixtures.schema.json#/$defs/InventoryFile",
    "letters_of_credit": "fixtures.schema.json#/$defs/LettersOfCreditFile",
    "trade_rules": "trade-rules.schema.json#/$defs/TradeRulesFile",
    "policies": "fixtures.schema.json#/$defs/PoliciesFile",
    "sources": "fixtures.schema.json#/$defs/SourcesFile",
}


def canonical_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def digest(value: Any) -> str:
    return "sha256:" + hashlib.sha256(canonical_json(value).encode("utf-8")).hexdigest()


def load_fixtures(root: Path) -> dict[str, Any]:
    root = Path(root)
    fixture_dir = root / "demo"
    if fixture_dir.is_dir():
        schema_dir = root.parent / "contracts" / "schemas"
    else:
        fixture_dir = root
        root = root.parent
        schema_dir = root / "contracts" / "schemas"
    base_uri = "https://aegisshield.local/schemas/"
    registry = Registry().with_resources(
        (base_uri + path.name, Resource.from_contents(json.loads(path.read_text(encoding="utf-8-sig")), default_specification=DRAFT202012))
        for path in sorted(schema_dir.glob("*.schema.json"))
    )
    result = {}
    for path in sorted(fixture_dir.glob("*.json")):
        value = json.loads(path.read_text(encoding="utf-8-sig"))
        schema_ref = FIXTURE_SCHEMAS.get(path.stem)
        if not schema_ref:
            raise ValueError(f"No contract schema is registered for fixture {path.name}")
        schema_uri, fragment = schema_ref.split("#", 1)
        schema = {"$ref": f"{base_uri}{schema_uri}#{fragment}"}
        errors = sorted(Draft202012Validator(schema, registry=registry).iter_errors(value), key=lambda error: list(error.absolute_path))
        if errors:
            error = errors[0]
            location = "/".join(map(str, error.absolute_path)) or "<root>"
            raise ValueError(f"Fixture {path.name} violates its contract at {location}: {error.message}")
        result[path.stem] = value
    return result


def snapshot_id(fixtures: dict[str, Any]) -> str:
    return digest(fixtures)
