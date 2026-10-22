"""LC text extraction (M5-D7, prompt lc_extract_v1). Bounded: enum-constrained JSON, compared with the verified record.

A mismatch never changes the record: the caller stores the result as LetterOfCredit.extracted and
MOD-08's LC.EXTRACTION_CONSISTENCY turns any difference into needs_review.
"""
from __future__ import annotations

import re

from .gateway import LLMGateway

PROMPT_ID = "lc_extract_v1"
FIELDS = ("transhipment", "partial_shipments", "ucp_20c_excluded", "latest_shipment_date", "port_of_discharge",
          "presentation_period_days")
_ENUM = {"transhipment": {"allowed", "not_allowed", "conditional"},
         "partial_shipments": {"allowed", "not_allowed", "conditional"}}
_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def validate_extraction(out) -> list[str]:
    """Schema of lc_extract_v1 output; returns problems (empty = valid)."""
    if not isinstance(out, dict):
        return ["not an object"]
    p = [f"unexpected field {k}" for k in out if k not in FIELDS]
    for k, allowed in _ENUM.items():
        if k in out and out[k] not in allowed:
            p.append(f"{k} not in {sorted(allowed)}")
    if "ucp_20c_excluded" in out and not isinstance(out["ucp_20c_excluded"], bool):
        p.append("ucp_20c_excluded not boolean")
    if "latest_shipment_date" in out and not (isinstance(out["latest_shipment_date"], str) and _DATE.match(out["latest_shipment_date"])):
        p.append("latest_shipment_date not YYYY-MM-DD")
    if "port_of_discharge" in out and not isinstance(out["port_of_discharge"], str):
        p.append("port_of_discharge not a string")
    if "presentation_period_days" in out and not (isinstance(out["presentation_period_days"], int)
                                                  and not isinstance(out["presentation_period_days"], bool)):
        p.append("presentation_period_days not integer")
    return p


def verified_values(lc: dict) -> dict:
    """The verified record projected onto the extraction fields (what a correct extraction must equal)."""
    s = lc["structured"]
    return {"transhipment": s["transhipment"]["value"], "partial_shipments": s["partial_shipments"]["value"],
            "ucp_20c_excluded": s["ucp_20c_excluded"]["value"], "latest_shipment_date": s["latest_shipment_date"]["value"],
            "port_of_discharge": s["port_of_discharge"]["port_id"],
            "presentation_period_days": s["presentation_period_days"]["value"]}


def compare_with_record(extracted: dict, lc: dict) -> list[str]:
    v = verified_values(lc)
    return sorted(k for k, val in extracted.items() if v.get(k) != val)


def extract_lc_fields(raw_text: str, gateway: LLMGateway | None) -> dict | None:
    """Model extraction or None (off mode, miss, failure, or invalid output). None means: no extraction to check."""
    if gateway is None:
        return None
    res = gateway.complete(PROMPT_ID, {"raw_text": raw_text})
    if res.output is None or validate_extraction(res.output):
        return None
    return dict(res.output)
