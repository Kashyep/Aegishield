"""Validator applied to every model output before use (docs/05 §6). Error codes = Explanation.validation enum."""
from __future__ import annotations

import re

_NUM = re.compile(r"\d[\d,]*(?:\.\d+)?")
# Positive claims that must not appear when the subject is not passed (unless negated).
_POSITIVE = re.compile(r"\b(approved|independent|compliant|safe to (?:execute|approve)|all checks passed|no issues)\b", re.I)
_NEGATED = re.compile(r"\b(not|never|cannot|can't|isn't|no longer)\s+(?:be\s+|been\s+|yet\s+)?$", re.I)


def _numbers(text: str) -> set[str]:
    return {n.replace(",", "").rstrip(".") for n in _NUM.findall(text)}


def _contradicts(text: str, outcome: str, subject_id: str) -> bool:
    if outcome == "passed":
        return bool(re.search(rf"\b{re.escape(subject_id)}\b[^.]{{0,40}}\b(blocked|needs[ _]review)\b", text, re.I))
    for m in _POSITIVE.finditer(text):
        if not _NEGATED.search(text[max(0, m.start() - 20):m.start()]):
            return True
    return False


def validate_output(output, *, allowed_ids, context_text: str, outcome: str, subject_id: str,
                    max_chars: int = 600) -> list[str]:
    """Return error codes; empty list = valid. `output` must be {text: str, cited_ids: [str]}."""
    if not isinstance(output, dict) or not isinstance(output.get("text"), str) or not output["text"].strip():
        return ["EMPTY"]
    cited = output.get("cited_ids")
    if not isinstance(cited, list) or not all(isinstance(c, str) for c in cited):
        return ["EMPTY"]
    text, errors = output["text"], []
    if set(cited) - set(allowed_ids):
        errors.append("UNKNOWN_CITATION")
    if _contradicts(text, outcome, subject_id):
        errors.append("OUTCOME_CONTRADICTION")
    if _numbers(text) - _numbers(context_text):
        errors.append("NUMBER_NOT_IN_CONTEXT")
    if len(text) > max_chars:
        errors.append("TOO_LONG")
    return errors
