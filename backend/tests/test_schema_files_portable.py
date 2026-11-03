"""Schema files must be regular, parseable JSON files on every platform.

A git symlink is checked out on Windows (core.symlinks=false) as a text file
holding the target path, which crashed the backend at startup in load_fixtures.
"""
import json
from pathlib import Path

SCHEMAS_DIR = Path(__file__).resolve().parents[2] / "contracts" / "schemas"


def test_schema_files_are_regular_json_files():
    paths = sorted(SCHEMAS_DIR.glob("*.json"))
    assert paths, "no schema files found"
    for path in paths:
        assert not path.is_symlink(), f"{path.name} is a symlink; commit a regular file instead"
        json.loads(path.read_text(encoding="utf-8-sig"))


def test_supply_network_schema_copies_match():
    # openapi.yaml and the loaders use supply_network.schema.json; supply_network.json is kept for compatibility.
    a = (SCHEMAS_DIR / "supply_network.schema.json").read_bytes()
    b = (SCHEMAS_DIR / "supply_network.json").read_bytes()
    assert a == b, "supply_network.json and supply_network.schema.json must stay identical"
