import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, getApiMode, getAuditEvents, getEvaluation, getExecution, getPlan, getPolicies, getSupplyGraph, startExecution, submitDecision, verifyAuditChain } from './api/client'
import type { Acknowledgement, AuditEvent, AuditVerifyResult, Decision, DecisionRequest, DemoActor, Evaluation, Execution, Finding, GraphNode, Plan, Policies, SupplyGraph } from './api/types'
import { navItems, readScreenFromHash, screenLabel, writeScreenToHash, type Screen } from './app/navigation'
import './App.css'

const money = (amount: number) => `₹${amount.toLocaleString('en-IN')}`
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

function SupplyGraphView({ graph, selectedNodeId, onSelectNode }: {
  graph: SupplyGraph
  selectedNodeId: string | null
  onSelectNode: (node: GraphNode) => void
}) {
  const positions: Record<string, { x: number; y: number }> = {
    'FAC-FABZ': { x: 28, y: 36 },
    'FAC-SUBS': { x: 28, y: 205 },
    'FAC-FABK': { x: 28, y: 376 },
    'FAC-TSUB': { x: 28, y: 545 },
    'FAC-Q-KDH': { x: 344, y: 36 },
    'FAC-VDIE': { x: 344, y: 376 },
    'FAC-A-PEN': { x: 670, y: 36 },
    'FAC-B-CHB': { x: 670, y: 286 },
    'FAC-C-BDG': { x: 670, y: 456 },
    'FAC-KAV-BLR': { x: 980, y: 36 },
  }
  const isConnected = (nodeId: string) => graph.edges.some((edge) => edge.source === selectedNodeId && edge.target === nodeId || edge.target === selectedNodeId && edge.source === nodeId)

  return <>
    <div className="graph-legend"><span><i className="legend-dot disrupted" />Disruption root cause</span><span><i className="legend-dot affected" />Affected supplier (SUP-A)</span><span><i className="legend-line" />Goods flow direction</span></div>
    <div className="graph-scroll">
      <svg className="supply-graph" viewBox="0 0 1215 670" role="img" aria-labelledby="supply-graph-title" aria-describedby="supply-graph-description">
        <title id="supply-graph-title">Interactive supply chain graph</title>
        <desc id="supply-graph-description">Arrows show fixture goods flowing from provider to consumer. Every facility and direct link is also listed below the graphic.</desc>
        <defs><marker id="graph-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" /></marker></defs>
        {graph.edges.map((edge) => {
          const from = positions[edge.source]
          const to = positions[edge.target]
          if (!from || !to) return null
          const startX = from.x + 205
          const endX = to.x - 10
          const middleX = (startX + endX) / 2
          const connected = selectedNodeId !== null && (edge.source === selectedNodeId || edge.target === selectedNodeId)
          return <g key={edge.edge_id} className={`graph-edge ${edge.source === 'FAC-FABZ' ? 'edge-disrupted' : ''} ${selectedNodeId ? connected ? 'is-connected' : 'is-dimmed' : ''}`}>
            <path d={`M ${startX} ${from.y + 44} C ${middleX} ${from.y + 44}, ${middleX} ${to.y + 44}, ${endX} ${to.y + 44}`} markerEnd="url(#graph-arrow)" />
            <title>{edge.edge_id}: {edge.source} supplies {edge.target} ({edge.part_id})</title>
          </g>
        })}
        {graph.nodes.map((node) => {
          const position = positions[node.node_id]
          if (!position) return null
          const disrupted = node.node_id === 'FAC-FABZ'
          const affected = node.supplier_id === 'SUP-A'
          const selected = node.node_id === selectedNodeId
          const tag = disrupted ? 'DISRUPTION ROOT CAUSE' : affected ? 'AFFECTED SUPPLIER · SUP-A' : node.role.replace(/_/g, ' ').toUpperCase()
          return <g key={node.node_id} className={`graph-node ${disrupted ? 'is-disrupted' : ''} ${affected ? 'is-affected' : ''} ${selected ? 'is-selected' : ''} ${selectedNodeId && !selected && !isConnected(node.node_id) ? 'is-dimmed' : ''}`} transform={`translate(${position.x} ${position.y})`} onClick={() => onSelectNode(node)}>
            <rect width="205" height="88" rx="10" />
            <text x="13" y="24" className="node-tag">{tag}</text>
            <text x="13" y="49" className="node-label">{node.label}</text>
            <text x="13" y="69" className="node-meta">{node.node_id} · {node.country}</text>
            <title>{node.org_name}</title>
          </g>
        })}
      </svg>
    </div>
    <p className="graph-note">Select a facility to inspect its fixture details and trace only its direct supply links. Arrows show provider-to-consumer flow.</p>
    <section className="graph-text-alternative" aria-labelledby="graph-text-heading">
      <h2 id="graph-text-heading">Text alternative: supply links</h2>
      <p>Each entry reports a fixture edge in its recorded direction: provider to consumer. Select a link to focus its consumer in the graphic.</p>
      <ol>{graph.edges.map((edge) => {
        const source = graph.nodes.find((node) => node.node_id === edge.source)
        const target = graph.nodes.find((node) => node.node_id === edge.target)
        return <li key={edge.edge_id}><button className="graph-link-button" onClick={() => target && onSelectNode(target)}>{source?.label ?? edge.source} ({source?.country ?? 'country not recorded'}) supplies {target?.label ?? edge.target} ({target?.country ?? 'country not recorded'})</button><span>{edge.part_id} · {edge.type} · {edge.confidence} · source {edge.source_ref}</span></li>
      })}</ol>
      <div className="table-scroll" role="region" aria-label="Scrollable facility records table" tabIndex={0}><table className="audit-table"><caption>Facility records in this graph fixture</caption><thead><tr><th scope="col">Facility</th><th scope="col">Organization</th><th scope="col">Country</th><th scope="col">Role</th><th scope="col">Supplier</th></tr></thead><tbody>{graph.nodes.map((node) => <tr key={node.node_id}><td>{node.label}<small>{node.node_id}</small></td><td>{node.org_name}</td><td>{node.country}</td><td>{node.role.replace(/_/g, ' ')}</td><td>{node.supplier_id ?? '—'}</td></tr>)}</tbody></table></div>
    </section>
  </>
}

function App() {
  const [activeScreen, setActiveScreen] = useState<Screen>(readScreenFromHash)
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null)
  const [graph, setGraph] = useState<SupplyGraph | null>(null)
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null)
  const [selectedGraphNode, setSelectedGraphNode] = useState<GraphNode | null>(null)
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
  const pendingDecisionRef = useRef<{ body: string; key: string } | null>(null)
  const [evaluationState, setEvaluationState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [evaluationError, setEvaluationError] = useState('')
  const [graphError, setGraphError] = useState('')

  const loadEvaluation = useCallback(async () => {
    setEvaluationState('loading')
    setEvaluationError('')
    try {
      setEvaluation(await getEvaluation())
      setEvaluationState('ready')
    } catch (error) {
      setEvaluation(null)
      setEvaluationError(error instanceof Error ? error.message : 'Evaluation fixture could not be loaded.')
      setEvaluationState('error')
    }
  }, [])

  const loadGraph = useCallback(async () => {
    setGraphError('')
    try {
      setGraph(await getSupplyGraph())
    } catch (error) {
      setGraph(null)
      setGraphError(error instanceof Error ? error.message : 'Supply graph fixture could not be loaded.')
    }
  }, [])

  useEffect(() => {
    void loadEvaluation()
    void loadGraph()
    void getPolicies().then(setPolicies).catch((error: unknown) => {
      setPoliciesError(error instanceof Error ? error.message : 'Approval policy fixture could not be loaded.')
    })
  }, [loadEvaluation, loadGraph])

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

  const openApproval = (planId: string) => {
    const plan = evaluation?.plans.find((candidate) => candidate.plan_id === planId)
    if (!plan) return
    setApprovalPlan(plan)
    setAcknowledgements({})
    setDecisionError(null)
    setDecisionJustification('')
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
      const focusable = [...dialog.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href]')]
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
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
        <div className="sidebar-bottom"><span className="status-dot" />Demo environment<small>LLM mode: Off</small></div>
      </aside>

      <main className="main-content">
        <header className="topbar"><span>Recovery workspace / {screenLabel(activeScreen)}</span><div className="topbar-tools"><label htmlFor="actor-select">Simulated identity</label><select id="actor-select" className="actor-select" value={actorId} onChange={(event) => setActorId(event.target.value)} aria-label="Simulated identity">{(policies?.demo_actors ?? []).map((actor) => <option key={actor.actor_id} value={actor.actor_id}>{actor.display_name}</option>)}</select><span className="user-chip">{getApiMode() === 'stub' ? 'Stub mode · Fixtures' : 'Live API'}</span></div></header>
        <section className="page-content">
          <div className="synthetic-banner"><strong>SYNTHETIC DATA</strong><span>All companies, prices, schedules and outcomes in this demo are fictional.</span></div>

          {activeScreen === 'command' && (
            <>
              <div className="page-title-row"><div><p className="eyebrow">SUPPLY CHAIN RESILIENCE</p><h1>Command Center</h1><p className="subtitle">Assess disruption, compare recovery plans, and review evidence before approval.</p></div><span className="evaluation-status"><span className="status-dot" />Evaluation completed</span></div>
              <section className="disruption-card"><div className="disruption-icon">!</div><div className="disruption-copy"><span className="eyebrow">ACTIVE DISRUPTION · DIS-2026-0042</span><h2>Supplier delay detected</h2><p>A delay at supplier SUP-A affects downstream supply-chain commitments.</p></div><span className="severity-badge">High severity</span></section>
              <div className="section-heading"><div><h2>Evaluation overview</h2><p>Evaluation {evaluation?.evaluation_id ?? 'EVAL-0001'} · {evaluation?.status ?? 'Loading'}</p></div><div className="command-actions"><button className="secondary-button" onClick={() => navigate('evaluations')}>View evaluation details ↗</button><button className="primary-button" onClick={openEvaluationProgress}>View evaluation progress</button></div></div>
              <section className="metrics-grid">
                <article className="metric-card"><span className="metric-label">Baseline loss</span><strong>{money(evaluation?.comparison.baseline_loss_inr ?? 1160000)}</strong><span className="metric-note">Estimated disruption impact</span></article>
                <article className="metric-card"><span className="metric-label">Recovery plans</span><strong>{evaluation?.comparison.plans.length ?? '—'}</strong><span className="metric-note">Evaluated against required checks</span></article>
                <article className="metric-card"><span className="metric-label">Recommended plan</span><strong className="green-text">{evaluation?.comparison.recommended_plan_id === 'PLN-0002' ? 'P2' : evaluation?.comparison.recommended_plan_id ?? '—'}</strong><span className="metric-note">AegisShield verified</span></article>
              </section>
              <div className="section-heading plans-heading"><div><h2>Recovery plan comparison</h2><p>Financial attractiveness alone does not establish executability.</p></div><span className="recommendation-label">P2 · Recommended</span></div>
              {evaluationError && <p className="load-error" role="alert">{evaluationError}</p>}
              <section className="plans-grid">{(evaluation?.comparison.plans ?? []).map((plan) => {
                const passed = plan.outcome === 'passed'
                const fullPlan = evaluation?.plans.find((candidate) => candidate.plan_id === plan.plan_id)
                const isBlocked = fullPlan?.status === 'blocked'
                return <article className="plan-card" key={plan.plan_id}><div className="plan-top"><div className="plan-id">{plan.plan_id.replace('PLN-', 'P')}</div><span className={`plan-status ${passed ? 'passed' : 'blocked'}`}>{fullPlan?.status?.replace(/_/g, ' ') ?? plan.outcome}</span></div><h3>{plan.label}</h3><p className="plan-detail">Recovery plan from evaluation {evaluation?.evaluation_id}.</p><div className="financial-block"><span>Net avoided loss{isBlocked ? ' · on paper' : ''}</span><strong>{money(plan.net_avoided_loss_inr)}</strong></div><div className="checks-row">{plan.check_outcome_counts.passed} passed · {plan.check_outcome_counts.needs_review} need review · {plan.check_outcome_counts.blocked} blocked</div><div className="plan-actions"><button className="secondary-button" onClick={() => fullPlan && setSelectedPlan(fullPlan)}>Review evidence</button>{fullPlan?.status === 'approved' || fullPlan?.status === 'completed' ? <button className="primary-button" disabled={executionSubmitting || getApiMode() === 'stub'} onClick={() => void startPlanExecution(fullPlan)}>{fullPlan.status === 'completed' ? 'View execution' : 'Start simulated execution'}</button> : <button className="primary-button" disabled={!fullPlan || isBlocked || !actorCanApprove || fullPlan.status !== 'pending_approval'} aria-describedby={isBlocked ? `blocked-reason-${plan.plan_id}` : undefined} onClick={() => openApproval(plan.plan_id)}>Approve</button>}</div>{isBlocked && <p className="blocked-reason" id={`blocked-reason-${plan.plan_id}`}>Cannot be approved: {plan.check_outcome_counts.blocked} blocking findings. P1 remains blocked.</p>}</article>
              })}</section>
              {executionError && <p className="load-error" role="alert">{executionError}</p>}
              {selectedPlan && <div className="evidence-panel"><div className="evidence-header"><h2>Evidence — {selectedPlan.plan_id}</h2><button className="secondary-button" onClick={() => setSelectedPlan(null)}>Close ✕</button></div><h3>{selectedPlan.label}</h3><p><strong>Validation status:</strong> {selectedPlan.status}</p><p><strong>Check results:</strong> {selectedPlan.check_outcome_counts.passed} passed · {selectedPlan.check_outcome_counts.needs_review} need review · {selectedPlan.check_outcome_counts.blocked} blocked</p><p><strong>Financial impact:</strong> {money(selectedPlan.financials.net_avoided_loss_inr)}</p><div className="evidence-findings"><h3>Plan findings</h3>{evaluation?.findings.filter((finding) => selectedPlan.finding_ids.includes(finding.finding_id)).map((finding) => <button key={finding.finding_id} className="finding-link" onClick={() => setSelectedFinding(finding)}>{finding.title}<span>{finding.finding_id} · {finding.outcome}</span></button>)}</div></div>}
            </>
          )}

          {activeScreen === 'evaluation-progress' && <>
            <div className="page-title-row"><div><p className="eyebrow">WORKSPACE / EVALUATION</p><h1>Evaluation progress</h1><p className="subtitle">Step results returned for the loaded evaluation. Fixture mode displays the recorded EVAL-0001 response.</p></div><span className="evaluation-status"><span className="status-dot" />{evaluationState === 'loading' ? 'Loading' : evaluation?.status ?? 'Unavailable'}</span></div>
            {evaluationState === 'loading' && <div className="progress-state" role="status">Loading the recorded evaluation fixture…</div>}
            {evaluationState === 'error' && <div className="progress-state progress-error" role="alert"><p>{evaluationError}</p><button className="primary-button" onClick={() => void loadEvaluation()}>Retry fixture load</button></div>}
            {evaluationState === 'ready' && evaluation && <><div className="evaluation-progress" aria-live="polite" aria-atomic="true"><p className="progress-announcement">Evaluation {evaluation.evaluation_id} is {evaluation.status}. {getApiMode() === 'stub' ? 'Stub mode displays recorded agent results; no live evaluation request was sent.' : 'Step results were returned by the live evaluation API.'}</p>{evaluation.steps?.map((step) => <article className={`progress-step ${step.status}`} key={step.seq}><span className="progress-step-icon" aria-hidden="true">{step.status === 'succeeded' ? '✓' : step.status === 'failed' ? '!' : '•'}</span><div><h2>{step.seq}. {step.step.replace(/_/g, ' ')}</h2><p>{step.owner} · {step.attempts > 1 ? `${step.attempts} attempts` : '1 attempt'}</p>{step.error && <p className="load-error">{typeof step.error === 'string' ? step.error : step.error.message ?? 'Step failed.'}</p>}</div><span className="mode-chip">{step.mode ?? 'not specified'}</span><time dateTime={step.finished_at ?? undefined}>{formatLocalTimestamp(step.finished_at)}</time></article>)}</div><div className="progress-actions"><button className="secondary-button" onClick={() => void loadEvaluation()}>{getApiMode() === 'stub' ? 'Reload fixture' : 'Refresh evaluation'}</button><button className="primary-button" onClick={() => navigate('evaluations')}>View plan comparison</button></div></>}
          </>}

          {activeScreen === 'evaluations' && <>
            <div className="page-title-row"><div><p className="eyebrow">WORKSPACE / EVALUATIONS</p><h1>Evaluations</h1><p className="subtitle">Review the completed synthetic recovery evaluation and its findings.</p></div><span className="evaluation-status"><span className="status-dot" />{evaluation?.status ?? 'Loading'}</span></div>
            {evaluationError && <p className="load-error" role="alert">{evaluationError}</p>}
            {evaluation ? <><div className="section-heading"><div><h2>{evaluation.evaluation_id} · {evaluation.status}</h2><p>Baseline loss: {money(evaluation.comparison.baseline_loss_inr)} · Recommended plan: {evaluation.comparison.recommended_plan_id}</p></div><button className="secondary-button" onClick={() => navigate('evaluation-progress')}>View evaluation progress</button></div><section className="plans-grid">{evaluation.comparison.plans.map((plan) => <article className="plan-card" key={plan.plan_id}><div className="plan-top"><div className="plan-id">{plan.plan_id}</div><span className={`plan-status ${plan.outcome === 'passed' ? 'passed' : 'blocked'}`}>{plan.outcome}</span></div><h3>{plan.label}</h3><p className="plan-detail">Net avoided loss: {money(plan.net_avoided_loss_inr)}</p><div className="checks-row">{plan.check_outcome_counts.passed} passed · {plan.check_outcome_counts.needs_review} need review · {plan.check_outcome_counts.blocked} blocked</div></article>)}</section><div className="section-heading"><div><h2>Findings</h2><p>{evaluation.findings.length} findings from the evaluation fixture.</p></div></div><div className="finding-list">{evaluation.findings.map((finding) => <button className="finding-link" key={finding.finding_id} onClick={() => setSelectedFinding(finding)}><strong>{finding.title}</strong><span>{finding.finding_id} · {finding.check_code} · {finding.outcome}</span></button>)}</div></> : evaluationState === 'loading' ? <p>Loading evaluation fixture…</p> : null}
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
            <div className="page-title-row"><div><p className="eyebrow">WORKSPACE / SUPPLY GRAPH</p><h1>Supply graph</h1><p className="subtitle">Facilities and supply relationships from the SCN-DEMO-001 fixture.</p></div></div>
            {graph ? <>
              <p className="subtitle">{graph.nodes.length} facilities · {graph.edges.length} supply links · Direction: {graph.edge_direction.replace(/_/g, ' ')}</p>
              <SupplyGraphView graph={graph} selectedNodeId={selectedGraphNode?.node_id ?? null} onSelectNode={setSelectedGraphNode} />
              {selectedGraphNode && <section className="facility-details" aria-live="polite" aria-label="Selected facility details">
                <div className="facility-details-header"><div><p className="eyebrow">SELECTED FACILITY</p><h2>{selectedGraphNode.label}</h2></div><button className="secondary-button" onClick={() => setSelectedGraphNode(null)}>Clear selection</button></div>
                <dl><div><dt>Facility ID</dt><dd>{selectedGraphNode.node_id}</dd></div><div><dt>Organization</dt><dd>{selectedGraphNode.org_name}</dd></div><div><dt>Country</dt><dd>{selectedGraphNode.country}</dd></div><div><dt>Role</dt><dd>{selectedGraphNode.role.replace(/_/g, ' ')}</dd></div>{selectedGraphNode.supplier_id && <div><dt>Supplier</dt><dd>{selectedGraphNode.supplier_id}</dd></div>}</dl>
              </section>}
              <div className="section-heading"><div><h2>Source records</h2><p>Fixture sources referenced by supply links.</p></div></div>
              {graph.sources.map((source) => <article className="evidence-finding" key={source.source_id}><h4>{source.title}</h4><p>{source.source_id} · {source.kind} · as of {source.as_of}</p></article>)}
            </> : <p>{graphError || 'Loading supply graph fixture…'}</p>}
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
          <div className="evidence-header"><div><p className="eyebrow">HUMAN APPROVAL · {approvalPlan.plan_id}</p><h2 id="approval-title">Review {approvalPlan.label}</h2></div><button className="secondary-button" onClick={() => setApprovalPlan(null)} aria-label="Close approval dialog">Close</button></div>
          <dl className="finding-details"><div><dt>Plan status</dt><dd>{approvalPlan.status.replace(/_/g, ' ')}</dd></div><div><dt>Version</dt><dd>{approvalPlan.version}</dd></div><div><dt>Plan hash</dt><dd className="hash-value">{approvalPlan.plan_hash}</dd></div><div><dt>Net avoided loss</dt><dd>{money(approvalPlan.financials.net_avoided_loss_inr)}</dd></div></dl>
          <p id="approval-status" className={approvalPlan.status === 'blocked' ? 'blocked-reason' : 'approval-note'}>{approvalPlan.status === 'blocked' ? 'Cannot approve: this plan is blocked by its fixture checks.' : `Outcome: ${approvalPlan.outcome}. Confirm the current plan version and evidence before approval.`}</p>
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
          {policiesError && <p className="load-error" role="alert">{policiesError}</p>}
          {getApiMode() === 'stub' && <p className="approval-note">Fixture mode contains no decision response. Connect the backend in live mode to submit; no approval will be simulated here.</p>}
          {decisionError && <div className="api-error" role="alert"><strong>{decisionError.problem?.title ?? 'Decision not recorded'}</strong><p>{decisionError.problem?.detail ?? decisionError.message}</p>{['PLAN_VERSION_STALE', 'PLAN_SUPERSEDED', 'DECISION_EXISTS'].includes(decisionError.problem?.code ?? '') && <button className="secondary-button" disabled={decisionSubmitting} onClick={() => void reloadApprovalPlan()}>Reload current plan</button>}</div>}
          <div className="approval-actions"><button className="secondary-button" disabled={decisionSubmitting} onClick={() => setApprovalPlan(null)}>Cancel</button><button className="primary-button" disabled={decisionSubmitting || Boolean(approvalDisabledReason) || getApiMode() === 'stub'} title={approvalDisabledReason || (getApiMode() === 'stub' ? 'Fixture mode has no decision endpoint response.' : undefined)} onClick={() => void submitApproval()}>{decisionSubmitting ? 'Submitting…' : 'Approve plan'}</button></div>
          {approvalDisabledReason && <p className="field-hint">{approvalDisabledReason}</p>}
        </section></div>}
        {selectedFinding && <div className="drawer-backdrop" role="presentation" onClick={() => setSelectedFinding(null)}><aside className="evidence-drawer" role="dialog" aria-modal="true" aria-labelledby="finding-drawer-title" onClick={(event) => event.stopPropagation()}>
          <div className="evidence-header"><div><p className="eyebrow">EVALUATION EVIDENCE</p><h2 id="finding-drawer-title">Finding details</h2></div><button className="secondary-button" onClick={() => setSelectedFinding(null)} aria-label="Close finding details">Close</button></div>
          <span className={`finding-outcome ${selectedFinding.outcome}`}>{displayOutcome(selectedFinding.outcome)}</span>
          <h3>{selectedFinding.title}</h3>
          <dl className="finding-details"><div><dt>Finding ID</dt><dd>{selectedFinding.finding_id}</dd></div><div><dt>Check</dt><dd>{selectedFinding.check_code}</dd></div><div><dt>Subject</dt><dd>{selectedFinding.subject.type}: {selectedFinding.subject.id}</dd></div><div><dt>Agent</dt><dd>{selectedFinding.agent.replace(/_/g, ' ')}</dd></div></dl>
          <section className="evidence-section"><h3>Why</h3><p>{selectedFinding.title}</p>{Object.entries(selectedFinding.details).length > 0 && <dl className="detail-list">{Object.entries(selectedFinding.details).map(([key, value]) => <div key={key}><dt>{key.replace(/_/g, ' ')}</dt><dd>{typeof value === 'string' ? value : JSON.stringify(value)}</dd></div>)}</dl>}</section>
          <section className="evidence-section"><h3>Evidence records</h3>{missingEvidenceIds.length > 0 && <p className="evidence-missing" role="alert">Evidence missing: {missingEvidenceIds.join(', ')}. This referenced record could not be resolved from the evaluation payload.</p>}
            {linkedEvidence.length === 0 && missingEvidenceIds.length === 0 && <p>No evidence IDs are recorded for this finding.</p>}
            {linkedEvidence.map((item) => <article className="evidence-record" key={item.evidence_id}><div className="evidence-record-heading"><strong>{item.title}</strong><span>{item.evidence_id}</span></div><p className="evidence-meta">{item.kind.replace(/_/g, ' ')} · {item.authority}{item.synthetic ? ' · Synthetic' : item.authority === 'secondary' ? ' · Secondary source' : ''}</p>{item.source_ids.length > 0 && <p className="evidence-meta">Source IDs: {item.source_ids.join(', ')}</p>}{item.excerpt && <blockquote>{item.excerpt}</blockquote>}</article>)}
          </section>
          {lcEvidence.length > 0 && <section className="evidence-section lc-panel"><h3>Letter-of-credit fields</h3><p>Contractual field excerpts attached to this finding; no unreferenced LC text is inferred.</p>{lcEvidence.map((item) => {
            const tag = item.locator.field_tag
            return <div className="lc-field" key={item.evidence_id}><strong>{typeof tag === 'string' ? tag : 'LC field'}</strong><code>{item.excerpt ?? 'No excerpt returned.'}</code><span>{item.title} · {item.synthetic ? 'Synthetic' : item.authority}</span></div>
          })}</section>}
          {selectedFinding.subject.type === 'route_option' && <section className="evidence-section rules-panel"><h3>Trade-rule results</h3>{selectedRouteRules ? <>
            <p>Route {selectedFinding.subject.id} · applicable on {selectedRouteRules.query.applicable_on} · origin {selectedRouteRules.query.origin_country} · transit {selectedRouteRules.query.transit_countries.join(', ') || 'none recorded'}.</p>
            <div className="table-scroll" role="region" aria-label="Scrollable route rules table" tabIndex={0}><table className="audit-table"><caption>Rules included in the evaluation response</caption><thead><tr><th scope="col">Rule</th><th scope="col">Type / rate</th><th scope="col">Effective</th><th scope="col">Authority</th><th scope="col">Result</th></tr></thead><tbody>{selectedRouteRules.applicable.map((rule) => {
              const rate = rule.structured.rate_bps
              return <tr key={rule.rule_id}><td>{rule.rule_id}<small>{rule.citation.title}{rule.citation.synthetic ? ' · Synthetic' : ''}</small></td><td>{rule.rule_type}{typeof rate === 'number' ? ` · ${rate / 100}%` : ''}</td><td>{rule.effective_from} – {rule.effective_to ?? 'open'}</td><td>{rule.authority_level}</td><td>Applied</td></tr>
            })}{selectedRouteRules.excluded.map((rule) => {
              const reason = rule.reason === 'superseded' ? 'Superseded' : rule.reason === 'draft' ? 'Draft — not in force' : rule.reason === 'lower_authority' ? 'Lower authority' : rule.reason.replace(/_/g, ' ')
              return <tr key={rule.rule_id}><td>{rule.rule_id}</td><td>Metadata not included in result</td><td>Not returned</td><td>Not returned</td><td>{reason}</td></tr>
            })}</tbody></table></div>
            {selectedRouteRules.excluded.length > 0 && <p className="evidence-meta">Excluded-rule dates and authority are not included in the evaluation API result; their exclusion reasons above are shown verbatim from that result.</p>}
            {selectedRouteRules.conflicts.length > 0 && <div><h4>Resolved conflicts</h4>{selectedRouteRules.conflicts.map((conflict) => <p key={`${conflict.family_id}-${conflict.selected_rule_id}`}>Resolved: {conflict.reason} · selected {conflict.selected_rule_id} over {conflict.excluded_rule_ids.join(', ')}.</p>)}</div>}
            {selectedRouteRules.missing_rule_types.length > 0 && <p className="evidence-missing">No result for: {selectedRouteRules.missing_rule_types.join(', ')}</p>}
          </> : <p>No route-specific rule result was included for this subject in the evaluation response.</p>}</section>}
          <section className="evidence-section"><h3>Remedies</h3>{selectedFinding.remedies.length ? selectedFinding.remedies.map((remedy, index) => <article className="remedy-item" key={`${selectedFinding.finding_id}-${index}`}><strong>{remedy.action.replace(/_/g, ' ')}</strong><p>{remedy.text}</p></article>) : <p>No remedies recorded for this finding.</p>}</section>
        </aside></div>}
      </main>
    </div>
  )
}

export default App
