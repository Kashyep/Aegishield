import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppShell } from './components/layout'
import { CommandCenter } from './components/screens/CommandCenter'
import { EvaluationsScreen } from './components/screens/EvaluationsScreen'
import { EvaluationProgressScreen } from './components/screens/EvaluationProgressScreen'
import { ExecutionScreen } from './components/screens/ExecutionScreen'
import { SupplyGraphScreen } from './components/screens/SupplyGraphScreen'
import { AuditTrailScreen } from './components/screens/AuditTrailScreen'
import { Modal, ConfirmDialog, NeuButton, NeuCard, Drawer, NeuChip } from './components/ui'
import { DependencyGraph } from './components/DependencyGraph'
import {
  ApiError, createEvaluation, getApiMode, getAuditEvents, getEvaluation, getEvaluationById,
  getExecution, getGraphView, getHealth, getPlan, getPolicies, listDisruptions,
  resetDemo, startExecution, submitDecision, verifyAuditChain
} from './api/client'
import type {
  Acknowledgement, AuditEvent, AuditVerifyResult, Decision, DecisionRequest,
  DemoActor, Evaluation, Execution, Finding, GraphView, GraphViewNode,
  Health, Plan, PlanComparisonItem, Policies
} from './api/types'
import { readScreenFromHash, writeScreenToHash, type Screen } from './app/navigation'
import './index.css'

const money = (amount: number) => `₹${amount.toLocaleString('en-IN')}`
const formatPlanId = (id: string) => id.replace(/^PLN-0*/, 'P')

const getWorstCaseExposure = (planItem: PlanComparisonItem, fullPlan?: Plan): number => {
  if (typeof planItem.worst_case_exposure_inr === 'number') return planItem.worst_case_exposure_inr
  if (fullPlan && typeof fullPlan.financials?.worst_case_exposure_inr === 'number') return fullPlan.financials.worst_case_exposure_inr
  if (fullPlan?.financials?.exposures) {
    const scenarioTotals = new Map<string, Map<string, number>>()
    let ungrouped = 0
    for (const exp of fullPlan.financials.exposures) {
      if (exp.amount_inr == null) continue
      if (!exp.mutually_exclusive_group) ungrouped += exp.amount_inr
      else {
        let kindMap = scenarioTotals.get(exp.mutually_exclusive_group)
        if (!kindMap) { kindMap = new Map(); scenarioTotals.set(exp.mutually_exclusive_group, kindMap) }
        kindMap.set(exp.kind, (kindMap.get(exp.kind) ?? 0) + exp.amount_inr)
      }
    }
    let total = ungrouped
    for (const kindMap of scenarioTotals.values()) {
      let maxKind = 0
      for (const amount of kindMap.values()) if (amount > maxKind) maxKind = amount
      total += maxKind
    }
    return total
  }
  return 0
}

const displayOutcome = (outcome: string) => ({
  passed: 'Passed', needs_review: 'Needs review', blocked: 'Blocked', not_applicable: 'Not applicable',
}[outcome] ?? outcome.replace(/_/g, ' '))

const formatLocalTimestamp = (timestamp?: string | null) => {
  if (!timestamp) return 'Time not recorded'
  const date = new Date(timestamp)
  return Number.isNaN(date.getTime()) ? timestamp : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'medium' }).format(date)
}

const LC_AMENDMENT_TARGETS: Record<string, string> = { '43T': 'ALLOWED', '47A': '(deleted)' }
const fieldValue = (excerpt: string | null | undefined, tag: string) => (excerpt ?? '').replace(`:${tag}:`, '').trim()

const highlightLcTag = (excerpt: string | null | undefined, tag: string) => {
  if (!excerpt || !tag) return excerpt ?? ''
  const searchTag = `:${tag}:`
  const idx = excerpt.indexOf(searchTag)
  if (idx === -1) return excerpt
  const before = excerpt.slice(0, idx)
  const matched = excerpt.slice(idx, idx + searchTag.length)
  const after = excerpt.slice(idx + searchTag.length)
  return `${before}<mark style="background: var(--color-primary-light); color: var(--color-primary-text); padding: 0 2px; border-radius: 2px;">${matched}</mark>${after}`
}

const getErrorMessage = (error: ApiError): string => {
  const code = error.problem?.code
  if (code === 'PLAN_VERSION_STALE' || code === 'PLAN_SUPERSEDED') return 'This plan changed or was replaced. Reload to review the current version.'
  if (code === 'DECISION_EXISTS') return 'A decision already exists for this plan version.'
  if (code === 'PLAN_BLOCKED') return 'Cannot approve: this plan is blocked by its fixture checks.'
  if (error.status === 403) return 'Switch to an actor with the required role to perform this action.'
  if (error.status === 422) return 'Please check the form for errors.'
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
  const executionKeyRef = useRef<{ planId: string; decisionId: string; key: string } | null>(null)
  const pendingDecisionRef = useRef<{ body: string; key: string } | null>(null)
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

  useEffect(() => { void loadGraph() }, [loadGraph])

  useEffect(() => {
    if (getApiMode() !== 'live') return
    void getHealth().then(setHealth).catch(() => setHealth(null))
  }, [evaluation?.evaluation_id])

  const llmMode = health?.llm_mode ?? evaluation?.llm_mode ?? 'off'
  const llmBadge = llmMode === 'off' ? 'LLM: off (templates)' : llmMode === 'recorded' ? 'LLM: recorded' : 'LLM: live'
  const llmBadgeFull = `${llmBadge}${health?.status === 'degraded' ? ' · degraded' : ''}`

  const pollEvaluation = async (id: string) => {
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const current = await getEvaluationById(id)
      setEvaluation(current)
      if (!['queued', 'running'].includes(current.status)) return current
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

  const confirmReset = () => setShowResetConfirm(true)

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
    void listDisruptions().then((data) => {
      const first = data.items[0]?.disruption_id
      if (first) setAvailableDisruptionId(first)
    }).catch(() => {})
    void getPolicies().then(setPolicies).catch((error: unknown) => {
      setPoliciesError(error instanceof Error ? error.message : 'Approval policy fixture could not be loaded.')
    })
  }, [])

  useEffect(() => {
    void loadEvaluation()
  }, [loadEvaluation])

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

  const currentActor: DemoActor | undefined = policies?.demo_actors.find((actor) => actor.actor_id === actorId)
  const reviewFindings = approvalPlan && evaluation
    ? evaluation.findings.filter((finding) => approvalPlan.finding_ids.includes(finding.finding_id) && finding.outcome === 'needs_review')
    : []
  const actorCanApprove = Boolean(currentActor && policies?.approval_policy.approver_roles.includes(currentActor.role))
  const reviewsAcknowledged = reviewFindings.every((finding) => {
    const permittedRoles = policies?.approval_policy.acknowledgement_roles[finding.agent] ?? []
    const acknowledgement = acknowledgements[finding.finding_id]
    return Boolean(currentActor && permittedRoles.includes(currentActor.role) && acknowledgement?.checked && acknowledgement.note.trim().length >= 5)
  })
  const approvalDisabledReason = approvalPlan?.status === 'blocked'
    ? 'Blocked plans cannot be approved. Review the blocking findings first.'
    : !actorCanApprove ? 'Switch to an approver role to approve this plan.'
    : !reviewsAcknowledged ? 'Acknowledge every review finding with a note of at least 5 characters.' : ''
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
    .map((item) => { const tag = String(item.locator.field_tag); return { field_tag: tag, from: fieldValue(item.excerpt, tag), to: LC_AMENDMENT_TARGETS[tag] } })
  const actorCanAmend = Boolean(currentActor && policies?.approval_policy.amendment_request_roles?.includes(currentActor.role))
  const amendmentDisabledReason = !actorCanAmend
    ? 'Switch to the trade compliance officer to request an LC amendment.'
    : decisionJustification.trim().length < 10 ? 'Enter a justification of at least 10 characters.'
    : getApiMode() === 'stub' ? 'Fixture mode has no decision endpoint response.' : ''

  const submitAmendment = async () => {
    if (!approvalPlan || !amendmentLcId || amendmentDisabledReason) return
    const body: DecisionRequest = { action: 'request_amendment', plan_version: approvalPlan.version, plan_hash: approvalPlan.plan_hash, justification: decisionJustification.trim(), acknowledgements: [], amendment: { lc_id: amendmentLcId, requested_changes: amendmentChanges } }
    const serializedBody = JSON.stringify(body)
    if (pendingDecisionRef.current?.body !== serializedBody) pendingDecisionRef.current = { body: serializedBody, key: crypto.randomUUID() }
    setDecisionSubmitting(true)
    setDecisionError(null)
    try {
      const result = await submitDecision(approvalPlan.plan_id, actorId, pendingDecisionRef.current.key, body)
      setAmendmentResult(result.data)
      setEvaluation((previous) => previous && ({ ...previous, plans: previous.plans.map((plan) => plan.plan_id === result.data.plan_id ? { ...plan, status: result.data.resulting_plan_status, decision_ids: [...(plan.decision_ids ?? []), result.data.decision_id] } : plan) }))
    } catch (error) {
      setDecisionError(error instanceof ApiError ? error : new ApiError(error instanceof Error ? error.message : 'Amendment request could not be submitted.'))
    } finally { setDecisionSubmitting(false) }
  }

  const linkedEvidence = selectedFinding && evaluation ? evaluation.evidence.filter((item) => selectedFinding.evidence_ids.includes(item.evidence_id)) : []
  const missingEvidenceIds = selectedFinding ? selectedFinding.evidence_ids.filter((id) => !linkedEvidence.some((item) => item.evidence_id === id)) : []
  const lcEvidence = linkedEvidence.filter((item) => item.kind === 'lc_field')
  const selectedRouteRules = selectedFinding?.subject.type === 'route_option' ? evaluation?.rule_results.find((result) => result.query.query_id === `RQ-${selectedFinding.subject.id}`) : undefined
  const graphEvidence = linkedEvidence.filter((item) => item.kind === 'graph_path')
  const [activeEvidenceTab, setActiveEvidenceTab] = useState<'graph' | 'lc' | 'rules' | 'record'>('graph')

  useEffect(() => {
    if (selectedFinding) {
      if (selectedRouteRules) setActiveEvidenceTab('rules')
      else if (graphEvidence.length > 0) setActiveEvidenceTab('graph')
      else if (lcEvidence.length > 0) setActiveEvidenceTab('lc')
      else setActiveEvidenceTab('record')
    }
  }, [selectedFinding, graphEvidence.length, lcEvidence.length, selectedRouteRules])

  const findingExposures = useMemo(() => {
    if (!selectedFinding || !evaluation) return []
    const seen = new Set<string>()
    const list: (Plan['financials']['exposures'][number] & { plan_id?: string })[] = []
    for (const p of evaluation.plans) {
      for (const exp of p.financials?.exposures ?? []) {
        if (exp.finding_id === selectedFinding.finding_id) {
          const key = `${p.plan_id}:${exp.exposure_id}`
          if (!seen.has(key)) { seen.add(key); list.push({ ...exp, plan_id: p.plan_id }) }
        }
      }
    }
    return list
  }, [selectedFinding, evaluation])

  const dutyAtRiskTotal = useMemo(() => {
    if (!selectedFinding || !evaluation) return 0
    const targetPlan = evaluation.plans.find((p) => p.finding_ids.includes(selectedFinding.finding_id))
    if (!targetPlan?.financials?.exposures) return 0
    return targetPlan.financials.exposures.filter((exp) => exp.finding_id === selectedFinding.finding_id && exp.kind === 'duty_if_preference_denied' && typeof exp.amount_inr === 'number').reduce((sum, exp) => sum + (exp.amount_inr ?? 0), 0)
  }, [selectedFinding, evaluation])

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
    const body: DecisionRequest = { action: 'approve', plan_version: approvalPlan.version, plan_hash: approvalPlan.plan_hash, justification: decisionJustification.trim() || null, acknowledgements: reviewFindings.map((finding): Acknowledgement => ({ finding_id: finding.finding_id, actor_id: actorId, note: acknowledgements[finding.finding_id]?.note.trim() ?? '' })) }
    const serializedBody = JSON.stringify(body)
    if (pendingDecisionRef.current?.body !== serializedBody) pendingDecisionRef.current = { body: serializedBody, key: crypto.randomUUID() }
    setDecisionSubmitting(true)
    setDecisionError(null)
    try {
      const result = await submitDecision(approvalPlan.plan_id, actorId, pendingDecisionRef.current.key, body)
      setEvaluation((previous) => previous && ({ ...previous, plans: previous.plans.map((plan) => plan.plan_id === result.data.plan_id ? { ...plan, status: result.data.resulting_plan_status, decision_ids: [result.data.decision_id] } : plan) }))
      setApprovedDecision(result.data)
      setApprovalPlan(null)
    } catch (error) {
      setDecisionError(error instanceof ApiError ? error : new ApiError(error instanceof Error ? error.message : 'Decision could not be submitted.'))
    } finally { setDecisionSubmitting(false) }
  }

  const reloadApprovalPlan = async () => {
    if (!approvalPlan) return
    setDecisionSubmitting(true)
    setDecisionError(null)
    try {
      const currentPlan = await getPlan(approvalPlan.plan_id)
      setApprovalPlan(currentPlan)
      setEvaluation((previous) => previous && ({ ...previous, plans: previous.plans.map((plan) => plan.plan_id === currentPlan.plan_id ? currentPlan : plan) }))
      pendingDecisionRef.current = null
    } catch (error) {
      setDecisionError(error instanceof ApiError ? error : new ApiError(error instanceof Error ? error.message : 'Plan could not be reloaded.'))
    } finally { setDecisionSubmitting(false) }
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
      if (currentPlan.status === 'completed' && currentPlan.execution_id) { setExecution(await getExecution(currentPlan.execution_id)); navigate('execution'); return }
      const decisionId = approvedDecision?.plan_id === plan.plan_id ? approvedDecision.decision_id : currentPlan.decision_ids?.[0]
      if (currentPlan.status !== 'approved' || !decisionId) throw new ApiError('Execution requires an approved plan and its recorded decision id.')
      if (!currentActor || currentActor.role === 'viewer') throw new ApiError('Switch to a non-viewer simulated actor before starting execution.')
      if (!executionKeyRef.current || executionKeyRef.current.planId !== plan.plan_id || executionKeyRef.current.decisionId !== decisionId) executionKeyRef.current = { planId: plan.plan_id, decisionId, key: crypto.randomUUID() }
      const result = await startExecution(plan.plan_id, actorId, executionKeyRef.current.key, decisionId)
      setExecution(result.data)
      navigate('execution')
    } catch (error) { setExecutionError(error instanceof Error ? error.message : 'Execution request failed.') }
    finally { setExecutionSubmitting(false) }
  }

  const executionId = execution?.execution_id
  const executionStatus = execution?.status
  useEffect(() => {
    if (!executionId || !executionStatus || !['queued', 'running'].includes(executionStatus)) return
    let cancelled = false; let timer: number | undefined
    const poll = () => { timer = window.setTimeout(() => { void getExecution(executionId).then((updated) => { if (cancelled) return; setExecution(updated); if (['queued', 'running'].includes(updated.status)) poll() }).catch((error: unknown) => { if (!cancelled) setExecutionError(error instanceof Error ? error.message : 'Execution status could not be loaded.') }) }, 500) }
    poll()
    return () => { cancelled = true; if (timer !== undefined) window.clearTimeout(timer) }
  }, [executionId, executionStatus])

  const loadAuditEvents = useCallback(async (subjectId = '') => {
    if (getApiMode() === 'stub') { setAuditEvents([]); setAuditState('unavailable'); setAuditError(''); return }
    setAuditState('loading'); setAuditError(''); setAuditVerification(null)
    try { const page = await getAuditEvents(subjectId.trim() || undefined); setAuditEvents(page.events); setAuditState('ready') }
    catch (error) { setAuditEvents([]); setAuditState('error'); setAuditError(error instanceof Error ? error.message : 'Audit events could not be loaded.') }
  }, [])

  useEffect(() => { if (activeScreen === 'audit-trail') void loadAuditEvents() }, [activeScreen, loadAuditEvents])

  const verifyAuditEvents = async () => {
    setAuditVerificationLoading(true); setAuditVerificationError(''); setAuditVerification(null)
    try { setAuditVerification(await verifyAuditChain()) } catch (error) { setAuditVerificationError(error instanceof Error ? error.message : 'Audit chain verification is unavailable.') }
    finally { setAuditVerificationLoading(false) }
  }

  const apiMode = getApiMode()

  // Render the appropriate screen based on activeScreen
  const renderScreen = () => {
    switch (activeScreen) {
      case 'command':
        return (
          <CommandCenter
            evaluation={evaluation}
            evaluationError={evaluationError}
            runEvaluation={runEvaluation}
            confirmReset={confirmReset}
            demoBusy={demoBusy}
            availableDisruptionId={availableDisruptionId}
            navigate={navigate}
            selectedPlan={selectedPlan}
            setSelectedPlan={setSelectedPlan}
            setSelectedFinding={setSelectedFinding}
            apiMode={apiMode}
            money={money}
            formatPlanId={formatPlanId}
            getWorstCaseExposure={getWorstCaseExposure}
            openApproval={openApproval}
            actorCanApprove={actorCanApprove}
            actorCanAmend={actorCanAmend}
            startPlanExecution={startPlanExecution}
            executionSubmitting={executionSubmitting}
          />
        )
      case 'evaluations':
        return (
          <EvaluationsScreen
            evaluation={evaluation}
            evaluationState={evaluationState}
            evaluationError={evaluationError}
            navigate={navigate}
            money={money}
            formatPlanId={formatPlanId}
            getWorstCaseExposure={getWorstCaseExposure}
            setSelectedFinding={setSelectedFinding}
          />
        )
      case 'evaluation-progress':
        return (
          <EvaluationProgressScreen
            evaluation={evaluation}
            evaluationState={evaluationState}
            evaluationError={evaluationError}
            loadEvaluation={loadEvaluation}
            navigate={navigate}
            stepAnnouncement={stepAnnouncement}
          />
        )
      case 'execution':
        return (
          <ExecutionScreen
            execution={execution}
            executionError={executionError}
            executionSubmitting={executionSubmitting}
            startPlanExecution={startPlanExecution}
            evaluation={evaluation}
            formatLocalTimestamp={formatLocalTimestamp}
          />
        )
      case 'supply-graph':
        return (
          <SupplyGraphScreen
            evaluationId={evaluationId}
            graphView={graphView}
            graphError={graphError}
            setFocusSupplierId={setFocusSupplierId}
            selectedGraphNode={selectedGraphNode}
            setSelectedGraphNode={setSelectedGraphNode}
            evaluation={evaluation}
          />
        )
      case 'audit-trail':
        return (
          <AuditTrailScreen
            auditEvents={auditEvents}
            auditState={auditState}
            auditError={auditError}
            auditFilter={auditFilter}
            setAuditFilter={setAuditFilter}
            loadAuditEvents={loadAuditEvents}
            auditVerification={auditVerification}
            auditVerificationLoading={auditVerificationLoading}
            auditVerificationError={auditVerificationError}
            verifyAuditEvents={verifyAuditEvents}
            apiMode={apiMode}
            formatLocalTimestamp={formatLocalTimestamp}
          />
        )
      default:
        return null
    }
  }

  return (
    <>
      <AppShell
        activeScreen={activeScreen}
        actorId={actorId}
        setActorId={setActorId}
        policies={policies}
        apiMode={apiMode}
        llmBadgeFull={llmBadgeFull}
        navigation={navigate}
      >
        <div className="screen-region" data-screen={activeScreen}>
          {renderScreen()}
        </div>
      </AppShell>


      {/* Approval Modal */}
      {approvalPlan && (
        <Modal
          isOpen={!!approvalPlan}
          onClose={() => setApprovalPlan(null)}
          title={`Review ${approvalPlan.label}`}
          maxWidth="680px"
        >
          <dl className="finding-details" style={{ margin: 0 }}>
            <div style={{ padding: 'var(--space-3) 0', borderBottom: '1px solid var(--color-border-light)' }}>
              <dt style={{ marginBottom: 'var(--space-1)', color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', textTransform: 'uppercase', fontFamily: 'var(--font-accent)' }}>Plan status</dt>
              <dd style={{ margin: 0, color: 'var(--color-text)', fontSize: 'var(--text-sm)', overflowWrap: 'anywhere' }}>{approvalPlan.status.replace(/_/g, ' ')}</dd>
            </div>
            <div style={{ padding: 'var(--space-3) 0', borderBottom: '1px solid var(--color-border-light)' }}>
              <dt style={{ marginBottom: 'var(--space-1)', color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', textTransform: 'uppercase', fontFamily: 'var(--font-accent)' }}>Version</dt>
              <dd style={{ margin: 0, color: 'var(--color-text)', fontSize: 'var(--text-sm)', overflowWrap: 'anywhere' }}>{approvalPlan.version}</dd>
            </div>
            <div style={{ padding: 'var(--space-3) 0', borderBottom: '1px solid var(--color-border-light)' }}>
              <dt style={{ marginBottom: 'var(--space-1)', color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', textTransform: 'uppercase', fontFamily: 'var(--font-accent)' }}>Plan hash</dt>
              <dd className="hash-value" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap', margin: 0, color: 'var(--color-text)', fontSize: 'var(--text-sm)', overflowWrap: 'anywhere' }}>
                <span title={approvalPlan.plan_hash}>{approvalPlan.plan_hash.slice(0, 12)}…</span>
                <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }}>{approvalPlan.plan_hash}</span>
                <button className="neu-btn neu-btn-secondary" style={{ padding: 'var(--space-1) var(--space-2)', fontSize: 'var(--text-xs)' }} onClick={() => { navigator.clipboard.writeText(approvalPlan.plan_hash); setDemoMessage('Plan hash copied to clipboard'); setTimeout(() => setDemoMessage(''), 2000) }}>Copy</button>
              </dd>
            </div>
            <div style={{ padding: 'var(--space-3) 0', borderBottom: '1px solid var(--color-border-light)' }}>
              <dt style={{ marginBottom: 'var(--space-1)', color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', textTransform: 'uppercase', fontFamily: 'var(--font-accent)' }}>Recovery cost</dt>
              <dd style={{ margin: 0, color: 'var(--color-text)', fontSize: 'var(--text-sm)', overflowWrap: 'anywhere' }}>{money(approvalPlan.financials.recovery_cost_inr)}</dd>
            </div>
            <div style={{ padding: 'var(--space-3) 0', borderBottom: '1px solid var(--color-border-light)' }}>
              <dt style={{ marginBottom: 'var(--space-1)', color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', textTransform: 'uppercase', fontFamily: 'var(--font-accent)' }}>Residual loss</dt>
              <dd style={{ margin: 0, color: 'var(--color-text)', fontSize: 'var(--text-sm)', overflowWrap: 'anywhere' }}>{money(approvalPlan.financials.residual_loss_inr)}</dd>
            </div>
            <div style={{ padding: 'var(--space-3) 0', borderBottom: '1px solid var(--color-border-light)' }}>
              <dt style={{ marginBottom: 'var(--space-1)', color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', textTransform: 'uppercase', fontFamily: 'var(--font-accent)' }}>Net avoided loss</dt>
              <dd style={{ margin: 0, color: 'var(--color-text)', fontSize: 'var(--text-sm)', overflowWrap: 'anywhere' }}>{money(approvalPlan.financials.net_avoided_loss_inr)}</dd>
            </div>
            <div style={{ padding: 'var(--space-3) 0' }}>
              <dt style={{ marginBottom: 'var(--space-1)', color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', textTransform: 'uppercase', fontFamily: 'var(--font-accent)' }}>Worst-case exposure</dt>
              <dd style={{ margin: 0, color: 'var(--color-text)', fontSize: 'var(--text-sm)', overflowWrap: 'anywhere' }}>{money(approvalPlan.financials.worst_case_exposure_inr ?? 0)}</dd>
            </div>
          </dl>

          <p className={approvalPlan.status === 'blocked' ? 'blocked-reason' : 'approval-note'} style={{ margin: 'var(--space-3) 0', padding: 'var(--space-3)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', color: approvalPlan.status === 'blocked' ? 'var(--color-error-text)' : 'var(--color-text-muted)', background: approvalPlan.status === 'blocked' ? 'var(--color-error-bg)' : 'var(--color-bg-subtle)', fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-relaxed)' }}>
            {approvalPlan.status === 'blocked' ? 'Cannot approve: this plan is blocked by its fixture checks.' : `Outcome: ${approvalPlan.outcome}. Confirm the current plan version and evidence before approval.`}
          </p>

          {approvalDisabledReason && <p className="blocked-reason" style={{ marginBottom: 'var(--space-3)', color: 'var(--color-error-text)' }}>{approvalDisabledReason}</p>}

          <label className="neu-label" htmlFor="approval-justification">Justification <span style={{ fontWeight: 'var(--weight-normal)', color: 'var(--color-text-muted)' }}>(optional for approval)</span></label>
          <textarea id="approval-justification" className="neu-textarea" value={decisionJustification} onChange={(e) => setDecisionJustification(e.target.value)} maxLength={1000} rows={3} placeholder="Record the reason for this approval" />

          <section className="acknowledgement-section" style={{ marginTop: 'var(--space-5)' }}>
            <h3 style={{ margin: '0 0 var(--space-3)', fontSize: 'var(--text-md)', fontFamily: 'var(--font-heading)' }}>Required acknowledgements</h3>
            {reviewFindings.length === 0 ? (
              <p style={{ color: 'var(--color-text-muted)' }}>No needs-review findings are recorded for this plan.</p>
            ) : (
              reviewFindings.map((finding) => {
                const requiredRoles = policies?.approval_policy.acknowledgement_roles[finding.agent] ?? []
                const canAcknowledge = Boolean(currentActor && requiredRoles.includes(currentActor.role))
                const value = acknowledgements[finding.finding_id] ?? { checked: false, note: '' }
                return (
                  <fieldset className="acknowledgement-item" key={finding.finding_id} style={{ margin: 'var(--space-3) 0', padding: 'var(--space-3)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
                    <legend style={{ padding: '0 var(--space-1)', color: 'var(--color-text)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)', fontFamily: 'var(--font-heading)' }}>{finding.title}</legend>
                    <p style={{ margin: 'var(--space-1) 0 var(--space-2)', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>{finding.finding_id} · acknowledgement role: {requiredRoles.join(' or ') || 'not specified'}</p>
                    <label className={canAcknowledge ? '' : 'disabled-label'} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', minHeight: 28, fontSize: 'var(--text-sm)', fontFamily: 'var(--font-body)', color: canAcknowledge ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
                      <input type="checkbox" disabled={!canAcknowledge} checked={value.checked} onChange={(e) => setAcknowledgements((prev) => ({ ...prev, [finding.finding_id]: { ...value, checked: e.target.checked } }))} style={{ width: 24, height: 24, accentColor: 'var(--color-primary)' }} />
                      I acknowledge this review finding
                    </label>
                    {!canAcknowledge && <p className="neu-hint" style={{ color: 'var(--color-error)' }}>Switch to an actor with the required role before acknowledging.</p>}
                    <label className="neu-label" htmlFor={`ack-note-${finding.finding_id}`}>Acknowledgement note</label>
                    <textarea id={`ack-note-${finding.finding_id}`} className="neu-textarea" value={value.note} disabled={!canAcknowledge} minLength={5} maxLength={500} rows={2} onChange={(e) => setAcknowledgements((prev) => ({ ...prev, [finding.finding_id]: { ...value, note: e.target.value } }))} />
                  </fieldset>
                )
              })
            )}
          </section>

          {approvalPlan.status === 'blocked' && amendableFindings.length > 0 && amendmentLcId && (
            <section className="amendment-section" style={{ marginTop: 'var(--space-4)', padding: 'var(--space-3)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
              <h3 style={{ margin: '0 0 var(--space-3)', fontSize: 'var(--text-md)', fontFamily: 'var(--font-heading)' }}>Request LC amendment</h3>
              <p style={{ marginBottom: 'var(--space-3)' }}>{amendableFindings.map((finding) => finding.title).join('; ')}. The plan stays blocked until the bank accepts the amendment and the plan is re-evaluated.</p>
              <div className="neu-table-wrap">
                <table className="neu-table">
                  <caption>Requested changes to {amendmentLcId}</caption>
                  <thead>
                    <tr><th scope="col">Field</th><th scope="col">Current</th><th scope="col">Requested</th></tr>
                  </thead>
                  <tbody>
                    {amendmentChanges.map((change) => (
                      <tr key={change.field_tag}>
                        <td>{change.field_tag}</td>
                        <td>{change.from}</td>
                        <td>{change.to}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="neu-hint">Uses the justification above (at least 10 characters). Role: trade compliance officer.</p>
              <NeuButton variant="secondary" disabled={decisionSubmitting || Boolean(amendmentDisabledReason) || Boolean(amendmentResult)} onClick={submitAmendment}>
                {decisionSubmitting ? 'Submitting…' : 'Request LC amendment'}
              </NeuButton>
              {amendmentDisabledReason && !amendmentResult && <p className="neu-hint" style={{ color: 'var(--color-error)' }}>{amendmentDisabledReason}</p>}
              {amendmentResult && <p className="approval-note" role="status" style={{ marginTop: 'var(--space-3)' }}>Amendment request {amendmentResult.amendment_request_id} recorded by {amendmentResult.actor.display_name ?? amendmentResult.actor.actor_id}. Plan {amendmentResult.plan_id} stays {amendmentResult.resulting_plan_status}.</p>}
            </section>
          )}

          {policiesError && <p className="load-error" role="alert" style={{ color: 'var(--color-error-text)' }}>{policiesError}</p>}
          {apiMode === 'stub' && <p className="approval-note" style={{ marginTop: 'var(--space-3)' }}>Fixture mode contains no decision response. Connect the backend in live mode to submit; no approval will be simulated here.</p>}
          {decisionError && (
            <div className="api-error" role="alert" style={{ margin: 'var(--space-4) 0', padding: 'var(--space-3)', border: '1px solid var(--color-error-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-error-text)', background: 'var(--color-error-bg)' }}>
              <strong>{getErrorMessage(decisionError)}</strong>
              <p style={{ margin: 'var(--space-1) 0 var(--space-2)', fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-relaxed)' }}>{decisionError.problem?.detail ?? decisionError.message}</p>
              {['PLAN_VERSION_STALE', 'PLAN_SUPERSEDED', 'DECISION_EXISTS'].includes(decisionError.problem?.code ?? '') && (
                <NeuButton variant="secondary" disabled={decisionSubmitting} onClick={reloadApprovalPlan}>Reload current plan</NeuButton>
              )}
            </div>
          )}

          <div className="neu-dialog-actions">
            <NeuButton variant="secondary" disabled={decisionSubmitting} onClick={() => setApprovalPlan(null)}>Cancel</NeuButton>
            <NeuButton variant="primary" disabled={decisionSubmitting || Boolean(approvalDisabledReason) || apiMode === 'stub'} onClick={submitApproval}>
              {decisionSubmitting ? 'Submitting…' : 'Approve plan'}
            </NeuButton>
          </div>
        </Modal>
      )}

      {/* Evidence Drawer */}
      {selectedFinding && (
        <Drawer
          isOpen={!!selectedFinding}
          onClose={() => setSelectedFinding(null)}
          title="Finding details"
        >
          <NeuChip variant={selectedFinding.outcome === 'passed' ? 'success' : selectedFinding.outcome === 'needs_review' ? 'warning' : 'error'} className="finding-outcome" style={{ marginTop: 'var(--space-4)' }}>
            {displayOutcome(selectedFinding.outcome)}
          </NeuChip>
          <h3 style={{ margin: 'var(--space-5) 0 var(--space-3)', fontFamily: 'var(--font-heading)' }}>{selectedFinding.title}</h3>

          <dl className="finding-details" style={{ margin: 0 }}>
            <div style={{ padding: 'var(--space-3) 0', borderBottom: '1px solid var(--color-border-light)' }}>
              <dt style={{ marginBottom: 'var(--space-1)', color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', textTransform: 'uppercase', fontFamily: 'var(--font-accent)' }}>Finding ID</dt>
              <dd style={{ margin: 0, color: 'var(--color-text)', fontSize: 'var(--text-sm)', overflowWrap: 'anywhere' }}>{selectedFinding.finding_id}</dd>
            </div>
            <div style={{ padding: 'var(--space-3) 0', borderBottom: '1px solid var(--color-border-light)' }}>
              <dt style={{ marginBottom: 'var(--space-1)', color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', textTransform: 'uppercase', fontFamily: 'var(--font-accent)' }}>Check</dt>
              <dd style={{ margin: 0, color: 'var(--color-text)', fontSize: 'var(--text-sm)', overflowWrap: 'anywhere' }}>{selectedFinding.check_code}</dd>
            </div>
            <div style={{ padding: 'var(--space-3) 0', borderBottom: '1px solid var(--color-border-light)' }}>
              <dt style={{ marginBottom: 'var(--space-1)', color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', textTransform: 'uppercase', fontFamily: 'var(--font-accent)' }}>Subject</dt>
              <dd style={{ margin: 0, color: 'var(--color-text)', fontSize: 'var(--text-sm)', overflowWrap: 'anywhere' }}>{selectedFinding.subject.type}: {selectedFinding.subject.id}</dd>
            </div>
            <div style={{ padding: 'var(--space-3) 0' }}>
              <dt style={{ marginBottom: 'var(--space-1)', color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', textTransform: 'uppercase', fontFamily: 'var(--font-accent)' }}>Agent</dt>
              <dd style={{ margin: 0, color: 'var(--color-text)', fontSize: 'var(--text-sm)', overflowWrap: 'anywhere' }}>{selectedFinding.agent.replace(/_/g, ' ')}</dd>
            </div>
          </dl>

          <section className="evidence-section" style={{ marginTop: 'var(--space-5)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--color-border-light)' }}>
            <h3 style={{ margin: '0 0 var(--space-2)', fontSize: 'var(--text-md)', fontFamily: 'var(--font-heading)' }}>Why</h3>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-relaxed)' }}>
              {selectedFinding.title}. {Object.entries(selectedFinding.details).map(([k,v]) => `${k.replace(/_/g, ' ')}: ${typeof v === 'string' ? v : JSON.stringify(v)}`).join('; ')}
            </p>
          </section>

          {(findingExposures.length > 0 || dutyAtRiskTotal > 0) && (
            <section className="evidence-section exposure-section" style={{ marginTop: 'var(--space-5)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--color-border-light)' }}>
              <h3 style={{ margin: '0 0 var(--space-2)', fontSize: 'var(--text-md)', fontFamily: 'var(--font-heading)' }}>Financial exposures & duty at risk</h3>
              {dutyAtRiskTotal > 0 && (
                <div className="duty-at-risk-card" style={{ marginBottom: 'var(--space-3)', padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-md)', background: 'var(--color-error-bg)', border: '1px solid var(--color-error-border)', color: 'var(--color-error-text)', fontSize: 'var(--text-sm)' }}>
                  <strong style={{ fontSize: 'var(--text-md)', fontFamily: 'var(--font-heading)' }}>Duty at risk: {money(dutyAtRiskTotal)}</strong>
                  <span> (kind: duty_if_preference_denied across {findingExposures.filter((e) => e.kind === 'duty_if_preference_denied').length} lines)</span>
                </div>
              )}
              <div className="exposure-list">
                {findingExposures.map((exp) => (
                  <NeuCard key={`${exp.plan_id ?? ''}-${exp.exposure_id}`} variant="raised" className="evidence-record" style={{ margin: 'var(--space-2) 0', padding: 'var(--space-3)' }}>
                    <div className="evidence-record-heading" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', color: 'var(--color-text)', fontSize: 'var(--text-sm)' }}>
                      <strong>{exp.exposure_id} · {exp.kind.replace(/_/g, ' ')}</strong>
                      <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-accent)' }}>{exp.amount_inr !== null ? money(exp.amount_inr) : 'Unquantified'}</span>
                    </div>
                    <p className="evidence-meta" style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-accent)' }}>Line {exp.line_id}{exp.mutually_exclusive_group ? ` · Group ${exp.mutually_exclusive_group}` : ''}</p>
                    <p className="evidence-meta" style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-accent)' }}>{exp.basis}</p>
                  </NeuCard>
                ))}
              </div>
            </section>
          )}

          {/* Evidence Tabs */}
          <div role="tablist" aria-label="Evidence types" style={{ display: 'flex', gap: 'var(--space-1)', marginTop: 'var(--space-3)', borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-2)' }}>
            {graphEvidence.length > 0 && (
              <button role="tab" aria-selected={activeEvidenceTab === 'graph'} onClick={() => setActiveEvidenceTab('graph')} className={`neu-pill ${activeEvidenceTab === 'graph' ? 'active' : ''}`}>
                Graph
              </button>
            )}
            {lcEvidence.length > 0 && (
              <button role="tab" aria-selected={activeEvidenceTab === 'lc'} onClick={() => setActiveEvidenceTab('lc')} className={`neu-pill ${activeEvidenceTab === 'lc' ? 'active' : ''}`}>
                Letter of Credit
              </button>
            )}
            {selectedRouteRules && (
              <button role="tab" aria-selected={activeEvidenceTab === 'rules'} onClick={() => setActiveEvidenceTab('rules')} className={`neu-pill ${activeEvidenceTab === 'rules' ? 'active' : ''}`}>
                Rules
              </button>
            )}
            {linkedEvidence.some((e) => e.kind !== 'graph_path' && e.kind !== 'lc_field' && e.kind !== 'rule_passage') && (
              <button role="tab" aria-selected={activeEvidenceTab === 'record'} onClick={() => setActiveEvidenceTab('record')} className={`neu-pill ${activeEvidenceTab === 'record' ? 'active' : ''}`}>
                Record
              </button>
            )}
          </div>

          {/* Graph Tab */}
          {graphView && (
            <section className="evidence-section" role="tabpanel" aria-label="Graph evidence" hidden={activeEvidenceTab !== 'graph'} style={{ marginTop: 'var(--space-5)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--color-border-light)' }}>
              <h3 style={{ margin: '0 0 var(--space-2)', fontSize: 'var(--text-md)', fontFamily: 'var(--font-heading)' }}>Graph</h3>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-relaxed)' }}>Cytoscape view focused on the supplier; blocking path highlighted.</p>
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
            </section>
          )}

          {/* Letter of Credit Tab */}
          {lcEvidence.length > 0 && (
            <section className="evidence-section lc-panel" role="tabpanel" aria-label="Letter of Credit evidence" hidden={activeEvidenceTab !== 'lc'} style={{ marginTop: 'var(--space-5)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--color-border-light)', padding: 'var(--space-4)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-info-bg)' }}>
              <h3 style={{ margin: '0 0 var(--space-2)', fontSize: 'var(--text-md)', fontFamily: 'var(--font-heading)' }}>Letter-of-credit fields</h3>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-relaxed)' }}>Contractual field excerpts attached to this finding; no unreferenced LC text is inferred.</p>
              {lcEvidence.map((item) => {
                const tag = item.locator.field_tag
                return (
                  <div key={item.evidence_id} className="lc-field" style={{ display: 'grid', gridTemplateColumns: '54px 1fr', gap: 'var(--space-2) var(--space-2)', alignItems: 'start', marginTop: 'var(--space-2)', padding: 'var(--space-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-bg-elevated)' }}>
                    <strong style={{ color: 'var(--color-primary-text)', fontFamily: 'var(--font-mono)' }}>{typeof tag === 'string' ? tag : 'LC field'}</strong>
                    <code style={{ color: 'var(--color-text)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', overflowWrap: 'anywhere' }} dangerouslySetInnerHTML={{ __html: highlightLcTag(item.excerpt, typeof tag === 'string' ? tag : '') }} />
                    <span style={{ gridColumn: 2, color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-accent)' }}>{item.title} · {item.synthetic ? 'Synthetic' : item.authority}{item.locator.lc_id ? ` · LC: ${item.locator.lc_id}` : ''}</span>
                  </div>
                )
              })}
            </section>
          )}

          {/* Rules Tab */}
          {selectedRouteRules && (
            <section className="evidence-section rules-panel" role="tabpanel" aria-label="Trade rule evidence" hidden={activeEvidenceTab !== 'rules'} style={{ marginTop: 'var(--space-5)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--color-border-light)' }}>
              <h3 style={{ margin: '0 0 var(--space-2)', fontSize: 'var(--text-md)', fontFamily: 'var(--font-heading)' }}>Trade-rule results</h3>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-relaxed)' }}>Route {selectedFinding.subject.id} · applicable on {selectedRouteRules.query.applicable_on} · origin {selectedRouteRules.query.origin_country} · transit {selectedRouteRules.query.transit_countries.join(', ') || 'none recorded'}.</p>
              <div className="neu-table-wrap" role="region" aria-label="Route rules table" tabIndex={0} style={{ margin: 'var(--space-2) 0' }}>
                <table className="neu-table" style={{ minWidth: 630, fontSize: 'var(--text-xs)' }}>
                  <caption>Rules included in the evaluation response</caption>
                  <thead>
                    <tr><th scope="col">Rule</th><th scope="col">Type / rate</th><th scope="col">Effective</th><th scope="col">Authority</th><th scope="col">Result</th></tr>
                  </thead>
                  <tbody>
                    {selectedRouteRules.applicable.map((rule) => {
                      const rate = rule.structured.rate_bps
                      return (
                        <tr key={rule.rule_id}>
                          <td>{rule.rule_id}<small style={{ display: 'block', marginTop: 'var(--space-1)', color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-accent)' }}>{rule.citation.title}{rule.citation.synthetic ? ' · Synthetic' : ''}</small></td>
                          <td>{rule.rule_type}{typeof rate === 'number' ? ` · ${rate / 100}%` : ''}</td>
                          <td>{rule.effective_from} – {rule.effective_to ?? 'open'}</td>
                          <td>{rule.authority_level}</td>
                          <td>Applied</td>
                        </tr>
                      )
                    })}
                    {selectedRouteRules.excluded.map((rule) => {
                      const reason = rule.reason === 'superseded' ? 'Superseded' : rule.reason === 'draft' ? 'Draft — not in force' : rule.reason === 'lower_authority' ? 'Lower authority' : rule.reason.replace(/_/g, ' ')
                      return (
                        <tr key={rule.rule_id}>
                          <td>{rule.rule_id}</td>
                          <td>See rule registry</td>
                          <td>See rule registry</td>
                          <td>See rule registry</td>
                          <td>{reason}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {selectedRouteRules.excluded.length > 0 && <p className="neu-hint" style={{ marginTop: 'var(--space-2)' }}>Excluded-rule dates and authority are not included in the evaluation API result; their exclusion reasons above are shown verbatim from that result.</p>}
              {selectedRouteRules.conflicts.length > 0 && (
                <div style={{ marginTop: 'var(--space-3)' }}>
                  <h4 style={{ margin: '0 0 var(--space-1)', color: 'var(--color-text)', fontFamily: 'var(--font-heading)' }}>Resolved conflicts</h4>
                  {selectedRouteRules.conflicts.map((conflict) => (
                    <p key={`${conflict.family_id}-${conflict.selected_rule_id}`}>Resolved: {conflict.reason} · selected {conflict.selected_rule_id} over {conflict.excluded_rule_ids.join(', ')}.</p>
                  ))}
                </div>
              )}
              {selectedRouteRules.missing_rule_types.length > 0 && <p className="neu-hint" style={{ color: 'var(--color-error)' }}>No result for: {selectedRouteRules.missing_rule_types.join(', ')}</p>}
            </section>
          )}

          {/* Record Tab */}
          <section className="evidence-section" role="tabpanel" aria-label="Record evidence" hidden={activeEvidenceTab !== 'record'} style={{ marginTop: 'var(--space-5)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--color-border-light)' }}>
              <h3 style={{ margin: '0 0 var(--space-2)', fontSize: 'var(--text-md)', fontFamily: 'var(--font-heading)' }}>Evidence records</h3>
              {missingEvidenceIds.length > 0 && <p className="evidence-missing" role="alert" style={{ padding: 'var(--space-3)', border: '1px solid var(--color-error-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-error-text)', background: 'var(--color-error-bg)' }}>Evidence missing: {missingEvidenceIds.join(', ')}. This referenced record could not be resolved from the evaluation payload.</p>}
              {linkedEvidence.filter((e) => e.kind !== 'graph_path' && e.kind !== 'rule_passage').length === 0 && missingEvidenceIds.length === 0 && <p style={{ color: 'var(--color-text-muted)' }}>No evidence IDs are recorded for this finding.</p>}
              {linkedEvidence.filter((e) => e.kind !== 'graph_path' && e.kind !== 'rule_passage').map((item) => (
                <NeuCard key={item.evidence_id} variant="raised" className="evidence-record" style={{ margin: 'var(--space-2) 0', padding: 'var(--space-3)' }}>
                  <div className="evidence-record-heading" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', color: 'var(--color-text)', fontSize: 'var(--text-sm)' }}>
                    <strong>{item.title}</strong>
                    <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-accent)' }}>{item.evidence_id}</span>
                  </div>
                  <p className="evidence-meta" style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-accent)' }}>{item.kind.replace(/_/g, ' ')} · {item.authority}{item.synthetic ? ' · Synthetic' : item.authority === 'secondary' ? ' · Secondary source' : ''}</p>
                  {item.source_ids.length > 0 && <p className="evidence-meta" style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-accent)' }}>Source IDs: {item.source_ids.join(', ')}</p>}
                  {item.excerpt && <blockquote style={{ margin: 'var(--space-2) 0 0', padding: 'var(--space-2) var(--space-3)', borderLeft: '3px solid var(--color-primary)', color: 'var(--color-text)', background: 'var(--color-primary-light)', fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-relaxed)', overflowWrap: 'anywhere' }}>{item.excerpt}</blockquote>}
                </NeuCard>
              ))}
            </section>

          {/* AI Explanation section */}
          {selectedFinding.explanations && selectedFinding.explanations.length > 0 && (
            <section className="evidence-section" style={{ marginTop: 'var(--space-5)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--color-border-light)', borderTopWidth: 2, borderTopColor: 'var(--color-accent)', background: 'var(--color-accent-light)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--color-accent)', margin: '0 0 var(--space-3)' }}>
                <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-accent)', background: 'var(--color-accent)', color: 'var(--color-text-inverse)', padding: '2px 6px', borderRadius: 'var(--radius-sm)' }}>AI Explanation</span>
                Explanation only — decisions come from the checks above
              </h3>
              {selectedFinding.explanations.map((exp, idx) => (
                <div key={idx} style={{ marginTop: 'var(--space-3)', padding: 'var(--space-3)', background: 'var(--color-bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-accent)' }}>
                  <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-2)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-accent)' }}>
                    <span style={{ background: 'var(--color-info-bg)', color: 'var(--color-info)', padding: '2px 6px', borderRadius: 'var(--radius-sm)' }}>Mode: {exp.mode}</span>
                    <span style={{ background: exp.validation_status === 'validated' ? 'var(--color-success-bg)' : 'var(--color-warning-bg)', color: exp.validation_status === 'validated' ? 'var(--color-success-text)' : 'var(--color-warning-text)', padding: '2px 6px', borderRadius: 'var(--radius-sm)' }}>{exp.validation_status}</span>
                  </div>
                  <p style={{ margin: 0, lineHeight: 'var(--leading-relaxed)' }}>{exp.text}</p>
                  {exp.cited_evidence_ids && exp.cited_evidence_ids.length > 0 && (
                    <p style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                      Cited: {exp.cited_evidence_ids.map((id: string) => <a key={id} href={`#evidence-${id}`} style={{ color: 'var(--color-primary)', textDecoration: 'underline' }}>{id}</a>).join(', ')}
                    </p>
                  )}
                </div>
              ))}
            </section>
          )}

          {/* Remedies section */}
          <section className="evidence-section" style={{ marginTop: 'var(--space-5)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--color-border-light)' }}>
            <h3 style={{ margin: '0 0 var(--space-2)', fontSize: 'var(--text-md)', fontFamily: 'var(--font-heading)' }}>Remedies</h3>
            {selectedFinding.remedies.length ? selectedFinding.remedies.map((remedy, index) => (
              <NeuCard key={`${selectedFinding.finding_id}-${index}`} variant="raised" className="remedy-item" style={{ margin: 'var(--space-2) 0', padding: 'var(--space-3)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-info-bg)' }}>
                <strong>{remedy.action.replace(/_/g, ' ')}</strong>
                <p style={{ margin: 'var(--space-1) 0 0', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-relaxed)' }}>{remedy.text}</p>
                {remedy.action === 'request_lc_amendment' && actorCanAmend && (
                  <NeuButton variant="primary" style={{ marginTop: 'var(--space-2)' }} onClick={() => { setSelectedFinding(null); openApproval(approvalPlan?.plan_id ?? evaluation?.plans.find((p) => p.finding_ids.includes(selectedFinding.finding_id))?.plan_id ?? '') }}>
                    Request LC amendment
                  </NeuButton>
                )}
              </NeuCard>
            )) : (
              <p style={{ color: 'var(--color-text-muted)' }}>No remedies recorded for this finding.</p>
            )}
          </section>
        </Drawer>
      )}

      {/* Reset Confirm Dialog */}
      {showResetConfirm && (
        <ConfirmDialog
          isOpen={showResetConfirm}
          onClose={() => setShowResetConfirm(false)}
          onConfirm={runDemoReset}
          title="Reset demo?"
          message="This will clear the current evaluation and restart the audit chain. This action cannot be undone."
          confirmLabel="Reset demo"
          isLoading={demoBusy === 'reset'}
        />
      )}

      {demoMessage && (
        <div style={{ position: 'fixed', bottom: 'var(--space-6)', right: 'var(--space-6)', zIndex: 'var(--z-toast)', maxWidth: '400px' }}>
          <NeuCard variant="raised-lg" style={{ padding: 'var(--space-4)', boxShadow: 'var(--shadow-neu-raised-lg)' }}>
            <p role="status" style={{ margin: 0, color: 'var(--color-text)', fontSize: 'var(--text-sm)' }}>{demoMessage}</p>
          </NeuCard>
        </div>
      )}
    </>
  )
}

export default App