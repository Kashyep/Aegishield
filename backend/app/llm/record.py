"""Write recorded responses (M5-D9): fixtures/llm/recorded/<prompt_id>/<request_hash>.json.

    python -m backend.app.llm.record          # regenerate the hand-authored demo set from current demo inputs

Hand-authored outputs are labelled origin="hand_authored" and must pass the validator. Replace them with
reviewed live captures (work/llm/captured/) once a provider is chosen (OD-04).
"""
from __future__ import annotations

import json
from pathlib import Path

from .gateway import RECORDED_DIR, request_hash
from .registry import get_prompt

HAND_MODEL = "hand-authored (synthetic)"


def write_recorded(prompt_id: str, payload, output: dict, *, model: str = HAND_MODEL, origin: str = "hand_authored",
                   directory: Path = RECORDED_DIR) -> Path:
    version = get_prompt(prompt_id)["version"]
    h = request_hash(prompt_id, version, payload)
    path = Path(directory) / prompt_id / f"{h}.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"prompt_id": prompt_id, "prompt_version": version, "request_hash": h,
                                "input": payload, "output": output, "model": model, "origin": origin,
                                "synthetic": True}, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return path


def demo_records(fx: dict) -> list[tuple[str, object, dict]]:
    """(prompt_id, input, output) for every demo prompt call."""
    from ..agents.dependency.check import check_dependency
    from ..agents.dependency.graph import build_graph
    from ..agents.dependency.linearize import linearize
    from ..services.evaluation import build_evaluation_payload
    from .explain_plan import plan_context
    from .lc_extract import verified_values

    ev = build_evaluation_payload(fx, "DIS-2026-0042", "EVAL-0001", ("PLN-0001", "PLN-0002"), "off",
                                  "2026-10-26T09:00:00+05:30", "2026-10-26T09:00:04+05:30")
    findings = {f["finding_id"]: f for f in ev["findings"]}
    plans = {p["plan_id"]: p for p in ev["plans"]}
    out = []

    def ctx_input(subject, ctx):
        return {"subject_id": subject, "lines": ctx["lines"], "allowed_citation_ids": ctx["allowed_citation_ids"]}

    p1, p2 = plans["PLN-0001"], plans["PLN-0002"]
    out.append(("plan_explain_v1", ctx_input("PLN-0001", plan_context(p1, findings)), {
        "text": ("PLN-0001 is blocked and cannot be executed. Its alternate supplier SUP-B depends on the disrupted "
                 "wafer fab (FND-DEP-SUP-B), and the Singapore transhipment breaks the letter of credit "
                 "(FND-LC-TRANSHIPMENT-RT-C-SIN). The Colombo route also needs review for FTA direct consignment "
                 "(FND-FTA-DIRECT_CONSIGNMENT-RT-B-CMB). Its net avoided loss of INR 826000 exists only on paper."),
        "cited_ids": ["FND-DEP-SUP-B", "FND-LC-TRANSHIPMENT-RT-C-SIN", "FND-FTA-DIRECT_CONSIGNMENT-RT-B-CMB"]}))
    p2_cites = [f for f in p2["finding_ids"] if f in ("FND-DEP-SUP-C", "FND-LC-TRANSHIPMENT-RT-C-DIR")]
    out.append(("plan_explain_v1", ctx_input("PLN-0002", plan_context(p2, findings)), {
        "text": ("PLN-0002 passed every check: plant and Pune stock plus Saigon Precision Electronics on the direct "
                 "sailing. Net avoided loss is INR 618000, with a residual loss of INR 50000 for units that arrive late."),
        "cited_ids": p2_cites}))

    g = build_graph(fx["supply_graph"], fx["master_data"])
    pol = fx["policies"]["dependency_policy"]
    for sid in ("SUP-B", "SUP-C"):
        r = check_dependency({"supplier_id": sid, "part_id": "PRT-PM750", "disrupted_node_ids": ["FAC-FABZ"],
                              "max_depth": pol["max_depth"]}, g, fx["master_data"]["parts"], pol)
        ctx = linearize(r, g)
        if sid == "SUP-B":
            p = next(p for p in r["paths"] if p["kind"] == "shared_disrupted_dependency")
            o = {"text": (f"Chao Phraya Power Devices is not independent: its IGBT dies come through Kedah die sort "
                          f"from the disrupted Zenith Kulim fab ({p['path_id']}: {', '.join(p['edge_ids'])})."),
                 "cited_ids": [p["path_id"], *p["edge_ids"]]}
        else:
            p = next(p for p in r["paths"] if "FAC-FABK" in p["node_ids"])
            o = {"text": (f"No upstream path from Saigon Precision Electronics reaches the disrupted fab within "
                          f"{r['max_depth']} hops; its dies come from the Kumgang Gumi fab via Hanoi die distribution "
                          f"({p['path_id']}). It shares the undisrupted Shah Alam substrate plant with the primary supplier."),
                 "cited_ids": [p["path_id"], *p["edge_ids"]]}
        out.append(("dependency_explain_v1", ctx_input(sid, ctx), o))

    for lc in fx["letters_of_credit"]["letters_of_credit"]:
        out.append(("lc_extract_v1", {"raw_text": lc["raw_text"]}, verified_values(lc)))
    for event in fx["disruptions"]["events"]:
        if event.get("gold_extraction"):
            out.append(("disruption_extract_v1", {"raw_text": event["raw_text"]}, event["gold_extraction"]))
    return out


def main():
    from ..services.fixtures import load_fixtures
    from ..config import FIXTURES
    for f in RECORDED_DIR.glob("*/*.json"):
        if json.loads(f.read_text(encoding="utf-8")).get("origin") == "hand_authored":
            f.unlink()
    for prompt_id, payload, output in demo_records(load_fixtures(FIXTURES)):
        print(write_recorded(prompt_id, payload, output).relative_to(RECORDED_DIR.parents[2]))


if __name__ == "__main__":
    main()
