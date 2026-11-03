import { useState, useEffect } from 'react';
import { Check, X, Circle } from 'lucide-react';
import '@ui5/webcomponents/dist/Button.js';
import '@ui5/webcomponents/dist/Tag.js';
import { PageHeader, PageBody } from '../layout';
import { NeuCard } from '../ui/NeuCard';
import { NeuButton } from '../ui/NeuButton';
import { type Screen } from '../../app/navigation';
import type { Evaluation } from '../../api/types';
interface EvaluationProgressScreenProps {
  evaluation: Evaluation | null;
  evaluationState: string;
  evaluationError: string;
  loadEvaluation: () => void;
  navigate: (screen: Screen) => void;
  stepAnnouncement: string;
}

export function EvaluationProgressScreen({
  evaluation,
  evaluationState,
  evaluationError,
  loadEvaluation,
  navigate,
  stepAnnouncement,
}: EvaluationProgressScreenProps) {
  const [viewedSteps, setViewedSteps] = useState<Set<number>>(() => new Set());

  useEffect(() => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const seqStr = entry.target.getAttribute('data-step-seq');
            if (seqStr) {
              const seq = parseInt(seqStr, 10);
              setViewedSteps((prev) => {
                if (prev.has(seq)) return prev;
                const next = new Set(prev);
                next.add(seq);
                return next;
              });
            }
          }
        });
      },
      { threshold: 0.1 }
    );

    const stepElements = document.querySelectorAll('[data-step-seq]');
    stepElements.forEach((el) => {
      observer.observe(el);
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        const seqStr = el.getAttribute('data-step-seq');
        if (seqStr) {
          const seq = parseInt(seqStr, 10);
          setViewedSteps((prev) => {
            if (prev.has(seq)) return prev;
            const next = new Set(prev);
            next.add(seq);
            return next;
          });
        }
      }
    });

    return () => observer.disconnect();
  }, [evaluation]);

  const totalSteps = evaluation?.steps?.length ?? 0;
  const viewedCount = viewedSteps.size;
  const stepProgress = totalSteps > 0 ? Math.round((viewedCount / totalSteps) * 100) : 0;
  return (
    <>
      <div aria-live="polite" aria-atomic="true" className="sr-only" role="status">{stepAnnouncement}</div>

      <PageHeader
        eyebrow="WORKSPACE / EVALUATION"
        title="Evaluation progress"
        subtitle="Agent pipeline execution steps returned for the loaded evaluation. Multi-agent orchestrator execution trace showing each pipeline stage status and timing, distinct from recovery plan check results."
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <ui5-tag design={evaluation?.status === 'completed' ? 'Positive' : 'Information'}>
            {evaluationState === 'loading' ? 'Loading' : evaluation?.status ?? 'Unavailable'}
          </ui5-tag>
          <NeuButton variant="primary" onClick={() => navigate('evaluations')} aria-label="View evaluation">
            View evaluation
          </NeuButton>
        </div>
      </PageHeader>

      <PageBody>
        {evaluationState === 'loading' && (
          <NeuCard variant="subtle" className="progress-state" role="status" aria-busy="true" style={{ padding: 'var(--space-5)' }}>
            Loading the recorded evaluation fixture…
          </NeuCard>
        )}

        {evaluationState === 'error' && (
          <NeuCard variant="subtle" className="progress-state progress-error" role="alert" aria-live="assertive" style={{ padding: 'var(--space-5)', borderColor: 'var(--color-error-border)', color: 'var(--color-error-text)' }}>
            <p>{evaluationError}</p>
            <NeuButton variant="primary" onClick={loadEvaluation} style={{ marginTop: 'var(--space-3)' }}>
              Retry fixture load
            </NeuButton>
          </NeuCard>
        )}

        {evaluationState === 'ready' && evaluation && (
          <section className="evaluation-results ae-evaluation-results" aria-labelledby="evaluation-results-heading">
            <h2 id="evaluation-results-heading" className="sr-only">Agent pipeline execution steps</h2>

            {totalSteps > 0 && (
              <div
                className="evaluation-review-progress ae-progress-tracker"
                role="region"
                aria-label="Pipeline steps review progress"
                style={{
                  margin: 'var(--space-3) 0 var(--space-4)',
                  padding: 'var(--space-3) var(--space-4)',
                  background: 'var(--sapTile_Background, var(--color-bg-elevated))',
                  border: '1px solid var(--sapTile_BorderColor, var(--color-border))',
                  borderRadius: 'var(--radius-lg)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--sapTextColor, var(--color-text))' }}>
                    Pipeline steps reviewed: <strong>{viewedCount} of {totalSteps}</strong> ({stepProgress}%)
                  </span>
                  <ui5-tag design={stepProgress === 100 ? 'Positive' : 'Information'}>
                    {stepProgress === 100 ? 'All steps viewed' : 'In review'}
                  </ui5-tag>
                </div>
                <div
                  role="progressbar"
                  aria-valuenow={stepProgress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Pipeline steps review progress: ${stepProgress}%`}
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
                      width: `${stepProgress}%`,
                      height: '100%',
                      background: stepProgress === 100 ? 'var(--sapPositiveColor)' : 'var(--sapInformativeColor)',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
              </div>
            )}

            <div className="evaluation-progress" aria-live="polite" aria-atomic="true" style={{ marginTop: 'var(--space-3)', borderTop: '1px solid var(--color-border-light)' }}>
              <p className="progress-announcement" style={{ padding: 'var(--space-3) 0', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-relaxed)' }}>
                Evaluation {evaluation.evaluation_id} is {evaluation.status}.
              </p>
              {evaluation?.steps?.length ? evaluation.steps.map((step) => (
                <NeuCard key={step.seq} variant="raised" className={`progress-step ae-progress-step ${step.status}`} role="article" data-step-seq={step.seq} aria-label={`Evaluation step ${step.seq}: ${step.step.replace(/_/g, ' ')}`} style={{ display: 'grid', gridTemplateColumns: '34px minmax(180px, 1fr) auto minmax(160px, auto)', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-4) 0', borderTop: '1px solid var(--color-border-light)' }}>
                  <span
                    role="img"
                    className={`progress-step-icon ae-step-tick ${viewedSteps.has(step.seq) ? 'viewed' : 'unviewed'}`}
                    data-status={viewedSteps.has(step.seq) ? 'viewed' : 'unviewed'}
                    aria-label={viewedSteps.has(step.seq) ? 'Step viewed' : 'Step not viewed yet'}
                    style={{
                      display: 'grid', placeItems: 'center', width: 28, height: 28, borderRadius: '50%',
                      color: viewedSteps.has(step.seq) ? 'var(--sapPositiveColor)' : (step.status === 'failed' ? 'var(--sapNegativeColor)' : 'var(--sapPositiveColor)'),
                      background: viewedSteps.has(step.seq) ? 'var(--sapPositiveBackground)' : (step.status === 'failed' ? 'var(--sapNegativeBackground)' : 'var(--sapPositiveBackground)'),
                      fontSize: 14, fontWeight: 'var(--weight-extrabold)',
                      border: viewedSteps.has(step.seq) ? '2px solid var(--sapPositiveColor)' : 'none',
                    }}
                  >
                    {step.status === 'succeeded' ? <Check size={14} /> : step.status === 'failed' ? <X size={14} /> : <Circle size={8} fill="currentColor" />}
                  </span>
                  <div>
                    <h2 style={{ margin: '0 0 var(--space-1)', color: 'var(--color-text)', fontSize: 'var(--text-md)', textTransform: 'capitalize', fontFamily: 'var(--font-heading)' }}>
                      {step.seq}. {step.step.replace(/_/g, ' ')}
                    </h2>
                    <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                      <ui5-tag
                        design={
                          step.status === 'succeeded' ? 'Positive' :
                          step.status === 'failed' ? 'Negative' :
                          'Critical'
                        }
                      >
                        {step.status}
                      </ui5-tag>{' '}
                      · {step.owner} · {step.attempts > 1 ? `${step.attempts} attempts` : '1 attempt'}
                    </p>
                    {step.error && <p className="load-error" style={{ color: 'var(--color-error-text)', marginTop: 'var(--space-1)' }}>{typeof step.error === 'string' ? step.error : step.error.message ?? 'Step failed.'}</p>}
                  </div>
                  <ui5-tag design="Information" className="mode-chip">
                    {step.mode ?? 'not specified'}
                  </ui5-tag>
                  <time dateTime={step.finished_at ?? undefined} style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', textAlign: 'right', fontFamily: 'var(--font-accent)' }}>
                    {step.finished_at ? new Date(step.finished_at).toLocaleString() : ''}
                  </time>
                </NeuCard>
              )) : (
                <p className="progress-state" role="status" style={{ padding: 'var(--space-5)', color: 'var(--color-text-muted)', textAlign: 'center' }}>
                  No evaluation steps are available.
                </p>
              )}
            </div>

            <div className="progress-actions" style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginTop: 'var(--space-5)' }}>
              <NeuButton variant="secondary" onClick={loadEvaluation}>
                Refresh evaluation
              </NeuButton>
              <NeuButton variant="primary" onClick={() => navigate('evaluations')} aria-label="View evaluation">
                View evaluation
              </NeuButton>
            </div>
          </section>
        )}
      </PageBody>
    </>
  );
}