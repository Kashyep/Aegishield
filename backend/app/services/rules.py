from typing import Any
from .fixtures import canonical_json

AUTH_RANK = {
    "official_gazette": 0,
    "official_circular": 1,
    "internal_policy": 2,
    "secondary": 3,
}


def rule_value(rule: dict[str, Any]) -> Any:
    s = rule["structured"]
    return s.get("rate_bps") if "rate_bps" in s else canonical_json(s)


def query_rule_applicability(fx: dict[str, Any], query: dict[str, Any]) -> dict[str, Any]:
    rules = sorted(fx["trade_rules"]["rules"], key=lambda r: r["rule_id"])
    agreements = {a["agreement_id"]: a for a in fx["master_data"]["agreements"]}
    on, known = query["applicable_on"], query["known_as_of"]
    excluded: list[dict[str, Any]] = []
    candidates: list[dict[str, Any]] = []

    for r in rules:
        if r["rule_type"] not in query["rule_types"]:
            continue
        reason = None
        if r["jurisdiction"] != query["jurisdiction"]:
            reason = "jurisdiction_mismatch"
        elif "*" not in r["hs_scope"] and query["hs_code"] not in r["hs_scope"]:
            reason = "hs_scope_mismatch"
        elif r["origin_scope"] == "agreement_parties" and (
            r["agreement_id"] not in agreements
            or query["origin_country"] not in agreements[r["agreement_id"]]["parties"]
        ):
            reason = "origin_scope_mismatch"
        elif r["published_date"] > known:
            reason = "not_yet_published"
        elif r["status"] in ("draft", "withdrawn"):
            reason = r["status"]
        elif on < r["effective_from"]:
            reason = "not_yet_effective"

        if reason:
            excluded.append({"rule_id": r["rule_id"], "reason": reason})
        else:
            candidates.append(r)

    remaining: list[dict[str, Any]] = []
    for r in candidates:
        if any(r["rule_id"] in s["supersedes"] for s in candidates):
            excluded.append({"rule_id": r["rule_id"], "reason": "superseded"})
        elif r["effective_to"] is not None and on > r["effective_to"]:
            excluded.append({"rule_id": r["rule_id"], "reason": "expired"})
        else:
            remaining.append(r)

    applicable: list[dict[str, Any]] = []
    conflicts: list[dict[str, Any]] = []
    missing: list[str] = []

    for rtype in query["rule_types"]:
        group = sorted(
            [r for r in remaining if r["rule_type"] == rtype],
            key=lambda r: (AUTH_RANK[r["authority"]["level"]], r["rule_id"]),
        )
        if not group:
            missing.append(rtype)
            continue

        best_rank = AUTH_RANK[group[0]["authority"]["level"]]
        top = [r for r in group if AUTH_RANK[r["authority"]["level"]] == best_rank]
        lower = [r for r in group if AUTH_RANK[r["authority"]["level"]] != best_rank]

        if len({rule_value(r) for r in top}) > 1:
            conflicts.append(
                {
                    "rule_type": rtype,
                    "rule_ids": [r["rule_id"] for r in top],
                    "field": "structured",
                    "values": [rule_value(r) for r in top],
                    "resolution": "unresolved",
                }
            )
            continue

        chosen = sorted(top, key=lambda r: r["published_date"], reverse=True)[0]
        applicable.append(
            {
                "rule_id": chosen["rule_id"],
                "rule_type": rtype,
                "family_id": chosen["family_id"],
                "effective_from": chosen["effective_from"],
                "effective_to": chosen["effective_to"],
                "authority_level": chosen["authority"]["level"],
                "structured": chosen["structured"],
                "citation": {
                    "source_id": chosen["source"]["source_id"],
                    "title": chosen["source"]["title"],
                    "synthetic": chosen["source"]["synthetic"],
                },
            }
        )
        for r in top:
            if r is not chosen:
                excluded.append({"rule_id": r["rule_id"], "reason": "duplicate_same_authority"})
        for r in lower:
            excluded.append({"rule_id": r["rule_id"], "reason": "lower_authority"})
            if rule_value(r) != rule_value(chosen):
                conflicts.append(
                    {
                        "rule_type": rtype,
                        "rule_ids": [chosen["rule_id"], r["rule_id"]],
                        "field": "structured",
                        "values": [rule_value(chosen), rule_value(r)],
                        "resolution": "authority_precedence",
                    }
                )

    unresolved = [c for c in conflicts if c["resolution"] == "unresolved"]
    return {
        "schema_version": "1.0.0",
        "query": query,
        "outcome": "needs_review" if (unresolved or missing) else "resolved",
        "applicable": applicable,
        "excluded": sorted(excluded, key=lambda x: x["rule_id"]),
        "conflicts": conflicts,
        "missing_rule_types": missing,
        "retrieval_trace": {
            "selection": "deterministic_metadata_filter",
            "ranker_used_for_selection": False,
        },
    }
