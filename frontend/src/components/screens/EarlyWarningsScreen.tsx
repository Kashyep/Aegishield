import { useEffect, useState } from 'react';
import { AlertTriangle, Eye, ShieldAlert, CheckCircle } from 'lucide-react';
import { PageHeader, PageBody } from '../layout';
import { NeuCard } from '../ui/NeuCard';
import { NeuButton } from '../ui/NeuButton';
import { NeuChip } from '../ui/NeuChip';
import { getEarlyWarnings } from '../../api/client';
import type { EarlyWarningResult, EarlyWarning } from '../../api/types';

const AS_OF_PRE_NOTICE = '2026-10-23T21:00:00+05:30';
const AS_OF_SCENARIO_TIME = '2026-10-26T09:00:00+05:30';

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
        {/* Always visible disclaimer per NFR-07 / DA-16 */}
        <NeuCard
          variant="subtle"
          className="ews-disclaimer"
          style={{
            marginBottom: 'var(--space-4)',
            padding: 'var(--space-4)',
            borderLeft: '4px solid var(--color-warning)',
          }}
        >
          <p style={{ margin: 0, fontWeight: 'var(--weight-semibold)', color: 'var(--color-text)' }}>
            Heuristic index, not a probability. Advisory only — never changes plans.
          </p>
          <p style={{ margin: 'var(--space-1) 0 0', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            Deterministic heuristic from synthetic team-chosen weights. Signals observed after query time are strictly excluded (no look-ahead).
          </p>
        </NeuCard>

        {/* Toggle buttons */}
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
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
            Snapshot time:
          </span>
          <NeuButton
            variant={selectedAsOf === AS_OF_PRE_NOTICE ? 'primary' : 'secondary'}
            onClick={() => setSelectedAsOf(AS_OF_PRE_NOTICE)}
            aria-pressed={selectedAsOf === AS_OF_PRE_NOTICE}
            style={{
              fontWeight: 'var(--weight-bold)',
              color: selectedAsOf === AS_OF_PRE_NOTICE ? '#ffffff' : 'var(--color-text)',
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
              color: selectedAsOf === AS_OF_SCENARIO_TIME ? '#ffffff' : 'var(--color-text)',
            }}
          >
            Now (scenario clock)
          </NeuButton>
          {loading && (
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>Loading…</span>
          )}
        </div>

        {error && (
          <NeuCard variant="subtle" style={{ color: 'var(--color-error-text)', marginBottom: 'var(--space-4)' }}>
            {error}
          </NeuCard>
        )}

        {/* Active warnings list */}
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
            }}
          >
            <ShieldAlert size={20} style={{ color: 'var(--color-error)' }} aria-hidden="true" />
            Active warnings ({activeWarnings.length})
          </h2>

          {activeWarnings.length === 0 ? (
            <NeuCard variant="subtle" style={{ padding: 'var(--space-4)', color: 'var(--color-text-muted)' }}>
              No active warnings at this timestamp.
            </NeuCard>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {activeWarnings.map((w) => (
                <NeuCard key={w.warning_id} className="warning-card" style={{ padding: 'var(--space-4)' }}>
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
                      <h3 style={{ margin: 0, fontSize: 'var(--text-md)', fontFamily: 'var(--font-heading)' }}>
                        {w.label}
                      </h3>
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                        Subject ID: {w.subject.id} ({w.subject.type})
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
                        <span style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)', color: 'var(--color-text)' }}>
                          {w.score}/100
                        </span>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                          raw: {w.raw_points} pts
                        </div>
                      </div>
                    </div>
                  </div>


                  {/* Signal list */}
                  <div style={{ marginTop: 'var(--space-4)' }}>
                    <h4 style={{ margin: '0 0 var(--space-2)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontFamily: 'var(--font-accent)' }}>
                      Contributing signals ({w.contributing.length})
                    </h4>
                    <div className="neu-table-wrap">
                      <table className="neu-table">
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
                                  <strong>{c.signal_id}</strong>
                                  {ev && (
                                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', maxWidth: 280 }}>
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
                                <td style={{ fontSize: 'var(--text-xs)' }}>{c.observed_at}</td>
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
                  <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-3)', background: 'var(--color-bg-subtle, rgba(0,0,0,0.02))', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-light)' }}>
                    <h4 style={{ margin: '0 0 var(--space-2)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontFamily: 'var(--font-accent)' }}>
                      Linked downstream exposure
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-3)', fontSize: 'var(--text-xs)' }}>
                      <div>
                        <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Customer orders:</span>
                        <strong>{w.exposure.order_ids.length > 0 ? w.exposure.order_ids.join(', ') : 'None'}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Purchase orders:</span>
                        <strong>{w.exposure.po_ids.length > 0 ? w.exposure.po_ids.join(', ') : 'None'}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Shipments:</span>
                        <strong>{w.exposure.shipment_ids.length > 0 ? w.exposure.shipment_ids.join(', ') : 'None'}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Affected candidate suppliers:</span>
                        <strong>
                          {w.exposure.affected_candidate_supplier_ids.length > 0 ? w.exposure.affected_candidate_supplier_ids.join(', ') : 'None'}
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
            }}
          >
            <CheckCircle size={18} style={{ color: 'var(--color-success)' }} aria-hidden="true" />
            Other monitored subjects (no alert)
          </h2>

          <div className="neu-table-wrap">
            <table className="neu-table">
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
                    <td colSpan={5} style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>
                      No other subjects recorded.
                    </td>
                  </tr>
                ) : (
                  otherWarnings.map((w) => (
                    <tr key={w.warning_id}>
                      <td>
                        <strong>{w.label}</strong>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                          {w.subject.id} ({w.subject.type})
                        </div>
                      </td>
                      <td>
                        <NeuChip variant="neutral" size="sm">NONE</NeuChip>
                      </td>
                      <td>
                        <strong>{w.score}/100</strong>
                      </td>
                      <td>{w.contributing.length} signal(s)</td>
                      <td style={{ fontSize: 'var(--text-xs)' }}>
                        {w.exposure.affected_candidate_supplier_ids.length > 0 && (
                          <div>Affects candidate: {w.exposure.affected_candidate_supplier_ids.join(', ')}</div>
                        )}
                        {w.exposure.po_ids.length > 0 && (
                          <div>POs: {w.exposure.po_ids.join(', ')}</div>
                        )}
                        {w.exposure.order_ids.length > 0 && (
                          <div>Orders: {w.exposure.order_ids.join(', ')}</div>
                        )}
                        {w.exposure.affected_candidate_supplier_ids.length === 0 && w.exposure.po_ids.length === 0 && w.exposure.order_ids.length === 0 && (
                          <span style={{ color: 'var(--color-text-muted)' }}>—</span>
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
