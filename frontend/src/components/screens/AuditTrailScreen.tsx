import { PageHeader, PageBody } from '../layout';
import { NeuCard } from '../ui/NeuCard';
import { NeuButton } from '../ui/NeuButton';
import { NeuChip } from '../ui/NeuChip';
import type { AuditEvent, AuditVerifyResult } from '../../api/types';

interface AuditTrailScreenProps {
  auditEvents: AuditEvent[];
  auditState: string;
  auditError: string;
  auditFilter: string;
  setAuditFilter: (v: string) => void;
  loadAuditEvents: (subjectId?: string) => void;
  auditVerification: AuditVerifyResult | null;
  auditVerificationLoading: boolean;
  auditVerificationError: string;
  verifyAuditEvents: () => void;
  apiMode: string;
  formatLocalTimestamp: (timestamp?: string | null) => string;
}

export function AuditTrailScreen({
  auditEvents,
  auditState,
  auditError,
  auditFilter,
  setAuditFilter,
  loadAuditEvents,
  auditVerification,
  auditVerificationLoading,
  auditVerificationError,
  verifyAuditEvents,
  apiMode,
  formatLocalTimestamp,
}: AuditTrailScreenProps) {
  return (
    <>
      <PageHeader
        eyebrow="WORKSPACE / AUDIT TRAIL"
        title="Audit trail"
        subtitle="Append-only audit events and verification results returned by the API."
      />

      <PageBody>
        {apiMode === 'stub' && (
          <NeuCard variant="subtle" className="audit-note" style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-4)', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-relaxed)' }}>
            Fixture mode contains no audit-event records or verified chain result. Evaluation steps are not audit events, so none are presented as an audit trail.
          </NeuCard>
        )}

        <form className="audit-controls" onSubmit={(e) => { e.preventDefault(); loadAuditEvents(auditFilter); }} style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-2)', margin: 'var(--space-4) 0' }}>
          <label htmlFor="audit-subject" style={{ color: 'var(--color-text)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', fontFamily: 'var(--font-accent)' }}>Filter by subject ID</label>
          <input
            id="audit-subject"
            type="text"
            value={auditFilter}
            onChange={(e) => setAuditFilter(e.target.value)}
            placeholder="e.g. PLN-0002"
            className="neu-input neu-select"
            style={{ minWidth: 190 }}
            disabled={apiMode === 'stub'}
          />
          <NeuButton variant="secondary" type="submit" disabled={apiMode === 'stub' || auditState === 'loading'}>
            Load events
          </NeuButton>
          <NeuButton variant="primary" type="button" onClick={verifyAuditEvents} disabled={apiMode === 'stub' || auditVerificationLoading}>
            {auditVerificationLoading ? 'Verifying…' : 'Verify chain'}
          </NeuButton>
        </form>

        {auditError && <p className="load-error" role="alert" style={{ color: 'var(--color-error-text)', marginBottom: 'var(--space-4)' }}>{auditError}</p>}
        {auditVerificationError && <p className="load-error" role="alert" style={{ color: 'var(--color-error-text)', marginBottom: 'var(--space-4)' }}>{auditVerificationError}</p>}

        {auditVerification && (
          <NeuChip
            className={auditVerification.valid ? 'audit-verified' : 'audit-invalid'}
            variant={auditVerification.valid ? 'success' : 'error'}
            role="status"
            style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)', fontFamily: 'var(--font-heading)' }}
          >
            {auditVerification.valid
              ? `Chain valid — API verified ${auditVerification.checked_events} events.`
              : `Chain invalid${auditVerification.first_invalid_seq === null ? '; the API did not provide the first invalid sequence.' : ` at sequence ${auditVerification.first_invalid_seq}`}.`}
          </NeuChip>
        )}

        {auditVerification && (
          <p className="audit-note" style={{ marginBottom: 'var(--space-4)', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-relaxed)' }}>
            Verification response applies to the event chain checked by the API; the subject filter affects only the table.
          </p>
        )}

        {auditState === 'loading' && (
          <NeuCard variant="subtle" className="progress-state" role="status" style={{ padding: 'var(--space-5)' }}>
            Loading audit events from the API…
          </NeuCard>
        )}

        {auditState === 'unavailable' && (
          <NeuCard variant="subtle" className="progress-state" role="status" style={{ padding: 'var(--space-5)' }}>
            No audit events or verification response are available in the local fixtures.
          </NeuCard>
        )}

        {auditState === 'ready' && (
          auditEvents.length ? (
            <NeuCard variant="subtle" className="neu-table-wrap" style={{ overflowX: 'auto' }}>
              <table className="neu-table">
                <caption>Audit events returned by the API, in sequence order</caption>
                <thead>
                  <tr>
                    <th scope="col">Seq</th>
                    <th scope="col">Time</th>
                    <th scope="col">Actor</th>
                    <th scope="col">Event</th>
                    <th scope="col">Subject</th>
                    <th scope="col">Hash</th>
                  </tr>
                </thead>
                <tbody>
                  {auditEvents.map((event) => (
                    <tr key={event.event_id}>
                      <td>{event.seq}</td>
                      <td><time dateTime={event.occurred_at}>{formatLocalTimestamp(event.occurred_at)}</time></td>
                      <td>
                        {event.actor.display_name ?? event.actor.actor_id}
                        <small style={{ display: 'block', marginTop: 'var(--space-1)', color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-accent)' }}>{event.actor.role}</small>
                      </td>
                      <td>{event.event_type}</td>
                      <td>{event.subject.type}: {event.subject.id}</td>
                      <td title={event.event_hash} style={{ fontFamily: 'var(--font-mono)' }}>{event.event_hash.slice(7, 15)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </NeuCard>
          ) : (
            <NeuCard variant="subtle" className="progress-state" role="status" style={{ padding: 'var(--space-5)', color: 'var(--color-text-muted)', textAlign: 'center' }}>
              The API returned no audit events for this filter.
            </NeuCard>
          )
        )}
      </PageBody>
    </>
  );
}