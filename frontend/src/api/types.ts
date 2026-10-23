export type PlanFinancials = {
  baseline_loss_inr: number
  recovery_cost_inr: number
  residual_loss_inr: number
  net_avoided_loss_inr: number
  worst_case_exposure_inr: number
  exposures: {
    exposure_id: string
    line_id: string
    finding_id: string
    kind: string
    amount_inr: number | null
    mutually_exclusive_group: string | null
    basis: string
  }[]
  cost_breakdown?: { category: string; amount_inr: number }[]
}

export type Plan = {
  schema_version: string
  plan_id: string
  evaluation_id: string
  version: number
  label: string
  strategy: string
  lines: {
    line_id: string
    order_id: string
    option_id: string
    qty: number
    need_by: string
    eta_plant: string
    days_late: number
  }[]
  finding_ids: string[]
  check_outcome_counts: {
    passed: number
    needs_review: number
    blocked: number
  }
  outcome: string
  status: string
  financials: PlanFinancials
  input_snapshot_id: string
  amendment_request_ids: string[]
  plan_hash: string
  decision_ids?: string[]
  execution_id?: string | null
}

export type PlanComparisonItem = {
  plan_id: string
  label: string
  outcome: string
  executable: boolean
  recovery_cost_inr: number
  residual_loss_inr: number
  net_avoided_loss_inr: number
  worst_case_exposure_inr: number
  check_outcome_counts: Plan['check_outcome_counts']
}

export type Finding = {
  finding_id: string
  check_code: string
  agent: string
  outcome: string
  subject: { type: string; id: string }
  title: string
  evidence_ids: string[]
  remedies: { action: string; text: string }[]
  details: Record<string, unknown>
  explanations?: { mode: string; validation_status: string; text: string; cited_evidence_ids?: string[] }[]
}

export type Evidence = {
  evidence_id: string
  kind: string
  source_ids: string[]
  title: string
  authority: string
  synthetic: boolean
  locator: Record<string, unknown>
  excerpt: string | null
}

export type RuleResult = {
  query: {
    query_id: string
    applicable_on: string
    origin_country: string
    transit_countries: string[]
  }
  outcome: string
  applicable: {
    rule_id: string
    rule_type: string
    family_id: string
    effective_from: string
    effective_to: string | null
    authority_level: string
    structured: Record<string, unknown>
    citation: { source_id: string; title: string; synthetic: boolean }
  }[]
  excluded: { rule_id: string; reason: string }[]
  conflicts: { family_id: string; selected_rule_id: string; excluded_rule_ids: string[]; reason: string }[]
  missing_rule_types: string[]
}

export type EvaluationStep = {
  seq: number
  step: string
  owner: string
  status: string
  attempts: number
  started_at?: string | null
  finished_at?: string | null
  mode?: string | null
  error?: { message?: string } | string | null
}

export type AffectedShipment = {
  shipment_id: string
  po_id: string
  planned_etd: string
  revised_etd: string
  planned_eta_plant: string
  revised_eta_plant: string
  delay_days: number
}

export type AffectedOrder = {
  order_id: string
  customer_id: string
  qty_affected: number
  order_value_inr: number
  need_by: string
  revised_arrival: string
  days_late: number
  baseline_penalty_inr: number
}

export type DisruptionEvent = {
  disruption_id: string
  received_at?: string
  channel?: string
  raw_text?: string
  [key: string]: unknown
}

export type DisruptionList = {
  items: DisruptionEvent[]
}

export type DisruptionAssessment = {
  schema_version: string
  assessment_id: string
  disruption_id: string
  outcome: 'passed' | 'needs_review'
  issues: string[]
  extraction_mode: 'gold' | 'recorded' | 'live'
  event_type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  severity_basis: string
  disrupted_node_ids: string[]
  affected_supplier_ids: string[]
  affected_shipments: AffectedShipment[]
  affected_orders: AffectedOrder[]
  baseline_loss_inr: number
  evidence: Evidence[]
}

export type Evaluation = {
  assessment?: DisruptionAssessment
  evaluation_id: string
  disruption_id: string
  status: string
  data_mode?: string
  llm_mode?: string
  input_snapshot_id: string
  created_at?: string
  completed_at?: string
  steps?: EvaluationStep[]
  comparison: {
    baseline_loss_inr: number
    plans: PlanComparisonItem[]
    recommended_plan_id: string | null
    recommendation_rule: string
    paper_advantage_of_best_blocked_plan_inr: number | null
  }
  plans: Plan[]
  findings: Finding[]
  evidence: Evidence[]
  rule_results: RuleResult[]
  dependency_results?: DependencyResult[]
}

export type DependencyResult = {
  supplier_id: string
  part_id: string
  start_node_id: string
  max_depth: number
  disrupted_node_ids: string[]
  outcome: 'passed' | 'needs_review' | 'blocked'
  reason_code: string
  paths: { path_id: string; kind: string; node_ids: string[]; edge_ids: string[] }[]
  shared_with_primary_node_ids: string[]
  coverage: { complete: boolean; gaps: unknown[] }
  truncated: boolean
  cycle_detected: boolean
}

export type DemoActor = {
  actor_id: string
  display_name: string
  role: 'supply_planner' | 'trade_compliance_officer' | 'viewer'
}

export type Policies = {
  approval_policy: {
    approver_roles: string[]
    acknowledgement_roles: Record<string, string[]>
    amendment_request_roles: string[]
    reject_roles: string[]
    blocked_plans_approvable: boolean
  }
  demo_actors: DemoActor[]
}

export type Acknowledgement = {
  finding_id: string
  actor_id: string
  note: string
}

export type DecisionRequest = {
  action: 'approve' | 'reject' | 'request_amendment'
  plan_version: number
  plan_hash: string
  justification: string | null
  acknowledgements: Acknowledgement[]
  amendment?: {
    lc_id: string
    requested_changes: { field_tag: string; from: string; to: string }[]
  } | null
}

export type Decision = {
  schema_version: string
  decision_id: string
  plan_id: string
  plan_version: number
  plan_hash: string
  action: DecisionRequest['action']
  actor: { actor_id: string; role: string; kind: string; display_name?: string | null }
  justification: string | null
  acknowledgements: Acknowledgement[]
  decided_at: string
  resulting_plan_status: string
  amendment_request_id: string | null
  idempotency_key: string
}

export type ExecutionStep = {
  seq: number
  step_type: string
  refs: Record<string, unknown>
  description: string
  status: string
  simulated: true
  proposed_sap_mapping: string
  error: { message?: string } | string | null
}

export type Execution = {
  schema_version: string
  execution_id: string
  plan_id: string
  plan_version: number
  decision_id: string
  status: 'queued' | 'running' | 'completed' | 'failed'
  simulated: true
  steps: ExecutionStep[]
  started_at: string
  finished_at: string | null
  error: { message?: string } | string | null
}

export type AuditEvent = {
  schema_version: string
  event_id: string
  seq: number
  occurred_at: string
  actor: { actor_id: string; role: string; kind: string; display_name?: string | null }
  event_type: string
  subject: { type: string; id: string; version?: number | null }
  payload: Record<string, unknown>
  evidence_ids: string[]
  prev_hash: string
  event_hash: string
}

export type AuditEventPage = {
  events: AuditEvent[]
  next_after_seq: number | null
}

export type AuditVerifyResult = {
  valid: boolean
  checked_events: number
  first_invalid_seq: number | null
}

export type ApiProblem = {
  title: string
  detail: string
  status: number
  code: string
  current?: { plan_version?: number; plan_hash?: string; status?: string }
}

export type ApiResult<T> = {
  data: T
  replayed: boolean
}

export type SupplyGraph = {
  dataset_id: string
  edge_direction: string
  nodes: {
    node_id: string
    kind: string
    label: string
    org_name: string
    supplier_id: string | null
    country: string
    role: string
  }[]
  edges: {
    edge_id: string
    type: string
    source: string
    target: string
    part_id: string
    source_ref: string
    confidence: string
  }[]
  sources: {
    source_id: string
    title: string
    kind: string
    as_of: string
    authority: string
  }[]
}

export type GraphNode = SupplyGraph['nodes'][number]

export type GraphViewNodeStatus = 'disrupted' | 'blocked' | 'candidate_passed' | 'affected_primary' | 'buyer' | 'normal'

export type GraphView = {
  schema_version: string
  view_id: string
  evaluation_id: string
  focus_supplier_id: string
  edge_direction: string
  nodes: {
    id: string
    label: string
    org_name: string
    country: string
    role: string
    status: GraphViewNodeStatus
    synthetic: boolean
  }[]
  edges: {
    id: string
    source: string
    target: string
    type: string
    part_id: string
    confidence: string | null
    source_ref: string | null
    highlighted: boolean
    candidate: boolean
  }[]
  paths: { path_id: string; kind: string; node_ids: string[]; edge_ids: string[] }[]
  text_alternative: string[]
}

export type GraphViewNode = GraphView['nodes'][number]

export type Health = {
  status: 'ok' | 'degraded'
  api_version: string
  contract_version: string
  data_mode: string
  llm_mode: 'off' | 'recorded' | 'live'
  demo_mode: boolean
  scenario_id: string
  input_snapshot_id: string
}

export type EvaluationAccepted = {
  evaluation_id: string
  status: string
  poll_url: string
  superseded_plan_ids: string[]
}

export type DemoResetResponse = {
  scenario_id: string
  input_snapshot_id: string
  reset_at: string
  counters_reset: boolean
  audit_event_id: string
}
