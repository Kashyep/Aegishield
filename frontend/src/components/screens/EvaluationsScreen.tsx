import { useState, useMemo, useRef, useEffect } from 'react';
import '@ui5/webcomponents/dist/Dialog.js';
import '@ui5/webcomponents/dist/Button.js';
import '@ui5/webcomponents/dist/Tag.js';
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
  if (s === 'passed' || s === 'approved' || s === 'completed' || s === 'positive') {
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
  const dialogRef = useRef<UI5DialogElement | null>(null);

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
                  <h2 style={{ marginBottom: 'var(--space-1)', fontSize: 'var(--text-lg)', fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <span>{evaluation.evaluation_id}</span>
                    <ui5-tag design={getValidationStatusDesign(evaluation.status)}>{evaluation.status}</ui5-tag>
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
                      <ui5-tag design={getValidationStatusDesign(planStatus)}>
                        {planStatus.replace(/_/g, ' ')}
                      </ui5-tag>
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
                          <div>
                            <ui5-tag design={getValidationStatusDesign(plan.outcome)}>{plan.outcome.toUpperCase()}</ui5-tag>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="checks-row" style={{ margin: 'var(--space-3) 0', color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-accent)' }}>
                      {plan.check_outcome_counts.passed} passed · {plan.check_outcome_counts.needs_review} need review · {plan.check_outcome_counts.blocked} blocked
                    </div>

                    <div style={{ marginTop: 'var(--space-3)' }}>
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
                      border: '1px solid var(--sapTile_BorderColor, var(--color-border))',
                      borderRadius: 'var(--radius-lg)',
                      color: 'var(--sapTextColor, var(--color-text))',
                      background: 'var(--sapTile_Background, var(--color-bg-elevated))',
                      textAlign: 'left',
                      fontFamily: 'var(--font-body)',
                      cursor: 'pointer',
                      transition: 'border-color var(--duration-fast), background var(--duration-fast)',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--sapHighlightColor, var(--color-primary))'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--sapTile_BorderColor, var(--color-border))'; }}
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

                  <div className="evidence-plan-summary" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-3)', padding: 'var(--space-3)', background: 'var(--sapTile_Background, var(--color-bg-subtle))', borderRadius: 'var(--radius-md)', border: '1px solid var(--sapTile_BorderColor, var(--color-border))' }}>
                    <div>
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--sapContent_LabelColor, var(--color-text-muted))', display: 'block', marginBottom: 'var(--space-1)' }}>Validation status</span>
                      <ui5-tag design={getValidationStatusDesign(selectedEvidencePlan.status)}>{selectedEvidencePlan.status}</ui5-tag>
                    </div>
                    <div>
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--sapContent_LabelColor, var(--color-text-muted))', display: 'block' }}>Financial impact</span>
                      <strong>{selectedEvidencePlan.financials ? money(selectedEvidencePlan.financials.net_avoided_loss_inr) : '—'}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--sapContent_LabelColor, var(--color-text-muted))', display: 'block' }}>Check results</span>
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
                                border: '1px solid var(--sapTile_BorderColor, var(--color-border))',
                                borderRadius: 'var(--radius-md)',
                                background: 'var(--sapTile_Background, var(--color-bg-elevated))',
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
                                <strong>{finding.title}</strong>
                                <ui5-tag design={getValidationStatusDesign(finding.outcome)}>{finding.outcome}</ui5-tag>
                              </div>
                              <p style={{ margin: 'var(--space-1) 0', fontSize: 'var(--text-xs)', color: 'var(--sapContent_LabelColor, var(--color-text-muted))' }}>
                                {finding.finding_id} · {finding.check_code} · Subject: {finding.subject.id} ({finding.subject.type})
                              </p>
                              {finding.remedies && finding.remedies.length > 0 && (
                                <div style={{ marginTop: 'var(--space-2)', padding: 'var(--space-2)', background: 'var(--sapInformationBackground, var(--color-info-bg))', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-xs)' }}>
                                  <strong>Remedy: </strong>
                                  {finding.remedies.map((r) => r.text).join('; ')}
                                </div>
                              )}
                              {linkedEvidence.length > 0 && (
                                <div style={{ marginTop: 'var(--space-2)', borderTop: '1px dashed var(--sapTile_BorderColor, var(--color-border))', paddingTop: 'var(--space-2)' }}>
                                  <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'bold', display: 'block', marginBottom: 'var(--space-1)' }}>
                                    Linked evidence records ({linkedEvidence.length}):
                                  </span>
                                  {linkedEvidence.map((ev) => (
                                    <div key={ev.evidence_id} style={{ fontSize: 'var(--text-xs)', color: 'var(--sapContent_LabelColor, var(--color-text-muted))', marginBottom: 'var(--space-1)' }}>
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