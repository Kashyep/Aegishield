"""Plan explanation composer (M5-D8): template + prompt plan_explain_v1."""
from __future__ import annotations

from .explain import explain
from .gateway import LLMGateway

PROMPT_ID = "plan_explain_v1"
MAX_CHARS = 900


def plan_template(plan: dict, findings: dict) -> dict:
    """Deterministic template; golden strings in fixtures/expected/evaluation_EVAL-0001.json."""
    material = [findings[f] for f in plan["finding_ids"] if findings[f]["outcome"] in ("blocked", "needs_review")]
    if material:
        summary = "; ".join(f"{f['finding_id']} is {f['outcome']}" for f in material)
        cited = [f["finding_id"] for f in material]
    else:
        summary, cited = "All checks passed", plan["finding_ids"][:3]
    return {"text": f"{plan['plan_id']} outcome {plan['outcome']}. {summary}. "
                    f"Net avoided loss INR {plan['financials']['net_avoided_loss_inr']}.",
            "cited_ids": cited}


def plan_context(plan: dict, findings: dict) -> dict:
    """The only plan material a model sees: ids, outcomes, titles and the plan's own numbers."""
    f = plan["financials"]
    lines = [f"PLAN {plan['plan_id']} outcome={plan['outcome']} strategy={plan['strategy']}",
             "FINANCIALS " + " ".join(f"{k}={f[k]}" for k in ("baseline_loss_inr", "recovery_cost_inr",
                                                              "residual_loss_inr", "net_avoided_loss_inr",
                                                              "worst_case_exposure_inr"))]
    lines += [f"FINDING {fid} outcome={findings[fid]['outcome']} check={findings[fid]['check_code']} "
              f"title={findings[fid]['title']}" for fid in plan["finding_ids"]]
    return {"lines": lines, "allowed_citation_ids": sorted(plan["finding_ids"]), "outcome": plan["outcome"]}


def explain_plan(plan: dict, findings: dict, gateway: LLMGateway | None, generated_at: str | None):
    return explain(plan["plan_id"], plan_context(plan, findings), PROMPT_ID, plan_template(plan, findings), gateway,
                   explanation_id=f"XPL-{plan['plan_id']}", generated_at=generated_at, max_chars=MAX_CHARS)
