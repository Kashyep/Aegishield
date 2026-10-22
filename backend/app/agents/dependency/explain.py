"""Dependency explanations (M4-D6). Prompt `dependency_explain_v1` is registered with MOD-12 (Member 5);
the deterministic template below is the always-available fallback and is what `off`/failed validation returns.
"""
from __future__ import annotations

import re

from ...llm.explain import explain
from ...llm.validate import validate_output
from .graph import SupplyGraph

PROMPT_ID = "dependency_explain_v1"
MAX_CHARS = 600
PROMPT_SPEC = {  # registered as app/llm/prompts/dependency_explain_v1.md
    "prompt_id": PROMPT_ID,
    "owner": "member_4",
    "input": "LinearizedContext.lines (aegis-path-v1) and allowed_citation_ids",
    "output_schema": {"text": "string <= 600 chars", "cited_ids": "list of ids from allowed_citation_ids"},
    "system": ("You explain supplier dependency findings. Use ONLY the lines provided. Never change the outcome. "
               "Do not say a supplier is independent unless RESULT outcome=passed. Cite only path ids (PATH-...) "
               "and edge ids (E-...) from the context. Do not introduce numbers that are not in the context. "
               "Answer as JSON {\"text\": ..., \"cited_ids\": [...]} in at most 600 characters."),
}

_REASON_SENTENCES = {
    "DISRUPTED_NODE_UNKNOWN": "The disrupted site could not be identified, so independence cannot be confirmed.",
    "UNVERIFIED_PATH_TO_DISRUPTED_NODE": "A path reaches the disrupted site but at least one link is unverified, so it needs review.",
    "INCOMPLETE_DEPENDENCY_DATA": "Some critical inputs have no known source, so independence cannot be confirmed.",
    "TRAVERSAL_TRUNCATED": "The search stopped at the depth limit before the chain ended, so it needs review.",
}


def _clean(name: str) -> str:
    return re.sub(r"\s*\(synthetic\)\s*$", "", name)


def template_explanation(result: dict, graph: SupplyGraph, parts: list[dict]) -> dict:
    sup = _clean(graph.suppliers[result["supplier_id"]]["name"])
    part = next(p["name"] for p in parts if p["part_id"] == result["part_id"]).split(" (")[0]
    label = lambda n: graph.nodes[n]["label"]
    out, cited = result["outcome"], []
    if out == "blocked":
        p = next(p for p in result["paths"] if p["kind"] == "shared_disrupted_dependency")
        chain = " \u2190 ".join(label(n) for n in p["node_ids"][:-1]) + f" from {label(p['node_ids'][-1])}"
        text = (f"{sup} is not independent: {part} comes through {chain}, the disrupted site "
                f"({p['path_id']}: {', '.join(p['edge_ids'])}).")
        cited = [p["path_id"], *p["edge_ids"]]
    elif out == "passed":
        text = (f"No upstream path from {sup} reaches the disrupted site within {result['max_depth']} hops; "
                f"all critical inputs have known sources.")
        shared = [label(n["node_id"]) for n in result["notes"] if n["code"] == "SHARED_NON_DISRUPTED_DEPENDENCY"]
        if shared:
            text += f" Shared but undisrupted: {', '.join(shared)}."
        cited = [p["path_id"] for p in result["paths"]]
    else:
        text = " ".join(_REASON_SENTENCES[result["reason_code"]].split("\n"))
        if result["reason_code"] == "INCOMPLETE_DEPENDENCY_DATA":
            miss = sorted({g["part_id"] for g in result["coverage"]["gaps"]})
            text = f"{sup}: " + text + f" Missing: {', '.join(miss)}."
        else:
            text = f"{sup}: " + text
        cited = [p["path_id"] for p in result["paths"] if p["kind"] != "clean"]
    return {"text": text[:MAX_CHARS], "cited_ids": cited}


def validate_explanation(expl: dict, context: dict, result: dict) -> list[str]:
    """Same rules as every other model output (MOD-12 validator)."""
    return validate_output(expl, allowed_ids=context["allowed_citation_ids"], context_text="\n".join(context["lines"]),
                           outcome=result["outcome"], subject_id=result["supplier_id"], max_chars=MAX_CHARS)


def explain_dependency(result: dict, context: dict, graph: SupplyGraph, parts: list[dict], gateway=None,
                       generated_at: str | None = None) -> dict:
    """Explanation for one dependency result through the MOD-12 gateway; template on any failure. Never raises."""
    ctx = {**context, "outcome": result["outcome"]}
    xpl, _ = explain(result["supplier_id"], ctx, PROMPT_ID, template_explanation(result, graph, parts), gateway,
                     explanation_id=f"XPL-DEP-{result['supplier_id']}", generated_at=generated_at, max_chars=MAX_CHARS)
    return xpl
