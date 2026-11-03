import { useState, useMemo, useRef, useEffect } from 'react';
import '@ui5/webcomponents/dist/Dialog.js';
import '@ui5/webcomponents/dist/Button.js';
import '@ui5/webcomponents/dist/Tag.js';
import '@ui5/webcomponents/dist/Table.js';
import '@ui5/webcomponents/dist/TableHeaderRow.js';
import '@ui5/webcomponents/dist/TableHeaderCell.js';
import '@ui5/webcomponents/dist/TableRow.js';
import '@ui5/webcomponents/dist/TableCell.js';
import '@ui5/webcomponents/dist/Title.js';
import { PageHeader, PageBody } from '../layout';
import { NeuCard } from '../ui/NeuCard';
import { NeuButton } from '../ui/NeuButton';
import { type Screen } from '../../app/navigation';
import type { Evaluation, Finding, Plan, PlanComparisonItem } from '../../api/types';

function getFindingRelevance(finding: Finding, evaluation?: Evaluation | null): number {
  let score = 0;
  // Blocked / failed findings represent immediate critical execution barriers
  if (finding.outcome === 'blocked' || finding.outcome === 'failed') {
    score += 100;
  } else if (finding.outcome === 'needs_review' || finding.outcome === 'warning') {
    score += 50;
  } else {
    score += 10;
  }
  // Actionable remedies elevate importance
  if (finding.remedies && finding.remedies.length > 0) {
    score += 20;
  }
  // Findings concerning suppliers affected in this scenario
  if (evaluation?.assessment?.affected_supplier_ids?.includes(finding.subject.id)) {
    score += 25;
  }
  // Finding directly on the disruption ID
  if (evaluation?.assessment?.disruption_id === finding.subject.id) {
    score += 15;
  }
  return score;
}

function rankFindings(findings: Finding[], evaluation?: Evaluation | null): Finding[] {
  return [...findings].sort((a, b) => {
    const scoreA = getFindingRelevance(a, evaluation);
    const scoreB = getFindingRelevance(b, evaluation);
    if (scoreB !== scoreA) {
      return scoreB - scoreA;
    }
    return a.finding_id.localeCompare(b.finding_id);
  });
}
function getValidationStatusDesign(status: string): 'Positive' | 'Negative' | 'Critical' | 'Information' {
  const s = status.toLowerCase();
  if (s === 'passed' || s === 'approved' || s === 'completed' || s === 'positive' || s === 'pending_approval') {
    return 'Positive';
  }
  if (s === 'blocked' || s === 'rejected' || s === 'failed' || s === 'negative') {
    return 'Negative';
  }
  if (s === 'needs_review' || s === 'warning' || s === 'critical') {
    return 'Critical';
  }
  return 'Information';
}


interface UI5DialogElement extends HTMLElement {
  open?: boolean;
  show?: () => void;
  close?: () => void;
}

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

/**
 * FB-09 ARCHITECTURAL NOTE — "Step results" vs "Check results":
 *
 * Inspection outcome:
 * 1. "Step results" represents the multi-agent pipeline orchestrator's execution trace
 *    (6 stages: disruption_sensing, supplier_dependency, trade_compliance, inventory_rebalancing,
 *    plan_generation, plan_comparison) with execution metadata (status, owner, attempts, finished_at).
 * 2. "Check results" represents policy and compliance validation outcomes (passed, needs_review, blocked)
 *    evaluated for each specific recovery plan (e.g. LC rules, FTA rules of origin, ATP inventory allocation).
 *
 * Design decision:
 * - "Step results" serves a distinct, valuable purpose for execution traceability and system transparency,
 *   and is housed in the dedicated `EvaluationProgressScreen` (accessible via "View evaluation progress").
 * - It does NOT duplicate plan check results. However, displaying pipeline execution steps inside
 *   `EvaluationsScreen` would duplicate content and confuse plan validation with agent pipeline orchestration.
 * - Therefore, `EvaluationsScreen` cleanly focuses on recovery plan comparison (Validation status ->
 *   Financial status -> Check results) and scenario findings, linking to `EvaluationProgressScreen` for
 *   the pipeline agent execution trace.
 */

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
  const [showAllFindings, setShowAllFindings] = useState(false);
  const [selectedEvidencePlan, setSelectedEvidencePlan] = useState<Plan | null>(null);
  const [viewedSections, setViewedSections] = useState<Set<string>>(() => new Set());
  const dialogRef = useRef<UI5DialogElement | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const sectionId = entry.target.getAttribute('data-eval-section');
            if (sectionId) {
              setViewedSections((prev) => {
                if (prev.has(sectionId)) return prev;
                const next = new Set(prev);
                next.add(sectionId);
                return next;
              });
            }
          }
        });
      },
      {
        root: null,
        rootMargin: '0px 0px -5% 0px',
        threshold: 0.05,
      }
    );

    const sectionElements = document.querySelectorAll('[data-eval-section]');
    sectionElements.forEach((el) => {
      observer.observe(el);
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        const sectionId = el.getAttribute('data-eval-section');
        if (sectionId) {
          setViewedSections((prev) => {
            if (prev.has(sectionId)) return prev;
            const next = new Set(prev);
            next.add(sectionId);
            return next;
          });
        }
      }
    });

    return () => observer.disconnect();
  }, [evaluation]);
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (selectedEvidencePlan) {
      if (typeof el.show === 'function' && !el.open) {
        el.show();
      }
    } else {
      if (typeof el.close === 'function' && el.open) {
        el.close();
      }
    }
  }, [selectedEvidencePlan]);
  const rankedFindings = useMemo(
    () => rankFindings(evaluation?.findings ?? [], evaluation),
    [evaluation]
  );
  const DEFAULT_VISIBLE_FINDINGS = 3;
  const visibleFindings = showAllFindings
    ? rankedFindings
    : rankedFindings.slice(0, DEFAULT_VISIBLE_FINDINGS);
  const remainingCount = Math.max(0, rankedFindings.length - DEFAULT_VISIBLE_FINDINGS);
  const totalEvaluationSections = 3;
  const viewedSectionCount = ['overview', 'plans', 'findings'].filter((id) => viewedSections.has(id)).length;
  const reviewProgressPercent = Math.round((viewedSectionCount / totalEvaluationSections) * 100);
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
            {/* FB-10: Section view progress tracking via IntersectionObserver */}
            <div
              className="evaluation-review-progress ae-review-progress"
              role="region"
              aria-label="Evaluation review progress"
              style={{
                marginBottom: 'var(--space-4)',
                padding: 'var(--space-3) var(--space-4)',
                background: 'var(--sapTile_Background, var(--color-bg-elevated))',
                border: '1px solid var(--color-border-light, var(--color-border))',
                borderRadius: 'var(--radius-lg)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--sapTextColor, var(--color-text))' }}>
                    Evaluation review progress:
                  </strong>
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--sapContent_LabelColor, var(--color-text-muted))' }}>
                    {viewedSectionCount} of {totalEvaluationSections} sections viewed ({reviewProgressPercent}%)
                  </span>
                </div>
                <ui5-tag design={reviewProgressPercent === 100 ? 'Positive' : 'Information'}>
                  {reviewProgressPercent === 100 ? 'All sections viewed' : 'In review'}
                </ui5-tag>
              </div>
              <div
                role="progressbar"
                aria-valuenow={reviewProgressPercent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Evaluation review progress: ${reviewProgressPercent}%`}
                style={{
                  height: 6,
                  background: 'var(--sapNeutralBorderColor, var(--color-border-light))',
                  borderRadius: 3,
                  overflow: 'hidden',
                  marginTop: 'var(--space-2)',
                }}
              >
                <div
                  style={{
                    width: `${reviewProgressPercent}%`,
                    height: '100%',
                    background: reviewProgressPercent === 100 ? 'var(--sapPositiveColor)' : 'var(--sapInformativeColor)',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
            </div>

            {/* FB-10 Section 1: Overview */}
            <section id="section-overview" data-eval-section="overview" className="eval-view-section">
              <NeuCard variant="raised" style={{ marginBottom: 'var(--space-section)', padding: 'var(--space-5)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
                      <span
                        className={`eval-section-tick ${viewedSections.has('overview') ? 'viewed' : 'unviewed'}`}
                        data-section-tick="overview"
                        data-status={viewedSections.has('overview') ? 'viewed' : 'unviewed'}
                        aria-label={viewedSections.has('overview') ? 'Overview section viewed' : 'Overview section not yet viewed'}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          fontSize: 'var(--text-sm)',
                          fontWeight: 'bold',
                          border: viewedSections.has('overview') ? '2px solid var(--sapPositiveColor)' : '2px solid var(--sapNeutralBorderColor)',
                          background: viewedSections.has('overview') ? 'var(--sapPositiveColor)' : 'transparent',
                          color: viewedSections.has('overview') ? 'var(--sapContent_ContrastTextColor, var(--sapButton_Selected_TextColor))' : 'var(--sapContent_LabelColor)',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        {viewedSections.has('overview') ? '✓' : '○'}
                      </span>
                      <h2 style={{ margin: 0, fontSize: 'var(--text-lg)', fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <span>{evaluation.evaluation_id}</span>
                        <ui5-tag design={getValidationStatusDesign(evaluation.status)}>{evaluation.status}</ui5-tag>
                      </h2>
                    </div>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginLeft: '32px' }}>
                      Baseline loss: {money(evaluation.comparison.baseline_loss_inr)} · Recommended plan: {evaluation.comparison.recommended_plan_id ? formatPlanId(evaluation.comparison.recommended_plan_id) : '—'}
                    </p>
                  </div>
                </div>
              </NeuCard>
            </section>

            {/* FB-10 Section 2: Recovery plan comparison */}
            <section id="section-plans" data-eval-section="plans" className="eval-view-section">
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <span
                  className={`eval-section-tick ${viewedSections.has('plans') ? 'viewed' : 'unviewed'}`}
                  data-section-tick="plans"
                  data-status={viewedSections.has('plans') ? 'viewed' : 'unviewed'}
                  aria-label={viewedSections.has('plans') ? 'Recovery plans section viewed' : 'Recovery plans section not yet viewed'}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    fontSize: 'var(--text-sm)',
                    fontWeight: 'bold',
                    border: viewedSections.has('plans') ? '2px solid var(--sapPositiveColor)' : '2px solid var(--sapNeutralBorderColor)',
                    background: viewedSections.has('plans') ? 'var(--sapPositiveColor)' : 'transparent',
                    color: viewedSections.has('plans') ? 'var(--sapContent_ContrastTextColor, var(--sapButton_Selected_TextColor))' : 'var(--sapContent_LabelColor)',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {viewedSections.has('plans') ? '✓' : '○'}
                </span>
                <PageHeader title="Recovery plan comparison" subtitle="Financial attractiveness alone does not establish executability." />
              </div>

              {/* D6: Candidate plan decision matrix ui5-table */}
              <div
                className="ae-decision-matrix"
                role="region"
                aria-label="Candidate plans decision matrix"
                style={{
                  marginTop: 'var(--space-4)',
                  marginBottom: 'var(--space-4)',
                  background: 'var(--sapTile_Background, var(--color-bg-elevated))',
                  border: '1px solid var(--color-border-light, var(--color-border))',
                  borderRadius: 'var(--radius-lg)',
                  boxShadow: 'var(--sapContent_Shadow0, 0 1px 3px rgba(0,0,0,0.1))',
                  padding: 'var(--space-4)',
                }}
              >
                <div style={{ marginBottom: 'var(--space-3)' }}>
                  <ui5-title level="H4" size="H4" style={{ fontWeight: 700, color: 'var(--sapTextColor)' }}>
                    Decision matrix
                  </ui5-title>
                  <p style={{ margin: 'var(--space-1) 0 0', color: 'var(--sapContent_LabelColor, var(--color-text-muted))', fontSize: 'var(--text-sm)' }}>
                    Multi-criteria evaluation matrix comparing candidate recovery plans across financial metrics, risk exposure, and operational executability.
                  </p>
                </div>

                <ui5-table
                  accessibleName="Candidate plans decision matrix"
                  className="ae-decision-matrix-table"
                  overflowMode="Popin"
                  tabIndex={0}
                >
                  <ui5-table-header-row slot="headerRow">
                    <ui5-table-header-cell width="70px" importance={1}>Plan ID</ui5-table-header-cell>
                    <ui5-table-header-cell minWidth="140px" importance={1}>Description</ui5-table-header-cell>
                    <ui5-table-header-cell width="120px" importance={1}>Status/Outcome</ui5-table-header-cell>
                    <ui5-table-header-cell horizontalAlign="Right" style={{ textAlign: 'right' }} width="130px" importance={1}>
                      Recovery Cost (₹)
                    </ui5-table-header-cell>
                    <ui5-table-header-cell horizontalAlign="Right" style={{ textAlign: 'right' }} width="120px" importance={1}>
                      Residual Loss (₹)
                    </ui5-table-header-cell>
                    <ui5-table-header-cell horizontalAlign="Right" style={{ textAlign: 'right' }} width="140px" importance={1}>
                      Net Avoided Loss (₹)
                    </ui5-table-header-cell>
                    <ui5-table-header-cell width="110px" importance={1}>Executability</ui5-table-header-cell>
                  </ui5-table-header-row>
                  {evaluation.comparison.plans.map((plan) => {
                    const fullPlan = evaluation.plans.find((candidate) => candidate.plan_id === plan.plan_id);
                    const planStatus = fullPlan?.status ?? plan.outcome;
                    const isExecutable = plan.executable ?? (planStatus !== 'blocked' && plan.outcome !== 'blocked');
                    return (
                      <ui5-table-row key={plan.plan_id}>
                        <ui5-table-cell>
                          <span
                            className="mono"
                            style={{
                              fontFamily: "'JetBrains Mono', monospace",
                              fontWeight: 700,
                              color: 'var(--sapHighlightColor, var(--color-info))',
                            }}
                          >
                            {formatPlanId(plan.plan_id)}
                          </span>
                        </ui5-table-cell>
                        <ui5-table-cell>
                          <span style={{ fontWeight: 600, color: 'var(--sapTextColor)' }}>
                            {plan.label}
                          </span>
                        </ui5-table-cell>
                        <ui5-table-cell>
                          <ui5-tag design={getValidationStatusDesign(planStatus)}>
                            {planStatus.replace(/_/g, ' ')}
                          </ui5-tag>
                        </ui5-table-cell>
                        <ui5-table-cell horizontalAlign="Right" style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--sapTextColor)' }}>
                            {money(plan.recovery_cost_inr)}
                          </span>
                        </ui5-table-cell>
                        <ui5-table-cell horizontalAlign="Right" style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--sapTextColor)' }}>
                            {money(plan.residual_loss_inr)}
                          </span>
                        </ui5-table-cell>
                        <ui5-table-cell horizontalAlign="Right" style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: plan.net_avoided_loss_inr > 0 ? 'var(--sapPositiveColor)' : 'var(--sapTextColor)' }}>
                            {money(plan.net_avoided_loss_inr)}
                          </span>
                        </ui5-table-cell>
                        <ui5-table-cell>
                          <ui5-tag design={isExecutable ? 'Positive' : 'Negative'}>
                            {isExecutable ? 'Executable' : 'Blocked'}
                          </ui5-tag>
                        </ui5-table-cell>
                      </ui5-table-row>
                    );
                  })}
                </ui5-table>
              </div>

              <div className="plans-grid" style={{ marginTop: 'var(--space-4)' }}>
              {evaluation.comparison.plans.map((plan) => {
                const fullPlan = evaluation.plans.find((candidate) => candidate.plan_id === plan.plan_id);
                const isBlocked = fullPlan?.status === 'blocked' || plan.outcome === 'blocked';
                const planStatus = plan.outcome ?? fullPlan?.status;
                const worstCaseExposure = getWorstCaseExposure(plan, fullPlan);

                return (
                  <NeuCard as="article" key={plan.plan_id} variant="raised" className="plan-card ae-plan-card interactive" style={{ padding: 'var(--space-5)' }}>
                    <div className="plan-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
                      <div className="plan-id" style={{ width: 35, height: 35, borderRadius: 'var(--radius-md)', color: 'var(--sapHighlightColor, var(--color-info))', background: 'var(--sapInformationBackground, var(--color-info-bg))', fontWeight: 'var(--weight-extrabold)', fontFamily: 'var(--font-heading)', display: 'grid', placeItems: 'center' }}>
                        {formatPlanId(plan.plan_id)}
                      </div>
                      <h3 style={{ margin: 0, fontSize: 'var(--text-md)', fontFamily: 'var(--font-heading)', flex: 1, marginLeft: 'var(--space-3)' }}>{plan.label}</h3>
                    </div>

                    {/* FB-08 Section 1: Validation status */}
                    <section className="plan-section validation-status-section" data-section="validation-status" aria-label={`Validation status for ${plan.plan_id}`} style={{ paddingBottom: 'var(--space-3)', borderBottom: '1px solid var(--color-border-light, var(--color-border-light))' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span className="section-label" style={{ color: 'var(--sapContent_LabelColor, var(--color-text-muted))', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', textTransform: 'uppercase' }}>
                          Validation status
                        </span>
                        <ui5-tag design={getValidationStatusDesign(planStatus)}>
                          {planStatus.replace(/_/g, ' ')}
                        </ui5-tag>
                        {fullPlan?.approved_with_override && <ui5-tag design="Negative" className="override-tag">Override</ui5-tag>}
                      </div>
                    </section>

                    {/* FB-08 Section 2: Financial status */}
                    <section className="plan-section financial-status-section" data-section="financial-status" aria-label={`Financial status for ${plan.plan_id}`} style={{ padding: 'var(--space-3) 0', borderBottom: '1px solid var(--color-border-light, var(--color-border-light))' }}>
                      <span className="section-label" style={{ color: 'var(--sapContent_LabelColor, var(--color-text-muted))', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', textTransform: 'uppercase', display: 'block', marginBottom: 'var(--space-2)' }}>
                        Financial status
                      </span>
                      <div className="financial-row-main" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', marginBottom: 'var(--space-2)' }}>
                        <span style={{ color: 'var(--sapContent_LabelColor, var(--color-text-muted))', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-accent)' }}>Net avoided loss{isBlocked ? ' · on paper' : ''}</span>
                        <strong style={{ fontSize: 'var(--text-xl)', fontFamily: 'var(--font-heading)' }}>{money(plan.net_avoided_loss_inr)}</strong>
                      </div>
                      <div className="financial-breakdown" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2) var(--space-3)', paddingTop: 'var(--space-2)', borderTop: '1px dashed var(--color-border-light, var(--color-border-light))' }}>
                        <div className="financial-item" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                          <span style={{ color: 'var(--sapContent_LabelColor, var(--color-text-muted))', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-accent)' }}>Recovery cost</span>
                          <strong style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)', fontFamily: 'var(--font-heading)' }}>{money(plan.recovery_cost_inr)}</strong>
                        </div>
                        <div className="financial-item" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                          <span style={{ color: 'var(--sapContent_LabelColor, var(--color-text-muted))', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-accent)' }}>Residual loss</span>
                          <strong style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)', fontFamily: 'var(--font-heading)' }}>{money(plan.residual_loss_inr)}</strong>
                        </div>
                        <div className="financial-item" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                          <span style={{ color: 'var(--sapContent_LabelColor, var(--color-text-muted))', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-accent)' }}>Worst-case exposure</span>
                          <strong style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)', fontFamily: 'var(--font-heading)' }}>worst {money(worstCaseExposure)}</strong>
                        </div>
                        <div className="financial-item" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                          <span style={{ color: 'var(--sapContent_LabelColor, var(--color-text-muted))', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-accent)' }}>Outcome</span>
                          <div>
                            <ui5-tag design={getValidationStatusDesign(plan.outcome)}>{plan.outcome.toUpperCase()}</ui5-tag>
                          </div>
                        </div>
                      </div>
                    </section>

                    {/* FB-08 / FB-09: Check results (plan validation rules, distinct from pipeline agent step results) */}
                    <section className="plan-section check-results-section" data-section="check-results" aria-label={`Check results for ${plan.plan_id}`} style={{ padding: 'var(--space-3) 0' }}>
                      <span className="section-label" style={{ color: 'var(--sapContent_LabelColor, var(--color-text-muted))', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', textTransform: 'uppercase', display: 'block', marginBottom: 'var(--space-1)' }}>
                        Check results
                      </span>
                      <div className="checks-row" style={{ color: 'var(--sapContent_LabelColor, var(--color-text-muted))', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-accent)' }}>
                        {plan.check_outcome_counts.passed} passed · {plan.check_outcome_counts.needs_review} need review · {plan.check_outcome_counts.blocked} blocked
                      </div>
                    </section>

                    <div style={{ marginTop: 'var(--space-2)' }}>
                      <NeuButton
                        variant="secondary"
                        onClick={() => {
                          const target = fullPlan ?? (plan as unknown as Plan);
                          setSelectedEvidencePlan(target);
                        }}
                        style={{ width: '100%' }}
                        aria-label={`Review evidence for ${plan.plan_id}`}
                      >
                        Review evidence
                      </NeuButton>
                    </div>
                  </NeuCard>
                );
              })}
              </div>
            </section>

            {/* FB-10 Section 3: Findings */}
            <section id="section-findings" data-eval-section="findings" className="eval-view-section">
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginTop: 'var(--space-section)' }}>
                <span
                  className={`eval-section-tick ${viewedSections.has('findings') ? 'viewed' : 'unviewed'}`}
                  data-section-tick="findings"
                  data-status={viewedSections.has('findings') ? 'viewed' : 'unviewed'}
                  aria-label={viewedSections.has('findings') ? 'Findings section viewed' : 'Findings section not yet viewed'}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    fontSize: 'var(--text-sm)',
                    fontWeight: 'bold',
                    border: viewedSections.has('findings') ? '2px solid var(--sapPositiveColor)' : '2px solid var(--sapNeutralBorderColor)',
                    background: viewedSections.has('findings') ? 'var(--sapPositiveColor)' : 'transparent',
                    color: viewedSections.has('findings') ? 'var(--sapContent_ContrastTextColor, var(--sapButton_Selected_TextColor))' : 'var(--sapContent_LabelColor)',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {viewedSections.has('findings') ? '✓' : '○'}
                </span>
                <PageHeader
                  title="Findings"
                  subtitle={
                    hasFindings
                      ? (showAllFindings
                          ? `Showing all ${rankedFindings.length} findings, ranked by scenario relevance.`
                          : `Showing top ${Math.min(DEFAULT_VISIBLE_FINDINGS, rankedFindings.length)} findings most relevant to the active scenario (${remainingCount} more hidden).`)
                      : '0 findings from the evaluation fixture.'
                  }
                />
              </div>

            {hasFindings ? (
              <div className="finding-list" style={{ display: 'grid', gap: 'var(--space-2)' }}>
                {visibleFindings.map((finding) => (
                  <button
                    key={finding.finding_id}
                    className="finding-link ae-finding-item"
                    onClick={() => setSelectedFinding(finding)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: 'var(--space-1)',
                      width: '100%',
                      padding: 'var(--space-3) var(--space-4)',
                      border: '1px solid var(--color-border-light, var(--color-border))',
                      borderRadius: 'var(--radius-lg)',
                      color: 'var(--sapTextColor, var(--color-text))',
                      background: 'var(--sapTile_Background, var(--color-bg-elevated))',
                      textAlign: 'left',
                      fontFamily: 'var(--font-body)',
                      cursor: 'pointer',
                      transition: 'border-color var(--duration-fast), background var(--duration-fast)',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--sapHighlightColor, var(--color-primary))'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-border-light, var(--color-border))'; }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: 'var(--space-2)' }}>
                      <strong>{finding.title}</strong>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <span style={{ color: 'var(--sapContent_LabelColor, var(--color-text-muted))', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-accent)' }}>
                          {finding.finding_id} · {finding.check_code}
                        </span>
                        <ui5-tag design={getValidationStatusDesign(finding.outcome)}>{finding.outcome}</ui5-tag>
                      </div>
                    </div>
                  </button>
                ))}
                {remainingCount > 0 && (
                  <div style={{ marginTop: 'var(--space-3)', display: 'flex', justifyContent: 'center' }}>
                    <NeuButton
                      variant="secondary"
                      onClick={() => setShowAllFindings(!showAllFindings)}
                      aria-label={showAllFindings ? 'Show less findings' : `Show more findings (${remainingCount} remaining)`}
                    >
                      {showAllFindings ? 'Show less' : `Show more (${remainingCount} more)`}
                    </NeuButton>
                  </div>
                )}
              </div>
            ) : (
              <NeuCard variant="subtle" className="progress-state" role="status" style={{ padding: 'var(--space-5)' }}>
                No findings were returned for this evaluation.
              </NeuCard>
            )}
            </section>
            {selectedEvidencePlan && (
              <ui5-dialog
                ref={dialogRef}
                open={true}
                headerText={`Evidence — ${selectedEvidencePlan.plan_id}`}
                accessibleName={`Review evidence for ${selectedEvidencePlan.plan_id}`}
                onclose={() => setSelectedEvidencePlan(null)}
                style={{ maxWidth: '820px', width: '90vw' }}
              >
                <div style={{ padding: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  <div>
                    <h3 style={{ margin: '0 0 var(--space-1)', fontSize: 'var(--text-lg)', fontFamily: 'var(--font-heading)' }}>
                      {selectedEvidencePlan.label}
                    </h3>
                    <p style={{ margin: 0, color: 'var(--sapContent_LabelColor, var(--color-text-muted))', fontSize: 'var(--text-sm)' }}>
                      Plan ID: {selectedEvidencePlan.plan_id}
                    </p>
                  </div>

                  <div className="evidence-plan-summary" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-3)', padding: 'var(--space-3)', background: 'var(--sapTile_Background, var(--color-bg-subtle))', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-light, var(--color-border))' }}>
                    <div data-section="validation-status">
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--sapContent_LabelColor, var(--color-text-muted))', display: 'block', marginBottom: 'var(--space-1)', textTransform: 'uppercase', fontWeight: 'var(--weight-bold)' }}>Validation status</span>
                      <ui5-tag design={getValidationStatusDesign(selectedEvidencePlan.status)}>{selectedEvidencePlan.status}</ui5-tag>
                    </div>
                    <div data-section="financial-status">
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--sapContent_LabelColor, var(--color-text-muted))', display: 'block', marginBottom: 'var(--space-1)', textTransform: 'uppercase', fontWeight: 'var(--weight-bold)' }}>Financial status</span>
                      <strong>{selectedEvidencePlan.financials ? money(selectedEvidencePlan.financials.net_avoided_loss_inr) : '—'}</strong>
                    </div>
                    <div data-section="check-results">
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--sapContent_LabelColor, var(--color-text-muted))', display: 'block', marginBottom: 'var(--space-1)', textTransform: 'uppercase', fontWeight: 'var(--weight-bold)' }}>Check results</span>
                      <strong>{selectedEvidencePlan.check_outcome_counts.passed} passed · {selectedEvidencePlan.check_outcome_counts.needs_review} need review · {selectedEvidencePlan.check_outcome_counts.blocked} blocked</strong>
                    </div>
                  </div>

                  <div>
                    <h4 style={{ margin: 'var(--space-2) 0', fontSize: 'var(--text-md)', fontFamily: 'var(--font-heading)' }}>
                      Plan findings ({evaluation?.findings.filter((f) => selectedEvidencePlan.finding_ids?.includes(f.finding_id)).length ?? 0})
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                      {evaluation?.findings
                        .filter((f) => selectedEvidencePlan.finding_ids?.includes(f.finding_id))
                        .map((finding) => {
                          const linkedEvidence = evaluation?.evidence?.filter((e) => finding.evidence_ids?.includes(e.evidence_id)) ?? [];
                          return (
                            <div
                              key={finding.finding_id}
                              style={{
                                padding: 'var(--space-3)',
                                border: '1px solid var(--color-border-light, var(--color-border))',
                                borderRadius: 'var(--radius-md)',
                                background: 'var(--sapTile_Background, var(--color-bg-elevated))',
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
                                <strong>{finding.title}</strong>
                                <ui5-tag design={getValidationStatusDesign(finding.outcome)}>{finding.outcome}</ui5-tag>
                              </div>
                              <p style={{ margin: 'var(--space-1) 0', fontSize: 'var(--text-sm)', color: 'var(--sapContent_LabelColor, var(--color-text-muted))' }}>
                                {finding.finding_id} · {finding.check_code} · Subject: {finding.subject.id} ({finding.subject.type})
                              </p>
                              {finding.remedies && finding.remedies.length > 0 && (
                                <div style={{ marginTop: 'var(--space-2)', padding: 'var(--space-2)', background: 'var(--sapInformationBackground, var(--color-info-bg))', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-xs)' }}>
                                  <strong>Remedy: </strong>
                                  {finding.remedies.map((r) => r.text).join('; ')}
                                </div>
                              )}
                              {linkedEvidence.length > 0 && (
                                <div style={{ marginTop: 'var(--space-2)', borderTop: '1px dashed var(--color-border-light, var(--color-border))', paddingTop: 'var(--space-2)' }}>
                                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'bold', display: 'block', marginBottom: 'var(--space-1)' }}>
                                    Linked evidence records ({linkedEvidence.length}):
                                  </span>
                                  {linkedEvidence.map((ev) => (
                                    <div key={ev.evidence_id} style={{ fontSize: 'var(--text-sm)', color: 'var(--sapContent_LabelColor, var(--color-text-muted))', marginBottom: 'var(--space-1)' }}>
                                      • <strong>{ev.evidence_id}</strong>: {ev.title} ({ev.kind}{ev.synthetic ? ' · synthetic' : ''})
                                      {ev.excerpt && (
                                        <pre style={{ margin: 'var(--space-1) 0 0', padding: 'var(--space-1) var(--space-2)', background: 'var(--sapNeutralBackground, var(--color-bg-subtle))', borderRadius: 'var(--radius-sm)', whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)' }}>
                                          {ev.excerpt}
                                        </pre>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </div>
                <div slot="footer" style={{ display: 'flex', justifyContent: 'flex-end', padding: 'var(--space-2)', width: '100%' }}>
                  <NeuButton variant="primary" onClick={() => setSelectedEvidencePlan(null)}>
                    Close
                  </NeuButton>
                </div>
              </ui5-dialog>
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