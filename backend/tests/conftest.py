import copy
import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
DEMO = ROOT / "fixtures" / "demo"
EXPECTED = ROOT / "fixtures" / "expected"
FILES = ["disruptions", "inventory", "letters_of_credit", "master_data", "orders", "policies",
         "route_options", "scenario", "sources", "supplier_quotes", "supply_graph", "trade_rules"]


def load_fx() -> dict:
    return {n: json.loads((DEMO / f"{n}.json").read_text(encoding="utf-8")) for n in FILES}


def apply_patches(fx: dict, patches: list) -> dict:
    fx = copy.deepcopy(fx)
    for p in patches:
        target = fx[p["file"]]
        for part in p["collection"].split("."):
            target = target[part]
        if p["op"] == "append":
            target.append(copy.deepcopy(p["value"]))
            continue
        m = [i for i in target if all(i.get(k) == v for k, v in p["match"].items())]
        assert len(m) == 1, p
        if p["op"] == "remove":
            target.remove(m[0])
        else:
            for path, value in p["set"].items():
                node, keys = m[0], path.split(".")
                for k in keys[:-1]:
                    node = node[k]
                node[keys[-1]] = copy.deepcopy(value)
    return fx


def golden(name):
    return json.loads((EXPECTED / name).read_text(encoding="utf-8"))


@pytest.fixture
def fx():
    return load_fx()
