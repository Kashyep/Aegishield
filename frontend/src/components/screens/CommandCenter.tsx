import { AlertTriangle } from 'lucide-react'
import { PageHeader, PageBody } from '../layout';
import { MetricCard } from '../shared/MetricCard';
import { NeuCard } from '../ui/NeuCard';
import { NeuButton } from '../ui/NeuButton';
import { NeuChip } from '../ui/NeuChip';
import { type Screen } from '../../app/navigation';
import type { EarlyWarning, Evaluation, Finding, Plan, PlanComparisonItem } from '../../api/types';

import { getPlanJustification, type PlanJustification } from './justifications';
export type { PlanJustification };
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
  openApproval: (planId: string, triggerElement?: HTMLElement | null, mode?: 'approve' | 'amend') => void;
  actorCanApprove: boolean;
  actorCanAmend: boolean;
  decisionSubmitting?: boolean;
  startPlanExecution: (plan: Plan) => void;
  executionSubmitting: boolean;
  planWarnings?: Record<string, EarlyWarning[]>;
  evaluationRun?: boolean;
  inspectedPlanIds?: string[];
  onInspectPlan?: (planId: string) => void;
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
  decisionSubmitting = false,
  startPlanExecution,
  executionSubmitting,
  planWarnings,
  evaluationRun = true,
  inspectedPlanIds = [],
  onInspectPlan,
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
          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
            {!evaluationRun && (
              <NeuButton variant="primary" disabled={!!demoBusy} onClick={runEvaluation}>
                {demoBusy === 'evaluate' ? 'Evaluating…' : 'Run evaluation'}
              </NeuButton>
            )}
            {recommendedPlanId && (evaluationRun || inspectedPlanIds.includes(recommendedPlanId)) && (
              <NeuChip variant="success" className="recommendation-label">{formatPlanId(recommendedPlanId)} · Recommended</NeuChip>
            )}
          </div>
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
            const isVerdictVisible = Boolean(evaluationRun || inspectedPlanIds.includes(plan.plan_id));
            const isBlocked = isVerdictVisible && (fullPlan?.status === 'blocked' || plan.outcome === 'blocked');
            const approveDisabledReason = !fullPlan
              ? 'Plan details are still loading.'
              : decisionSubmitting
                ? 'Approval in progress.'
                : !actorCanApprove
                  ? 'Only Supply Planner or Trade Compliance Officer can approve.'
                  : ['approved', 'executing', 'completed'].includes(fullPlan.status)
                    ? 'Already approved.'
                    : isBlocked || fullPlan.status === 'blocked'
                      ? 'Plan is blocked.'
                      : fullPlan.status !== 'pending_approval'
                        ? `Plan is ${fullPlan.status.replace(/_/g, ' ')}, not pending approval.`
                        : '';
            const planStatus = isVerdictVisible ? (fullPlan?.status ?? plan.outcome) : 'pending_analysis';
            const planStatusClass = planStatus.toLowerCase().replace(/_/g, '-');
            const worstCaseExposure = getWorstCaseExposure(plan, fullPlan);
            const baselineLoss = evaluation?.assessment?.baseline_loss_inr ?? evaluation?.comparison?.baseline_loss_inr ?? 1160000;
            const planExposures = fullPlan?.financials?.exposures?.filter((e) => e.amount_inr !== null) ?? [];

            // FB-03: Priority colour coding (MAX 2 recommended)
            const isHighlyRecommended = plan.plan_id === recommendedPlanId || (recommendedPlanId === null && plan.outcome === 'passed');
            const priorityDesign = isHighlyRecommended ? 'Positive' : 'Critical';
            const priorityLabel = isHighlyRecommended ? 'Highly Recommended' : 'Alternate';
            const cardLeftAccent = isHighlyRecommended
              ? '4px solid var(--sapPositiveColor, #107e3e)'
              : '4px solid var(--sapCriticalColor, #e9730c)';

            return (
             <ui5-card
  key={plan.plan_id}
  className="plan-card interactive"
  style={{ width: '100%', borderLeft: cardLeftAccent }}
>
                <div className="plan-top" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div className="plan-id" style={{ width: 35, height: 35, borderRadius: 'var(--radius-md)', color: 'var(--sapInformativeTextColor, #00386b)', background: 'var(--color-info-bg)', fontWeight: 'var(--weight-extrabold)', fontFamily: 'var(--font-heading)', display: 'grid', placeItems: 'center' }}>
                    {formatPlanId(plan.plan_id)}
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
                    <ui5-tag design={priorityDesign} className="priority-tag">{priorityLabel}</ui5-tag>
                    <NeuChip
                      variant={
                        !isVerdictVisible ? 'neutral' :
                        planStatusClass === 'passed' || planStatusClass === 'approved' || planStatusClass === 'completed' ? 'success' :
                        planStatusClass === 'blocked' || planStatusClass === 'rejected' || planStatusClass === 'failed' ? 'error' :
                        'warning'
                      }
                    >
                      {!isVerdictVisible ? 'Pending analysis' : planStatus.replace(/_/g, ' ')}
                    </NeuChip>
                  </div>
                </div>
                <h3 style={{ margin: 'var(--space-4) 0 var(--space-2)', fontSize: 'var(--text-md)', fontFamily: 'var(--font-heading)' }}>{plan.label}</h3>
                <p className="plan-detail" style={{ minHeight: 36, color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-relaxed)' }}>
                  {!isVerdictVisible ? `Analysis workspace alternate · Feasibility model vs ${money(baselineLoss)} baseline.` : `Recovery plan from evaluation ${evaluation?.evaluation_id}.`}
                </p>

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
                      {isVerdictVisible ? (
                        <strong className={`outcome-val ${plan.outcome}`} style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)', fontFamily: 'var(--font-heading)', color: plan.outcome === 'blocked' ? 'var(--color-error)' : plan.outcome === 'passed' ? 'var(--color-success)' : 'var(--color-text)' }}>{plan.outcome.toUpperCase()}</strong>
                      ) : (
                        <strong className="outcome-val pending" style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)', fontFamily: 'var(--font-heading)', color: 'var(--color-text-muted)' }}>PENDING</strong>
                      )}
                    </div>
                  </div>
                </div>

                {/* Allocation table */}
                {fullPlan && fullPlan.lines.length > 0 && (
                  <div style={{ marginTop: 'var(--space-3)', borderTop: '1px solid var(--color-border-light)', paddingTop: 'var(--space-3)' }}>
                    <h4 style={{ margin: '0 0 var(--space-2)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-heading)', color: 'var(--color-text)' }}>Allocation</h4>
                    <div className="ae-table-wrap" role="region" aria-label="Allocation table" tabIndex={0} style={{ maxHeight: '200px', overflow: 'auto' }}>
                      <table className="ae-table" style={{ fontSize: 'var(--text-sm)' }}>
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

                {/* 60-80 Word Justification (FB-04) */}
                {(() => {
                  const justification = getPlanJustification(plan.plan_id);
                  return (
                    <div
                      className="ae-justification"
                      data-testid={`plan-justification-${plan.plan_id}`}
                      style={{
                        marginTop: 'var(--space-3)',
                        padding: 'var(--space-3)',
                        background: 'var(--sapTile_Background, #ffffff)',
                        border: '1px solid var(--color-border-light, #d1d9cc)',
                        borderRadius: 'var(--radius-md)',
                      }}
                    >
                      <h4 style={{ margin: '0 0 var(--space-2)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-heading)', color: 'var(--color-text)' }}>
                        Plan Justification ({justification.wordCount} words)
                      </h4>
                      <p style={{ margin: '0 0 var(--space-2)', fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-relaxed)' }}>
                        <strong style={{ color: 'var(--sapPositiveTextColor, #106634)' }}>Why it helps: </strong>
                        {justification.whyItHelps}
                      </p>
                      <p style={{ margin: 0, fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-relaxed)' }}>
                        <strong style={{ color: 'var(--sapCriticalTextColor, #8a3b00)' }}>What could go wrong: </strong>
                        {justification.whatCouldGoWrong}
                      </p>
                    </div>
                  );
                })()}

                <div className="checks-row" style={{ margin: 'var(--space-3) 0', color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-accent)' }}>
                  {isVerdictVisible
                    ? `${plan.check_outcome_counts.passed} passed · ${plan.check_outcome_counts.needs_review} need review · ${plan.check_outcome_counts.blocked} blocked`
                    : `Feasibility & profitability model vs ${money(baselineLoss)} baseline · Run evaluation or inspect plan for verification checks`}
                </div>

                <div className="plan-actions" style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                  <NeuButton design="Default" variant="secondary" onClick={() => { if (fullPlan) setSelectedPlan(fullPlan); onInspectPlan?.(plan.plan_id); }} style={{ flex: 1 }}>
                    Review evidence
                  </NeuButton>
                  {!isVerdictVisible ? (
                    <NeuButton variant="primary" onClick={() => onInspectPlan?.(plan.plan_id)} style={{ flex: 1 }}>
                      Inspect plan
                    </NeuButton>
                  ) : (fullPlan?.status === 'approved' || fullPlan?.status === 'completed') ? (
                    <NeuButton variant="primary" disabled={executionSubmitting || apiMode === 'stub'} onClick={() => { if (fullPlan) void startPlanExecution(fullPlan) }} style={{ flex: 1 }}>
                      {fullPlan.status === 'completed' ? 'View execution' : 'Start simulated execution'}
                    </NeuButton>
                  ) : isBlocked ? (
                    <>
                      <NeuButton
                        design="Positive"
                        disabled={true}
                        title={approveDisabledReason || undefined}
                        {...{ accessibleDescription: approveDisabledReason || undefined }}
                        style={{ flex: 1 }}
                      >
                        Approve
                      </NeuButton>
                      <NeuButton
                        design="Default"
                        disabled={!fullPlan || !actorCanApprove}
                        onClick={(event) => openApproval(plan.plan_id, event.currentTarget as HTMLElement)}
                        style={{ flex: 1 }}
                      >
                        Attempt approval
                      </NeuButton>
                    </>
                  ) : (
                    <NeuButton
                      design="Positive"
                      disabled={Boolean(approveDisabledReason)}
                      title={approveDisabledReason || undefined}
                      {...{ accessibleDescription: approveDisabledReason || undefined }}
                      onClick={(event) => openApproval(plan.plan_id, event.currentTarget as HTMLElement)}
                      style={{ flex: 1 }}
                    >
                      Approve
                    </NeuButton>
                  )}
                  {isVerdictVisible && isBlocked && fullPlan && evaluation?.findings.some((finding) => fullPlan.finding_ids.includes(finding.finding_id) && finding.outcome === 'blocked' && finding.check_code.startsWith('LC.')) && (
                    <NeuButton
                      design="Default"
                      disabled={!actorCanAmend}
                      title={actorCanAmend ? undefined : 'Switch to the trade compliance officer to request an LC amendment.'}
                      onClick={(event) => openApproval(plan.plan_id, event.currentTarget as HTMLElement, 'amend')}
                      style={{ flex: 1 }}
                    >
                      Request LC amendment
                    </NeuButton>
                  )}
                </div>

                {isVerdictVisible && isBlocked && (
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
        {evaluationRun && evaluation?.comparison && (evaluation.comparison.paper_advantage_of_best_blocked_plan_inr ?? 0) > 0 && (
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