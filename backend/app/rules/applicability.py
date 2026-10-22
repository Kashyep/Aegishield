"""Temporal rule applicability (M5-D3), canonical algorithm in docs/00 §10.2."""
from __future__ import annotations

import json

AUTH_RANK = {"official_gazette": 0, "official_circular": 1, "internal_policy": 2, "secondary": 3}


def _value(rule: dict):
    """Comparable value of a rule: its rate if it has one, else its canonical structured payload."""
    s = rule["structured"]
    if "rate_bps" in s:
        return s["rate_bps"]
    return json.dumps(s, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def _exclusion(rule: dict, q: dict, parties: dict) -> str | None:
    if rule["jurisdiction"] != q["jurisdiction"]:
        return "jurisdiction_mismatch"
    if "*" not in rule["hs_scope"] and q["hs_code"] not in rule["hs_scope"]:
        return "hs_scope_mismatch"
    if rule["origin_scope"] == "agreement_parties" and q["origin_country"] not in parties.get(rule["agreement_id"], ()):
        return "origin_scope_mismatch"
    if rule["published_date"] > q["known_as_of"]:
        return "not_yet_published"
    if rule["status"] in ("draft", "withdrawn"):
        return rule["status"]
    if q["applicable_on"] < rule["effective_from"]:
        return "not_yet_effective"
    return None


def rule_applicability(q: dict, rules: list[dict], agreements: list[dict] | dict) -> dict:
    agreements = agreements.values() if isinstance(agreements, dict) else agreements
    parties = {a["agreement_id"]: set(a["parties"]) for a in agreements}
    on = q["applicable_on"]
    excluded, candidates = [], []
    for r in sorted(rules, key=lambda r: r["rule_id"]):
        if r["rule_type"] not in q["rule_types"]:
            continue
        reason = _exclusion(r, q, parties)
        (excluded.append({"rule_id": r["rule_id"], "reason": reason}) if reason else candidates.append(r))

    superseded = {s for r in candidates for s in r["supersedes"]}
    remaining = []
    for r in candidates:
        if r["rule_id"] in superseded:
            excluded.append({"rule_id": r["rule_id"], "reason": "superseded"})
        elif r["effective_to"] is not None and on > r["effective_to"]:
            excluded.append({"rule_id": r["rule_id"], "reason": "expired"})
        else:
            remaining.append(r)

    applicable, conflicts, missing = [], [], []
    for rtype in q["rule_types"]:
        group = sorted((r for r in remaining if r["rule_type"] == rtype),
                       key=lambda r: (AUTH_RANK[r["authority"]["level"]], r["rule_id"]))
        if not group:
            missing.append(rtype)
            continue
        best = AUTH_RANK[group[0]["authority"]["level"]]
        top = [r for r in group if AUTH_RANK[r["authority"]["level"]] == best]
        lower = [r for r in group if AUTH_RANK[r["authority"]["level"]] != best]
        if len({_value(r) for r in top}) > 1:
            conflicts.append({"rule_type": rtype, "rule_ids": [r["rule_id"] for r in top], "field": "structured",
                              "values": [_value(r) for r in top], "resolution": "unresolved"})
            continue
        chosen = max(top, key=lambda r: r["published_date"])  # first max wins on ties (rule_id order)
        applicable.append({"rule_id": chosen["rule_id"], "rule_type": rtype, "family_id": chosen["family_id"],
                           "effective_from": chosen["effective_from"], "effective_to": chosen["effective_to"],
                           "authority_level": chosen["authority"]["level"], "structured": chosen["structured"],
                           "citation": {"source_id": chosen["source"]["source_id"], "title": chosen["source"]["title"],
                                        "synthetic": chosen["source"]["synthetic"]}})
        excluded += [{"rule_id": r["rule_id"], "reason": "duplicate_same_authority"} for r in top if r is not chosen]
        for r in lower:
            excluded.append({"rule_id": r["rule_id"], "reason": "lower_authority"})
            if _value(r) != _value(chosen):
                conflicts.append({"rule_type": rtype, "rule_ids": [chosen["rule_id"], r["rule_id"]], "field": "structured",
                                  "values": [_value(chosen), _value(r)], "resolution": "authority_precedence"})

    unresolved = any(c["resolution"] == "unresolved" for c in conflicts)
    return {"schema_version": "1.0.0", "query": q,
            "outcome": "needs_review" if unresolved or missing else "resolved",
            "applicable": applicable, "excluded": sorted(excluded, key=lambda x: x["rule_id"]),
            "conflicts": conflicts, "missing_rule_types": missing,
            "retrieval_trace": {"selection": "deterministic_metadata_filter", "ranker_used_for_selection": False}}
