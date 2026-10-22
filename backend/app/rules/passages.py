"""BM25 passage ranking for display only (M5-D4). Never changes `applicable`."""
from __future__ import annotations

import math
import re
from collections import Counter

K1, B = 1.5, 0.75
_TOKEN = re.compile(r"[a-z0-9]+(?:[.\-][a-z0-9]+)*")


def tokenize(text: str) -> list[str]:
    return _TOKEN.findall(text.lower())


def query_text(q: dict) -> str:
    parts = [t.replace("_", " ") for t in q["rule_types"]]
    parts += [q["hs_code"], q["origin_country"], *q["transit_countries"]]
    if q.get("agreement_id"):
        parts.append(q["agreement_id"])
    if q["transit_countries"]:
        parts += ["transit", "consignment"]
    return " ".join(parts)


def bm25_scores(query: list[str], docs: list[list[str]]) -> list[float]:
    n = len(docs)
    if n == 0:
        return []
    avg = sum(map(len, docs)) / n or 1.0
    df = Counter(t for d in docs for t in set(d))
    scores = []
    for d in docs:
        tf, s = Counter(d), 0.0
        for t in query:
            if tf[t] == 0:
                continue
            idf = math.log(1 + (n - df[t] + 0.5) / (df[t] + 0.5))
            s += idf * tf[t] * (K1 + 1) / (tf[t] + K1 * (1 - B + B * len(d) / avg))
        scores.append(s)
    return scores


def rank_passages(q: dict, result: dict, rules: list[dict], k: int = 3) -> list[dict]:
    """Passages for the rule evidence panel: what we applied, what conflicts, and what we read but did not use.

    Applicable and unresolved-conflict rules are always shown (ordered by BM25 score); the remaining
    k slots go to the highest-scoring excluded rules. The result is never modified: selection is the
    deterministic filter's job and this ordering cannot change it.
    """
    status = {e["rule_id"]: ("excluded", e["reason"]) for e in result["excluded"]}
    status.update({rid: ("conflict", c["resolution"]) for c in result["conflicts"] if c["resolution"] == "unresolved"
                   for rid in c["rule_ids"]})
    status.update({a["rule_id"]: ("applicable", None) for a in result["applicable"]})
    pool = sorted((r for r in rules if r["rule_id"] in status), key=lambda r: r["rule_id"])
    scores = bm25_scores(tokenize(query_text(q)), [tokenize(f"{r['title']} {r.get('text', '')}") for r in pool])
    ranked = sorted(zip(pool, scores), key=lambda x: (-x[1], x[0]["rule_id"]))
    must = [x for x in ranked if status[x[0]["rule_id"]][0] != "excluded"]
    rest = [x for x in ranked if status[x[0]["rule_id"]][0] == "excluded"][:max(0, k - len(must))]
    chosen = sorted(must + rest, key=lambda x: (-x[1], x[0]["rule_id"]))
    return [{"rule_id": r["rule_id"], "score": round(s, 4), "status": status[r["rule_id"]][0],
             "exclusion_reason": status[r["rule_id"]][1] if status[r["rule_id"]][0] == "excluded" else None,
             "title": r["title"], "text": r.get("text", ""), "source_id": r["source"]["source_id"]} for r, s in chosen]
