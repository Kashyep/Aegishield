"""Disruption notice extraction via prompt disruption_extract_v1 (consumer: MOD-04 sensing agent)."""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

from jsonschema import Draft202012Validator
from referencing import Registry, Resource

from .gateway import LLMGateway

PROMPT_ID = "disruption_extract_v1"
SCHEMAS = Path(__file__).resolve().parents[3] / "contracts" / "schemas"


@lru_cache(maxsize=1)
def _validator():
    reg = Registry()
    for p in SCHEMAS.glob("*.schema.json"):
        reg = reg.with_resource(p.name, Resource.from_contents(json.loads(p.read_text(encoding="utf-8"))))
    return Draft202012Validator({"$ref": "disruption.schema.json#/$defs/GoldExtraction"}, registry=reg)


def extractor_for(gateway: LLMGateway):
    """Return extractor(raw_text) for assess_disruption(mode='recorded'|'live'); None when no valid output."""
    def extract(raw_text: str):
        res = gateway.complete(PROMPT_ID, {"raw_text": raw_text})
        if res.output is None or not _validator().is_valid(res.output):
            return None
        return res.output
    return extract
