import { PageHeader, PageBody } from '../layout';
import { NeuCard } from '../ui/NeuCard';
import { NeuButton } from '../ui/NeuButton';
import { NeuChip } from '../ui/NeuChip';
import { type Screen } from '../../app/navigation';
import type { Evaluation, Finding, Plan, PlanComparisonItem } from '../../api/types';

interface EvaluationsScreenProps {
  evaluation: Evaluation | null;
  evaluationState: string;
  evaluationError: string;
  navigate: (screen: Screen) => void;
  money: (amount: number) => string;
  formatPlanId: (id: string) => string;
  getWorstCaseExposure: (plan: PlanComparisonItem, fullPlan?: Plan) => number;
  setSelectedFinding: (finding: Finding | null) => void;
}

export function EvaluationsScreen({
  evaluation,
  evaluationState,
  evaluationError,
  navigate,
  money,
  formatPlanId,
  getWorstCaseExposure,
  setSelectedFinding,
}: EvaluationsScreenProps) {
  if (evaluationState === 'loading') {
    return (
      <PageBody>
        <PageHeader title="Evaluations" subtitle="Review the completed synthetic recovery evaluation and its findings." />
        <NeuCard variant="subtle" className="progress-state" role="status" style={{ padding: 'var(--space-5)' }}>
          Loading evaluation fixture…
        </NeuCard>
      </PageBody>
    );
  }

  const hasFindings = Boolean(evaluation?.findings?.length);

  return (
    <>
      <PageHeader
        eyebrow="WORKSPACE / EVALUATIONS"
        title="Evaluations"
        subtitle="Review the completed synthetic recovery evaluation and its findings."
      >
        <NeuButton variant="secondary" onClick={() => navigate('evaluation-progress')}>
          View evaluation progress
        </NeuButton>
      </PageHeader>

      {evaluationError && <p className="load-error progress-error" role="alert" style={{ color: 'var(--color-error-text)', marginBottom: 'var(--space-4)' }}>{evaluationError}</p>}

      <PageBody>

        {evaluation && (
          <>
            <NeuCard variant="raised" style={{ marginBottom: 'var(--space-section)', padding: 'var(--space-5)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                <div>
                  <h2 style={{ marginBottom: 'var(--space-1)', fontSize: 'var(--text-lg)', fontFamily: 'var(--font-heading)' }}>
                    {evaluation.evaluation_id} · {evaluation.status}
                  </h2>
                  <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                    Baseline loss: {money(evaluation.comparison.baseline_loss_inr)} · Recommended plan: {evaluation.comparison.recommended_plan_id ? formatPlanId(evaluation.comparison.recommended_plan_id) : '—'}
                  </p>
                </div>
              </div>
            </NeuCard>

            <PageHeader title="Recovery plan comparison" subtitle="Financial attractiveness alone does not establish executability." />

            <div className="plans-grid" style={{ marginTop: 'var(--space-4)' }}>
              {evaluation.comparison.plans.map((plan) => {
                const fullPlan = evaluation.plans.find((candidate) => candidate.plan_id === plan.plan_id);
                const isBlocked = fullPlan?.status === 'blocked' || plan.outcome === 'blocked';
                const planStatus = fullPlan?.status ?? plan.outcome;
                const worstCaseExposure = getWorstCaseExposure(plan, fullPlan);

                return (
                  <NeuCard as="article" key={plan.plan_id} variant="raised" className="plan-card interactive" style={{ padding: 'var(--space-5)' }}>
                    <div className="plan-top" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div className="plan-id" style={{ width: 35, height: 35, borderRadius: 'var(--radius-md)', color: 'var(--color-info)', background: 'var(--color-info-bg)', fontWeight: 'var(--weight-extrabold)', fontFamily: 'var(--font-heading)', display: 'grid', placeItems: 'center' }}>
                        {formatPlanId(plan.plan_id)}
                      </div>
                      <NeuChip
                        variant={
                          planStatus === 'passed' || planStatus === 'approved' || planStatus === 'completed' ? 'success' :
                          planStatus === 'blocked' || planStatus === 'rejected' || planStatus === 'failed' ? 'error' :
                          'warning'
                        }
                      >
                        {planStatus.replace(/_/g, ' ')}
                      </NeuChip>
                    </div>
                    <h3 style={{ margin: 'var(--space-4) 0 var(--space-2)', fontSize: 'var(--text-md)', fontFamily: 'var(--font-heading)' }}>{plan.label}</h3>
                    <p className="plan-detail" style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-relaxed)' }}>Net avoided loss: {money(plan.net_avoided_loss_inr)}</p>

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

                    <div className="checks-row" style={{ margin: 'var(--space-3) 0', color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-accent)' }}>
                      {plan.check_outcome_counts.passed} passed · {plan.check_outcome_counts.needs_review} need review · {plan.check_outcome_counts.blocked} blocked
                    </div>
                  </NeuCard>
                );
              })}
            </div>

            <PageHeader title="Findings" subtitle={`${evaluation.findings.length} findings from the evaluation fixture.`} />

            {hasFindings ? (
              <div className="finding-list" style={{ display: 'grid', gap: 'var(--space-2)' }}>
                {evaluation.findings.map((finding) => (
                  <button
                    key={finding.finding_id}
                    className="finding-link"
                    onClick={() => setSelectedFinding(finding)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: 'var(--space-1)',
                      width: '100%',
                      padding: 'var(--space-3) var(--space-4)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-lg)',
                      color: 'var(--color-text)',
                      background: 'var(--color-bg-elevated)',
                      textAlign: 'left',
                      fontFamily: 'var(--font-body)',
                      cursor: 'pointer',
                      transition: 'border-color var(--duration-fast), background var(--duration-fast)',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.background = 'var(--color-primary-light)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.background = 'var(--color-bg-elevated)'; }}
                  >
                    <strong>{finding.title}</strong>
                    <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-accent)' }}>{finding.finding_id} · {finding.check_code} · {finding.outcome}</span>
                  </button>
                ))}
              </div>
            ) : (
              <NeuCard variant="subtle" className="progress-state" role="status" style={{ padding: 'var(--space-5)' }}>
                No findings were returned for this evaluation.
              </NeuCard>
            )}
          </>
        )}
        {!evaluation && !evaluationError && (
          <NeuCard variant="subtle" className="progress-state" role="status" style={{ padding: 'var(--space-5)' }}>
            No completed evaluation is available yet.
          </NeuCard>
        )}
      </PageBody>
    </>
  );
}