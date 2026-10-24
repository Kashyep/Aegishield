import { PageHeader, PageBody } from '../layout';
import { NeuCard } from '../ui/NeuCard';
import { NeuButton } from '../ui/NeuButton';
import { NeuChip } from '../ui/NeuChip';
import type { Evaluation, Execution, Plan } from '../../api/types';

interface ExecutionScreenProps {
  execution: Execution | null;
  executionError: string;
  executionSubmitting: boolean;
  startPlanExecution: (plan: Plan) => void;
  evaluation: Evaluation | null;
  formatLocalTimestamp: (timestamp?: string | null) => string;
}

export function ExecutionScreen({
  execution,
  executionError,
  executionSubmitting,
  startPlanExecution,
  evaluation,
  formatLocalTimestamp,
}: ExecutionScreenProps) {
  return (
    <>
      <PageHeader
        eyebrow="WORKSPACE / EXECUTION"
        title="Simulated execution"
        subtitle="Execution requests require an approved plan and its recorded decision. SAP mappings are proposals only."
      >
        {execution && <NeuChip variant={execution.status === 'completed' ? 'success' : execution.status === 'failed' ? 'error' : 'warning'}>{execution.status}</NeuChip>}
      </PageHeader>

      <PageBody>
        {executionError && (
          <NeuCard variant="subtle" className="api-error" role="alert" style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-4)', borderColor: 'var(--color-error-border)', background: 'var(--color-error-bg)', color: 'var(--color-error-text)' }}>
            <p>{executionError}</p>
            {execution && ['queued', 'running'].includes(execution.status) && (
              <NeuButton variant="secondary" onClick={() => window.dispatchEvent(new CustomEvent('retry-execution'))} style={{ marginTop: 'var(--space-2)' }}>
                Retry status check
              </NeuButton>
            )}
          </NeuCard>
        )}

        {execution ? (
          <NeuCard variant="raised" className="execution-panel" role="region" aria-label="Simulated execution details" style={{ padding: 'var(--space-5)' }}>
            <dl className="finding-details" style={{ margin: 0 }}>
              <div style={{ padding: 'var(--space-3) 0', borderBottom: '1px solid var(--color-border-light)' }}>
                <dt style={{ marginBottom: 'var(--space-1)', color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', textTransform: 'uppercase', fontFamily: 'var(--font-accent)' }}>Execution</dt>
                <dd style={{ margin: 0, color: 'var(--color-text)', fontSize: 'var(--text-sm)', overflowWrap: 'anywhere' }}>{execution.execution_id}</dd>
              </div>
              <div style={{ padding: 'var(--space-3) 0', borderBottom: '1px solid var(--color-border-light)' }}>
                <dt style={{ marginBottom: 'var(--space-1)', color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', textTransform: 'uppercase', fontFamily: 'var(--font-accent)' }}>Plan</dt>
                <dd style={{ margin: 0, color: 'var(--color-text)', fontSize: 'var(--text-sm)', overflowWrap: 'anywhere' }}>{execution.plan_id} · version {execution.plan_version}</dd>
              </div>
              <div style={{ padding: 'var(--space-3) 0', borderBottom: '1px solid var(--color-border-light)' }}>
                <dt style={{ marginBottom: 'var(--space-1)', color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', textTransform: 'uppercase', fontFamily: 'var(--font-accent)' }}>Decision</dt>
                <dd style={{ margin: 0, color: 'var(--color-text)', fontSize: 'var(--text-sm)', overflowWrap: 'anywhere' }}>{execution.decision_id}</dd>
              </div>
              <div style={{ padding: 'var(--space-3) 0' }}>
                <dt style={{ marginBottom: 'var(--space-1)', color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', textTransform: 'uppercase', fontFamily: 'var(--font-accent)' }}>Started</dt>
                <dd style={{ margin: 0, color: 'var(--color-text)', fontSize: 'var(--text-sm)', overflowWrap: 'anywhere' }}>{formatLocalTimestamp(execution.started_at)}</dd>
              </div>
            </dl>

            <p className="approval-note" style={{ margin: 'var(--space-3) 0', padding: 'var(--space-3)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-muted)', background: 'var(--color-bg-subtle)', fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-relaxed)' }}>
              Every row below is simulated. No SAP system was changed.
            </p>

            {execution.steps.map((step) => (
              <NeuCard key={step.seq} variant={step.status === 'failed' ? 'pressed' : 'raised'} className={`execution-step ${step.status}`} role="article" aria-label={`Execution step ${step.seq}: ${step.step_type.replace(/_/g, ' ')}`} style={{ marginTop: 'var(--space-3)', padding: 'var(--space-4)', borderColor: step.status === 'failed' ? 'var(--color-error-border)' : 'var(--color-border)', background: step.status === 'failed' ? 'var(--color-error-bg)' : step.status === 'skipped' ? 'var(--color-bg-subtle)' : 'var(--color-bg-elevated)' }}>
                <div className="execution-step-heading" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
                  <h2 style={{ margin: 0, color: 'var(--color-text)', fontSize: 'var(--text-md)', fontFamily: 'var(--font-heading)' }}>{step.seq}. {step.step_type.replace(/_/g, ' ')}</h2>
                  <NeuChip variant={step.status === 'succeeded' ? 'success' : step.status === 'failed' ? 'error' : 'neutral'}>{step.status}</NeuChip>
                </div>
                <p style={{ margin: 'var(--space-2) 0 0', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-relaxed)' }}>{step.description}</p>
                <p className="execution-refs" style={{ marginTop: 'var(--space-2)', overflowWrap: 'anywhere', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}><strong>References:</strong> {JSON.stringify(step.refs)}</p>
                <p className="mapping-label" style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)' }}><strong>Proposed SAP mapping:</strong> {step.proposed_sap_mapping}</p>
                <NeuChip variant="info" className="simulated-chip" style={{ marginTop: 'var(--space-3)', padding: 'var(--space-1) var(--space-2)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)' }}>Simulated</NeuChip>
                {step.error && <p className="load-error" style={{ color: 'var(--color-error-text)', marginTop: 'var(--space-2)' }}>{typeof step.error === 'string' ? step.error : step.error.message ?? 'Step failed.'}</p>}
              </NeuCard>
            ))}

            {execution.status === 'failed' && (
              <p className="blocked-reason" style={{ marginTop: 'var(--space-3)', color: 'var(--color-error-text)', fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-relaxed)' }}>
                Execution failed. Later steps, if any, are skipped. No automatic retry or compensation is performed.
              </p>
            )}
            {execution.status === 'completed' && (
              <p className="approval-note" style={{ marginTop: 'var(--space-3)', padding: 'var(--space-3)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-muted)', background: 'var(--color-bg-subtle)', fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-relaxed)' }}>
                The API reports this simulated execution as completed.
              </p>
            )}
          </NeuCard>
        ) : (
          <section className="execution-empty" aria-labelledby="execution-empty-heading">
            <p id="execution-empty-heading" role="status" style={{ marginBottom: 'var(--space-4)', color: 'var(--color-text-muted)' }}>No execution record is included in the fixtures. Connect the supported backend in live mode to submit and view an execution.</p>
            <div className="execution-launch-list" aria-label="Available execution plans">
              {evaluation?.plans.filter((plan) => ['approved', 'completed'].includes(plan.status)).map((plan) => (
                <NeuCard key={plan.plan_id} variant="raised" className="plan-card execution-launch" role="article" aria-label={`Execution plan: ${plan.label}`} style={{ marginTop: 'var(--space-3)', padding: 'var(--space-5)' }}>
                  <h2 style={{ color: 'var(--color-text)', fontSize: 'var(--text-md)', fontFamily: 'var(--font-heading)' }}>{plan.label}</h2>
                  <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Plan {plan.plan_id} · {plan.status.replace(/_/g, ' ')}</p>
                  <NeuButton variant="primary" disabled={executionSubmitting} onClick={() => startPlanExecution(plan)} style={{ marginTop: 'var(--space-3)', width: '100%' }}>
                    {executionSubmitting ? 'Loading…' : 'Load or start simulated execution'}
                  </NeuButton>
                </NeuCard>
              ))}
            </div>
          </section>
        )}
      </PageBody>
    </>
  );
}