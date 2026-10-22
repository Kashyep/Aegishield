"""MOD-12 LLM gateway (Member 5). The only module that talks to an LLM provider.

Outcomes never depend on this module: every caller has a deterministic template and the
validator rejects any model output that cites unknown ids, contradicts the outcome, or
introduces numbers absent from the context.
"""
from .gateway import GatewayResult, LLMGateway, gateway_from_env, request_hash
from .explain import explain
from .validate import validate_output

__all__ = ["GatewayResult", "LLMGateway", "gateway_from_env", "request_hash", "explain", "validate_output"]
