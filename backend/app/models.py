from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ContractModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=False)


class EvaluationCreateRequest(ContractModel):
    disruption_id: str
    max_depth: int | None = Field(default=None, ge=1, le=4)


class AcknowledgementRequest(ContractModel):
    finding_id: str
    actor_id: str
    note: str = Field(min_length=5, max_length=500)


class LetterOfCreditChange(ContractModel):
    field_tag: str = Field(pattern=r"^[0-9]{2}[A-Z]?$")
    from_: str = Field(alias="from")
    to: str


class AmendmentDecisionRequest(ContractModel):
    lc_id: str = Field(pattern=r"^LC-[A-Z0-9-]+$")
    requested_changes: list[LetterOfCreditChange] = Field(min_length=1)


class DecisionRequest(ContractModel):
    action: Literal["approve", "reject", "request_amendment"]
    plan_version: int = Field(ge=1)
    plan_hash: str
    justification: str | None = Field(max_length=1000)
    acknowledgements: list[AcknowledgementRequest]
    amendment: AmendmentDecisionRequest | None = None


class ExecutionRequest(ContractModel):
    decision_id: str


class RuleQueryRequest(ContractModel):
    query_id: str
    jurisdiction: str
    rule_types: list[str] = Field(min_length=1)
    hs_code: str
    origin_country: str
    transit_countries: list[str]
    agreement_id: str | None
    applicable_on: str
    known_as_of: str
