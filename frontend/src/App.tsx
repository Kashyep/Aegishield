import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ApiError, createEvaluation, getApiMode, getAuditEvents, getEvaluation, getEvaluationById, getExecution, getGraphView, getHealth, getPlan, getPolicies, listDisruptions, resetDemo, startExecution, submitDecision, verifyAuditChain } from './api/client'
import type { Acknowledgement, AuditEvent, AuditVerifyResult, Decision, DecisionRequest, DemoActor, Evaluation, Execution, Finding, GraphView, GraphViewNode, Health, Plan, PlanComparisonItem, Policies } from './api/types'
import { DependencyGraph } from './components/DependencyGraph'
import { STATUS_TEXT } from './components/graphStatus'
import { navItems, readScreenFromHash, screenLabel, writeScreenToHash, type Screen } from './app/navigation'
import './App.css'

const money = (amount: number) => `₹${amount.toLocaleString('en-IN')}`
const formatPlanId = (id: string) => id.replace(/^PLN-0*/, 'P')

/** Map option_id to readable source text per spec §94 */
const OPTION_LABELS: Record<string, string> = {
  'OPT-RT-B-CMB': 'Chao Phraya (TH) via Colombo',
  'OPT-INV-BLR': 'Bengaluru plant stock',
  'OPT-RT-C-SIN': 'Singapore transhipment route',
  'OPT-RT-A-DIR': 'Direct shipping route',
  'OPT-SRC-ALT': 'Alternative supplier',
}

const getOptionLabel = (optionId: string) => OPTION_LABELS[optionId] ?? optionId

const getWorstCaseExposure = (planItem: PlanComparisonItem, fullPlan?: Plan): number => {
  if (typeof planItem.worst_case_exposure_inr === 'number') {
    return planItem.worst_case_exposure_inr
  }
  if (fullPlan && typeof fullPlan.financials?.worst_case_exposure_inr === 'number') {
    return fullPlan.financials.worst_case_exposure_inr
  }
  if (fullPlan?.financials?.exposures) {
    const scenarioTotals = new Map<string, Map<string, number>>()
    let ungrouped = 0
    for (const exp of fullPlan.financials.exposures) {
      if (exp.amount_inr == null) continue
      if (!exp.mutually_exclusive_group) {
        ungrouped += exp.amount_inr
      } else {
        let kindMap = scenarioTotals.get(exp.mutually_exclusive_group)
        if (!kindMap) {
          kindMap = new Map<string, number>()
          scenarioTotals.set(exp.mutually_exclusive_group, kindMap)
        }
        kindMap.set(exp.kind, (kindMap.get(exp.kind) ?? 0) + exp.amount_inr)
      }
    }
    let total = ungrouped
    for (const kindMap of scenarioTotals.values()) {
      let maxKind = 0
      for (const amount of kindMap.values()) {
        if (amount > maxKind) maxKind = amount
      }
      total += maxKind
    }
    return total
  }
  return 0
}

const displayOutcome = (outcome: string) => ({
  passed: 'Passed',
  needs_review: 'Needs review',
  blocked: 'Blocked',
  not_applicable: 'Not applicable',
}[outcome] ?? outcome.replace(/_/g, ' '))

const formatLocalTimestamp = (timestamp?: string | null) => {
  if (!timestamp) return 'Time not recorded'
  const date = new Date(timestamp)
  return Number.isNaN(date.getTime())
    ? timestamp
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'medium' }).format(date)
}

/** Remedy target values for the LC fields the demo may amend (backend accepts 43T and 47A only). */
const LC_AMENDMENT_TARGETS: Record<string, string> = { '43T': 'ALLOWED', '47A': '(deleted)' }
const fieldValue = (excerpt: string | null | undefined, tag: string) => (excerpt ?? '').replace(`:${tag}:`, '').trim()

/** Highlight LC field tag in excerpt */
const highlightLcTag = (excerpt: string | null | undefined, tag: string) => {
  if (!excerpt || !tag) return excerpt ?? ''
  const searchTag = `:${tag}:`
  const idx = excerpt.indexOf(searchTag)
  if (idx === -1) return excerpt
  const before = excerpt.slice(0, idx)
  const matched = excerpt.slice(idx, idx + searchTag.length)
  const after = excerpt.slice(idx + searchTag.length)
  return `${before}<mark style="background: var(--color-primary-light); color: var(--color-primary); padding: 0 2px; border-radius: 2px;">${matched}</mark>${after}`
}

/** Map API problem codes to user-friendly messages per spec §113 */
const getErrorMessage = (error: ApiError): string => {
  const code = error.problem?.code
  if (code === 'PLAN_VERSION_STALE' || code === 'PLAN_SUPERSEDED') {
    return 'This plan changed or was replaced. Reload to review the current version.'
  }
  if (code === 'DECISION_EXISTS') {
    return 'A decision already exists for this plan version.'
  }
  if (code === 'PLAN_BLOCKED') {
    return 'Cannot approve: this plan is blocked by its fixture checks.'
  }
  if (error.status === 403) {
    return 'Switch to an actor with the required role to perform this action.'
  }
  if (error.status === 422) {
    return 'Please check the form for errors.'
  }
  return error.problem?.title ?? 'Decision not recorded'
}

function App() {
  const [activeScreen, setActiveScreen] = useState<Screen>(readScreenFromHash)
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null)
  const [graphView, setGraphView] = useState<GraphView | null>(null)
  const [focusSupplierId, setFocusSupplierId] = useState('SUP-B')
  const [health, setHealth] = useState<Health | null>(null)
  const [demoBusy, setDemoBusy] = useState<'' | 'reset' | 'evaluate'>('')
  const [demoMessage, setDemoMessage] = useState('')
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [amendmentResult, setAmendmentResult] = useState<Decision | null>(null)
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null)
  const [selectedGraphNode, setSelectedGraphNode] = useState<GraphViewNode | null>(null)
  const [approvalPlan, setApprovalPlan] = useState<Plan | null>(null)
  const [approvedDecision, setApprovedDecision] = useState<Decision | null>(null)
  const [execution, setExecution] = useState<Execution | null>(null)
  const [executionError, setExecutionError] = useState('')
  const [executionSubmitting, setExecutionSubmitting] = useState(false)
  const [executionPollRetry, setExecutionPollRetry] = useState(0)
  const executionKeyRef = useRef<{ planId: string; decisionId: string; key: string } | null>(null)
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([])
  const [auditState, setAuditState] = useState<'idle' | 'loading' | 'ready' | 'error' | 'unavailable'>('idle')
  const [auditError, setAuditError] = useState('')
  const [auditFilter, setAuditFilter] = useState('')
  const [auditVerification, setAuditVerification] = useState<AuditVerifyResult | null>(null)
  const [auditVerificationLoading, setAuditVerificationLoading] = useState(false)
  const [auditVerificationError, setAuditVerificationError] = useState('')
  const [policies, setPolicies] = useState<Policies | null>(null)
  const [policiesError, setPoliciesError] = useState('')
  const [actorId, setActorId] = useState('USR-PRIYA')
  const [acknowledgements, setAcknowledgements] = useState<Record<string, { checked: boolean; note: string }>>({})
  const [decisionError, setDecisionError] = useState<ApiError | null>(null)
  const [decisionSubmitting, setDecisionSubmitting] = useState(false)
  const [decisionJustification, setDecisionJustification] = useState('')
  const approvalDialogRef = useRef<HTMLDivElement>(null)
  const evidenceDrawerRef = useRef<HTMLElement>(null)
  const pendingDecisionRef = useRef<{ body: string; key: string } | null>(null)
  const [evaluationState, setEvaluationState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [evaluationError, setEvaluationError] = useState('')
  const [graphError, setGraphError] = useState('')
  const [stepAnnouncement, setStepAnnouncement] = useState('')

  const [availableDisruptionId, setAvailableDisruptionId] = useState<string | null>(null)
  const [evaluationId, setEvaluationId] = useState('EVAL-0001')
  const loadEvaluation = useCallback(async (id = evaluationId) => {
    setEvaluationState('loading')
    setEvaluationError('')
    try {
      setEvaluation(getApiMode() === 'live' ? await getEvaluationById(id) : await getEvaluation())
      setEvaluationState('ready')
    } catch (error) {
      setEvaluation(null)
      setEvaluationError(error instanceof Error ? error.message : 'Evaluation fixture could not be loaded.')
      setEvaluationState('error')
    }
  }, [evaluationId])

  const evaluationCompleted = evaluation?.status === 'completed'
  const loadGraph = useCallback(async () => {
    setGraphError('')
    if (!evaluationCompleted) {
      setGraphView(null)
      setGraphError('The dependency graph is available once an evaluation has completed.')
      return
    }
    try {
      setGraphView(await getGraphView(evaluationId, focusSupplierId))
    } catch (error) {
      setGraphView(null)
      setGraphError(error instanceof Error ? error.message : 'Dependency graph could not be loaded.')
    }
  }, [evaluationId, focusSupplierId, evaluationCompleted])

  useEffect(() => {
    void loadGraph()
  }, [loadGraph])

  useEffect(() => {
    if (getApiMode() !== 'live') return
    void getHealth().then(setHealth).catch(() => setHealth(null))
  }, [evaluation?.evaluation_id])

  const llmMode = health?.llm_mode ?? evaluation?.llm_mode ?? 'off'
  const llmBadge = llmMode === 'off'
    ? 'LLM: off (templates)'
    : llmMode === 'recorded'
      ? 'LLM: recorded'
      : 'LLM: live'
  const llmBadgeFull = `${llmBadge}${health?.status === 'degraded' ? ' · degraded' : ''}`

  const pollEvaluation = async (id: string) => {
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const current = await getEvaluationById(id)
      setEvaluation(current)
      if (!['queued', 'running'].includes(current.status)) return current
      // Announce completed steps for accessibility
      const latestStep = current.steps?.find(s => s.status === 'succeeded' || s.status === 'failed')
      if (latestStep && latestStep.finished_at) {
        setStepAnnouncement(`Step ${latestStep.seq}: ${latestStep.step.replace(/_/g, ' ')} ${latestStep.status}`)
      }
      await new Promise((resolve) => window.setTimeout(resolve, 500))
    }
    throw new ApiError(`Evaluation ${id} did not finish within 60 seconds.`)
  }

  const runDemoReset = async () => {
    setDemoBusy('reset')
    setDemoMessage('')
    try {
      const reset = await resetDemo(actorId)
      setEvaluation(null)
      setGraphView(null)
      setExecution(null)
      setApprovedDecision(null)
      setAmendmentResult(null)
      setEvaluationState('error')
      setEvaluationError('No evaluation yet. Run the evaluation to assess the disruption.')
      setDemoMessage(`Demo reset at ${formatLocalTimestamp(reset.reset_at)}. Audit chain restarted (${reset.audit_event_id}).`)
      setShowResetConfirm(false)
    } catch (error) {
      setDemoMessage(error instanceof Error ? error.message : 'Reset failed.')
    } finally {
      setDemoBusy('')
    }
  }

  const confirmReset = () => {
    setShowResetConfirm(true)
  }

  const runEvaluation = async () => {
    setDemoBusy('evaluate')
    setDemoMessage('')
    setEvaluationError('')
    try {
      const disruptionId = evaluation?.disruption_id ?? availableDisruptionId
      if (!disruptionId) return
      const accepted = await createEvaluation(actorId, crypto.randomUUID(), disruptionId)
      setEvaluationId(accepted.evaluation_id)
      navigate('evaluation-progress')
      setEvaluationState('ready')
      const done = await pollEvaluation(accepted.evaluation_id)
      setDemoMessage(`Evaluation ${done.evaluation_id} ${done.status}.${accepted.superseded_plan_ids.length ? ` Superseded: ${accepted.superseded_plan_ids.join(', ')}.` : ''}`)
    } catch (error) {
      setDemoMessage(error instanceof Error ? error.message : 'Evaluation could not be started.')
    } finally {
      setDemoBusy('')
    }
  }

  useEffect(() => {
    void loadEvaluation()
    void listDisruptions().then((data) => {
      const first = data.items[0]?.disruption_id
      if (first) setAvailableDisruptionId(first)
    }).catch(() => {})
    void getPolicies().then(setPolicies).catch((error: unknown) => {
      setPoliciesError(error instanceof Error ? error.message : 'Approval policy fixture could not be loaded.')
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only; later loads are explicit
  }, [])

  useEffect(() => {
    const syncScreenFromHistory = () => setActiveScreen(readScreenFromHash())
    window.addEventListener('popstate', syncScreenFromHistory)
    window.addEventListener('hashchange', syncScreenFromHistory)
    return () => {
      window.removeEventListener('popstate', syncScreenFromHistory)
      window.removeEventListener('hashchange', syncScreenFromHistory)
    }
  }, [])

  const navigate = (screen: Screen) => {
    writeScreenToHash(screen)
    setActiveScreen(screen)
    setSelectedPlan(null)
    setSelectedFinding(null)
    setSelectedGraphNode(null)
  }

  const openEvaluationProgress = () => {
    navigate('evaluation-progress')
    void loadEvaluation()
  }

  const currentActor: DemoActor | undefined = policies?.demo_actors.find((actor) => actor.actor_id === actorId)
  const reviewFindings = approvalPlan && evaluation
    ? evaluation.findings.filter((finding) => approvalPlan.finding_ids.includes(finding.finding_id) && finding.outcome === 'needs_review')
    : []
  const actorCanApprove = Boolean(currentActor && policies?.approval_policy.approver_roles.includes(currentActor.role))
  const reviewsAcknowledged = reviewFindings.every((finding) => {
    const permittedRoles = policies?.approval_policy.acknowledgement_roles[finding.agent] ?? []
    const acknowledgement = acknowledgements[finding.finding_id]
    return Boolean(
      currentActor &&
      permittedRoles.includes(currentActor.role) &&
      acknowledgement?.checked &&
      acknowledgement.note.trim().length >= 5,
    )
  })
  const approvalDisabledReason = approvalPlan?.status === 'blocked'
    ? 'Blocked plans cannot be approved. Review the blocking findings first.'
    : !actorCanApprove
      ? 'Switch to an approver role to approve this plan.'
      : !reviewsAcknowledged
        ? 'Acknowledge every review finding with a note of at least 5 characters.'
        : ''
  const hasAmendableLcFinding = (plan: Plan) => Boolean(evaluation?.findings.some((finding) => plan.finding_ids.includes(finding.finding_id) && finding.outcome === 'blocked' && finding.check_code.startsWith('LC.')))
  const amendableFindings = approvalPlan && evaluation
    ? evaluation.findings.filter((finding) => approvalPlan.finding_ids.includes(finding.finding_id) && finding.outcome === 'blocked' && finding.check_code.startsWith('LC.'))
    : []
  const amendmentEvidence = evaluation
    ? evaluation.evidence.filter((item) => item.kind === 'lc_field' && amendableFindings.some((finding) => finding.evidence_ids.includes(item.evidence_id)))
    : []
  const amendmentLcId = amendmentEvidence.map((item) => item.locator.lc_id).find((id): id is string => typeof id === 'string')
  const amendmentChanges = [...new Map(amendmentEvidence
    .map((item) => [String(item.locator.field_tag), item] as const)
    .filter(([tag]) => tag in LC_AMENDMENT_TARGETS)).values()]
    .map((item) => {
      const tag = String(item.locator.field_tag)
      return { field_tag: tag, from: fieldValue(item.excerpt, tag), to: LC_AMENDMENT_TARGETS[tag] }
    })
  const actorCanAmend = Boolean(currentActor && policies?.approval_policy.amendment_request_roles?.includes(currentActor.role))
  const amendmentDisabledReason = !actorCanAmend
    ? 'Switch to the trade compliance officer to request an LC amendment.'
    : decisionJustification.trim().length < 10
      ? 'Enter a justification of at least 10 characters.'
      : getApiMode() === 'stub'
        ? 'Fixture mode has no decision endpoint response.'
        : ''

  const submitAmendment = async () => {
    if (!approvalPlan || !amendmentLcId || amendmentDisabledReason) return
    const body: DecisionRequest = {
      action: 'request_amendment',
      plan_version: approvalPlan.version,
      plan_hash: approvalPlan.plan_hash,
      justification: decisionJustification.trim(),
      acknowledgements: [],
      amendment: { lc_id: amendmentLcId, requested_changes: amendmentChanges },
    }
    const serializedBody = JSON.stringify(body)
    if (pendingDecisionRef.current?.body !== serializedBody) {
      pendingDecisionRef.current = { body: serializedBody, key: crypto.randomUUID() }
    }
    setDecisionSubmitting(true)
    setDecisionError(null)
    try {
      const result = await submitDecision(approvalPlan.plan_id, actorId, pendingDecisionRef.current.key, body)
      setAmendmentResult(result.data)
      setEvaluation((previous) => previous && ({
        ...previous,
        plans: previous.plans.map((plan) => plan.plan_id === result.data.plan_id
          ? { ...plan, status: result.data.resulting_plan_status, decision_ids: [...(plan.decision_ids ?? []), result.data.decision_id] }
          : plan),
      }))
    } catch (error) {
      setDecisionError(error instanceof ApiError ? error : new ApiError(error instanceof Error ? error.message : 'Amendment request could not be submitted.'))
    } finally {
      setDecisionSubmitting(false)
    }
  }

  const linkedEvidence = selectedFinding && evaluation
    ? evaluation.evidence.filter((item) => selectedFinding.evidence_ids.includes(item.evidence_id))
    : []
  const missingEvidenceIds = selectedFinding
    ? selectedFinding.evidence_ids.filter((id) => !linkedEvidence.some((item) => item.evidence_id === id))
    : []
  const lcEvidence = linkedEvidence.filter((item) => item.kind === 'lc_field')
  const selectedRouteRules = selectedFinding?.subject.type === 'route_option'
    ? evaluation?.rule_results.find((result) => result.query.query_id === `RQ-${selectedFinding.subject.id}`)
    : undefined

  const findingExposures = useMemo(() => {
    if (!selectedFinding || !evaluation) return []
    const seen = new Set<string>()
    const list: (Plan['financials']['exposures'][number] & { plan_id?: string })[] = []
    for (const p of evaluation.plans) {
      for (const exp of p.financials?.exposures ?? []) {
        if (exp.finding_id === selectedFinding.finding_id) {
          const key = `${p.plan_id}:${exp.exposure_id}`
          if (!seen.has(key)) {
            seen.add(key)
            list.push({ ...exp, plan_id: p.plan_id })
          }
        }
      }
    }
    return list
  }, [selectedFinding, evaluation])

  const dutyAtRiskTotal = useMemo(() => {
    if (!selectedFinding || !evaluation) return 0
    const targetPlan = evaluation.plans.find((p) => p.finding_ids.includes(selectedFinding.finding_id))
    if (!targetPlan?.financials?.exposures) return 0
    return targetPlan.financials.exposures
      .filter((exp) => exp.finding_id === selectedFinding.finding_id && exp.kind === 'duty_if_preference_denied' && typeof exp.amount_inr === 'number')
      .reduce((sum, exp) => sum + (exp.amount_inr ?? 0), 0)
  }, [selectedFinding, evaluation])

  // Used in evidence drawer JSX - suppress unused warning
  void findingExposures
  void dutyAtRiskTotal

  const [activeEvidenceTab, setActiveEvidenceTab] = useState<'graph' | 'lc' | 'rules' | 'record'>('graph')
  
  const graphEvidence = linkedEvidence.filter((item) => item.kind === 'graph_path')
  
  // Reset active tab when finding changes - prioritize rules for route findings
  useEffect(() => {
    if (selectedFinding) {
      if (selectedRouteRules) setActiveEvidenceTab('rules')
      else if (graphEvidence.length > 0) setActiveEvidenceTab('graph')
      else if (lcEvidence.length > 0) setActiveEvidenceTab('lc')
      else setActiveEvidenceTab('record')
    }
  }, [selectedFinding, graphEvidence.length, lcEvidence.length, selectedRouteRules])

  const openApproval = (planId: string) => {
    const plan = evaluation?.plans.find((candidate) => candidate.plan_id === planId)
    if (!plan) return
    setApprovalPlan(plan)
    setAcknowledgements({})
    setDecisionError(null)
    setDecisionJustification('')
    setAmendmentResult(null)
    pendingDecisionRef.current = null
  }

  const submitApproval = async () => {
    if (!approvalPlan || approvalDisabledReason) return
    const body: DecisionRequest = {
      action: 'approve',
      plan_version: approvalPlan.version,
      plan_hash: approvalPlan.plan_hash,
      justification: decisionJustification.trim() || null,
      acknowledgements: reviewFindings.map((finding): Acknowledgement => ({
        finding_id: finding.finding_id,
        actor_id: actorId,
        note: acknowledgements[finding.finding_id]?.note.trim() ?? '',
      })),
    }

    const serializedBody = JSON.stringify(body)
    if (pendingDecisionRef.current?.body !== serializedBody) {
      pendingDecisionRef.current = { body: serializedBody, key: crypto.randomUUID() }
    }
    setDecisionSubmitting(true)
    setDecisionError(null)
    try {
      const result = await submitDecision(
        approvalPlan.plan_id,
        actorId,
        pendingDecisionRef.current.key,
        body,
      )
      setEvaluation((previous) => previous && ({
        ...previous,
        plans: previous.plans.map((plan) => plan.plan_id === result.data.plan_id
          ? { ...plan, status: result.data.resulting_plan_status, decision_ids: [result.data.decision_id] }
          : plan),
      }))
      setApprovedDecision(result.data)
      setApprovalPlan(null)
    } catch (error) {
      setDecisionError(error instanceof ApiError ? error : new ApiError(error instanceof Error ? error.message : 'Decision could not be submitted.'))
    } finally {
      setDecisionSubmitting(false)
    }
  }

  const reloadApprovalPlan = async () => {
    if (!approvalPlan) return
    setDecisionSubmitting(true)
    setDecisionError(null)
    try {
      const currentPlan = await getPlan(approvalPlan.plan_id)
      setApprovalPlan(currentPlan)
      setEvaluation((previous) => previous && ({
        ...previous,
        plans: previous.plans.map((plan) => plan.plan_id === currentPlan.plan_id ? currentPlan : plan),
      }))
      pendingDecisionRef.current = null
    } catch (error) {
      setDecisionError(error instanceof ApiError ? error : new ApiError(error instanceof Error ? error.message : 'Plan could not be reloaded.'))
    } finally {
      setDecisionSubmitting(false)
    }
  }

  const startPlanExecution = async (plan: Plan) => {
    setExecutionError('')
    if (getApiMode() !== 'live') {
      setExecutionError('Fixture mode has no recorded execution response. Connect the backend in live mode to start simulated execution.')
      return
    }
    setExecutionSubmitting(true)
    try {
      const currentPlan = await getPlan(plan.plan_id)
      if (currentPlan.status === 'completed' && currentPlan.execution_id) {
        setExecution(await getExecution(currentPlan.execution_id))
        navigate('execution')
        return
      }
      const decisionId = approvedDecision?.plan_id === plan.plan_id
        ? approvedDecision.decision_id
        : currentPlan.decision_ids?.[0]
      if (currentPlan.status !== 'approved' || !decisionId) {
        throw new ApiError('Execution requires an approved plan and its recorded decision id.')
      }
      if (!currentActor || currentActor.role === 'viewer') {
        throw new ApiError('Switch to a non-viewer simulated actor before starting execution.')
      }
      if (!executionKeyRef.current || executionKeyRef.current.planId !== plan.plan_id || executionKeyRef.current.decisionId !== decisionId) {
        executionKeyRef.current = { planId: plan.plan_id, decisionId, key: crypto.randomUUID() }
      }
      const result = await startExecution(plan.plan_id, actorId, executionKeyRef.current.key, decisionId)
      setExecution(result.data)
      navigate('execution')
    } catch (error) {
      setExecutionError(error instanceof Error ? error.message : 'Execution request failed.')
    } finally {
      setExecutionSubmitting(false)
    }
  }

  const executionId = execution?.execution_id
  const executionStatus = execution?.status
  useEffect(() => {
    if (!executionId || !executionStatus || !['queued', 'running'].includes(executionStatus)) return
    let cancelled = false
    let timer: number | undefined
    const poll = () => {
      timer = window.setTimeout(() => {
        void getExecution(executionId).then((updated) => {
          if (cancelled) return
          setExecution(updated)
          if (['queued', 'running'].includes(updated.status)) poll()
        }).catch((error: unknown) => {
          if (!cancelled) setExecutionError(error instanceof Error ? error.message : 'Execution status could not be loaded.')
        })
      }, 500)
    }
    poll()
    return () => {
      cancelled = true
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [executionId, executionStatus, executionPollRetry])

  const loadAuditEvents = useCallback(async (subjectId = '') => {
    if (getApiMode() === 'stub') {
      setAuditEvents([])
      setAuditState('unavailable')
      setAuditError('')
      return
    }
    setAuditState('loading')
    setAuditError('')
    setAuditVerification(null)
    try {
      const page = await getAuditEvents(subjectId.trim() || undefined)
      setAuditEvents(page.events)
      setAuditState('ready')
    } catch (error) {
      setAuditEvents([])
      setAuditState('error')
      setAuditError(error instanceof Error ? error.message : 'Audit events could not be loaded.')
    }
  }, [])

  useEffect(() => {
    if (activeScreen === 'audit-trail') void loadAuditEvents()
  }, [activeScreen, loadAuditEvents])

  const verifyAuditEvents = async () => {
    setAuditVerificationLoading(true)
    setAuditVerificationError('')
    setAuditVerification(null)
    try {
      setAuditVerification(await verifyAuditChain())
    } catch (error) {
      setAuditVerificationError(error instanceof Error ? error.message : 'Audit chain verification is unavailable.')
    } finally {
      setAuditVerificationLoading(false)
    }
  }

  useEffect(() => {
    if (!approvalPlan) return
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const dialog = approvalDialogRef.current
    dialog?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setApprovalPlan(null)
        return
      }
      if (event.key !== 'Tab' || !dialog) return
      const focusable = [...dialog.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex="0"]')]
      if (focusable.length === 0) {
        event.preventDefault()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      if (active === dialog || !dialog.contains(active)) {
        event.preventDefault()
        if (event.shiftKey) {
          last.focus()
        } else {
          first.focus()
        }
      } else if (event.shiftKey && active === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previouslyFocused?.focus()
    }
  }, [approvalPlan])

  useEffect(() => {
    if (!selectedFinding) return
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const drawer = evidenceDrawerRef.current
    drawer?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedFinding(null)
        return
      }
      if (event.key !== 'Tab' || !drawer) return
      const focusable = [...drawer.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex="0"]')]
      if (focusable.length === 0) {
        event.preventDefault()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      if (active === drawer || !drawer.contains(active)) {
        event.preventDefault()
        if (event.shiftKey) {
          last.focus()
        } else {
          first.focus()
        }
      } else if (event.shiftKey && active === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previouslyFocused?.focus()
    }
  }, [selectedFinding])

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">A</div><div><strong>AegisShield</strong><span>AI RECOVERY PLATFORM</span></div></div>
        <p className="nav-heading">WORKSPACE</p>
        {navItems.map((item) => (
          <button key={item.id} className={`nav-item ${activeScreen === item.id ? 'active' : ''}`} onClick={() => navigate(item.id)}>
            {item.icon} &nbsp; {item.label}
          </button>
        ))}
        <div className="sidebar-bottom"><span className="status-dot" />Demo environment<small className="llm-badge" aria-label="LLM mode">{llmBadgeFull}</small></div>
      </aside>

      <main className="main-content">
        <header className="topbar"><span>Recovery workspace / {screenLabel(activeScreen)}</span><div className="topbar-tools"><label htmlFor="actor-select">Simulated identity</label><select id="actor-select" className="actor-select" value={actorId} onChange={(event) => setActorId(event.target.value)}>{(policies?.demo_actors ?? []).map((actor) => <option key={actor.actor_id} value={actor.actor_id}>{actor.display_name}</option>)}</select><span className="user-chip">{getApiMode() === 'stub' ? 'Stub mode · Fixtures' : 'Live API'}</span></div></header>
        <section className="page-content">
          <div className="synthetic-banner"><strong>SYNTHETIC DATA</strong><span>All companies, prices, schedules and outcomes in this demo are fictional.</span></div>

          {activeScreen === 'command' && (
            <>
              <div className="page-title-row"><div><p className="eyebrow">SUPPLY CHAIN RESILIENCE</p><h1>Command Center</h1><p className="subtitle">Assess disruption, compare recovery plans, and review evidence before approval.</p></div><span className="evaluation-status"><span className="status-dot" />{evaluation ? `Evaluation ${evaluation.status}` : 'No evaluation'}</span></div>
              {getApiMode() === 'live' && <div className="demo-controls" aria-label="Demo controls"><button className="secondary-button" disabled={Boolean(demoBusy)} onClick={confirmReset}>{demoBusy === 'reset' ? 'Resetting…' : 'Reset demo'}</button><button className="primary-button" disabled={Boolean(demoBusy) || !(evaluation?.disruption_id ?? availableDisruptionId)} onClick={() => void runEvaluation()}>{demoBusy === 'evaluate' ? 'Evaluating…' : 'Run evaluation'}</button>{demoMessage && <span role="status">{demoMessage}</span>}</div>}
              {/* Reset confirmation dialog */}
              {showResetConfirm && (
                <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowResetConfirm(false) }}>
                  <section className="approval-dialog" role="dialog" aria-modal="true" aria-labelledby="reset-confirm-title" tabIndex={-1} style={{maxWidth: '400px'}}>
                    <div className="evidence-header"><h2 id="reset-confirm-title">Reset demo?</h2><button className="secondary-button" onClick={() => setShowResetConfirm(false)} aria-label="Close">Close</button></div>
                    <p className="approval-note">This will clear the current evaluation and restart the audit chain. This action cannot be undone.</p>
                    <div className="approval-actions">
                      <button className="secondary-button" onClick={() => setShowResetConfirm(false)}>Cancel</button>
                      <button className="primary-button" onClick={() => void runDemoReset()}>Reset demo</button>
                    </div>
                  </section>
                </div>
              )}
              {!evaluation?.assessment ? (
                <section className="disruption-card disruption-card-neutral">
                  <div className="disruption-icon" aria-hidden="true">ℹ</div>
                  <div className="disruption-copy">
                    <span className="eyebrow">COMMAND CENTER</span>
                    <h2>Run the evaluation</h2>
                    <p>Assess disruption, compare recovery plans, and review evidence before approval.</p>
                  </div>
                </section>
              ) : (
                <section className="disruption-card">
                  <div className="disruption-icon" aria-hidden="true">!</div>
                  <div className="disruption-copy">
                    <span className="eyebrow">ACTIVE DISRUPTION · {evaluation.assessment.disruption_id}</span>
                    <h2>{evaluation.assessment.event_type.replace(/_/g, ' ')} detected</h2>
                    <div className="disruption-facility-row">
                      <span>Disrupted facility: <strong>{evaluation.assessment.disrupted_node_ids.join(', ') || 'Unknown'}</strong></span>
                      <span>Affected supplier: <strong>{evaluation.assessment.affected_supplier_ids.join(', ')}</strong></span>
                      {evaluation.assessment.evidence?.[0] && <span>Source: <strong>{evaluation.assessment.evidence[0].title}</strong></span>}
                    </div>
                    {/* Quote block with raw notice text per spec §81 */}
                    {evaluation.assessment.evidence?.[0]?.excerpt && (
                      <blockquote style={{margin: 'var(--space-3) 0 0', padding: 'var(--space-3)', borderLeft: '3px solid var(--color-error)', background: 'var(--color-error-bg)', color: 'var(--color-error-text)', fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-relaxed)', fontStyle: 'italic'}}>
                        {evaluation.assessment.evidence[0].excerpt}
                      </blockquote>
                    )}
                    <div className="affected-orders-block">
                      <strong>Affected orders:</strong>
                      <ul className="affected-orders-list">
                        {evaluation.assessment.affected_orders.map((order) => (
                          <li key={order.order_id}>
                            <strong>{order.order_id}</strong>: {order.days_late} days late
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <span className="severity-badge">{evaluation.assessment.severity} severity</span>
                </section>
              )}
              <div className="section-heading"><div><h2>Evaluation overview</h2><p>{evaluation ? `Evaluation ${evaluation.evaluation_id} · ${evaluation.status}` : 'No evaluation'}</p></div><div className="command-actions"><button className="secondary-button" onClick={() => navigate('evaluations')}>View evaluation details ↗</button><button className="primary-button" onClick={openEvaluationProgress}>View evaluation progress</button></div></div>
              {/* What happens next strip per spec §83 */}
              <div style={{marginTop: 'var(--space-4)', padding: 'var(--space-3)', background: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-light)'}}>
                <strong style={{display: 'block', marginBottom: 'var(--space-2)', color: 'var(--color-text)', fontFamily: 'var(--font-heading)'}}>What happens next</strong>
                <div style={{display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)'}}>
                  <span>1. Disruption sensing</span>
                  <span>2. Supplier dependency</span>
                  <span>3. Routing</span>
                  <span>4. Inventory rebalancing</span>
                  <span>5. Trade compliance</span>
                  <span>6. Plan assembly</span>
                  <span>7. Explanation</span>
                </div>
              </div>
              <section className="metrics-grid">
                <article className="metric-card"><span className="metric-label">Baseline loss</span><strong>{evaluation?.assessment ? money(evaluation.assessment.baseline_loss_inr) : evaluation ? money(evaluation.comparison.baseline_loss_inr) : '—'}</strong><span className="metric-note">Estimated disruption impact</span></article>
                <article className="metric-card"><span className="metric-label">Recovery plans</span><strong>{evaluation ? evaluation.comparison.plans.length : '—'}</strong><span className="metric-note">Evaluated against required checks</span></article>
                <article className="metric-card"><span className="metric-label">Recommended plan</span><strong className="green-text">{evaluation?.comparison.recommended_plan_id ? formatPlanId(evaluation.comparison.recommended_plan_id) : '—'}</strong><span className="metric-note">AegisShield verified</span></article>
              </section>
              <div className="section-heading plans-heading"><div><h2>Recovery plan comparison</h2><p>Financial attractiveness alone does not establish executability.</p></div>{evaluation?.comparison.recommended_plan_id && <span className="recommendation-label">{formatPlanId(evaluation.comparison.recommended_plan_id)} · Recommended</span>}</div>
              {evaluationError && <p className="load-error" role="alert">{evaluationError}</p>}
              <section className="plans-grid">{(evaluation?.comparison.plans ?? []).map((plan) => {
                const fullPlan = evaluation?.plans.find((candidate) => candidate.plan_id === plan.plan_id)
                const isBlocked = fullPlan?.status === 'blocked' || plan.outcome === 'blocked'
                const planStatus = fullPlan?.status ?? plan.outcome
                const planStatusClass = planStatus.toLowerCase().replace(/_/g, '-')
                const worstCaseExposure = getWorstCaseExposure(plan, fullPlan)
                const planExposures = fullPlan?.financials?.exposures?.filter(e => e.amount_inr !== null) ?? []
                const exposuresByGroup = new Map<string, typeof planExposures>()
                for (const exp of planExposures) {
                  const key = exp.mutually_exclusive_group ?? `__ungrouped_${exp.exposure_id}`
                  if (!exposuresByGroup.has(key)) exposuresByGroup.set(key, [])
                  exposuresByGroup.get(key)!.push(exp)
                }
                return <article className="plan-card" key={plan.plan_id}>
                  <div className="plan-top">
                    <div className="plan-id">{formatPlanId(plan.plan_id)}</div>
                    <span className={`plan-status ${planStatusClass}`}>{planStatus.replace(/_/g, ' ')}</span>
                  </div>
                  <h3>{plan.label}</h3>
                  <p className="plan-detail">Recovery plan from evaluation {evaluation?.evaluation_id}.</p>
                  <div className="financial-block">
                    <div className="financial-row-main">
                      <span>Net avoided loss{isBlocked ? ' · on paper' : ''}</span>
                      <strong>{money(plan.net_avoided_loss_inr)}</strong>
                    </div>
                    <div className="financial-breakdown">
                      <div className="financial-item">
                        <span>Recovery cost</span>
                        <strong>{money(plan.recovery_cost_inr)}</strong>
                      </div>
                      <div className="financial-item">
                        <span>Residual loss</span>
                        <strong>{money(plan.residual_loss_inr)}</strong>
                      </div>
                      <div className="financial-item">
                        <span>Worst-case exposure</span>
                        <strong>worst {money(worstCaseExposure)}</strong>
                      </div>
                      <div className="financial-item">
                        <span>Outcome</span>
                        <strong className={`outcome-val ${plan.outcome}`}>{plan.outcome.toUpperCase()}</strong>
                      </div>
                    </div>
                  </div>
                  {/* Allocation table with mapped source names per spec §94 */}
                  {fullPlan && fullPlan.lines.length > 0 && (
                    <div style={{marginTop: 'var(--space-3)', borderTop: '1px solid var(--color-border-light)', paddingTop: 'var(--space-3)'}}>
                      <h4 style={{margin: '0 0 var(--space-2)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-heading)', color: 'var(--color-text)'}}>Allocation</h4>
                      <div className="table-scroll" role="region" aria-label="Scrollable allocation table" tabIndex={0} style={{maxHeight: '200px'}}>
                        <table className="audit-table" style={{fontSize: 'var(--text-xs)'}}>
                          <thead>
                            <tr>
                              <th scope="col">Order</th>
                              <th scope="col">Source</th>
                              <th scope="col">Units</th>
                              <th scope="col">Arrives</th>
                              <th scope="col">Days late</th>
                            </tr>
                          </thead>
                          <tbody>
                            {fullPlan.lines.map((line) => (
                              <tr key={line.line_id}>
                                <td>{line.order_id}</td>
                                <td>{getOptionLabel(line.option_id)}</td>
                                <td>{line.qty.toLocaleString()}</td>
                                <td>{line.eta_plant}</td>
                                <td>{line.days_late}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  {/* Exposure list with either/or per spec §92 */}
                  {planExposures.length > 0 && (
                    <div style={{marginTop: 'var(--space-3)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--color-border-light)'}}>
                      <h4 style={{margin: '0 0 var(--space-2)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-heading)', color: 'var(--color-text)'}}>Exposures</h4>
                      <ul style={{listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 'var(--space-1)'}}>
                        {Array.from(exposuresByGroup.entries()).map(([groupKey, exps]) => (
                          <li key={groupKey} style={{fontSize: 'var(--text-sm)', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)'}}>
                            {exps.length > 1 && <span style={{color: 'var(--color-warning)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-accent)'}}>either/or</span>}
                            {exps.map((exp) => (
                              <span key={exp.exposure_id} style={{display: 'flex', alignItems: 'center', gap: 'var(--space-1)'}}>
                                <strong>{money(exp.amount_inr ?? 0)}</strong>
                                <span style={{color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)'}}>{exp.kind.replace(/_/g, ' ')}</span>
                              </span>
                            ))}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="checks-row">{plan.check_outcome_counts.passed} passed · {plan.check_outcome_counts.needs_review} need review · {plan.check_outcome_counts.blocked} blocked</div>
                  <div className="plan-actions">
                    <button className="secondary-button" onClick={() => fullPlan && setSelectedPlan(fullPlan)}>
                      Review evidence
                    </button>
                    {fullPlan?.status === 'approved' || fullPlan?.status === 'completed' ? (
                      <button className="primary-button" disabled={executionSubmitting || getApiMode() === 'stub'} onClick={() => void startPlanExecution(fullPlan)}>
                        {fullPlan.status === 'completed' ? 'View execution' : 'Start simulated execution'}
                      </button>
                    ) : (
                      <button className="primary-button" disabled={!fullPlan || isBlocked || !actorCanApprove || fullPlan.status !== 'pending_approval'} aria-describedby={isBlocked ? `blocked-reason-${plan.plan_id}` : undefined} onClick={() => openApproval(plan.plan_id)}>
                        Approve
                      </button>
                    )}
                    {isBlocked && fullPlan && hasAmendableLcFinding(fullPlan) && (
                      <button className="secondary-button" disabled={!actorCanAmend} title={actorCanAmend ? undefined : 'Switch to the trade compliance officer to request an LC amendment.'} onClick={() => openApproval(plan.plan_id)}>
                        Request LC amendment
                      </button>
                    )}
                  </div>
                  {isBlocked && <p className="blocked-reason" id={`blocked-reason-${plan.plan_id}`}>Cannot be approved: {plan.check_outcome_counts.blocked} blocking findings. {formatPlanId(plan.plan_id)} remains blocked.</p>}
                </article>
              })}</section>
              {/* Paper advantage callout per spec §93 */}
              {evaluation?.comparison.paper_advantage_of_best_blocked_plan_inr && evaluation.comparison.paper_advantage_of_best_blocked_plan_inr > 0 && (
                <div style={{marginTop: 'var(--space-4)', padding: 'var(--space-4)', background: 'var(--color-warning-bg)', border: '1px solid var(--color-warning-border)', borderRadius: 'var(--radius-lg)', color: 'var(--color-warning-text)'}}>
                  <strong>P1 looks {money(evaluation.comparison.paper_advantage_of_best_blocked_plan_inr)} better on paper</strong> but is blocked by {evaluation.comparison.plans.find(p => p.outcome === 'blocked')?.check_outcome_counts.blocked ?? 0} blocking finding{evaluation.comparison.plans.find(p => p.outcome === 'blocked')?.check_outcome_counts.blocked !== 1 ? 's' : ''}.
                </div>
              )}
              {executionError && <p className="load-error" role="alert">{executionError}</p>}
              {selectedPlan && <div className="evidence-panel"><div className="evidence-header"><h2>Evidence — {selectedPlan.plan_id}</h2><button className="secondary-button" onClick={() => setSelectedPlan(null)}>Close ✕</button></div><h3>{selectedPlan.label}</h3><p><strong>Validation status:</strong> {selectedPlan.status}</p><p><strong>Check results:</strong> {selectedPlan.check_outcome_counts.passed} passed · {selectedPlan.check_outcome_counts.needs_review} need review · {selectedPlan.check_outcome_counts.blocked} blocked</p><p><strong>Financial impact:</strong> {money(selectedPlan.financials.net_avoided_loss_inr)}</p><div className="evidence-findings"><h3>Plan findings</h3>{evaluation?.findings.filter((finding) => selectedPlan.finding_ids.includes(finding.finding_id)).map((finding) => <button key={finding.finding_id} className="finding-link" onClick={() => setSelectedFinding(finding)}>{finding.title}<span>{finding.finding_id} · {finding.outcome}</span></button>)}</div></div>}
            </>
          )}

          {activeScreen === 'evaluation-progress' && <>
            {/* Live region for step announcements per spec §86 */}
            <div aria-live="polite" aria-atomic="true" className="sr-only" role="status">{stepAnnouncement}</div>
            <div className="page-title-row"><div><p className="eyebrow">WORKSPACE / EVALUATION</p><h1>Evaluation progress</h1><p className="subtitle">Step results returned for the loaded evaluation. Fixture mode displays the recorded EVAL-0001 response.</p></div><span className="evaluation-status"><span className="status-dot" />{evaluationState === 'loading' ? 'Loading' : evaluation?.status ?? 'Unavailable'}</span></div>
            {evaluationState === 'loading' && <div className="progress-state" role="status">Loading the recorded evaluation fixture…</div>}
            {evaluationState === 'error' && <div className="progress-state progress-error" role="alert"><p>{evaluationError}</p><button className="primary-button" onClick={() => void loadEvaluation()}>Retry fixture load</button></div>}
            {evaluationState === 'ready' && evaluation && <><div className="evaluation-progress" aria-live="polite" aria-atomic="true"><p className="progress-announcement">Evaluation {evaluation.evaluation_id} is {evaluation.status}. {getApiMode() === 'stub' ? 'Stub mode displays recorded agent results; no live evaluation request was sent.' : 'Step results were returned by the live evaluation API.'}</p>{evaluation.steps?.map((step) => <article className={`progress-step ${step.status}`} key={step.seq}><span className="progress-step-icon" aria-hidden="true">{step.status === 'succeeded' ? '✓' : step.status === 'failed' ? '!' : '•'}</span><div><h2>{step.seq}. {step.step.replace(/_/g, ' ')}</h2><p><span className="step-status-badge">{step.status}</span> · {step.owner} · {step.attempts > 1 ? `${step.attempts} attempts` : '1 attempt'}</p>{step.error && <p className="load-error">{typeof step.error === 'string' ? step.error : step.error.message ?? 'Step failed.'}</p>}</div><span className="mode-chip">{step.mode ?? 'not specified'}</span><time dateTime={step.finished_at ?? undefined}>{formatLocalTimestamp(step.finished_at)}</time></article>)}</div><div className="progress-actions"><button className="secondary-button" onClick={() => void loadEvaluation()}>{getApiMode() === 'stub' ? 'Reload fixture' : 'Refresh evaluation'}</button><button className="primary-button" onClick={() => navigate('evaluations')}>View plan comparison</button></div></>}
          </>}

          {activeScreen === 'evaluations' && <>
            <div className="page-title-row"><div><p className="eyebrow">WORKSPACE / EVALUATIONS</p><h1>Evaluations</h1><p className="subtitle">Review the completed synthetic recovery evaluation and its findings.</p></div><span className="evaluation-status"><span className="status-dot" />{evaluation?.status ?? 'Loading'}</span></div>
            {evaluationError && <p className="load-error" role="alert">{evaluationError}</p>}
            {evaluation ? <><div className="section-heading"><div><h2>{evaluation.evaluation_id} · {evaluation.status}</h2><p>Baseline loss: {money(evaluation.comparison.baseline_loss_inr)} · Recommended plan: {evaluation.comparison.recommended_plan_id ? formatPlanId(evaluation.comparison.recommended_plan_id) : '—'}</p></div><button className="secondary-button" onClick={() => navigate('evaluation-progress')}>View evaluation progress</button></div><section className="plans-grid">{evaluation.comparison.plans.map((plan) => {
              const fullPlan = evaluation.plans.find((candidate) => candidate.plan_id === plan.plan_id)
              const isBlocked = fullPlan?.status === 'blocked' || plan.outcome === 'blocked'
              const planStatus = fullPlan?.status ?? plan.outcome
              const planStatusClass = planStatus.toLowerCase().replace(/_/g, '-')
              const worstCaseExposure = getWorstCaseExposure(plan, fullPlan)
              return <article className="plan-card" key={plan.plan_id}>
                <div className="plan-top">
                  <div className="plan-id">{formatPlanId(plan.plan_id)}</div>
                  <span className={`plan-status ${planStatusClass}`}>{planStatus.replace(/_/g, ' ')}</span>
                </div>
                <h3>{plan.label}</h3>
                <p className="plan-detail">Net avoided loss: {money(plan.net_avoided_loss_inr)}</p>
                <div className="financial-block">
                  <div className="financial-row-main">
                    <span>Net avoided loss{isBlocked ? ' · on paper' : ''}</span>
                    <strong>{money(plan.net_avoided_loss_inr)}</strong>
                  </div>
                  <div className="financial-breakdown">
                    <div className="financial-item">
                      <span>Recovery cost</span>
                      <strong>{money(plan.recovery_cost_inr)}</strong>
                    </div>
                    <div className="financial-item">
                      <span>Residual loss</span>
                      <strong>{money(plan.residual_loss_inr)}</strong>
                    </div>
                    <div className="financial-item">
                      <span>Worst-case exposure</span>
                      <strong>worst {money(worstCaseExposure)}</strong>
                    </div>
                    <div className="financial-item">
                      <span>Outcome</span>
                      <strong className={`outcome-val ${plan.outcome}`}>{plan.outcome.toUpperCase()}</strong>
                    </div>
                  </div>
                </div>
                <div className="checks-row">{plan.check_outcome_counts.passed} passed · {plan.check_outcome_counts.needs_review} need review · {plan.check_outcome_counts.blocked} blocked</div>
              </article>
            })}</section><div className="section-heading"><div><h2>Findings</h2><p>{evaluation.findings.length} findings from the evaluation fixture.</p></div></div><div className="finding-list">{evaluation.findings.map((finding) => <button className="finding-link" key={finding.finding_id} onClick={() => setSelectedFinding(finding)}><strong>{finding.title}</strong><span>{finding.finding_id} · {finding.check_code} · {finding.outcome}</span></button>)}</div></> : evaluationState === 'loading' ? <p>Loading evaluation fixture…</p> : null}
          </>}

          {activeScreen === 'execution' && <>
            <div className="page-title-row"><div><p className="eyebrow">WORKSPACE / EXECUTION</p><h1>Simulated execution</h1><p className="subtitle">Execution requests require an approved plan and its recorded decision. SAP mappings are proposals only.</p></div>{execution && <span className="evaluation-status">{execution.status}</span>}</div>
            {getApiMode() === 'stub' && !execution && <div className="progress-state">No execution record is included in the fixtures. Connect the supported backend in live mode to submit and view an execution.</div>}
            {executionError && <div className="api-error" role="alert"><p>{executionError}</p>{execution && ['queued', 'running'].includes(execution.status) && <button className="secondary-button" onClick={() => { setExecutionError(''); setExecutionPollRetry((retry) => retry + 1) }}>Retry status check</button>}</div>}
            {execution && <section className="execution-panel" aria-live="polite">
              <dl className="finding-details"><div><dt>Execution</dt><dd>{execution.execution_id}</dd></div><div><dt>Plan</dt><dd>{execution.plan_id} · version {execution.plan_version}</dd></div><div><dt>Decision</dt><dd>{execution.decision_id}</dd></div><div><dt>Started</dt><dd>{formatLocalTimestamp(execution.started_at)}</dd></div></dl>
              <p className="approval-note">Every row below is simulated. No SAP system was changed.</p>
              {execution.steps.map((step) => <article className={`execution-step ${step.status}`} key={step.seq}>
                <div className="execution-step-heading"><h2>{step.seq}. {step.step_type.replace(/_/g, ' ')}</h2><span className={`plan-status ${step.status === 'succeeded' ? 'passed' : step.status === 'failed' ? 'blocked' : ''}`}>{step.status}</span></div>
                <p>{step.description}</p><p className="execution-refs"><strong>References:</strong> {JSON.stringify(step.refs)}</p>
                <p className="mapping-label"><strong>Proposed SAP mapping:</strong> {step.proposed_sap_mapping}</p>
                <span className="simulated-chip">Simulated</span>
                {step.error && <p className="load-error">{typeof step.error === 'string' ? step.error : step.error.message ?? 'Step failed.'}</p>}
              </article>)}
              {execution.status === 'failed' && <p className="blocked-reason">Execution failed. Later steps, if any, are skipped. No automatic retry or compensation is performed.</p>}
              {execution.status === 'completed' && <p className="approval-note">The API reports this simulated execution as completed.</p>}
            </section>}
            {!execution && evaluation?.plans.filter((plan) => ['approved', 'completed'].includes(plan.status)).map((plan) => <article className="plan-card execution-launch" key={plan.plan_id}><h2>{plan.label}</h2><p>Plan {plan.plan_id} · {plan.status.replace(/_/g, ' ')}</p><button className="primary-button" disabled={executionSubmitting} onClick={() => void startPlanExecution(plan)}>{executionSubmitting ? 'Loading…' : 'Load or start simulated execution'}</button></article>)}
          </>}

          {activeScreen === 'supply-graph' && <>
            <div className="page-title-row"><div><p className="eyebrow">WORKSPACE / SUPPLY GRAPH</p><h1>Supply graph</h1><p className="subtitle">Why a candidate supplier is or is not independent of the disruption: upstream evidence from evaluation {evaluationId}.</p></div></div>
            {graphView ? <>
              <p className="subtitle">{graphView.nodes.length} facilities · {graphView.edges.length} links · Direction: {graphView.edge_direction.replace(/_/g, ' ')}</p>
              <DependencyGraph
                view={graphView}
                result={evaluation?.dependency_results?.find((result) => result.supplier_id === graphView.focus_supplier_id)}
                candidates={(evaluation?.dependency_results ?? []).map((result) => ({
                  supplierId: result.supplier_id,
                  label: graphView.nodes.find((node) => node.id === result.start_node_id)?.org_name.replace(' (synthetic)', '') ?? result.supplier_id,
                }))}
                onFocusSupplier={(supplierId) => { setSelectedGraphNode(null); setFocusSupplierId(supplierId) }}
                selectedNodeId={selectedGraphNode?.id ?? null}
                onSelectNode={setSelectedGraphNode}
              />
              {selectedGraphNode && <section className="facility-details" aria-live="polite" aria-label="Selected facility details">
                <div className="facility-details-header"><div><p className="eyebrow">SELECTED FACILITY</p><h2>{selectedGraphNode.label}</h2></div><button className="secondary-button" onClick={() => setSelectedGraphNode(null)}>Clear selection</button></div>
                <dl><div><dt>Facility ID</dt><dd>{selectedGraphNode.id}</dd></div><div><dt>Organization</dt><dd>{selectedGraphNode.org_name}</dd></div><div><dt>Country</dt><dd>{selectedGraphNode.country}</dd></div><div><dt>Role</dt><dd>{selectedGraphNode.role.replace(/_/g, ' ')}</dd></div><div><dt>Status</dt><dd>{STATUS_TEXT[selectedGraphNode.status] ?? selectedGraphNode.status}</dd></div></dl>
              </section>}
            </> : <p>{graphError || 'Loading dependency graph…'}</p>}
          </>}

          {activeScreen === 'audit-trail' && <>
            <div className="page-title-row"><div><p className="eyebrow">WORKSPACE / AUDIT TRAIL</p><h1>Audit trail</h1><p className="subtitle">Append-only audit events and verification results returned by the API.</p></div></div>
            {getApiMode() === 'stub' && <p className="audit-note">Fixture mode contains no audit-event records or verified chain result. Evaluation steps are not audit events, so none are presented as an audit trail.</p>}
            <form className="audit-controls" onSubmit={(event) => { event.preventDefault(); void loadAuditEvents(auditFilter) }}>
              <label htmlFor="audit-subject">Filter by subject ID</label><input id="audit-subject" value={auditFilter} onChange={(event) => setAuditFilter(event.target.value)} placeholder="e.g. PLN-0002" />
              <button className="secondary-button" type="submit" disabled={getApiMode() === 'stub' || auditState === 'loading'}>Load events</button>
              <button className="primary-button" type="button" onClick={() => void verifyAuditEvents()} disabled={getApiMode() === 'stub' || auditVerificationLoading}>{auditVerificationLoading ? 'Verifying…' : 'Verify chain'}</button>
            </form>
            {auditError && <p className="load-error" role="alert">{auditError}</p>}
            {auditVerificationError && <p className="load-error" role="alert">{auditVerificationError}</p>}
            {auditVerification && <p className={auditVerification.valid ? 'audit-verified' : 'audit-invalid'} role="status">{auditVerification.valid
              ? `Chain valid — API verified ${auditVerification.checked_events} events.`
              : `Chain invalid${auditVerification.first_invalid_seq === null ? '; the API did not provide the first invalid sequence.' : ` at sequence ${auditVerification.first_invalid_seq}`}.`}</p>}
            {auditVerification && <p className="audit-note">Verification response applies to the event chain checked by the API; the subject filter affects only the table.</p>}
            {auditState === 'loading' && <p role="status">Loading audit events from the API…</p>}
            {auditState === 'unavailable' && <div className="progress-state">No audit events or verification response are available in the local fixtures.</div>}
            {auditState === 'ready' && (auditEvents.length ? <div className="table-scroll" role="region" aria-label="Scrollable audit events table" tabIndex={0}><table className="audit-table"><caption>Audit events returned by the API, in sequence order</caption><thead><tr><th scope="col">Seq</th><th scope="col">Time</th><th scope="col">Actor</th><th scope="col">Event</th><th scope="col">Subject</th><th scope="col">Hash</th></tr></thead><tbody>{auditEvents.map((event) => <tr key={event.event_id}><td>{event.seq}</td><td><time dateTime={event.occurred_at}>{formatLocalTimestamp(event.occurred_at)}</time></td><td>{event.actor.display_name ?? event.actor.actor_id}<small>{event.actor.role}</small></td><td>{event.event_type}</td><td>{event.subject.type}: {event.subject.id}</td><td title={event.event_hash}>{event.event_hash.slice(7, 15)}</td></tr>)}</tbody></table></div> : <p className="progress-state">The API returned no audit events for this filter.</p>)}
          </>}
        </section>
        {approvalPlan && <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setApprovalPlan(null) }}><section className="approval-dialog" role="dialog" aria-modal="true" aria-labelledby="approval-title" aria-describedby="approval-status" tabIndex={-1} ref={approvalDialogRef} onMouseDown={(event) => event.stopPropagation()}>
          <div className="evidence-header"><div><p className="eyebrow">HUMAN APPROVAL · {formatPlanId(approvalPlan.plan_id)}</p><h2 id="approval-title">Review {approvalPlan.label}</h2></div><button className="secondary-button" onClick={() => setApprovalPlan(null)} aria-label="Close approval dialog">Close</button></div>
          <dl className="finding-details">
            <div><dt>Plan status</dt><dd>{approvalPlan.status.replace(/_/g, ' ')}</dd></div>
            <div><dt>Version</dt><dd>{approvalPlan.version}</dd></div>
            <div><dt>Plan hash</dt><dd className="hash-value" style={{display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap'}}><span title={approvalPlan.plan_hash}>{approvalPlan.plan_hash.slice(0, 12)}…</span><span style={{color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)'}}>{approvalPlan.plan_hash}</span><button className="secondary-button" style={{padding: 'var(--space-1) var(--space-2)', fontSize: 'var(--text-xs)'}} onClick={() => { navigator.clipboard.writeText(approvalPlan.plan_hash); setDemoMessage('Plan hash copied to clipboard'); setTimeout(() => setDemoMessage(''), 2000) }}>Copy</button></dd></div>
            <div><dt>Recovery cost</dt><dd>{money(approvalPlan.financials.recovery_cost_inr)}</dd></div>
            <div><dt>Residual loss</dt><dd>{money(approvalPlan.financials.residual_loss_inr)}</dd></div>
            <div><dt>Net avoided loss</dt><dd>{money(approvalPlan.financials.net_avoided_loss_inr)}</dd></div>
            <div><dt>Worst-case exposure</dt><dd>{money(approvalPlan.financials.worst_case_exposure_inr ?? 0)}</dd></div>
          </dl>
          <p id="approval-status" className={approvalPlan.status === 'blocked' ? 'blocked-reason' : 'approval-note'}>{approvalPlan.status === 'blocked' ? 'Cannot approve: this plan is blocked by its fixture checks.' : `Outcome: ${approvalPlan.outcome}. Confirm the current plan version and evidence before approval.`}</p>
          {approvalDisabledReason && <p className="blocked-reason" style={{marginBottom: 'var(--space-3)'}}>{approvalDisabledReason}</p>}
          <label className="field-label" htmlFor="approval-justification">Justification <span>(optional for approval)</span></label>
          <textarea id="approval-justification" value={decisionJustification} onChange={(event) => setDecisionJustification(event.target.value)} maxLength={1000} rows={3} placeholder="Record the reason for this approval" />
          <section className="acknowledgement-section" aria-labelledby="acknowledgement-heading"><h3 id="acknowledgement-heading">Required acknowledgements</h3>
            {reviewFindings.length === 0 ? <p>No needs-review findings are recorded for this plan.</p> : reviewFindings.map((finding) => {
              const requiredRoles = policies?.approval_policy.acknowledgement_roles[finding.agent] ?? []
              const canAcknowledge = Boolean(currentActor && requiredRoles.includes(currentActor.role))
              const value = acknowledgements[finding.finding_id] ?? { checked: false, note: '' }
              return <fieldset className="acknowledgement-item" key={finding.finding_id}>
                <legend>{finding.title}</legend><p>{finding.finding_id} · acknowledgement role: {requiredRoles.join(' or ') || 'not specified'}</p>
                <label className={canAcknowledge ? '' : 'disabled-label'}><input type="checkbox" disabled={!canAcknowledge} checked={value.checked} onChange={(event) => setAcknowledgements((previous) => ({ ...previous, [finding.finding_id]: { ...value, checked: event.target.checked } }))} /> I acknowledge this review finding</label>
                {!canAcknowledge && <p className="field-hint">Switch to an actor with the required role before acknowledging.</p>}
                <label className="field-label" htmlFor={`ack-note-${finding.finding_id}`}>Acknowledgement note</label>
                <textarea id={`ack-note-${finding.finding_id}`} value={value.note} disabled={!canAcknowledge} minLength={5} maxLength={500} rows={2} onChange={(event) => setAcknowledgements((previous) => ({ ...previous, [finding.finding_id]: { ...value, note: event.target.value } }))} />
              </fieldset>
            })}
          </section>
          {approvalPlan.status === 'blocked' && amendableFindings.length > 0 && amendmentLcId && <section className="amendment-section" aria-labelledby="amendment-heading">
            <h3 id="amendment-heading">Request LC amendment</h3>
            <p>{amendableFindings.map((finding) => finding.title).join('; ')}. The plan stays blocked until the bank accepts the amendment and the plan is re-evaluated.</p>
            <table className="audit-table"><caption>Requested changes to {amendmentLcId}</caption><thead><tr><th scope="col">Field</th><th scope="col">Current</th><th scope="col">Requested</th></tr></thead><tbody>{amendmentChanges.map((change) => <tr key={change.field_tag}><td>{change.field_tag}</td><td>{change.from}</td><td>{change.to}</td></tr>)}</tbody></table>
            <p className="field-hint">Uses the justification above (at least 10 characters). Role: trade compliance officer.</p>
            <button className="secondary-button" disabled={decisionSubmitting || Boolean(amendmentDisabledReason) || Boolean(amendmentResult)} title={amendmentDisabledReason || undefined} onClick={() => void submitAmendment()}>{decisionSubmitting ? 'Submitting…' : 'Request LC amendment'}</button>
            {amendmentDisabledReason && !amendmentResult && <p className="field-hint">{amendmentDisabledReason}</p>}
            {amendmentResult && <p className="approval-note" role="status">Amendment request {amendmentResult.amendment_request_id} recorded by {amendmentResult.actor.display_name ?? amendmentResult.actor.actor_id}. Plan {amendmentResult.plan_id} stays {amendmentResult.resulting_plan_status}.</p>}
          </section>}
          {policiesError && <p className="load-error" role="alert">{policiesError}</p>}
          {getApiMode() === 'stub' && <p className="approval-note">Fixture mode contains no decision response. Connect the backend in live mode to submit; no approval will be simulated here.</p>}
          {decisionError && <div className="api-error" role="alert"><strong>{getErrorMessage(decisionError)}</strong><p>{decisionError.problem?.detail ?? decisionError.message}</p>{['PLAN_VERSION_STALE', 'PLAN_SUPERSEDED', 'DECISION_EXISTS'].includes(decisionError.problem?.code ?? '') && <button className="secondary-button" disabled={decisionSubmitting} onClick={() => void reloadApprovalPlan()}>Reload current plan</button>}</div>}
          <div className="approval-actions"><button className="secondary-button" disabled={decisionSubmitting} onClick={() => setApprovalPlan(null)}>Cancel</button><button className="primary-button" disabled={decisionSubmitting || Boolean(approvalDisabledReason) || getApiMode() === 'stub'} onClick={() => void submitApproval()}>{decisionSubmitting ? 'Submitting…' : 'Approve plan'}</button></div>
        </section></div>}
        {selectedFinding && <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedFinding(null) }}><aside className="evidence-drawer" role="dialog" aria-modal="true" aria-labelledby="finding-drawer-title" tabIndex={-1} ref={evidenceDrawerRef} onMouseDown={(event) => event.stopPropagation()}>
          <div className="evidence-header"><div><p className="eyebrow">EVALUATION EVIDENCE</p><h2 id="finding-drawer-title">Finding details</h2></div><button className="secondary-button" onClick={() => setSelectedFinding(null)} aria-label="Close finding details">Close</button></div>
          <span className={`finding-outcome ${selectedFinding.outcome}`}>{displayOutcome(selectedFinding.outcome)}</span>
          <h3>{selectedFinding.title}</h3>
          <dl className="finding-details"><div><dt>Finding ID</dt><dd>{selectedFinding.finding_id}</dd></div><div><dt>Check</dt><dd>{selectedFinding.check_code}</dd></div><div><dt>Subject</dt><dd>{selectedFinding.subject.type}: {selectedFinding.subject.id}</dd></div><div><dt>Agent</dt><dd>{selectedFinding.agent.replace(/_/g, ' ')}</dd></div></dl>
          
          {/* Why section - composed sentence per spec §98 */}
          <section className="evidence-section">
            <h3>Why</h3>
            <p>{selectedFinding.title}. {Object.entries(selectedFinding.details).map(([k,v]) => `${k.replace(/_/g, ' ')}: ${typeof v === 'string' ? v : JSON.stringify(v)}`).join('; ')}</p>
          </section>

          {/* Financial exposures & duty at risk per spec §92 */}
          {(findingExposures.length > 0 || dutyAtRiskTotal > 0) && (
            <section className="evidence-section exposure-section">
              <h3>Financial exposures & duty at risk</h3>
              {dutyAtRiskTotal > 0 && (
                <div className="duty-at-risk-card">
                  <strong>Duty at risk: {money(dutyAtRiskTotal)}</strong>
                  <span> (kind: duty_if_preference_denied across {findingExposures.filter((e) => e.kind === 'duty_if_preference_denied').length} lines)</span>
                </div>
              )}
              <div className="exposure-list">
                {findingExposures.map((exp) => (
                  <article className="evidence-record" key={`${exp.plan_id ?? ''}-${exp.exposure_id}`}>
                    <div className="evidence-record-heading">
                      <strong>{exp.exposure_id} · {exp.kind.replace(/_/g, ' ')}</strong>
                      <span>{exp.amount_inr !== null ? money(exp.amount_inr) : 'Unquantified'}</span>
                    </div>
                    <p className="evidence-meta">Line {exp.line_id}{exp.mutually_exclusive_group ? ` · Group ${exp.mutually_exclusive_group}` : ''}</p>
                    <p className="evidence-meta">{exp.basis}</p>
                  </article>
                ))}
              </div>
            </section>
          )}

          {/* Evidence Tabs per spec §99-100 */}
          <div role="tablist" aria-label="Evidence types" style={{display: 'flex', gap: 'var(--space-1)', marginTop: 'var(--space-3)', borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-2)'}}>
            {graphEvidence.length > 0 && (
              <button role="tab" aria-selected={activeEvidenceTab === 'graph'} onClick={() => setActiveEvidenceTab('graph')} className={`focus-button ${activeEvidenceTab === 'graph' ? 'active' : ''}`}>
                Graph
              </button>
            )}
            {lcEvidence.length > 0 && (
              <button role="tab" aria-selected={activeEvidenceTab === 'lc'} onClick={() => setActiveEvidenceTab('lc')} className={`focus-button ${activeEvidenceTab === 'lc' ? 'active' : ''}`}>
                Letter of Credit
              </button>
            )}
            {selectedRouteRules && (
              <button role="tab" aria-selected={activeEvidenceTab === 'rules'} onClick={() => setActiveEvidenceTab('rules')} className={`focus-button ${activeEvidenceTab === 'rules' ? 'active' : ''}`}>
                Rules
              </button>
            )}
            {linkedEvidence.some(e => e.kind !== 'graph_path' && e.kind !== 'lc_field' && e.kind !== 'rule_passage') && (
              <button role="tab" aria-selected={activeEvidenceTab === 'record'} onClick={() => setActiveEvidenceTab('record')} className={`focus-button ${activeEvidenceTab === 'record' ? 'active' : ''}`}>
                Record
              </button>
            )}
          </div>

          {/* Graph Tab */}
          <section className="evidence-section" role="tabpanel" aria-label="Graph evidence" hidden={activeEvidenceTab !== 'graph'} style={{display: activeEvidenceTab === 'graph' ? 'block' : 'none'}}>
            <h3>Graph</h3>
            <p>Cytoscape view focused on the supplier; blocking path highlighted.</p>
            {graphView && (
              <DependencyGraph
                view={graphView}
                result={evaluation?.dependency_results?.find((result) => result.supplier_id === graphView.focus_supplier_id)}
                candidates={(evaluation?.dependency_results ?? []).map((result) => ({
                  supplierId: result.supplier_id,
                  label: graphView.nodes.find((node) => node.id === result.start_node_id)?.org_name.replace(' (synthetic)', '') ?? result.supplier_id,
                }))}
                onFocusSupplier={(supplierId) => { setSelectedGraphNode(null); setFocusSupplierId(supplierId) }}
                selectedNodeId={selectedGraphNode?.id ?? null}
                onSelectNode={setSelectedGraphNode}
              />
            )}
          </section>

          {/* Letter of Credit Tab */}
          <section className="evidence-section lc-panel" role="tabpanel" aria-label="Letter of Credit evidence" hidden={activeEvidenceTab !== 'lc'} style={{display: activeEvidenceTab === 'lc' ? 'block' : 'none'}}>
            <h3>Letter-of-credit fields</h3>
            <p>Contractual field excerpts attached to this finding; no unreferenced LC text is inferred.</p>
            {lcEvidence.map((item) => {
              const tag = item.locator.field_tag
              return <div className="lc-field" key={item.evidence_id}>
                <strong>{typeof tag === 'string' ? tag : 'LC field'}</strong>
                <code dangerouslySetInnerHTML={{__html: highlightLcTag(item.excerpt, typeof tag === 'string' ? tag : '')}} />
                <span>{item.title} · {item.synthetic ? 'Synthetic' : item.authority}{item.locator.lc_id ? ` · LC: ${item.locator.lc_id}` : ''}</span>
              </div>
            })}
          </section>

          {/* Rules Tab */}
          {selectedRouteRules && (
            <section className="evidence-section rules-panel" role="tabpanel" aria-label="Trade rule evidence" hidden={activeEvidenceTab !== 'rules'} style={{display: activeEvidenceTab === 'rules' ? 'block' : 'none'}}>
              <h3>Trade-rule results</h3>
              <p>Route {selectedFinding.subject.id} · applicable on {selectedRouteRules.query.applicable_on} · origin {selectedRouteRules.query.origin_country} · transit {selectedRouteRules.query.transit_countries.join(', ') || 'none recorded'}.</p>
              <div className="table-scroll" role="region" aria-label="Scrollable route rules table" tabIndex={0}>
                <table className="audit-table">
                  <caption>Rules included in the evaluation response</caption>
                  <thead>
                    <tr>
                      <th scope="col">Rule</th>
                      <th scope="col">Type / rate</th>
                      <th scope="col">Effective</th>
                      <th scope="col">Authority</th>
                      <th scope="col">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedRouteRules.applicable.map((rule) => {
                      const rate = rule.structured.rate_bps
                      return <tr key={rule.rule_id}><td>{rule.rule_id}<small>{rule.citation.title}{rule.citation.synthetic ? ' · Synthetic' : ''}</small></td><td>{rule.rule_type}{typeof rate === 'number' ? ` · ${rate / 100}%` : ''}</td><td>{rule.effective_from} – {rule.effective_to ?? 'open'}</td><td>{rule.authority_level}</td><td>Applied</td></tr>
                    })}
                    {selectedRouteRules.excluded.map((rule) => {
                      const reason = rule.reason === 'superseded' ? 'Superseded' : rule.reason === 'draft' ? 'Draft — not in force' : rule.reason === 'lower_authority' ? 'Lower authority' : rule.reason.replace(/_/g, ' ')
                      return <tr key={rule.rule_id}><td>{rule.rule_id}</td><td>See rule registry</td><td>See rule registry</td><td>See rule registry</td><td>{reason}</td></tr>
                    })}
                  </tbody>
                </table>
              </div>
              {selectedRouteRules.excluded.length > 0 && <p className="evidence-meta">Excluded-rule dates and authority are not included in the evaluation API result; their exclusion reasons above are shown verbatim from that result.</p>}
              {selectedRouteRules.conflicts.length > 0 && <div><h4>Resolved conflicts</h4>{selectedRouteRules.conflicts.map((conflict) => <p key={`${conflict.family_id}-${conflict.selected_rule_id}`}>Resolved: {conflict.reason} · selected {conflict.selected_rule_id} over {conflict.excluded_rule_ids.join(', ')}.</p>)}</div>}
              {selectedRouteRules.missing_rule_types.length > 0 && <p className="evidence-missing">No result for: {selectedRouteRules.missing_rule_types.join(', ')}</p>}
            </section>
          )}

          {/* Record Tab */}
          <section className="evidence-section" role="tabpanel" aria-label="Record evidence" hidden={activeEvidenceTab !== 'record'} style={{display: activeEvidenceTab === 'record' ? 'block' : 'none'}}>
            <h3>Evidence records</h3>
            {missingEvidenceIds.length > 0 && <p className="evidence-missing" role="alert">Evidence missing: {missingEvidenceIds.join(', ')}. This referenced record could not be resolved from the evaluation payload.</p>}
            {linkedEvidence.filter(e => e.kind !== 'graph_path' && e.kind !== 'rule_passage').length === 0 && missingEvidenceIds.length === 0 && <p>No evidence IDs are recorded for this finding.</p>}
            {linkedEvidence.filter(e => e.kind !== 'graph_path' && e.kind !== 'rule_passage').map((item) => <article className="evidence-record" key={item.evidence_id}><div className="evidence-record-heading"><strong>{item.title}</strong><span>{item.evidence_id}</span></div><p className="evidence-meta">{item.kind.replace(/_/g, ' ')} · {item.authority}{item.synthetic ? ' · Synthetic' : item.authority === 'secondary' ? ' · Secondary source' : ''}</p>{item.source_ids.length > 0 && <p className="evidence-meta">Source IDs: {item.source_ids.join(', ')}</p>}{item.excerpt && <blockquote>{item.excerpt}</blockquote>}</article>)}
          </section>

          {/* AI Explanation section per spec §104 */}
          {selectedFinding.explanations && selectedFinding.explanations.length > 0 && (
            <section className="evidence-section" style={{borderTop: '2px solid var(--color-accent)', background: 'var(--color-accent-light)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', marginTop: 'var(--space-3)'}}>
              <h3 style={{display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--color-accent)'}}>
                <span style={{fontSize: 'var(--text-xs)', fontFamily: 'var(--font-accent)', background: 'var(--color-accent)', color: 'var(--color-text-inverse)', padding: '2px 6px', borderRadius: 'var(--radius-sm)'}}>AI Explanation</span>
                Explanation only — decisions come from the checks above
              </h3>
              {selectedFinding.explanations.map((exp: { mode: string; validation_status: string; text: string; cited_evidence_ids?: string[] }, idx: number) => (
                <div key={idx} style={{marginTop: 'var(--space-3)', padding: 'var(--space-3)', background: 'var(--color-bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-accent)'}}>
                  <div style={{display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-2)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-accent)'}}>
                    <span style={{background: 'var(--color-info-bg)', color: 'var(--color-info)', padding: '2px 6px', borderRadius: 'var(--radius-sm)'}}>Mode: {exp.mode}</span>
                    <span style={{background: exp.validation_status === 'validated' ? 'var(--color-success-bg)' : 'var(--color-warning-bg)', color: exp.validation_status === 'validated' ? 'var(--color-success-text)' : 'var(--color-warning-text)', padding: '2px 6px', borderRadius: 'var(--radius-sm)'}}>{exp.validation_status}</span>
                  </div>
                  <p style={{margin: 0, lineHeight: 'var(--leading-relaxed)'}}>{exp.text}</p>
                  {exp.cited_evidence_ids && exp.cited_evidence_ids.length > 0 && (
                    <p style={{marginTop: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)'}}>
                      Cited: {exp.cited_evidence_ids.map((id: string) => <a key={id} href={`#evidence-${id}`} style={{color: 'var(--color-primary)', textDecoration: 'underline'}}>{id}</a>).join(', ')}
                    </p>
                  )}
                </div>
              ))}
            </section>
          )}

          {/* Remedies with action buttons per spec §105 */}
          <section className="evidence-section">
            <h3>Remedies</h3>
            {selectedFinding.remedies.length ? selectedFinding.remedies.map((remedy, index) => (
              <article className="remedy-item" key={`${selectedFinding.finding_id}-${index}`}>
                <strong>{remedy.action.replace(/_/g, ' ')}</strong>
                <p>{remedy.text}</p>
                {remedy.action === 'request_lc_amendment' && actorCanAmend && (
                  <button className="primary-button" style={{marginTop: 'var(--space-2)'}} onClick={() => { setSelectedFinding(null); openApproval(approvalPlan?.plan_id ?? evaluation?.plans.find(p => p.finding_ids.includes(selectedFinding.finding_id))?.plan_id ?? '') }}>
                    Request LC amendment
                  </button>
                )}
              </article>
            )) : <p>No remedies recorded for this finding.</p>}
          </section>
        </aside></div>}
      </main>
    </div>
  )
}

export default App
