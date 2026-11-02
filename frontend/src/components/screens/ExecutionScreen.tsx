import { useState } from 'react';
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
import type * as React from 'react';
import { PageHeader, PageBody } from '../layout';
import type { Evaluation, Execution, ExecutionStep, Plan } from '../../api/types';
/* eslint-disable @typescript-eslint/no-namespace */
declare module 'react/jsx-runtime' {
  namespace JSX {
    interface IntrinsicElements {
      'ui5-card': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        loading?: boolean;
        loadingDelay?: number;
        accessibleName?: string;
        [key: string]: unknown;
      };
      'ui5-card-header': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        titleText?: string;
        subtitleText?: string;
        additionalText?: string;
        status?: string;
        interactive?: boolean;
        [key: string]: unknown;
      };
      'ui5-button': React.DetailedHTMLProps<React.ButtonHTMLAttributes<HTMLElement>, HTMLElement> & {
        design?: 'Default' | 'Positive' | 'Negative' | 'Transparent' | 'Emphasized' | 'Attention';
        disabled?: boolean;
        icon?: string;
        endIcon?: string;
        accessibleName?: string;
        [key: string]: unknown;
      };
      'ui5-tag': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        design?: 'Set1' | 'Set2' | 'Neutral' | 'Information' | 'Positive' | 'Negative' | 'Critical';
        colorScheme?: string;
        hideStateIcon?: boolean;
        interactive?: boolean;
        [key: string]: unknown;
      };
      'ui5-title': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        level?: 'H1' | 'H2' | 'H3' | 'H4' | 'H5' | 'H6';
        size?: 'H1' | 'H2' | 'H3' | 'H4' | 'H5' | 'H6';
        wrappingType?: 'None' | 'Normal';
        [key: string]: unknown;
      };
      'ui5-label': React.DetailedHTMLProps<React.LabelHTMLAttributes<HTMLElement>, HTMLElement> & {
        for?: string;
        showColon?: boolean;
        required?: boolean;
        wrappingType?: 'None' | 'Normal';
        [key: string]: unknown;
      };
      'ui5-icon': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        name?: string;
        design?: 'Contrast' | 'Critical' | 'Default' | 'Information' | 'Negative' | 'Neutral' | 'NonInteractive' | 'Positive';
        mode?: 'Image' | 'Decorative' | 'Interactive';
        accessibleName?: string;
        showTooltip?: boolean;
        [key: string]: unknown;
      };
      'ui5-wizard': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        contentLayout?: 'MultipleSteps' | 'SingleStep';
        'onstep-change'?: (event: Event) => void;
        [key: string]: unknown;
      };
      'ui5-wizard-step': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        titleText?: string;
        subtitleText?: string;
        icon?: string;
        selected?: boolean;
        disabled?: boolean;
        branching?: boolean;
        'data-step-index'?: number;
        [key: string]: unknown;
      };
    }
  }
}
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
  const [selectedStep, setSelectedStep] = useState(0);

  // Group backend execution steps into the 4 business process flow steps (D7)
  const steps: ExecutionStep[] = execution?.steps || [];
  const mmSteps = steps.filter((s) => s.step_type === 'REDUCE_PO' || s.step_type === 'CREATE_PO');
  const tmSteps = steps.filter((s) => s.step_type === 'BOOK_FREIGHT');
  const sdSteps = steps.filter((s) =>
    ['CREATE_STOCK_TRANSFER', 'RESERVE_STOCK', 'NOTIFY_CUSTOMER'].includes(s.step_type)
  );

  const getStepStatus = (substeps: ExecutionStep[]) => {
    if (!execution) return 'pending';
    if (substeps.some((s) => s.status === 'failed')) return 'failed';
    if (substeps.length > 0 && substeps.every((s) => s.status === 'succeeded')) return 'succeeded';
    if (execution.status === 'completed') return 'succeeded';
    if (execution.status === 'failed') return 'failed';
    return 'running';
  };

  const step1Status = execution ? (execution.status === 'failed' && steps[0]?.status === 'failed' ? 'failed' : 'succeeded') : 'pending';
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

  return (
    <>
      <PageHeader
        eyebrow="WORKSPACE / EXECUTION"
        title="Simulated execution"
        subtitle="Execution requests require an approved plan and its recorded decision. SAP mappings are proposals only."
      >
        {execution && (
          <ui5-tag design={tagDesign(execution.status)}>{execution.status}</ui5-tag>
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
            {execution && ['queued', 'running'].includes(execution.status) && (
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

        {execution ? (
          <div className="ae-execution-panel" role="region" aria-label="Simulated execution details">
            {/* Execution Metadata Card */}
            <ui5-card
              className="ae-summary-card"
              style={{
                marginBottom: 'var(--space-4)',
                padding: 'var(--space-4)',
                borderLeft: `4px solid ${
                  execution.status === 'completed'
                    ? 'var(--sapPositiveColor, #107e3e)'
                    : execution.status === 'failed'
                    ? 'var(--sapNegativeColor, #b00)'
                    : 'var(--sapCriticalColor, #e9730c)'
                }`,
              }}
            >
              <dl
                className="ae-finding-details"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: 'var(--space-3)',
                  margin: 0,
                }}
              >
                <div style={{ padding: 'var(--space-2) 0' }}>
                  <dt style={{ marginBottom: 'var(--space-1)', color: 'var(--sapContent_LabelColor, var(--color-text-muted))', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', textTransform: 'uppercase' }}>
                    Execution
                  </dt>
                  <dd style={{ margin: 0, color: 'var(--color-text)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-mono)' }}>
                    {execution.execution_id}
                  </dd>
                </div>
                <div style={{ padding: 'var(--space-2) 0' }}>
                  <dt style={{ marginBottom: 'var(--space-1)', color: 'var(--sapContent_LabelColor, var(--color-text-muted))', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', textTransform: 'uppercase' }}>
                    Plan
                  </dt>
                  <dd style={{ margin: 0, color: 'var(--color-text)', fontSize: 'var(--text-sm)' }}>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{execution.plan_id}</span> · version {execution.plan_version}
                  </dd>
                </div>
                <div style={{ padding: 'var(--space-2) 0' }}>
                  <dt style={{ marginBottom: 'var(--space-1)', color: 'var(--sapContent_LabelColor, var(--color-text-muted))', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', textTransform: 'uppercase' }}>
                    Decision
                  </dt>
                  <dd style={{ margin: 0, color: 'var(--color-text)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-mono)' }}>
                    {execution.decision_id}
                  </dd>
                </div>
                <div style={{ padding: 'var(--space-2) 0' }}>
                  <dt style={{ marginBottom: 'var(--space-1)', color: 'var(--sapContent_LabelColor, var(--color-text-muted))', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', textTransform: 'uppercase' }}>
                    Started
                  </dt>
                  <dd style={{ margin: 0, color: 'var(--color-text)', fontSize: 'var(--text-sm)' }}>
                    {formatLocalTimestamp(execution.started_at)}
                  </dd>
                </div>
              </dl>
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

            {/* 4-Step UI5 Wizard / Process Flow (D7) */}
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
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
                    <ui5-title level="H4" style={{ margin: 0, fontWeight: 'bold' }}>
                      Step 1. MT707 AMEND-2026-0019
                    </ui5-title>
                    <ui5-tag design={tagDesign(step1Status)}>{step1Status}</ui5-tag>
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
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
                    <ui5-title level="H4" style={{ margin: 0, fontWeight: 'bold' }}>
                      Step 2. MM PO re-issue
                    </ui5-title>
                    <ui5-tag design={tagDesign(step2Status)}>{step2Status}</ui5-tag>
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
                      {mmSteps.map((step) => (
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
                            <span style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)' }}>
                              {step.seq}. {step.step_type.replace(/_/g, ' ')}
                            </span>
                            <ui5-tag design={tagDesign(step.status)}>{step.status}</ui5-tag>
                          </div>
                          <p style={{ margin: 'var(--space-1) 0 0', color: 'var(--sapContent_LabelColor, var(--color-text-muted))', fontSize: 'var(--text-xs)' }}>
                            {step.description}
                          </p>
                          <p className="ae-refs" style={{ marginTop: 'var(--space-1)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>
                            <strong>References:</strong> {JSON.stringify(step.refs)}
                          </p>
                          {step.error && (
                            <p style={{ color: 'var(--sapNegativeColor, #b00)', fontSize: 'var(--text-xs)', marginTop: 'var(--space-1)' }}>
                              {typeof step.error === 'string' ? step.error : step.error.message ?? 'Step failed.'}
                            </p>
                          )}
                        </div>
                      ))}
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
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
                    <ui5-title level="H4" style={{ margin: 0, fontWeight: 'bold' }}>
                      Step 3. TM consignment + AIFTA Form AI
                    </ui5-title>
                    <ui5-tag design={tagDesign(step3Status)}>{step3Status}</ui5-tag>
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
                      {tmSteps.map((step) => (
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
                            <span style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)' }}>
                              {step.seq}. {step.step_type.replace(/_/g, ' ')}
                            </span>
                            <ui5-tag design={tagDesign(step.status)}>{step.status}</ui5-tag>
                          </div>
                          <p style={{ margin: 'var(--space-1) 0 0', color: 'var(--sapContent_LabelColor, var(--color-text-muted))', fontSize: 'var(--text-xs)' }}>
                            {step.description}
                          </p>
                          <p className="ae-refs" style={{ marginTop: 'var(--space-1)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>
                            <strong>References:</strong> {JSON.stringify(step.refs)}
                          </p>
                          {step.error && (
                            <p style={{ color: 'var(--sapNegativeColor, #b00)', fontSize: 'var(--text-xs)', marginTop: 'var(--space-1)' }}>
                              {typeof step.error === 'string' ? step.error : step.error.message ?? 'Step failed.'}
                            </p>
                          )}
                        </div>
                      ))}
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
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
                    <ui5-title level="H4" style={{ margin: 0, fontWeight: 'bold' }}>
                      Step 4. SD ATP reallocation
                    </ui5-title>
                    <ui5-tag design={tagDesign(step4Status)}>{step4Status}</ui5-tag>
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
                      {sdSteps.map((step) => (
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
                            <span style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)' }}>
                              {step.seq}. {step.step_type.replace(/_/g, ' ')}
                            </span>
                            <ui5-tag design={tagDesign(step.status)}>{step.status}</ui5-tag>
                          </div>
                          <p style={{ margin: 'var(--space-1) 0 0', color: 'var(--sapContent_LabelColor, var(--color-text-muted))', fontSize: 'var(--text-xs)' }}>
                            {step.description}
                          </p>
                          <p className="ae-refs" style={{ marginTop: 'var(--space-1)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>
                            <strong>References:</strong> {JSON.stringify(step.refs)}
                          </p>
                          {step.error && (
                            <p style={{ color: 'var(--sapNegativeColor, #b00)', fontSize: 'var(--text-xs)', marginTop: 'var(--space-1)' }}>
                              {typeof step.error === 'string' ? step.error : step.error.message ?? 'Step failed.'}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </ui5-wizard-step>
            </ui5-wizard>

            {execution.status === 'failed' && (
              <p className="blocked-reason" style={{ marginTop: 'var(--space-3)', color: 'var(--sapNegativeColor, #b00)', fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-relaxed)' }}>
                Execution failed. Later steps, if any, are skipped. No automatic retry or compensation is performed.
              </p>
            )}
            {execution.status === 'completed' && (
              <p className="approval-note" style={{ marginTop: 'var(--space-3)', padding: 'var(--space-3)', border: '1px solid var(--sapTile_BorderColor, var(--color-border))', borderRadius: 'var(--radius-md)', color: 'var(--sapContent_LabelColor, var(--color-text-muted))', background: 'var(--color-bg-subtle)', fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-relaxed)' }}>
                The API reports this simulated execution as completed.
              </p>
            )}
          </div>
        ) : (
          <section className="execution-empty" aria-labelledby="execution-empty-heading">
            <p id="execution-empty-heading" role="status" style={{ marginBottom: 'var(--space-4)', color: 'var(--sapContent_LabelColor, var(--color-text-muted))' }}>
              No execution record is included in the fixtures. Connect the supported backend in live mode to submit and view an execution.
            </p>
            <div className="execution-launch-list" aria-label="Available execution plans">
              {evaluation?.plans.filter((plan) => ['approved', 'completed'].includes(plan.status)).map((plan) => (
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
