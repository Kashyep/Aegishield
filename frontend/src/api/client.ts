import type {
  ApiProblem,
  ApiResult,
  AuditEventPage,
  AuditVerifyResult,
  Decision,
  DecisionRequest,
  DemoResetResponse,
  DisruptionList,
  Evaluation,
  EvaluationAccepted,
  Execution,
  GraphView,
  Health,
  Policies,
  Plan,
  ScenarioResponse,
  SupplyGraph,
  EarlyWarningResult,
  SupplyNetwork,
} from './types'

export type ApiMode = 'stub' | 'live'

export class ApiError extends Error {
  readonly status?: number
  readonly problem?: ApiProblem

  constructor(
    message: string,
    status?: number,
    problem?: ApiProblem,
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.problem = problem
  }
}

declare const process: { env?: Record<string, string | undefined> } | undefined

function getEnvVar(key: string): string | undefined {
  if (typeof import.meta !== 'undefined' && 'env' in import.meta && import.meta.env) {
    return import.meta.env[key]
  }
  if (typeof process !== 'undefined' && process?.env) {
    return process.env[key]
  }
  return undefined
}
const apiMode: ApiMode = getEnvVar('VITE_API_MODE') === 'live' ? 'live' : 'stub'
const apiBaseUrl = (getEnvVar('VITE_API_BASE_URL') || 'http://localhost:8000').replace(/\/$/, '')

async function getStub<T>(path: string): Promise<T> {
  const response = await fetch(path)
  if (!response.ok) {
    throw new ApiError(`Could not load ${path} (${response.status}).`, response.status)
  }
  return response.json() as Promise<T>
}

function requireLiveMode(): void {
  if (apiMode !== 'live') {
    throw new ApiError('This action is unavailable in fixture mode because no recorded response exists.')
  }
}

function unsupportedLiveOperation(operation: string): never {
  throw new ApiError(`${operation} is not available from the current live API contract.`)
}

async function request<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST'
    actorId?: string
    idempotencyKey?: string
    body?: unknown
  } = {},
): Promise<ApiResult<T>> {
  requireLiveMode()
  const headers = new Headers({ Accept: 'application/json, application/problem+json' })
  if (options.body !== undefined) headers.set('Content-Type', 'application/json')
  if (options.actorId) headers.set('X-Actor-Id', options.actorId)
  if (options.idempotencyKey) headers.set('Idempotency-Key', options.idempotencyKey)

  let response: Response
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Network request failed.'
    throw new ApiError(`Could not reach the AegisShield API at ${apiBaseUrl}: ${message}`)
  }

  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw new ApiError(`API returned invalid JSON (${response.status}).`, response.status)
  }
  if (!response.ok) {
    const problem = body && typeof body === 'object' ? body as ApiProblem : undefined
    throw new ApiError(
      problem?.title && problem.detail ? `${problem.title}: ${problem.detail}` : `API request failed (${response.status}).`,
      response.status,
      problem,
    )
  }

  return {
    data: body as T,
    replayed: response.headers.get('Idempotent-Replay') === 'true',
  }
}

export function getApiMode(): ApiMode {
  return apiMode
}

export async function listDisruptions(): Promise<DisruptionList> {
  if (apiMode === 'stub') {
    try {
      return await getStub<DisruptionList>('/stubs/disruptions.json')
    } catch {
      const evaluation = await getEvaluation()
      return {
        items: evaluation?.disruption_id ? [{ disruption_id: evaluation.disruption_id }] : [],
      }
    }
  }
  return (await request<DisruptionList>('/api/v1/disruptions')).data
}

export function getEvaluation(): Promise<Evaluation> {
  return apiMode === 'stub'
    ? getStub<Evaluation>('/stubs/evaluation_EVAL-0001.json')
    : request<Evaluation>('/api/v1/evaluations/EVAL-0001').then(({ data }) => data)
}

export function getSupplyGraph(): Promise<SupplyGraph> {
  if (apiMode === 'live') {
    return unsupportedLiveOperation('The raw supply graph fixture view')
  }
  return getStub<SupplyGraph>('/stubs/supply_graph.json')
}

/** Dependency evidence graph (GraphView) for one candidate supplier. Stub files are generated from the backend builder. */
export function getGraphView(evaluationId: string, supplierId: string): Promise<GraphView> {
  return apiMode === 'stub'
    ? getStub<GraphView>(`/stubs/graph_view_${encodeURIComponent(supplierId)}.json`)
    : request<GraphView>(`/api/v1/evaluations/${encodeURIComponent(evaluationId)}/graph?focus_supplier_id=${encodeURIComponent(supplierId)}`).then(({ data }) => data)
}

export async function getHealth(): Promise<Health> {
  return (await request<Health>('/api/v1/health')).data
}

export async function resetDemo(actorId: string): Promise<DemoResetResponse> {
  return (await request<DemoResetResponse>('/api/v1/demo/reset', { method: 'POST', actorId })).data
}

export async function createEvaluation(actorId: string, idempotencyKey: string, disruptionId: string): Promise<EvaluationAccepted> {
  return (await request<EvaluationAccepted>('/api/v1/evaluations', {
    method: 'POST',
    actorId,
    idempotencyKey,
    body: { disruption_id: disruptionId },
  })).data
}

export async function getEvaluationById(evaluationId: string): Promise<Evaluation> {
  return (await request<Evaluation>(`/api/v1/evaluations/${encodeURIComponent(evaluationId)}`)).data
}

export async function getPolicies(): Promise<Policies> {
  if (apiMode === 'stub') {
    return getStub<Policies>('/stubs/policies.json')
  }
  try {
    const res = await request<ScenarioResponse>('/api/v1/scenario')
    if (res.data.policies) {
      return res.data.policies
    }
  } catch {
    // fall back to stubs only if policies is missing
  }
  return getStub<Policies>('/stubs/policies.json')
}

export async function getPlan(planId: string): Promise<Plan> {
  return (await request<Plan>(`/api/v1/plans/${encodeURIComponent(planId)}`)).data
}

export async function submitDecision(
  planId: string,
  actorId: string,
  idempotencyKey: string,
  decision: DecisionRequest,
): Promise<ApiResult<Decision>> {
  if (apiMode === 'stub') {
    let isBlocked = planId === 'PLN-0001'
    try {
      const evaluation = await getEvaluation()
      const plan = evaluation.plans.find((p) => p.plan_id === planId)
      if (plan) {
        isBlocked = plan.status === 'blocked'
      }
    } catch {
      // ignore
    }
    if (decision.action === 'approve' && isBlocked) {
      const problem: ApiProblem = {
        title: 'Plan is blocked',
        status: 422,
        code: 'PLAN_BLOCKED',
        detail: `Plan ${planId} is blocked and cannot be approved`,
      }
      throw new ApiError(`Plan is blocked: ${problem.detail}`, 422, problem)
    }
    requireLiveMode()
  }
  return request<Decision>(`/api/v1/plans/${encodeURIComponent(planId)}/decisions`, {
    method: 'POST',
    actorId,
    idempotencyKey,
    body: decision,
  })
}

export function startExecution(
  planId: string,
  actorId: string,
  idempotencyKey: string,
  decisionId: string,
): Promise<ApiResult<Execution>> {
  if (apiMode === 'stub') requireLiveMode()
  return request<Execution>(`/api/v1/plans/${encodeURIComponent(planId)}/executions`, {
    method: 'POST',
    actorId,
    idempotencyKey,
    body: { decision_id: decisionId },
  })
}

export async function getExecution(executionId: string): Promise<Execution> {
  return (await request<Execution>(`/api/v1/executions/${encodeURIComponent(executionId)}`)).data
}

export async function getAuditEvents(subjectId?: string): Promise<AuditEventPage> {
  const query = new URLSearchParams({ limit: '200' })
  if (subjectId) query.set('subject_id', subjectId)
  return (await request<AuditEventPage>(`/api/v1/audit-events?${query.toString()}`)).data
}

export async function verifyAuditChain(): Promise<AuditVerifyResult> {
  return (await request<AuditVerifyResult>('/api/v1/audit-events/verify')).data
}

export async function getEarlyWarnings(asOf?: string): Promise<EarlyWarningResult> {
  if (apiMode === 'stub') {
    const stubFile = asOf && asOf.includes('2026-10-23')
      ? '/stubs/early_warnings_pre_notice.json'
      : '/stubs/early_warnings_scenario_time.json'
    return getStub<EarlyWarningResult>(stubFile)
  }
  const query = asOf ? '?as_of=' + encodeURIComponent(asOf) : ''
  return (await request<EarlyWarningResult>('/api/v1/early-warnings' + query)).data
}

export async function getSupplyNetwork(): Promise<SupplyNetwork> {
  if (apiMode === 'stub') {
    return getStub<SupplyNetwork>('/stubs/supply_network.json')
  }
  return (await request<SupplyNetwork>('/api/v1/supply-network')).data
}
