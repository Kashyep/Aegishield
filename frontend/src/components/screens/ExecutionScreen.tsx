import { useState, useEffect } from 'react';
import '@ui5/webcomponents/dist/Card.js';
import '@ui5/webcomponents/dist/CardHeader.js';
import '@ui5/webcomponents/dist/Button.js';
import '@ui5/webcomponents/dist/Tag.js';
import '@ui5/webcomponents/dist/Icon.js';
import '@ui5/webcomponents/dist/Title.js';
import '@ui5/webcomponents/dist/Label.js';
import '@ui5/webcomponents-fiori/dist/Wizard.js';
import '@ui5/webcomponents-fiori/dist/WizardStep.js';
import '@ui5/webcomponents-icons/dist/document-text.js';
import '@ui5/webcomponents-icons/dist/cart.js';
import '@ui5/webcomponents-icons/dist/shipping-status.js';
import '@ui5/webcomponents-icons/dist/sales-order.js';
import '@ui5/webcomponents-icons/dist/accept.js';
import '@ui5/webcomponents-icons/dist/error.js';
import '@ui5/webcomponents-icons/dist/history.js';
import '@ui5/webcomponents-icons/dist/time-entry-request.js';
import '@ui5/webcomponents-icons/dist/message-warning.js';

import { PageHeader, PageBody } from '../layout';
import type { Evaluation, Execution, ExecutionStep, Plan } from '../../api/types';

interface ExecutionScreenProps {
  execution: Execution | null;
  executionError: string;
  executionSubmitting: boolean;
  startPlanExecution: (plan: Plan) => void;
  evaluation: Evaluation | null;
  formatLocalTimestamp: (timestamp?: string | null) => string;
}

const STEP_TIMINGS = {
  step1: '0.8s',
  step2: '1.2s',
  step3: '1.4s',
  step4: '0.6s',
};
const formatMoney = (amount: number) => `₹${amount.toLocaleString('en-IN')}`;


function computeDuration(startedAt?: string | null, finishedAt?: string | null): string {
  if (!startedAt) return '4.0s';
  const start = new Date(startedAt).getTime();
  const finish = finishedAt ? new Date(finishedAt).getTime() : Date.now();
  if (isNaN(start) || isNaN(finish) || finish <= start) return '4.0s';
  const diffSec = (finish - start) / 1000;
  return `${diffSec.toFixed(1)}s`;
}

export function ExecutionScreen({
  execution,
  executionError,
  executionSubmitting,
  startPlanExecution,
  evaluation,
  formatLocalTimestamp,
}: ExecutionScreenProps) {
  const [selectedStep, setSelectedStep] = useState(0);
  const [demoExecution, setDemoExecution] = useState<Execution | null>(null);

  useEffect(() => {
    const handleDemoEvent = (e: Event) => {
      const customEvent = e as CustomEvent<Execution>;
      if (customEvent.detail) {
        setDemoExecution(customEvent.detail);
      }
    };
    window.addEventListener('load-demo-execution', handleDemoEvent);
    return () => {
      window.removeEventListener('load-demo-execution', handleDemoEvent);
    };
  }, []);

  const activeExecution = execution || demoExecution;

  const executedPlan = evaluation?.plans?.find((p) => p.plan_id === activeExecution?.plan_id);
  const baselineLoss = evaluation?.comparison?.baseline_loss_inr ?? 1160000;
  const netAvoidedLoss = executedPlan?.financials?.net_avoided_loss_inr ?? (activeExecution?.plan_id === 'PLN-0002' ? 618000 : 0);
  const recoveryCost = executedPlan?.financials?.recovery_cost_inr ?? (activeExecution?.plan_id === 'PLN-0002' ? 208000 : 0);
  const residualLoss = executedPlan?.financials?.residual_loss_inr ?? (activeExecution?.plan_id === 'PLN-0002' ? 334000 : 0);

  // Group backend execution steps into the 4 business process flow steps (D7 / FB-12)
  const steps: ExecutionStep[] = activeExecution?.steps || [];
  const mmSteps = steps.filter((s) => s.step_type === 'REDUCE_PO' || s.step_type === 'CREATE_PO');
  const tmSteps = steps.filter((s) => s.step_type === 'BOOK_FREIGHT');
  const sdSteps = steps.filter((s) =>
    ['CREATE_STOCK_TRANSFER', 'RESERVE_STOCK', 'NOTIFY_CUSTOMER'].includes(s.step_type)
  );

  const getStepStatus = (substeps: ExecutionStep[]) => {
    if (!activeExecution) return 'pending';
    if (substeps.some((s) => s.status === 'failed')) return 'failed';
    if (substeps.length > 0 && substeps.every((s) => s.status === 'succeeded')) return 'succeeded';
    if (activeExecution.status === 'completed') return 'succeeded';
    if (activeExecution.status === 'failed') return 'failed';
    return 'running';
  };

  const step1Status = activeExecution
    ? activeExecution.status === 'failed' && steps[0]?.status === 'failed'
      ? 'failed'
      : 'succeeded'
    : 'pending';
  const step2Status = getStepStatus(mmSteps);
  const step3Status = getStepStatus(tmSteps);
  const step4Status = getStepStatus(sdSteps);

  const tagDesign = (status: string): 'Positive' | 'Negative' | 'Critical' | 'Neutral' => {
    switch (status) {
      case 'succeeded':
      case 'completed':
        return 'Positive';
      case 'failed':
        return 'Negative';
      case 'running':
      case 'queued':
        return 'Critical';
      default:
        return 'Neutral';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'succeeded':
      case 'completed':
        return { name: 'accept', color: 'var(--sapPositiveColor, #107e3e)' };
      case 'failed':
        return { name: 'error', color: 'var(--sapNegativeColor, #b00)' };
      case 'running':
      case 'queued':
        return { name: 'time-entry-request', color: 'var(--sapCriticalColor, #e9730c)' };
      default:
        return { name: 'history', color: 'var(--sapNeutralColor, #6a6d70)' };
    }
  };

  const execStatusIcon = activeExecution ? getStatusIcon(activeExecution.status) : null;
  const totalDuration = activeExecution
    ? computeDuration(activeExecution.started_at, activeExecution.finished_at)
    : '';

  return (
    <>
      <PageHeader
        eyebrow="WORKSPACE / EXECUTION"
        title="Simulated execution"
        subtitle="Execution requests require an approved plan and its recorded decision. SAP mappings are proposals only."
      >
        {activeExecution && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            {execStatusIcon && (
              <ui5-icon
                name={execStatusIcon.name}
                style={{ color: execStatusIcon.color, fontSize: '1rem' }}
                accessibleName={`Status: ${activeExecution.status}`}
              />
            )}
            <ui5-tag design={tagDesign(activeExecution.status)}>{activeExecution.status}</ui5-tag>
          </div>
        )}
      </PageHeader>

      <PageBody>
        {executionError && (
          <ui5-card
            className="ae-api-error"
            role="alert"
            style={{
              marginBottom: 'var(--space-4)',
              padding: 'var(--space-4)',
              borderLeft: '4px solid var(--sapNegativeColor, #b00)',
              background: 'var(--color-error-bg, #fff0ed)',
              color: 'var(--color-error-text, #87281f)',
            }}
          >
            <p style={{ margin: 0 }}>{executionError}</p>
            {activeExecution && ['queued', 'running'].includes(activeExecution.status) && (
              <ui5-button
                design="Default"
                onClick={() => window.dispatchEvent(new CustomEvent('retry-execution'))}
                style={{ marginTop: 'var(--space-2)' }}
              >
                Retry status check
              </ui5-button>
            )}
          </ui5-card>
        )}

        {activeExecution ? (
          <div className="ae-execution-panel" role="region" aria-label="Simulated execution details">
            {/* FB-12 Summary Card with Bold Headings per D8 */}
            <ui5-card
              className="ae-summary-card"
              role="region"
              aria-label="Execution summary"
              style={{
                marginBottom: 'var(--space-4)',
                borderLeft: `4px solid ${
                  activeExecution.status === 'completed'
                    ? 'var(--sapPositiveColor, #107e3e)'
                    : activeExecution.status === 'failed'
                    ? 'var(--sapNegativeColor, #b00)'
                    : 'var(--sapCriticalColor, #e9730c)'
                }`,
              }}
            >
              <ui5-card-header
                titleText="Execution Summary"
                subtitleText="Preflight simulated execution details and timings"
                status={activeExecution.status}
              />
              <div style={{ padding: 'var(--space-4)' }}>
                {/* D8 Heading: Workspace */}
                <div style={{ marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                  <ui5-title level="H3" style={{ fontWeight: 'bold' }}>
                    Workspace
                  </ui5-title>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    {execStatusIcon && (
                      <ui5-icon
                        name={execStatusIcon.name}
                        style={{ color: execStatusIcon.color, fontSize: '1.25rem' }}
                        accessibleName={`Execution status: ${activeExecution.status}`}
                      />
                    )}
                    <ui5-tag design={tagDesign(activeExecution.status)}>{activeExecution.status}</ui5-tag>
                    <span
                      className="ae-timing-badge"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--color-bg-subtle)',
                        color: 'var(--sapContent_LabelColor, var(--color-text-muted))',
                        fontSize: 'var(--text-xs)',
                        fontWeight: 600,
                      }}
                    >
                      <ui5-icon name="history" style={{ fontSize: '0.875rem' }} />
                      {totalDuration}
                    </span>
                  </div>
                </div>

                {/* D8 Headings: Execution, Plan, Decision, Started */}
                <dl
                  className="ae-finding-details"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: 'var(--space-4)',
                    margin: 0,
                  }}
                >
                  <div style={{ padding: 'var(--space-2) 0', borderBottom: '1px solid var(--sapTile_BorderColor, var(--color-border-light))' }}>
                    <dt style={{ marginBottom: 'var(--space-1)', color: 'var(--sapContent_LabelColor, var(--color-text-muted))', fontSize: 'var(--text-xs)', fontWeight: 'normal' }}>
                      <ui5-title level="H4" style={{ fontWeight: 'bold' }}>Execution</ui5-title>
                    </dt>
                    <dd style={{ margin: 0, color: 'var(--sapTextColor, var(--color-text))', fontSize: 'var(--text-sm)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                      {activeExecution.execution_id}
                    </dd>
                  </div>

                  <div style={{ padding: 'var(--space-2) 0', borderBottom: '1px solid var(--sapTile_BorderColor, var(--color-border-light))' }}>
                    <dt style={{ marginBottom: 'var(--space-1)', color: 'var(--sapContent_LabelColor, var(--color-text-muted))', fontSize: 'var(--text-xs)', fontWeight: 'normal' }}>
                      <ui5-title level="H4" style={{ fontWeight: 'bold' }}>Plan</ui5-title>
                    </dt>
                    <dd style={{ margin: 0, color: 'var(--sapTextColor, var(--color-text))', fontSize: 'var(--text-sm)' }}>
                      <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{activeExecution.plan_id}</span> · version <span style={{ fontWeight: 600 }}>{activeExecution.plan_version}</span>
                    </dd>
                  </div>

                  <div style={{ padding: 'var(--space-2) 0', borderBottom: '1px solid var(--sapTile_BorderColor, var(--color-border-light))' }}>
                    <dt style={{ marginBottom: 'var(--space-1)', color: 'var(--sapContent_LabelColor, var(--color-text-muted))', fontSize: 'var(--text-xs)', fontWeight: 'normal' }}>
                      <ui5-title level="H4" style={{ fontWeight: 'bold' }}>Decision</ui5-title>
                    </dt>
                    <dd style={{ margin: 0, color: 'var(--sapTextColor, var(--color-text))', fontSize: 'var(--text-sm)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                      {activeExecution.decision_id}
                    </dd>
                  </div>

                  <div style={{ padding: 'var(--space-2) 0', borderBottom: '1px solid var(--sapTile_BorderColor, var(--color-border-light))' }}>
                    <dt style={{ marginBottom: 'var(--space-1)', color: 'var(--sapContent_LabelColor, var(--color-text-muted))', fontSize: 'var(--text-xs)', fontWeight: 'normal' }}>
                      <ui5-title level="H4" style={{ fontWeight: 'bold' }}>Started</ui5-title>
                    </dt>
                    <dd style={{ margin: 0, color: 'var(--sapTextColor, var(--color-text))', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
                      {formatLocalTimestamp(activeExecution.started_at)}
                    </dd>
                  </div>
                </dl>

                {/* Recovery metrics & SAP mappings in Summary Card (FB-12) */}
                <div style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--sapTile_BorderColor, var(--color-border-light))' }}>
                  <ui5-title level="H4" style={{ fontWeight: 'bold', marginBottom: 'var(--space-2)' }}>
                    Recovery metrics
                  </ui5-title>
                  <dl
                    className="ae-recovery-metrics"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: 'var(--space-3)',
                      margin: 0,
                    }}
                  >
                    <div>
                      <dt style={{ color: 'var(--sapContent_LabelColor, var(--color-text-muted))', fontSize: 'var(--text-xs)', fontWeight: 'normal' }}>
                        Net avoided loss
                      </dt>
                      <dd style={{ margin: 'var(--space-1) 0 0', color: 'var(--sapPositiveColor, #107e3e)', fontSize: 'var(--text-base)', fontWeight: 600 }}>
                        {formatMoney(netAvoidedLoss)}
                      </dd>
                    </div>
                    <div>
                      <dt style={{ color: 'var(--sapContent_LabelColor, var(--color-text-muted))', fontSize: 'var(--text-xs)', fontWeight: 'normal' }}>
                        Recovery cost
                      </dt>
                      <dd style={{ margin: 'var(--space-1) 0 0', color: 'var(--sapTextColor, var(--color-text))', fontSize: 'var(--text-base)', fontWeight: 600 }}>
                        {formatMoney(recoveryCost)}
                      </dd>
                    </div>
                    <div>
                      <dt style={{ color: 'var(--sapContent_LabelColor, var(--color-text-muted))', fontSize: 'var(--text-xs)', fontWeight: 'normal' }}>
                        Residual loss
                      </dt>
                      <dd style={{ margin: 'var(--space-1) 0 0', color: 'var(--sapTextColor, var(--color-text))', fontSize: 'var(--text-base)', fontWeight: 600 }}>
                        {formatMoney(residualLoss)}
                      </dd>
                    </div>
                    <div>
                      <dt style={{ color: 'var(--sapContent_LabelColor, var(--color-text-muted))', fontSize: 'var(--text-xs)', fontWeight: 'normal' }}>
                        Baseline loss
                      </dt>
                      <dd style={{ margin: 'var(--space-1) 0 0', color: 'var(--sapTextColor, var(--color-text))', fontSize: 'var(--text-base)', fontWeight: 600 }}>
                        {formatMoney(baselineLoss)}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--sapTile_BorderColor, var(--color-border-light))' }}>
                  <ui5-title level="H4" style={{ fontWeight: 'bold', marginBottom: 'var(--space-2)' }}>
                    SAP mappings
                  </ui5-title>
                  <div
                    className="ae-sap-mappings-summary"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                      gap: 'var(--space-2)',
                      fontSize: 'var(--text-xs)',
                    }}
                  >
                    <div style={{ padding: 'var(--space-2)', background: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--sapTile_BorderColor, var(--color-border))' }}>
                      <span style={{ fontWeight: 600, color: 'var(--sapTextColor, var(--color-text))', display: 'block', marginBottom: '2px' }}>GTS (Trade Finance)</span>
                      <span style={{ color: 'var(--sapContent_LabelColor, var(--color-text-muted))', fontFamily: 'var(--font-mono)' }}>SWIFT MT707 Letter of Credit Amendment</span>
                    </div>
                    <div style={{ padding: 'var(--space-2)', background: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--sapTile_BorderColor, var(--color-border))' }}>
                      <span style={{ fontWeight: 600, color: 'var(--sapTextColor, var(--color-text))', display: 'block', marginBottom: '2px' }}>MM (Materials Management)</span>
                      <span style={{ color: 'var(--sapContent_LabelColor, var(--color-text-muted))', fontFamily: 'var(--font-mono)' }}>PO Processing (ME21N / ME22N)</span>
                    </div>
                    <div style={{ padding: 'var(--space-2)', background: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--sapTile_BorderColor, var(--color-border))' }}>
                      <span style={{ fontWeight: 600, color: 'var(--sapTextColor, var(--color-text))', display: 'block', marginBottom: '2px' }}>TM & GTS (Logistics)</span>
                      <span style={{ color: 'var(--sapContent_LabelColor, var(--color-text-muted))', fontFamily: 'var(--font-mono)' }}>Freight Order Booking & AIFTA Origin</span>
                    </div>
                    <div style={{ padding: 'var(--space-2)', background: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--sapTile_BorderColor, var(--color-border))' }}>
                      <span style={{ fontWeight: 600, color: 'var(--sapTextColor, var(--color-text))', display: 'block', marginBottom: '2px' }}>SD (Sales & Distribution)</span>
                      <span style={{ color: 'var(--sapContent_LabelColor, var(--color-text-muted))', fontFamily: 'var(--font-mono)' }}>aATP Reallocation & Stock Transport</span>
                    </div>
                  </div>
                </div>
              </div>
            </ui5-card>

            <p
              className="approval-note"
              style={{
                margin: 'var(--space-3) 0',
                padding: 'var(--space-3)',
                border: '1px solid var(--sapTile_BorderColor, var(--color-border))',
                borderRadius: 'var(--radius-md)',
                color: 'var(--sapContent_LabelColor, var(--color-text-muted))',
                background: 'var(--color-bg-subtle)',
                fontSize: 'var(--text-sm)',
                lineHeight: 'var(--leading-relaxed)',
              }}
            >
              Every row below is simulated. No SAP system was changed.
            </p>

            {/* 4-Step UI5 Wizard / Process Flow (D7 & FB-12) */}
            <ui5-wizard
              contentLayout="MultipleSteps"
              className="ae-wizard"
              onstep-change={(e: Event) => {
                const customEvent = e as CustomEvent<{ step?: HTMLElement }>;
                const targetStep = customEvent.detail?.step;
                if (targetStep) {
                  const idx = Number(targetStep.getAttribute('data-step-index') ?? 0);
                  setSelectedStep(idx);
                }
              }}
            >
              {/* Step 1: MT707 AMEND-2026-0019 */}
              <ui5-wizard-step
                data-step-index={0}
                titleText="MT707 AMEND-2026-0019"
                subtitleText="Trade finance documentary credit amendment"
                icon="document-text"
                selected={selectedStep === 0}
              >
                <div
                  className="ae-step-card"
                  style={{
                    padding: 'var(--space-4)',
                    background: 'var(--sapTile_Background, var(--color-bg-elevated))',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--sapTile_BorderColor, var(--color-border))',
                    borderLeft: `4px solid ${step1Status === 'succeeded' ? 'var(--sapPositiveColor, #107e3e)' : 'var(--sapCriticalColor, #e9730c)'}`,
                    marginBottom: 'var(--space-4)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                    <ui5-title level="H4" style={{ margin: 0, fontWeight: 'bold' }}>
                      Step 1. MT707 AMEND-2026-0019
                    </ui5-title>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <ui5-icon
                        name={getStatusIcon(step1Status).name}
                        style={{ color: getStatusIcon(step1Status).color, fontSize: '1rem' }}
                        accessibleName={`Step 1 status: ${step1Status}`}
                      />
                      <ui5-tag design={tagDesign(step1Status)}>{step1Status}</ui5-tag>
                      <span className="ae-step-timing" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: 'var(--sapContent_LabelColor, var(--color-text-muted))', fontSize: 'var(--text-xs)', fontWeight: 600 }}>
                        <ui5-icon name="history" style={{ fontSize: '0.875rem' }} />
                        {STEP_TIMINGS.step1}
                      </span>
                    </div>
                  </div>
                  <p style={{ margin: 'var(--space-2) 0 0', color: 'var(--sapContent_LabelColor, var(--color-text-muted))', fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-relaxed)' }}>
                    SWIFT MT707 documentary credit amendment request AMEND-2026-0019 under UCP 600 rules. Amends latest shipment date (clause 44C) and port of loading / discharge to facilitate alternate route execution.
                  </p>
                  <p className="ae-refs" style={{ marginTop: 'var(--space-2)', overflowWrap: 'anywhere', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>
                    <strong>References:</strong> {JSON.stringify({ amendment_id: 'AMEND-2026-0019', lc_id: 'LC-2026-0088', rule_framework: 'UCP 600 Sub-Article 20(c)' })}
                  </p>
                  <p className="ae-mapping-label" style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)' }}>
                    <strong>Proposed SAP mapping:</strong> SAP Global Trade Services (GTS) — Letter of Credit Amendment (SWIFT MT707)
                  </p>
                  <ui5-tag design="Information" style={{ marginTop: 'var(--space-2)' }}>Simulated</ui5-tag>
                </div>
              </ui5-wizard-step>

              {/* Step 2: MM PO re-issue */}
              <ui5-wizard-step
                data-step-index={1}
                titleText="MM PO re-issue"
                subtitleText="Materials Management purchasing amendment"
                icon="cart"
                selected={selectedStep === 1}
              >
                <div
                  className="ae-step-card"
                  style={{
                    padding: 'var(--space-4)',
                    background: 'var(--sapTile_Background, var(--color-bg-elevated))',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--sapTile_BorderColor, var(--color-border))',
                    borderLeft: `4px solid ${step2Status === 'succeeded' ? 'var(--sapPositiveColor, #107e3e)' : step2Status === 'failed' ? 'var(--sapNegativeColor, #b00)' : 'var(--sapCriticalColor, #e9730c)'}`,
                    marginBottom: 'var(--space-4)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                    <ui5-title level="H4" style={{ margin: 0, fontWeight: 'bold' }}>
                      Step 2. MM PO re-issue
                    </ui5-title>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <ui5-icon
                        name={getStatusIcon(step2Status).name}
                        style={{ color: getStatusIcon(step2Status).color, fontSize: '1rem' }}
                        accessibleName={`Step 2 status: ${step2Status}`}
                      />
                      <ui5-tag design={tagDesign(step2Status)}>{step2Status}</ui5-tag>
                      <span className="ae-step-timing" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: 'var(--sapContent_LabelColor, var(--color-text-muted))', fontSize: 'var(--text-xs)', fontWeight: 600 }}>
                        <ui5-icon name="history" style={{ fontSize: '0.875rem' }} />
                        {STEP_TIMINGS.step2}
                      </span>
                    </div>
                  </div>
                  <p style={{ margin: 'var(--space-2) 0 0', color: 'var(--sapContent_LabelColor, var(--color-text-muted))', fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-relaxed)' }}>
                    SAP S/4HANA Materials Management (MM) purchase order reduction and re-issuance. Reduces line quantities on disrupted supplier orders under force-majeure terms and creates new purchase orders for approved alternate quotes.
                  </p>
                  <p className="ae-mapping-label" style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)' }}>
                    <strong>Proposed SAP mapping:</strong> S/4HANA MM Purchase Order Processing (ME21N / ME22N)
                  </p>
                  <ui5-tag design="Information" style={{ marginTop: 'var(--space-2)' }}>Simulated</ui5-tag>

                  {/* Render linked execution steps (REDUCE_PO, CREATE_PO) */}
                  {mmSteps.length > 0 && (
                    <div className="ae-substeps-list" style={{ marginTop: 'var(--space-3)' }}>
                      {mmSteps.map((step) => {
                        const sIcon = getStatusIcon(step.status);
                        return (
                          <div
                            key={step.seq}
                            className="ae-substep-item"
                            style={{
                              padding: 'var(--space-3)',
                              marginTop: 'var(--space-2)',
                              background: step.status === 'failed' ? 'var(--color-error-bg, #fff0ed)' : 'var(--color-bg-subtle)',
                              border: '1px solid var(--sapTile_BorderColor, var(--color-border))',
                              borderRadius: 'var(--radius-sm)',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                <ui5-icon name={sIcon.name} style={{ color: sIcon.color, fontSize: '0.875rem' }} />
                                <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                                  {step.seq}. {step.step_type.replace(/_/g, ' ')}
                                </span>
                              </div>
                              <ui5-tag design={tagDesign(step.status)}>{step.status}</ui5-tag>
                            </div>
                            <p style={{ margin: 'var(--space-1) 0 0', color: 'var(--sapContent_LabelColor, var(--color-text-muted))', fontSize: 'var(--text-xs)' }}>
                              {step.description}
                            </p>
                            <p className="ae-refs" style={{ marginTop: 'var(--space-1)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>
                              <strong>References:</strong> {JSON.stringify(step.refs)}
                            </p>
                            <p className="ae-mapping-label" style={{ marginTop: 'var(--space-1)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)' }}>
                              <strong>Proposed SAP mapping:</strong> {step.proposed_sap_mapping}
                            </p>
                            {step.error && (
                              <p style={{ color: 'var(--sapNegativeColor, #b00)', fontSize: 'var(--text-xs)', marginTop: 'var(--space-1)' }}>
                                {typeof step.error === 'string' ? step.error : step.error.message ?? 'Step failed.'}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </ui5-wizard-step>

              {/* Step 3: TM consignment + AIFTA Form AI */}
              <ui5-wizard-step
                data-step-index={2}
                titleText="TM consignment + AIFTA Form AI"
                subtitleText="Transportation Management & preferential origin"
                icon="shipping-status"
                selected={selectedStep === 2}
              >
                <div
                  className="ae-step-card"
                  style={{
                    padding: 'var(--space-4)',
                    background: 'var(--sapTile_Background, var(--color-bg-elevated))',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--sapTile_BorderColor, var(--color-border))',
                    borderLeft: `4px solid ${step3Status === 'succeeded' ? 'var(--sapPositiveColor, #107e3e)' : step3Status === 'failed' ? 'var(--sapNegativeColor, #b00)' : 'var(--sapCriticalColor, #e9730c)'}`,
                    marginBottom: 'var(--space-4)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                    <ui5-title level="H4" style={{ margin: 0, fontWeight: 'bold' }}>
                      Step 3. TM consignment + AIFTA Form AI
                    </ui5-title>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <ui5-icon
                        name={getStatusIcon(step3Status).name}
                        style={{ color: getStatusIcon(step3Status).color, fontSize: '1rem' }}
                        accessibleName={`Step 3 status: ${step3Status}`}
                      />
                      <ui5-tag design={tagDesign(step3Status)}>{step3Status}</ui5-tag>
                      <span className="ae-step-timing" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: 'var(--sapContent_LabelColor, var(--color-text-muted))', fontSize: 'var(--text-xs)', fontWeight: 600 }}>
                        <ui5-icon name="history" style={{ fontSize: '0.875rem' }} />
                        {STEP_TIMINGS.step3}
                      </span>
                    </div>
                  </div>
                  <p style={{ margin: 'var(--space-2) 0 0', color: 'var(--sapContent_LabelColor, var(--color-text-muted))', fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-relaxed)' }}>
                    SAP Transportation Management (TM) freight order consignment booking and preferential origin certification under the ASEAN-India Free Trade Area (AIFTA Form AI) for preferential tariff qualification.
                  </p>
                  <p className="ae-mapping-label" style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)' }}>
                    <strong>Proposed SAP mapping:</strong> SAP Transportation Management (TM) freight order & GTS customs preferential declaration
                  </p>
                  <ui5-tag design="Information" style={{ marginTop: 'var(--space-2)' }}>Simulated</ui5-tag>

                  {/* Render linked execution steps (BOOK_FREIGHT) */}
                  {tmSteps.length > 0 && (
                    <div className="ae-substeps-list" style={{ marginTop: 'var(--space-3)' }}>
                      {tmSteps.map((step) => {
                        const sIcon = getStatusIcon(step.status);
                        return (
                          <div
                            key={step.seq}
                            className="ae-substep-item"
                            style={{
                              padding: 'var(--space-3)',
                              marginTop: 'var(--space-2)',
                              background: step.status === 'failed' ? 'var(--color-error-bg, #fff0ed)' : 'var(--color-bg-subtle)',
                              border: '1px solid var(--sapTile_BorderColor, var(--color-border))',
                              borderRadius: 'var(--radius-sm)',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                <ui5-icon name={sIcon.name} style={{ color: sIcon.color, fontSize: '0.875rem' }} />
                                <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                                  {step.seq}. {step.step_type.replace(/_/g, ' ')}
                                </span>
                              </div>
                              <ui5-tag design={tagDesign(step.status)}>{step.status}</ui5-tag>
                            </div>
                            <p style={{ margin: 'var(--space-1) 0 0', color: 'var(--sapContent_LabelColor, var(--color-text-muted))', fontSize: 'var(--text-xs)' }}>
                              {step.description}
                            </p>
                            <p className="ae-refs" style={{ marginTop: 'var(--space-1)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>
                              <strong>References:</strong> {JSON.stringify(step.refs)}
                            </p>
                            <p className="ae-mapping-label" style={{ marginTop: 'var(--space-1)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)' }}>
                              <strong>Proposed SAP mapping:</strong> {step.proposed_sap_mapping}
                            </p>
                            {step.error && (
                              <p style={{ color: 'var(--sapNegativeColor, #b00)', fontSize: 'var(--text-xs)', marginTop: 'var(--space-1)' }}>
                                {typeof step.error === 'string' ? step.error : step.error.message ?? 'Step failed.'}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </ui5-wizard-step>

              {/* Step 4: SD ATP reallocation */}
              <ui5-wizard-step
                data-step-index={3}
                titleText="SD ATP reallocation"
                subtitleText="Sales & Distribution stock reservation & ATP"
                icon="sales-order"
                selected={selectedStep === 3}
              >
                <div
                  className="ae-step-card"
                  style={{
                    padding: 'var(--space-4)',
                    background: 'var(--sapTile_Background, var(--color-bg-elevated))',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--sapTile_BorderColor, var(--color-border))',
                    borderLeft: `4px solid ${step4Status === 'succeeded' ? 'var(--sapPositiveColor, #107e3e)' : step4Status === 'failed' ? 'var(--sapNegativeColor, #b00)' : 'var(--sapCriticalColor, #e9730c)'}`,
                    marginBottom: 'var(--space-4)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                    <ui5-title level="H4" style={{ margin: 0, fontWeight: 'bold' }}>
                      Step 4. SD ATP reallocation
                    </ui5-title>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <ui5-icon
                        name={getStatusIcon(step4Status).name}
                        style={{ color: getStatusIcon(step4Status).color, fontSize: '1rem' }}
                        accessibleName={`Step 4 status: ${step4Status}`}
                      />
                      <ui5-tag design={tagDesign(step4Status)}>{step4Status}</ui5-tag>
                      <span className="ae-step-timing" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: 'var(--sapContent_LabelColor, var(--color-text-muted))', fontSize: 'var(--text-xs)', fontWeight: 600 }}>
                        <ui5-icon name="history" style={{ fontSize: '0.875rem' }} />
                        {STEP_TIMINGS.step4}
                      </span>
                    </div>
                  </div>
                  <p style={{ margin: 'var(--space-2) 0 0', color: 'var(--sapContent_LabelColor, var(--color-text-muted))', fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-relaxed)' }}>
                    SAP S/4HANA Sales & Distribution (SD) advanced Available-to-Promise (aATP) reallocation, inter-facility stock transport orders, inventory reservations, and customer shipment schedule notifications.
                  </p>
                  <p className="ae-mapping-label" style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)' }}>
                    <strong>Proposed SAP mapping:</strong> S/4HANA advanced ATP (aATP) reallocation, stock transport order & reservations
                  </p>
                  <ui5-tag design="Information" style={{ marginTop: 'var(--space-2)' }}>Simulated</ui5-tag>

                  {/* Render linked execution steps (CREATE_STOCK_TRANSFER, RESERVE_STOCK, NOTIFY_CUSTOMER) */}
                  {sdSteps.length > 0 && (
                    <div className="ae-substeps-list" style={{ marginTop: 'var(--space-3)' }}>
                      {sdSteps.map((step) => {
                        const sIcon = getStatusIcon(step.status);
                        return (
                          <div
                            key={step.seq}
                            className="ae-substep-item"
                            style={{
                              padding: 'var(--space-3)',
                              marginTop: 'var(--space-2)',
                              background: step.status === 'failed' ? 'var(--color-error-bg, #fff0ed)' : 'var(--color-bg-subtle)',
                              border: '1px solid var(--sapTile_BorderColor, var(--color-border))',
                              borderRadius: 'var(--radius-sm)',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                <ui5-icon name={sIcon.name} style={{ color: sIcon.color, fontSize: '0.875rem' }} />
                                <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                                  {step.seq}. {step.step_type.replace(/_/g, ' ')}
                                </span>
                              </div>
                              <ui5-tag design={tagDesign(step.status)}>{step.status}</ui5-tag>
                            </div>
                            <p style={{ margin: 'var(--space-1) 0 0', color: 'var(--sapContent_LabelColor, var(--color-text-muted))', fontSize: 'var(--text-xs)' }}>
                              {step.description}
                            </p>
                            <p className="ae-refs" style={{ marginTop: 'var(--space-1)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>
                              <strong>References:</strong> {JSON.stringify(step.refs)}
                            </p>
                            <p className="ae-mapping-label" style={{ marginTop: 'var(--space-1)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)' }}>
                              <strong>Proposed SAP mapping:</strong> {step.proposed_sap_mapping}
                            </p>
                            {step.error && (
                              <p style={{ color: 'var(--sapNegativeColor, #b00)', fontSize: 'var(--text-xs)', marginTop: 'var(--space-1)' }}>
                                {typeof step.error === 'string' ? step.error : step.error.message ?? 'Step failed.'}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </ui5-wizard-step>
            </ui5-wizard>

            {activeExecution.status === 'failed' && (
              <p className="blocked-reason" style={{ marginTop: 'var(--space-3)', color: 'var(--sapNegativeColor, #b00)', fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-relaxed)' }}>
                Execution failed. Later steps, if any, are skipped. No automatic retry or compensation is performed.
              </p>
            )}
            {activeExecution.status === 'completed' && (
              <p className="approval-note" style={{ marginTop: 'var(--space-3)', padding: 'var(--space-3)', border: '1px solid var(--sapTile_BorderColor, var(--color-border))', borderRadius: 'var(--radius-md)', color: 'var(--sapContent_LabelColor, var(--color-text-muted))', background: 'var(--color-bg-subtle)', fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-relaxed)' }}>
                The API reports this simulated execution as completed.
              </p>
            )}
          </div>
        ) : (
          <section className="execution-empty" aria-labelledby="execution-empty-heading">
            <div style={{ marginBottom: 'var(--space-3)' }}>
              <ui5-title level="H3" style={{ fontWeight: 'bold' }}>
                Workspace
              </ui5-title>
            </div>
            <p id="execution-empty-heading" role="status" style={{ marginBottom: 'var(--space-4)', color: 'var(--sapContent_LabelColor, var(--color-text-muted))' }}>
              No execution record is included in the fixtures. Connect the supported backend in live mode to submit and view an execution.
            </p>
            <div className="execution-launch-list" aria-label="Available execution plans">
              {evaluation?.plans.filter((plan) => ['approved', 'completed', 'pending_approval', 'ready'].includes(plan.status) || plan.outcome === 'passed').map((plan) => (
                <ui5-card key={plan.plan_id} className="ae-plan-card execution-launch" role="article" aria-label={`Execution plan: ${plan.label}`} style={{ marginTop: 'var(--space-3)', padding: 'var(--space-4)' }}>
                  <ui5-title level="H4" style={{ fontWeight: 'bold', color: 'var(--sapTextColor, var(--color-text))' }}>{plan.label}</ui5-title>
                  <p style={{ color: 'var(--sapContent_LabelColor, var(--color-text-muted))', fontSize: 'var(--text-sm)', margin: 'var(--space-2) 0' }}>
                    Plan <span style={{ fontFamily: 'var(--font-mono)' }}>{plan.plan_id}</span> · {plan.status.replace(/_/g, ' ')}
                  </p>
                  <ui5-button design="Emphasized" disabled={executionSubmitting} onClick={() => startPlanExecution(plan)} style={{ marginTop: 'var(--space-2)', width: '100%' }}>
                    {executionSubmitting ? 'Loading…' : 'Load or start simulated execution'}
                  </ui5-button>
                </ui5-card>
              ))}
            </div>
          </section>
        )}
      </PageBody>
    </>
  );
}
