"""Adapter: MOD-07 Temporal Rule Service lives in app/rules (Member 5). Signature kept for existing callers."""
from typing import Any

from ..rules.applicability import AUTH_RANK, _value as rule_value, rule_applicability

__all__ = ["AUTH_RANK", "rule_value", "query_rule_applicability"]


def query_rule_applicability(fx: dict[str, Any], query: dict[str, Any]) -> dict[str, Any]:
    return rule_applicability(query, fx["trade_rules"]["rules"], fx["master_data"]["agreements"])
