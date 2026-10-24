import { Check, X, Circle } from 'lucide-react'
import { PageHeader, PageBody } from '../layout';
import { NeuCard } from '../ui/NeuCard';
import { NeuButton } from '../ui/NeuButton';
import { NeuChip } from '../ui/NeuChip';
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
  return (
    <>
      <div aria-live="polite" aria-atomic="true" className="sr-only" role="status">{stepAnnouncement}</div>

      <PageHeader
        eyebrow="WORKSPACE / EVALUATION"
        title="Evaluation progress"
        subtitle="Step results returned for the loaded evaluation. Fixture mode displays the recorded EVAL-0001 response."
      >
        <NeuChip variant="neutral">
          <span className="status-dot" style={{ marginRight: 'var(--space-1)' }} />
          {evaluationState === 'loading' ? 'Loading' : evaluation?.status ?? 'Unavailable'}
        </NeuChip>
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
          <section className="evaluation-results" aria-labelledby="evaluation-results-heading">
            <h2 id="evaluation-results-heading" className="sr-only">Evaluation step results</h2>
            <div className="evaluation-progress" aria-live="polite" aria-atomic="true" style={{ marginTop: 'var(--space-5)', borderTop: '1px solid var(--color-border-light)' }}>
              <p className="progress-announcement" style={{ padding: 'var(--space-3) 0', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-relaxed)' }}>
                Evaluation {evaluation.evaluation_id} is {evaluation.status}.
              </p>
              {evaluation?.steps?.length ? evaluation.steps.map((step) => (
                <NeuCard key={step.seq} variant="raised" className={`progress-step ${step.status}`} role="article" aria-label={`Evaluation step ${step.seq}: ${step.step.replace(/_/g, ' ')}`} style={{ display: 'grid', gridTemplateColumns: '34px minmax(180px, 1fr) auto minmax(160px, auto)', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-4) 0', borderTop: '1px solid var(--color-border-light)' }}>
                  <span className="progress-step-icon" aria-hidden="true" style={{
                    display: 'grid', placeItems: 'center', width: 28, height: 28, borderRadius: '50%',
                    color: step.status === 'failed' ? 'var(--color-error)' : 'var(--color-success)',
                    background: step.status === 'failed' ? 'var(--color-error-bg)' : 'var(--color-success-bg)',
                    fontSize: 14, fontWeight: 'var(--weight-extrabold)'
                  }}>
                    {step.status === 'succeeded' ? <Check size={14} /> : step.status === 'failed' ? <X size={14} /> : <Circle size={8} fill="currentColor" />}
                  </span>
                  <div>
                    <h2 style={{ margin: '0 0 var(--space-1)', color: 'var(--color-text)', fontSize: 'var(--text-md)', textTransform: 'capitalize', fontFamily: 'var(--font-heading)' }}>
                      {step.seq}. {step.step.replace(/_/g, ' ')}
                    </h2>
                    <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                      <NeuChip
                        variant={
                          step.status === 'succeeded' ? 'success' :
                          step.status === 'failed' ? 'error' :
                          'warning'
                        }
                        style={{ display: 'inline-block', padding: 'var(--space-1) var(--space-1)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', textTransform: 'uppercase' }}
                      >
                        {step.status}
                      </NeuChip>{' '}
                      · {step.owner} · {step.attempts > 1 ? `${step.attempts} attempts` : '1 attempt'}
                    </p>
                    {step.error && <p className="load-error" style={{ color: 'var(--color-error-text)', marginTop: 'var(--space-1)' }}>{typeof step.error === 'string' ? step.error : step.error.message ?? 'Step failed.'}</p>}
                  </div>
                  <NeuChip variant="info" className="mode-chip" style={{ padding: 'var(--space-1) var(--space-2)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)' }}>
                    {step.mode ?? 'not specified'}
                  </NeuChip>
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
              <NeuButton variant="primary" onClick={() => navigate('evaluations')}>
                View plan comparison
              </NeuButton>
            </div>
          </section>
        )}
      </PageBody>
    </>
  );
}