"""Rule store: load trade_rules.json and validate it (M5-D2). Fails fast with RuleStoreError."""
from __future__ import annotations

import json
from pathlib import Path

from jsonschema import Draft202012Validator
from referencing import Registry, Resource

SCHEMAS = Path(__file__).resolve().parents[3] / "contracts" / "schemas"


class RuleStoreError(ValueError):
    pass


def _validator() -> Draft202012Validator:
    reg = Registry()
    for p in SCHEMAS.glob("*.schema.json"):
        reg = reg.with_resource(p.name, Resource.from_contents(json.loads(p.read_text(encoding="utf-8"))))
    return Draft202012Validator({"$ref": "trade-rules.schema.json#/$defs/TradeRulesFile"}, registry=reg)


def validate_rules(doc: dict) -> list[dict]:
    """Schema + corpus-governance checks (docs/05 §5). Returns rules sorted by rule_id."""
    errors = [f"{'/'.join(map(str, e.absolute_path)) or '<root>'}: {e.message}" for e in _validator().iter_errors(doc)]
    if errors:
        raise RuleStoreError("; ".join(errors[:10]))
    rules = doc["rules"]
    ids = [r["rule_id"] for r in rules]
    err = [f"duplicate rule id {i}" for i in sorted({i for i in ids if ids.count(i) > 1})]
    known = set(ids)
    for r in rules:
        rid = r["rule_id"]
        if r["effective_to"] is not None and r["effective_to"] < r["effective_from"]:
            err.append(f"{rid}: effective_to before effective_from")
        for s in r["supersedes"]:
            if s not in known:
                err.append(f"{rid}: supersedes unknown rule {s}")
            if s == rid:
                err.append(f"{rid}: supersedes itself")
        src = r["source"]
        if not src.get("title") or "synthetic" not in src:
            err.append(f"{rid}: source needs a title and a synthetic flag")
        if not src["synthetic"] and r.get("modeled_on") is None and not src.get("uri"):
            err.append(f"{rid}: non-synthetic rule needs a source uri")
    if err:
        raise RuleStoreError("; ".join(err))
    return sorted(rules, key=lambda r: r["rule_id"])


def load_rules(path: str | Path) -> list[dict]:
    return validate_rules(json.loads(Path(path).read_text(encoding="utf-8")))
