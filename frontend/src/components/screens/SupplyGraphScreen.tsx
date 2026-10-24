import { useMemo } from 'react';
import { PageHeader, PageBody } from '../layout';
import { NeuCard } from '../ui/NeuCard';
import { NeuButton } from '../ui/NeuButton';
import { DependencyGraph } from '../../components/DependencyGraph';
import type { Evaluation, GraphView, GraphViewNode } from '../../api/types';

interface SupplyGraphScreenProps {
  evaluationId: string;
  graphView: GraphView | null;
  graphError: string;
  setFocusSupplierId: (id: string) => void;
  selectedGraphNode: GraphViewNode | null;
  setSelectedGraphNode: (node: GraphViewNode | null) => void;
  evaluation: Evaluation | null;
}

export function SupplyGraphScreen({
  evaluationId,
  graphView,
  graphError,
  setFocusSupplierId,
  selectedGraphNode,
  setSelectedGraphNode,
  evaluation,
}: SupplyGraphScreenProps) {
  // ⚡ Bolt Optimization: Memoize props passed to DependencyGraph to prevent re-rendering it
  const candidates = useMemo(() => (evaluation?.dependency_results ?? []).map((result) => ({
    supplierId: result.supplier_id,
    label: graphView?.nodes.find((node) => node.id === result.start_node_id)?.org_name.replace(' (synthetic)', '') ?? result.supplier_id,
  })), [evaluation?.dependency_results, graphView?.nodes]);

  return (
    <>
      <PageHeader
        eyebrow="WORKSPACE / SUPPLY GRAPH"
        title="Supply graph"
        subtitle={`Why a candidate supplier is or is not independent of the disruption: upstream evidence from evaluation ${evaluationId}.`}
      />

      <PageBody>
        {graphView ? (
          <>
            <p className="subtitle" style={{ marginBottom: 'var(--space-4)' }}>
              {graphView.nodes.length} facilities · {graphView.edges.length} links · Direction: {graphView.edge_direction.replace(/_/g, ' ')}
            </p>

            <NeuCard variant="raised" style={{ padding: 'var(--space-4)' }}>
              <DependencyGraph
                view={graphView}
                result={evaluation?.dependency_results?.find((result) => result.supplier_id === graphView.focus_supplier_id)}
                candidates={candidates}
                onFocusSupplier={setFocusSupplierId}
                selectedNodeId={selectedGraphNode?.id ?? null}
                onSelectNode={setSelectedGraphNode}
              />
            </NeuCard>

            {selectedGraphNode && (
              <NeuCard as="section" aria-label="Selected facility details" aria-live="polite" variant="raised" className="facility-details" style={{ marginTop: 'var(--space-4)', padding: 'var(--space-5)' }}>
                <div className="facility-details-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-4)' }}>
                  <div>
                    <p className="eyebrow">SELECTED FACILITY</p>
                    <h2 style={{ marginBottom: 0, color: 'var(--color-text)', fontSize: 'var(--text-lg)', fontFamily: 'var(--font-heading)' }}>{selectedGraphNode.label}</h2>
                  </div>
                  <NeuButton variant="secondary" onClick={() => setSelectedGraphNode(null)}>Clear selection</NeuButton>
                </div>
                <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0 var(--space-6)', margin: 'var(--space-4) 0 0' }}>
                  <div style={{ padding: 'var(--space-3) 0', borderTop: '1px solid var(--color-border-light)' }}>
                    <dt style={{ marginBottom: 'var(--space-1)', color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', letterSpacing: 'var(--tracking-wide)', textTransform: 'uppercase', fontFamily: 'var(--font-accent)' }}>Facility ID</dt>
                    <dd style={{ margin: 0, color: 'var(--color-text)', fontSize: 'var(--text-sm)', overflowWrap: 'anywhere' }}>{selectedGraphNode.id}</dd>
                  </div>
                  <div style={{ padding: 'var(--space-3) 0', borderTop: '1px solid var(--color-border-light)' }}>
                    <dt style={{ marginBottom: 'var(--space-1)', color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', letterSpacing: 'var(--tracking-wide)', textTransform: 'uppercase', fontFamily: 'var(--font-accent)' }}>Organization</dt>
                    <dd style={{ margin: 0, color: 'var(--color-text)', fontSize: 'var(--text-sm)', overflowWrap: 'anywhere' }}>{selectedGraphNode.org_name}</dd>
                  </div>
                  <div style={{ padding: 'var(--space-3) 0', borderTop: '1px solid var(--color-border-light)' }}>
                    <dt style={{ marginBottom: 'var(--space-1)', color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', letterSpacing: 'var(--tracking-wide)', textTransform: 'uppercase', fontFamily: 'var(--font-accent)' }}>Country</dt>
                    <dd style={{ margin: 0, color: 'var(--color-text)', fontSize: 'var(--text-sm)', overflowWrap: 'anywhere' }}>{selectedGraphNode.country}</dd>
                  </div>
                  <div style={{ padding: 'var(--space-3) 0', borderTop: '1px solid var(--color-border-light)' }}>
                    <dt style={{ marginBottom: 'var(--space-1)', color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', letterSpacing: 'var(--tracking-wide)', textTransform: 'uppercase', fontFamily: 'var(--font-accent)' }}>Role</dt>
                    <dd style={{ margin: 0, color: 'var(--color-text)', fontSize: 'var(--text-sm)', overflowWrap: 'anywhere' }}>{selectedGraphNode.role.replace(/_/g, ' ')}</dd>
                  </div>
                  <div style={{ padding: 'var(--space-3) 0', borderTop: '1px solid var(--color-border-light)' }}>
                    <dt style={{ marginBottom: 'var(--space-1)', color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', letterSpacing: 'var(--tracking-wide)', textTransform: 'uppercase', fontFamily: 'var(--font-accent)' }}>Status</dt>
                    <dd style={{ margin: 0, color: 'var(--color-text)', fontSize: 'var(--text-sm)', overflowWrap: 'anywhere' }}>{selectedGraphNode.status}</dd>
                  </div>
                </dl>
              </NeuCard>
            )}
          </>
        ) : (
          <NeuCard variant="subtle" style={{ padding: 'var(--space-5)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            {graphError || 'Loading dependency graph…'}
          </NeuCard>
        )}
      </PageBody>
    </>
  );
}