import { AlertTriangle } from 'lucide-react'
import { PageHeader, PageBody } from '../layout';
import { MetricCard } from '../shared/MetricCard';
import { NeuCard } from '../ui/NeuCard';
import { NeuButton } from '../ui/NeuButton';
import { NeuChip } from '../ui/NeuChip';
import { type Screen } from '../../app/navigation';
import type { EarlyWarning, Evaluation, Finding, Plan, PlanComparisonItem } from '../../api/types';

interface CommandCenterProps {
  evaluation: Evaluation | null;
  evaluationError: string;
  runEvaluation: () => void;
  confirmReset: () => void;
  demoBusy: string;
  availableDisruptionId: string | null;
  navigate: (screen: Screen) => void;
  selectedPlan: Plan | null;
  setSelectedPlan: (plan: Plan | null) => void;
  setSelectedFinding: (finding: Finding | null) => void;
  apiMode: string;
  money: (amount: number) => string;
  formatPlanId: (id: string) => string;
  getWorstCaseExposure: (plan: PlanComparisonItem, fullPlan?: Plan) => number;
  openApproval: (planId: string) => void;
  actorCanApprove: boolean;
  actorCanAmend: boolean;
  startPlanExecution: (plan: Plan) => void;
  executionSubmitting: boolean;
  planWarnings?: Record<string, EarlyWarning[]>;
}

export function CommandCenter({
  evaluation,
  evaluationError,
  runEvaluation,
  confirmReset,
  demoBusy,
  availableDisruptionId,
  navigate,
  selectedPlan,
  setSelectedPlan,
  setSelectedFinding,
  apiMode,
  money,
  formatPlanId,
  getWorstCaseExposure,
  openApproval,
  actorCanApprove,
  actorCanAmend,
  startPlanExecution,
  executionSubmitting,
  planWarnings,
}: CommandCenterProps) {
  const plans = evaluation?.comparison?.plans ?? [];
  const recommendedPlanId = evaluation?.comparison?.recommended_plan_id;

  return (
    <>
      <PageHeader
        eyebrow="SUPPLY CHAIN RESILIENCE"
        title="Command Center"
        subtitle="Assess disruption, compare recovery plans, and review evidence before approval."
      >
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          {apiMode === 'live' && (
            <>
              <NeuButton variant="secondary" disabled={!!demoBusy} onClick={confirmReset}>
                {demoBusy === 'reset' ? 'Resetting…' : 'Reset demo'}
              </NeuButton>
              <NeuButton
                variant="primary"
                disabled={!!demoBusy || !(evaluation?.disruption_id ?? availableDisruptionId)}
                onClick={runEvaluation}
              >
                {demoBusy === 'evaluate' ? 'Evaluating…' : 'Run evaluation'}
              </NeuButton>
            </>
          )}
        </div>
      </PageHeader>

      <PageBody>
        
{/* Disruption Card */}
{!evaluation?.assessment ? (
  <ui5-card
    className="disruption-card-neutral"
    style={{ width: '100%' }}
  >
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      padding: '20px',
    }}>
      <div className="disruption-icon" aria-hidden="true">ℹ</div>
      <div className="disruption-copy" style={{ flex: 1 }}>
        <span className="eyebrow">COMMAND CENTER</span>
        <h2>Run the evaluation</h2>
        <p>Assess disruption, compare recovery plans, and review evidence before approval.</p>
      </div>
    </div>
  </ui5-card>
) : (
  <ui5-card
    className="disruption-card"
    style={{ width: '100%' }}
  >
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: '16px',
      padding: '20px',
    }}>
      <div className="disruption-icon" aria-hidden="true">
        <AlertTriangle size={22} strokeWidth={2} />
      </div>

      <div className="disruption-copy" style={{ flex: 1 }}>
        <span className="eyebrow" style={{ color: 'var(--sapNegativeColor)' }}>
          ACTIVE DISRUPTION · {evaluation.assessment.disruption_id}
        </span>

        <h2>{evaluation.assessment.event_type.replace(/_/g, ' ')} detected</h2>

        <div className="disruption-facility-row">
          <span>Disrupted facility: <strong>{evaluation.assessment.disrupted_node_ids.join(', ') || 'Unknown'}</strong></span>
          <span>Affected supplier: <strong>{evaluation.assessment.affected_supplier_ids.join(', ')}</strong></span>
          {evaluation.assessment.evidence?.[0] && (
            <span>Source: <strong>{evaluation.assessment.evidence[0].title}</strong></span>
          )}
        </div>

        {evaluation.assessment.evidence?.[0]?.excerpt && (
          <blockquote style={{
            margin: '12px 0 0',
            padding: '12px',
            borderLeft: '3px solid var(--sapNegativeColor)',
            fontSize: 'var(--text-sm)',
            lineHeight: 'var(--leading-relaxed)',
          }}>
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

      <NeuChip variant="error" className="severity-badge">
        {evaluation.assessment.severity} severity
      </NeuChip>
    </div>
  </ui5-card>
)}

        {/* What happens next */}
        <NeuCard variant="subtle" style={{ marginTop: 'var(--space-section)', padding: 'var(--space-4)' }}>
          <strong style={{ display: 'block', marginBottom: 'var(--space-2)', color: 'var(--color-text)', fontFamily: 'var(--font-heading)' }}>What happens next</strong>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
            <span>1. Disruption sensing</span>
            <span>2. Supplier dependency</span>
            <span>3. Routing</span>
            <span>4. Inventory rebalancing</span>
            <span>5. Trade compliance</span>
            <span>6. Plan assembly</span>
            <span>7. Explanation</span>
          </div>
        </NeuCard>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-2)', marginTop: 'var(--space-section)' }}>
          <p style={{ margin: 0, color: 'var(--color-text-muted)', fontFamily: 'var(--font-accent)' }}>{evaluation ? `${evaluation.evaluation_id} · ${evaluation.status}` : 'No evaluation'}</p>
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <NeuButton variant="secondary" onClick={() => navigate('evaluations')}>View evaluation details ↗</NeuButton>
            <NeuButton variant="primary" onClick={() => navigate('evaluation-progress')}>View evaluation progress</NeuButton>
          </div>
        </div>
        {/* Metrics Grid */}
        <div className="metrics-grid" style={{ marginTop: 'var(--space-section)' }}>
          <MetricCard
            label="Baseline loss"
            value={evaluation?.assessment ? money(evaluation.assessment.baseline_loss_inr) : evaluation ? money(evaluation.comparison.baseline_loss_inr) : '—'}
            note="Estimated disruption impact"
          />
          <MetricCard
            label="Recovery plans"
            value={evaluation ? evaluation.comparison.plans.length : '—'}
            note="Evaluated against required checks"
          />
          <MetricCard
            label="Recommended plan"
            value={recommendedPlanId ? formatPlanId(recommendedPlanId) : '—'}
            note="AegisShield verified"
            variant="success"
          />
        </div>

        {/* Plans Section */}
        <PageHeader
          eyebrow=""
          title="Recovery plan comparison"
          subtitle="Financial attractiveness alone does not establish executability."
        >
          {recommendedPlanId && <NeuChip variant="success" className="recommendation-label">{formatPlanId(recommendedPlanId)} · Recommended</NeuChip>}
        </PageHeader>

        {evaluationError && <p className="load-error" role="alert" style={{ color: 'var(--color-error-text)' }}>{evaluationError}</p>}

        {plans.length === 0 && (
          <NeuCard variant="subtle" className="progress-state" role="status" style={{ marginTop: 'var(--space-4)', padding: 'var(--space-5)' }}>
            No recovery plans are available for this evaluation yet.
          </NeuCard>
        )}

        <div className="plans-grid" style={{ marginTop: 'var(--space-4)' }} aria-live="polite">
          {plans.map((plan) => {
            const fullPlan = evaluation?.plans?.find((candidate) => candidate.plan_id === plan.plan_id);
            const isBlocked = fullPlan?.status === 'blocked' || plan.outcome === 'blocked';
            const planStatus = fullPlan?.status ?? plan.outcome;
            const planStatusClass = planStatus.toLowerCase().replace(/_/g, '-');
            const worstCaseExposure = getWorstCaseExposure(plan, fullPlan);
            const planExposures = fullPlan?.financials?.exposures?.filter((e) => e.amount_inr !== null) ?? [];

            return (
             <ui5-card
  key={plan.plan_id}
  className="plan-card interactive"
  style={{ width: '100%' }}
>
                <div className="plan-top" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div className="plan-id" style={{ width: 35, height: 35, borderRadius: 'var(--radius-md)', color: 'var(--color-info)', background: 'var(--color-info-bg)', fontWeight: 'var(--weight-extrabold)', fontFamily: 'var(--font-heading)', display: 'grid', placeItems: 'center' }}>
                    {formatPlanId(plan.plan_id)}
                  </div>
                  <NeuChip
                    variant={
                      planStatusClass === 'passed' || planStatusClass === 'approved' || planStatusClass === 'completed' ? 'success' :
                      planStatusClass === 'blocked' || planStatusClass === 'rejected' || planStatusClass === 'failed' ? 'error' :
                      'warning'
                    }
                  >
                    {planStatus.replace(/_/g, ' ')}
                  </NeuChip>
                </div>
                <h3 style={{ margin: 'var(--space-4) 0 var(--space-2)', fontSize: 'var(--text-md)', fontFamily: 'var(--font-heading)' }}>{plan.label}</h3>
                <p className="plan-detail" style={{ minHeight: 36, color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-relaxed)' }}>Recovery plan from evaluation {evaluation?.evaluation_id}.</p>

                <div className="financial-block" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', padding: 'var(--space-4) 0', borderTop: '1px solid var(--color-border-light)', borderBottom: '1px solid var(--color-border-light)' }}>
                  <div className="financial-row-main" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                    <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-accent)' }}>Net avoided loss{isBlocked ? ' · on paper' : ''}</span>
                    <strong style={{ fontSize: 'var(--text-xl)', fontFamily: 'var(--font-heading)' }}>{money(plan.net_avoided_loss_inr)}</strong>
                  </div>
                  <div className="financial-breakdown" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2) var(--space-3)', marginTop: 'var(--space-1)', paddingTop: 'var(--space-2)', borderTop: '1px dashed var(--color-border-light)' }}>
                    <div className="financial-item" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                      <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-accent)' }}>Recovery cost</span>
                      <strong style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)', fontFamily: 'var(--font-heading)' }}>{money(plan.recovery_cost_inr)}</strong>
                    </div>
                    <div className="financial-item" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                      <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-accent)' }}>Residual loss</span>
                      <strong style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)', fontFamily: 'var(--font-heading)' }}>{money(plan.residual_loss_inr)}</strong>
                    </div>
                    <div className="financial-item" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                      <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-accent)' }}>Worst-case exposure</span>
                      <strong style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)', fontFamily: 'var(--font-heading)' }}>worst {money(worstCaseExposure)}</strong>
                    </div>
                    <div className="financial-item" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                      <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-accent)' }}>Outcome</span>
                      <strong className={`outcome-val ${plan.outcome}`} style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)', fontFamily: 'var(--font-heading)', color: plan.outcome === 'blocked' ? 'var(--color-error)' : plan.outcome === 'passed' ? 'var(--color-success)' : 'var(--color-text)' }}>{plan.outcome.toUpperCase()}</strong>
                    </div>
                  </div>
                </div>

                {/* Allocation table */}
                {fullPlan && fullPlan.lines.length > 0 && (
                  <div style={{ marginTop: 'var(--space-3)', borderTop: '1px solid var(--color-border-light)', paddingTop: 'var(--space-3)' }}>
                    <h4 style={{ margin: '0 0 var(--space-2)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-heading)', color: 'var(--color-text)' }}>Allocation</h4>
                    <div className="neu-table-wrap" role="region" aria-label="Allocation table" tabIndex={0} style={{ maxHeight: '200px', overflow: 'auto' }}>
                      <table className="neu-table" style={{ fontSize: 'var(--text-xs)' }}>
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
                              <td>{line.option_id}</td>
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

                {/* Exposures */}
                {planExposures.length > 0 && (
                  <div style={{ marginTop: 'var(--space-3)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--color-border-light)' }}>
                    <h4 style={{ margin: '0 0 var(--space-2)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-heading)', color: 'var(--color-text)' }}>Exposures</h4>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 'var(--space-1)' }}>
                      {planExposures.map((exp) => (
                        <li key={exp.exposure_id} style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                          <strong>{money(exp.amount_inr ?? 0)}</strong>
                          <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }}>{exp.kind.replace(/_/g, ' ')}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="checks-row" style={{ margin: 'var(--space-3) 0', color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-accent)' }}>
                  {plan.check_outcome_counts.passed} passed · {plan.check_outcome_counts.needs_review} need review · {plan.check_outcome_counts.blocked} blocked
                </div>

                <div className="plan-actions" style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <NeuButton variant="secondary" onClick={() => fullPlan && setSelectedPlan(fullPlan)} style={{ flex: 1 }}>
                    Review evidence
                  </NeuButton>
                  {(fullPlan?.status === 'approved' || fullPlan?.status === 'completed') ? (
                    <NeuButton variant="primary" disabled={executionSubmitting || apiMode === 'stub'} onClick={() => { if (fullPlan) void startPlanExecution(fullPlan) }} style={{ flex: 1 }}>
                      {fullPlan.status === 'completed' ? 'View execution' : 'Start simulated execution'}
                    </NeuButton>
                  ) : (
                    <NeuButton variant="primary" disabled={!fullPlan || isBlocked || !actorCanApprove || fullPlan.status !== 'pending_approval'} aria-describedby={isBlocked ? `blocked-reason-${plan.plan_id}` : undefined} onClick={() => openApproval(plan.plan_id)} style={{ flex: 1 }}>
                      Approve
                    </NeuButton>
                  )}
                  {isBlocked && fullPlan && evaluation?.findings.some((finding) => fullPlan.finding_ids.includes(finding.finding_id) && finding.outcome === 'blocked' && finding.check_code.startsWith('LC.')) && (
                    <NeuButton variant="secondary" disabled={!actorCanAmend} title={actorCanAmend ? undefined : 'Switch to the trade compliance officer to request an LC amendment.'} onClick={() => openApproval(plan.plan_id)} style={{ flex: 1 }}>
                      Request LC amendment
                    </NeuButton>
                  )}
                </div>

                {isBlocked && (
                  <p className="blocked-reason" id={`blocked-reason-${plan.plan_id}`} style={{ margin: 'var(--space-3) 0 0', color: 'var(--color-error-text)', fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-relaxed)' }}>
                    Cannot be approved: {plan.check_outcome_counts.blocked} blocking findings. {formatPlanId(plan.plan_id)} remains blocked.
                  </p>
                )}
                {(planWarnings?.[plan.plan_id] ?? []).map((w) => (
                  <p key={w.warning_id} className="plan-warning" role="note" style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-start', margin: 'var(--space-3) 0 0', fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>
                    <AlertTriangle size={16} aria-hidden="true" style={{ color: 'var(--color-warning)', flexShrink: 0, marginTop: 2 }} />
                    <span>Early warning (advisory): {w.label} · {w.level.toUpperCase()} {w.score}/100 via {w.exposure.affected_candidate_supplier_ids.join(', ')}. Heuristic index, not a probability; plan unchanged.</span>
                  </p>
                ))}
              </ui5-card>
            );
          })}
        </div>

        {/* Paper advantage callout */}
        {evaluation?.comparison && (evaluation.comparison.paper_advantage_of_best_blocked_plan_inr ?? 0) > 0 && (
          <NeuCard variant="subtle" style={{ marginTop: 'var(--space-section)', padding: 'var(--space-4)', borderColor: 'var(--color-warning-border)', background: 'var(--color-warning-bg)', borderWidth: 2 }}>
            <strong style={{ color: 'var(--color-warning-text)' }}>
              P1 looks {money(evaluation.comparison.paper_advantage_of_best_blocked_plan_inr ?? 0)} better on paper
            </strong>{' '}
            but is blocked by {evaluation.comparison.plans.find((p) => p.outcome === 'blocked')?.check_outcome_counts.blocked ?? 0} blocking finding{evaluation.comparison.plans.find((p) => p.outcome === 'blocked')?.check_outcome_counts.blocked !== 1 ? 's' : ''}.
          </NeuCard>
        )}

        {/* Selected Plan Evidence Panel */}
        {selectedPlan && (
          <NeuCard variant="raised-lg" className="evidence-panel" style={{ marginTop: 'var(--space-section)', maxWidth: '900px', margin: 'var(--space-section) auto 0', maxHeight: '70vh', overflow: 'auto' }}>
            <div className="evidence-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
              <h2 style={{ margin: 0, fontSize: 'var(--text-xl)', fontFamily: 'var(--font-heading)' }}>Evidence — {selectedPlan.plan_id}</h2>
              <NeuButton variant="secondary" onClick={() => setSelectedPlan(null)}>Close ✕</NeuButton>
            </div>
            <h3>{selectedPlan.label}</h3>
            <p><strong>Validation status:</strong> {selectedPlan.status}</p>
            <p><strong>Check results:</strong> {selectedPlan.check_outcome_counts.passed} passed · {selectedPlan.check_outcome_counts.needs_review} need review · {selectedPlan.check_outcome_counts.blocked} blocked</p>
            <p><strong>Financial impact:</strong> {money(selectedPlan.financials.net_avoided_loss_inr)}</p>
            <div className="evidence-findings" style={{ marginTop: 'var(--space-5)' }}>
              <h3 style={{ marginBottom: 'var(--space-4)', fontFamily: 'var(--font-heading)' }}>Plan findings</h3>
              {evaluation?.findings.filter((finding) => selectedPlan.finding_ids.includes(finding.finding_id)).map((finding) => (
              <button key={finding.finding_id} className="finding-link" onClick={() => setSelectedFinding(finding)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 'var(--space-1)', width: '100%', padding: 'var(--space-3) var(--space-4)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', color: 'var(--color-text)', background: 'var(--color-bg-elevated)', textAlign: 'left', fontFamily: 'var(--font-body)' }}>
                  {finding.title}
                  <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-accent)' }}>{finding.finding_id} · {finding.outcome}</span>
                </button>
              ))}
            </div>
          </NeuCard>
        )}
      </PageBody>
    </>
  );
}