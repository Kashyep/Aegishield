"""explain(): never raises; falls back to the template (docs/00 §9.4)."""
from __future__ import annotations

from .gateway import LLMGateway
from .validate import validate_output


def explain(subject_id: str, context: dict, prompt_id: str, template: dict, gateway: LLMGateway | None,
            *, explanation_id: str, generated_at: str | None, max_chars: int = 600) -> tuple[dict, dict]:
    """context: {lines: [str], allowed_citation_ids: [str], outcome: str}. template: {text, cited_ids}.

    Returns (Explanation, step_info) where step_info = {mode, degraded, attempts, error}.
    """
    res = gateway.complete(prompt_id, {"subject_id": subject_id, "lines": context["lines"],
                                       "allowed_citation_ids": context["allowed_citation_ids"]}) \
        if gateway is not None else None
    base = {"explanation_id": explanation_id, "subject_id": subject_id, "generated_at": generated_at}
    info = {"mode": "template", "degraded": bool(res and res.degraded), "attempts": res.attempts if res else 0,
            "error": res.error if res else None}
    if res is not None and res.output is not None:
        errors = validate_output(res.output, allowed_ids=context["allowed_citation_ids"],
                                 context_text="\n".join(context["lines"]), outcome=context["outcome"],
                                 subject_id=subject_id, max_chars=max_chars)
        if not errors:
            info["mode"] = res.mode
            return ({**base, "mode": res.mode, "prompt_id": prompt_id, "model": res.model,
                     "text": res.output["text"], "cited_ids": list(res.output["cited_ids"]),
                     "validation": {"passed": True, "errors": []}}, info)
        info.update(degraded=True, error="VALIDATION_FAILED")
        return ({**base, "mode": "template", "prompt_id": None, "model": None, **_t(template),
                 "validation": {"passed": False, "errors": errors}}, info)
    return ({**base, "mode": "template", "prompt_id": None, "model": None, **_t(template),
             "validation": {"passed": True, "errors": []}}, info)


def _t(template: dict) -> dict:
    return {"text": template["text"], "cited_ids": list(template["cited_ids"])}
