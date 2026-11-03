import { useEffect, useState } from 'react';
import { AlertTriangle, Eye, ShieldAlert, CheckCircle, Network, Clock, Layers } from 'lucide-react';
import '@ui5/webcomponents/dist/Card.js';
import '@ui5/webcomponents/dist/CardHeader.js';
import '@ui5/webcomponents/dist/Button.js';
import '@ui5/webcomponents/dist/Tag.js';
import { PageHeader, PageBody } from '../layout';
import { NeuCard } from '../ui/NeuCard';
import { NeuButton } from '../ui/NeuButton';
import { NeuChip } from '../ui/NeuChip';
import { getEarlyWarnings } from '../../api/client';
import type { EarlyWarningResult, EarlyWarning } from '../../api/types';

const AS_OF_PRE_NOTICE = '2026-10-23T21:00:00+05:30';
const AS_OF_SCENARIO_TIME = '2026-10-26T09:00:00+05:30';

interface NodeStructuralRisk {
  nodeId: string;
  label: string;
  role: string;
  country: string;
  score: number;
  level: 'warning' | 'watch' | 'healthy';
  sharedFabDetail: string;
  leadTimeDrift: string;
  inventoryCoverDays: number;
  reasons: string[];
}

const NODE_STRUCTURAL_RISKS: NodeStructuralRisk[] = [
  {
    nodeId: 'FAC-FABZ',
    label: 'Zenith Kulim wafer fab',
    role: 'wafer_fab',
    country: 'MY',
    score: 95,
    level: 'warning',
    sharedFabDetail: 'Shared Tier-2/3 fab: Single point of failure supplying SUP-A and SUP-B (via Kedah die sort)',
    leadTimeDrift: '+14 days disruption delay on IGBT die production',
    inventoryCoverDays: 1.0,
    reasons: [
      'Shared Tier-2/3 fab: Single point of failure supplying both SUP-A and SUP-B via Kedah dicing',
      'Inventory cover deficit: 1.0 day buffer remaining (threshold: 14.0 days)',
      'Lead-time drift: +14 days expected delay due to DIS-2026-0042 cleanroom flood shutdown',
    ],
  },
  {
    nodeId: 'FAC-A-PEN',
    label: 'Penang module assembly',
    role: 'module_assembly',
    country: 'MY',
    score: 82,
    level: 'warning',
    sharedFabDetail: '100% upstream reliance on disrupted Kulim fab for PRT-IGBT-DIE',
    leadTimeDrift: '+7 days transit drift on outbound PO-7001 shipment SHP-A-0901',
    inventoryCoverDays: 6.0,
    reasons: [
      'Shared fab dependency: upstream wafer supply halted from Kulim',
      'Inventory cover deficit: 6.0 days on-hand buffer (below 14.0-day safety floor)',
      'Lead-time drift: +7 days shipment transit drift to Chennai port',
    ],
  },
  {
    nodeId: 'FAC-Q-KDH',
    label: 'Kedah die sort and dicing',
    role: 'die_processing',
    country: 'MY',
    score: 68,
    level: 'warning',
    sharedFabDetail: 'Shared Tier-2 facility passing Kulim wafer output to SUP-B (FAC-B-CHB)',
    leadTimeDrift: '+5 days queue drift due to upstream wafer shortfall',
    inventoryCoverDays: 4.0,
    reasons: [
      'Shared Tier-2 die dicing facility: propagates Kulim disruption downstream to Chonburi assembly',
      'Inventory cover deficit: 4.0 days die cover (threshold: 14.0 days)',
      'Lead-time drift: +5 days backlog accumulation',
    ],
  },
  {
    nodeId: 'FAC-B-CHB',
    label: 'Chonburi module assembly',
    role: 'module_assembly',
    country: 'TH',
    score: 45,
    level: 'watch',
    sharedFabDetail: 'Latent indirect exposure to Kulim fab via Tier-2 Kedah die processor',
    leadTimeDrift: '+2 days transit drift',
    inventoryCoverDays: 18.0,
    reasons: [
      'Latent shared Tier-2 exposure: indirect dependence on Kulim fab via Kedah dicing',
      'Inventory cover: 18.0 days (currently above safety threshold, but buffer draining)',
      'Lead-time drift: +2 days transit drift',
    ],
  },
  {
    nodeId: 'FAC-KAV-BLR',
    label: 'Kaveri Bengaluru plant',
    role: 'buyer_plant',
    country: 'IN',
    score: 40,
    level: 'watch',
    sharedFabDetail: 'Buyer plant impacted by delayed primary assembly inbound shipment',
    leadTimeDrift: '+4 days delivery delay on delayed PO-7001',
    inventoryCoverDays: 12.0,
    reasons: [
      'Inventory cover deficit: 12.0 days on-hand (250 units on hand vs 400 needed for SO-1001)',
      'Lead-time drift: awaiting delayed in-transit shipment SHP-A-0901',
      'Protected floor: buffer approaching safety boundary',
    ],
  },
  {
    nodeId: 'FAC-C-BDG',
    label: 'Binh Duong module assembly',
    role: 'module_assembly',
    country: 'VN',
    score: 10,
    level: 'healthy',
    sharedFabDetail: 'Independent Korean wafer fab (Kumgang Gumi FAC-FABK); zero Kulim concentration',
    leadTimeDrift: '0 days drift; on schedule',
    inventoryCoverDays: 22.0,
    reasons: [
      'Independent wafer fab: sourced from Kumgang Gumi (FAC-FABK), zero Kulim overlap',
      'Inventory cover: 22.0 days healthy buffer (exceeds 14.0-day threshold)',
      'Lead-time drift: 0 days drift; full capacity operational',
    ],
  },
];

export function EarlyWarningsScreen() {
  const [selectedAsOf, setSelectedAsOf] = useState<string>(AS_OF_PRE_NOTICE);
  const [result, setResult] = useState<EarlyWarningResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    getEarlyWarnings(selectedAsOf)
      .then((data) => {
        if (active) {
          setResult(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Failed to load early warnings.');
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [selectedAsOf]);

  const activeWarnings: EarlyWarning[] = result
    ? result.warnings.filter((w) => w.level === 'warning' || w.level === 'watch')
    : [];

  const otherWarnings: EarlyWarning[] = result
    ? result.warnings.filter((w) => w.level === 'none')
    : [];

  return (
    <>
      <PageHeader
        eyebrow="WORKSPACE / EARLY WARNINGS"
        title="Early warnings"
        subtitle="Heuristic risk index computed from external signals around supplier sites and ports."
      />

      <PageBody>
        {/* Always visible disclaimer per NFR-07 / DA-16 / FB-19 */}
        <NeuCard
          variant="subtle"
          className="ae-disclaimer-card ews-disclaimer"
          style={{
            marginBottom: 'var(--space-4)',
            padding: 'var(--space-4)',
            borderLeft: '4px solid var(--sapCriticalColor)',
            backgroundColor: 'var(--sapTile_Background)',
          }}
        >
          <p style={{ margin: 0, fontWeight: 'var(--weight-semibold)', color: 'var(--sapTextColor)' }}>
            Heuristic index, not a probability. Advisory only — never changes plans or automated decisions. No prediction accuracy is claimed.
          </p>
          <p style={{ margin: 'var(--space-1) 0 0', fontSize: 'var(--text-xs)', color: 'var(--sapContent_LabelColor)' }}>
            Deterministic heuristic from synthetic team-chosen weights. Signals observed after query time are strictly excluded (no look-ahead).
          </p>
        </NeuCard>

        {/* FB-19: Early Disruption Signal Panel (Node Structural Risk Scoring) */}
        <section aria-labelledby="node-scoring-heading" style={{ marginBottom: 'var(--space-6)' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 'var(--space-2)',
              marginBottom: 'var(--space-3)',
            }}
          >
            <h2
              id="node-scoring-heading"
              style={{
                fontSize: 'var(--text-lg)',
                fontFamily: 'var(--font-heading)',
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                color: 'var(--sapTextColor)',
              }}
            >
              <ShieldAlert size={20} style={{ color: 'var(--sapCriticalColor)' }} aria-hidden="true" />
              Node early disruption signals (structural risk scoring)
            </h2>
            <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
              <span
                className="ae-badge"
                style={{
                  fontSize: 'var(--text-xs)',
                  fontWeight: 'var(--weight-bold)',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-full)',
                  background: 'var(--sapNeutralBackground)',
                  color: 'var(--sapTextColor)',
                  border: '1px solid var(--color-border-light)',
                }}
              >
                Heuristic + Simulated
              </span>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--sapContent_LabelColor)' }}>
                No prediction accuracy is claimed.
              </span>
            </div>
          </div>

          <NeuCard
            variant="subtle"
            style={{
              marginBottom: 'var(--space-4)',
              padding: 'var(--space-3)',
              borderLeft: '4px solid var(--sapInformativeColor)',
              background: 'var(--sapTile_Background)',
            }}
          >
            <p style={{ margin: 0, fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-sm)', color: 'var(--sapTextColor)' }}>
              Node risk scoring evaluated from structural graph RAG, shared Tier-2/Tier-3 fab concentration (FAC-FABZ), lead-time drift, and inventory cover days.
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 'var(--text-xs)', color: 'var(--sapContent_LabelColor)' }}>
              Heuristic index, not a probability. Advisory only — never changes plans or automated decisions. No prediction accuracy is claimed. Threshold: 14.0 cover days safety boundary.
            </p>
          </NeuCard>

          <div
            className="ae-node-risks-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: 'var(--space-4)',
            }}
          >
            {NODE_STRUCTURAL_RISKS.map((node) => {
              const borderLeftColor =
                node.level === 'warning'
                  ? 'var(--sapNegativeColor)'
                  : node.level === 'watch'
                    ? 'var(--sapCriticalColor)'
                    : 'var(--sapPositiveColor)';

              return (
                <NeuCard
                  key={node.nodeId}
                  className="ae-card ae-node-risk-card"
                  style={{
                    padding: 'var(--space-4)',
                    borderLeft: `5px solid ${borderLeftColor}`,
                    background: 'var(--sapTile_Background)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                    <div>
                      <span
                        className="mono"
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 'var(--text-xs)',
                          fontWeight: 'var(--weight-bold)',
                        }}
                      >
                        {node.nodeId}
                      </span>
                      <h3 style={{ margin: '2px 0 0', fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)', color: 'var(--sapTextColor)' }}>
                        {node.label}
                      </h3>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <NeuChip
                        variant={node.level === 'warning' ? 'error' : node.level === 'watch' ? 'warning' : 'success'}
                        size="sm"
                      >
                        {node.level.toUpperCase()}
                      </NeuChip>
                      <div style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-bold)', marginTop: '2px', color: 'var(--sapTextColor)' }}>
                        {node.score}/100
                      </div>
                    </div>
                  </div>

                  {/* Operational factors: Shared fab, drift, cover */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      fontSize: 'var(--text-sm)',
                      background: 'var(--sapList_AlternatingBackground, var(--sapBackgroundColor))',
                      padding: 'var(--space-2)',
                      borderRadius: 'var(--radius-sm)',
                      marginBottom: 'var(--space-3)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                      <Layers size={14} style={{ color: 'var(--sapContent_LabelColor)', flexShrink: 0, marginTop: '2px' }} aria-hidden="true" />
                      <span style={{ color: 'var(--sapTextColor)' }}><strong style={{ color: 'var(--sapTextColor)' }}>Shared Fab / Dependency:</strong> {node.sharedFabDetail}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                      <Clock size={14} style={{ color: 'var(--sapContent_LabelColor)', flexShrink: 0, marginTop: '2px' }} aria-hidden="true" />
                      <span style={{ color: 'var(--sapTextColor)' }}><strong style={{ color: 'var(--sapTextColor)' }}>Lead-Time Drift:</strong> {node.leadTimeDrift}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                      <Network size={14} style={{ color: 'var(--sapContent_LabelColor)', flexShrink: 0, marginTop: '2px' }} aria-hidden="true" />
                      <span style={{ color: 'var(--sapTextColor)' }}>
                        <strong style={{ color: 'var(--sapTextColor)' }}>Inventory Cover:</strong>{' '}
                        <span style={{ color: node.inventoryCoverDays < 14 ? 'var(--sapNegativeColor)' : 'var(--sapPositiveColor)', fontWeight: 'bold' }}>
                          {node.inventoryCoverDays} days
                        </span>{' '}
                        (safety threshold: 14.0 days)
                      </span>
                    </div>
                  </div>

                  {/* Reasons list */}
                  <div>
                    <h4 style={{ margin: '0 0 4px', fontSize: 'var(--text-xs)', color: 'var(--sapContent_LabelColor)', textTransform: 'uppercase' }}>
                      Heuristic Evaluation Reasons:
                    </h4>
                    <ul style={{ margin: 0, paddingLeft: '16px', fontSize: 'var(--text-sm)', color: 'var(--sapTextColor)' }}>
                      {node.reasons.map((reason, idx) => (
                        <li key={idx} style={{ marginBottom: '2px' }}>{reason}</li>
                      ))}
                    </ul>
                  </div>
                </NeuCard>
              );
            })}
          </div>
        </section>

        {/* Toggle buttons for external signals */}
        <div
          className="ews-controls"
          role="group"
          aria-label="Early warning evaluation timestamp"
          style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 'var(--space-3)',
            marginBottom: 'var(--space-5)',
          }}
        >
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', color: 'var(--sapContent_LabelColor)', textTransform: 'uppercase' }}>
            Snapshot time:
          </span>
          <NeuButton
            variant={selectedAsOf === AS_OF_PRE_NOTICE ? 'primary' : 'secondary'}
            onClick={() => setSelectedAsOf(AS_OF_PRE_NOTICE)}
            aria-pressed={selectedAsOf === AS_OF_PRE_NOTICE}
            style={{
              fontWeight: 'var(--weight-bold)',
            }}
          >
            As of 23 Oct 21:00 (before the notice)
          </NeuButton>
          <NeuButton
            variant={selectedAsOf === AS_OF_SCENARIO_TIME ? 'primary' : 'secondary'}
            onClick={() => setSelectedAsOf(AS_OF_SCENARIO_TIME)}
            aria-pressed={selectedAsOf === AS_OF_SCENARIO_TIME}
            style={{
              fontWeight: 'var(--weight-bold)',
            }}
          >
            Now (scenario clock)
          </NeuButton>
          {loading && (
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--sapContent_LabelColor)' }}>Loading…</span>
          )}
        </div>

        {error && (
          <NeuCard variant="subtle" style={{ color: 'var(--sapNegativeColor)', marginBottom: 'var(--space-4)' }}>
            {error}
          </NeuCard>
        )}

        {/* Active external signals warnings list */}
        <section aria-labelledby="active-warnings-heading" style={{ marginBottom: 'var(--space-6)' }}>
          <h2
            id="active-warnings-heading"
            style={{
              fontSize: 'var(--text-lg)',
              fontFamily: 'var(--font-heading)',
              margin: '0 0 var(--space-4)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              color: 'var(--sapTextColor)',
            }}
          >
            <ShieldAlert size={20} style={{ color: 'var(--sapNegativeColor)' }} aria-hidden="true" />
            Active warnings ({activeWarnings.length})
          </h2>

          {activeWarnings.length === 0 ? (
            <NeuCard variant="subtle" style={{ padding: 'var(--space-4)', color: 'var(--sapContent_LabelColor)' }}>
              No active warnings at this timestamp.
            </NeuCard>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {activeWarnings.map((w) => (
                <NeuCard key={w.warning_id} className="ae-card warning-card" style={{ padding: 'var(--space-4)' }}>
                  {/* Warning Header */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 'var(--space-2)',
                      paddingBottom: 'var(--space-3)',
                      borderBottom: '1px solid var(--color-border-light)',
                    }}
                  >
                    <div>
                      <h3 style={{ margin: 0, fontSize: 'var(--text-md)', fontFamily: 'var(--font-heading)', color: 'var(--sapTextColor)' }}>
                        {w.label}
                      </h3>
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--sapContent_LabelColor)' }}>
                        Subject ID: <span className="mono" style={{ fontFamily: 'var(--font-mono)' }}>{w.subject.id}</span> ({w.subject.type})
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                      <NeuChip
                        variant={w.level === 'warning' ? 'error' : 'warning'}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)' }}
                      >
                        {w.level === 'warning' ? (
                          <AlertTriangle size={14} aria-hidden="true" />
                        ) : (
                          <Eye size={14} aria-hidden="true" />
                        )}
                        <span>{w.level.toUpperCase()}</span>
                      </NeuChip>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)', color: 'var(--sapTextColor)' }}>
                          {w.score}/100
                        </span>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--sapContent_LabelColor)' }}>
                          raw: {w.raw_points} pts
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Signal list */}
                  <div style={{ marginTop: 'var(--space-4)' }}>
                    <h4 style={{ margin: '0 0 var(--space-2)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', textTransform: 'uppercase', color: 'var(--sapContent_LabelColor)', fontFamily: 'var(--font-accent)' }}>
                      Contributing signals ({w.contributing.length})
                    </h4>
                    <div className="ae-table-wrap">
                      <table className="ae-table">
                        <caption>Signals contributing to {w.label}</caption>
                        <thead>
                          <tr>
                            <th scope="col">Signal ID</th>
                            <th scope="col">Category</th>
                            <th scope="col">Severity</th>
                            <th scope="col">Source Type</th>
                            <th scope="col">Observed At</th>
                            <th scope="col">Contribution</th>
                          </tr>
                        </thead>
                        <tbody>
                          {w.contributing.map((c) => {
                            const ev = result?.evidence.find((e) => e.evidence_id === `EVD-${c.signal_id}`);
                            return (
                              <tr key={c.signal_id}>
                                <td>
                                  <strong className="mono" style={{ fontFamily: 'var(--font-mono)' }}>{c.signal_id}</strong>
                                  {ev && (
                                    <div style={{ fontSize: 'var(--text-sm)', color: 'var(--sapContent_LabelColor)', maxWidth: 280 }}>
                                      {ev.title}
                                    </div>
                                  )}
                                </td>
                                <td>{c.category.replace('_', ' ')}</td>
                                <td>
                                  <NeuChip variant={c.severity === 'critical' ? 'error' : c.severity === 'high' ? 'warning' : 'neutral'} size="sm">
                                    {c.severity}
                                  </NeuChip>
                                </td>
                                <td>{c.source_kind} ({c.confidence_pct}%)</td>
                                <td style={{ fontSize: 'var(--text-sm)', color: 'var(--sapTextColor)' }}>{c.observed_at}</td>
                                <td>
                                  <strong>+{c.contribution} pts</strong>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Exposure Section */}
                  <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-3)', background: 'var(--sapList_AlternatingBackground, var(--sapBackgroundColor))', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-light)' }}>
                    <h4 style={{ margin: '0 0 var(--space-2)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', textTransform: 'uppercase', color: 'var(--sapContent_LabelColor)', fontFamily: 'var(--font-accent)' }}>
                      Linked downstream exposure
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-3)', fontSize: 'var(--text-sm)' }}>
                      <div>
                        <span style={{ color: 'var(--sapContent_LabelColor)', display: 'block' }}>Customer orders:</span>
                        <strong>
                          {w.exposure.order_ids.length > 0 ? (
                            w.exposure.order_ids.map((id, idx) => (
                              <span key={id} className="mono" style={{ fontFamily: 'var(--font-mono)' }}>
                                {idx > 0 && ', '}
                                {id}
                              </span>
                            ))
                          ) : (
                            'None'
                          )}
                        </strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--sapContent_LabelColor)', display: 'block' }}>Purchase orders:</span>
                        <strong>
                          {w.exposure.po_ids.length > 0 ? (
                            w.exposure.po_ids.map((id, idx) => (
                              <span key={id} className="mono" style={{ fontFamily: 'var(--font-mono)' }}>
                                {idx > 0 && ', '}
                                {id}
                              </span>
                            ))
                          ) : (
                            'None'
                          )}
                        </strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--sapContent_LabelColor)', display: 'block' }}>Shipments:</span>
                        <strong>
                          {w.exposure.shipment_ids.length > 0 ? (
                            w.exposure.shipment_ids.map((id, idx) => (
                              <span key={id} className="mono" style={{ fontFamily: 'var(--font-mono)' }}>
                                {idx > 0 && ', '}
                                {id}
                              </span>
                            ))
                          ) : (
                            'None'
                          )}
                        </strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--sapContent_LabelColor)', display: 'block' }}>Affected candidate suppliers:</span>
                        <strong>
                          {w.exposure.affected_candidate_supplier_ids.length > 0 ? (
                            w.exposure.affected_candidate_supplier_ids.map((id, idx) => (
                              <span key={id} className="mono" style={{ fontFamily: 'var(--font-mono)' }}>
                                {idx > 0 && ', '}
                                {id}
                              </span>
                            ))
                          ) : (
                            'None'
                          )}
                        </strong>
                      </div>
                    </div>
                  </div>
                </NeuCard>
              ))}
            </div>
          )}
        </section>

        {/* Secondary table: Subjects with level none */}
        <section aria-labelledby="monitored-subjects-heading">
          <h2
            id="monitored-subjects-heading"
            style={{
              fontSize: 'var(--text-md)',
              fontFamily: 'var(--font-heading)',
              margin: '0 0 var(--space-3)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              color: 'var(--sapTextColor)',
            }}
          >
            <CheckCircle size={18} style={{ color: 'var(--sapPositiveColor)' }} aria-hidden="true" />
            Other monitored subjects (no alert)
          </h2>

          <div className="ae-table-wrap">
            <table className="ae-table">
              <caption>Monitored subjects currently below watch threshold</caption>
              <thead>
                <tr>
                  <th scope="col">Subject</th>
                  <th scope="col">Level</th>
                  <th scope="col">Score</th>
                  <th scope="col">Signals</th>
                  <th scope="col">Linked Exposure</th>
                </tr>
              </thead>
              <tbody>
                {otherWarnings.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', color: 'var(--sapContent_LabelColor)' }}>
                      No other subjects recorded.
                    </td>
                  </tr>
                ) : (
                  otherWarnings.map((w) => (
                    <tr key={w.warning_id}>
                      <td>
                        <strong style={{ color: 'var(--sapTextColor)' }}>{w.label}</strong>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--sapContent_LabelColor)' }}>
                          <span className="mono" style={{ fontFamily: 'var(--font-mono)' }}>{w.subject.id}</span> ({w.subject.type})
                        </div>
                      </td>
                      <td>
                        <NeuChip variant="neutral" size="sm">NONE</NeuChip>
                      </td>
                      <td>
                        <strong style={{ color: 'var(--sapTextColor)' }}>{w.score}/100</strong>
                      </td>
                      <td>{w.contributing.length} signal(s)</td>
                      <td style={{ fontSize: 'var(--text-sm)', color: 'var(--sapTextColor)' }}>
                        {w.exposure.affected_candidate_supplier_ids.length > 0 && (
                          <div>
                            Affects candidate:{' '}
                            {w.exposure.affected_candidate_supplier_ids.map((id, idx) => (
                              <span key={id} className="mono" style={{ fontFamily: 'var(--font-mono)' }}>
                                {idx > 0 && ', '}
                                {id}
                              </span>
                            ))}
                          </div>
                        )}
                        {w.exposure.po_ids.length > 0 && (
                          <div>
                            POs:{' '}
                            {w.exposure.po_ids.map((id, idx) => (
                              <span key={id} className="mono" style={{ fontFamily: 'var(--font-mono)' }}>
                                {idx > 0 && ', '}
                                {id}
                              </span>
                            ))}
                          </div>
                        )}
                        {w.exposure.order_ids.length > 0 && (
                          <div>
                            Orders:{' '}
                            {w.exposure.order_ids.map((id, idx) => (
                              <span key={id} className="mono" style={{ fontFamily: 'var(--font-mono)' }}>
                                {idx > 0 && ', '}
                                {id}
                              </span>
                            ))}
                          </div>
                        )}
                        {w.exposure.affected_candidate_supplier_ids.length === 0 && w.exposure.po_ids.length === 0 && w.exposure.order_ids.length === 0 && (
                          <span style={{ color: 'var(--sapContent_LabelColor)' }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </PageBody>
    </>
  );
}
