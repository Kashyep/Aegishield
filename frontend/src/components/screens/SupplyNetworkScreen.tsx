import { useEffect, useState } from 'react';
import { PageHeader, PageBody } from '../layout';
import { NeuCard } from '../ui/NeuCard';
import { NeuChip } from '../ui/NeuChip';
import { getSupplyNetwork } from '../../api/client';
import type { SupplyNetwork, SupplyNetworkNode } from '../../api/types';

function Sparkline({ data, color = 'var(--sapBrandColor, #0070f2)' }: { data: number[]; color?: string }) {
  if (!data || data.length === 0) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 100;
  const height = 24;
  const points = data
    .map((val, idx) => {
      const x = (idx / (data.length - 1)) * width;
      const y = height - ((val - min) / range) * (height - 6) - 3;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Movement trend: ${data.join(', ')}`}
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    >
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

function getNodeStatusBadge(status: string) {
  switch (status) {
    case 'disrupted':
      return <NeuChip variant="error">DISRUPTED</NeuChip>;
    case 'warning':
    case 'at_risk':
      return <NeuChip variant="warning">WARNING</NeuChip>;
    case 'operational':
    default:
      return <NeuChip variant="success">OPERATIONAL</NeuChip>;
  }
}

function getNodeBorderColor(status: string) {
  switch (status) {
    case 'disrupted':
      return 'var(--sapNegativeColor, #b00)';
    case 'warning':
    case 'at_risk':
      return 'var(--sapCriticalColor, #e9730c)';
    case 'operational':
    default:
      return 'var(--sapPositiveColor, #107e3e)';
  }
}

export function SupplyNetworkScreen() {
  const [network, setNetwork] = useState<SupplyNetwork | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getSupplyNetwork()
      .then((data) => {
        if (active) {
          setNetwork(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Failed to load supply network');
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const tier3Nodes = network?.nodes.filter((n) => n.role === 'wafer_fab') ?? [];
  const tier2Nodes = network?.nodes.filter((n) => n.role === 'die_processing' || n.role === 'material_supplier') ?? [];
  const tier1Nodes = network?.nodes.filter((n) => n.role === 'module_assembly') ?? [];
  const tier0Nodes = network?.nodes.filter((n) => n.role === 'buyer_plant') ?? [];

  return (
    <div className="supply-network-screen" data-testid="supply-network-screen">
      <PageHeader
        eyebrow="WORKSPACE / SUPPLY NETWORK"
        title="Supply Network"
        subtitle="Flowchart of existing supply chains with inventory on hand, stock in transit, movement over time and node status."
      >
        <span
          className="ae-badge simulated-indicator"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '4px 12px',
            borderRadius: '16px',
            fontSize: 'var(--text-xs, 0.75rem)',
            fontWeight: 'var(--weight-bold, 700)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            background: 'var(--sapNeutralBackground, #e5eaf0)',
            color: 'var(--sapTextColor, #1d2d3e)',
            border: '1px solid var(--sapTile_BorderColor, #d9d9d9)',
          }}
          aria-label="Simulation state: Simulated"
        >
          Simulated
        </span>
      </PageHeader>

      <PageBody>
        {/* Disclosure Banner per NFR-07 / DA-16 / FB-18 */}
        <NeuCard
          variant="subtle"
          className="ae-disclosure-card"
          style={{
            marginBottom: 'var(--space-4, 1rem)',
            padding: 'var(--space-4, 1rem)',
            borderLeft: '4px solid var(--sapInformativeColor, #0a6ed1)',
            backgroundColor: 'var(--sapTile_Background, #ffffff)',
          }}
        >
          <p style={{ margin: 0, fontWeight: 'var(--weight-semibold, 600)', color: 'var(--color-text, #1d2d3e)' }}>
            Simulated supply chain network topology and operational metrics.
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 'var(--text-xs, 0.75rem)', color: 'var(--color-text-muted, #556b82)' }}>
            Zenith is fictional; figures are synthetic; SAP integration is proposed only. Baseline network model for recovery preflight simulation.
          </p>
        </NeuCard>

        {loading && (
          <NeuCard variant="subtle" style={{ padding: 'var(--space-4, 1rem)', marginBottom: 'var(--space-4, 1rem)' }}>
            <p style={{ margin: 0, color: 'var(--color-text-muted, #556b82)' }}>Loading supply network topology…</p>
          </NeuCard>
        )}

        {error && (
          <NeuCard
            variant="subtle"
            style={{
              padding: 'var(--space-4, 1rem)',
              marginBottom: 'var(--space-4, 1rem)',
              borderLeft: '4px solid var(--sapNegativeColor, #b00)',
            }}
          >
            <p style={{ margin: 0, color: 'var(--sapNegativeColor, #b00)' }}>{error}</p>
          </NeuCard>
        )}

        {network && (
          <>
            {/* KPI Stat Cards */}
            <div
              className="ae-stats-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 'var(--space-4, 1rem)',
                marginBottom: 'var(--space-5, 1.5rem)',
              }}
            >
              <NeuCard style={{ padding: 'var(--space-4, 1rem)' }}>
                <span style={{ fontSize: 'var(--text-xs, 0.75rem)', color: 'var(--sapContent_LabelColor, #556b82)', textTransform: 'uppercase' }}>
                  Total Inventory On Hand
                </span>
                <div style={{ fontSize: 'var(--text-2xl, 1.75rem)', fontWeight: 'var(--weight-bold, 700)', marginTop: '4px' }}>
                  {network.total_on_hand.toLocaleString()} <span style={{ fontSize: 'var(--text-sm, 0.875rem)', fontWeight: 'normal' }}>units</span>
                </div>
              </NeuCard>

              <NeuCard style={{ padding: 'var(--space-4, 1rem)' }}>
                <span style={{ fontSize: 'var(--text-xs, 0.75rem)', color: 'var(--sapContent_LabelColor, #556b82)', textTransform: 'uppercase' }}>
                  Stock In Transit
                </span>
                <div style={{ fontSize: 'var(--text-2xl, 1.75rem)', fontWeight: 'var(--weight-bold, 700)', marginTop: '4px' }}>
                  {network.total_in_transit.toLocaleString()} <span style={{ fontSize: 'var(--text-sm, 0.875rem)', fontWeight: 'normal' }}>units</span>
                </div>
              </NeuCard>

              <NeuCard style={{ padding: 'var(--space-4, 1rem)' }}>
                <span style={{ fontSize: 'var(--text-xs, 0.75rem)', color: 'var(--sapContent_LabelColor, #556b82)', textTransform: 'uppercase' }}>
                  Monitored Network Nodes
                </span>
                <div style={{ fontSize: 'var(--text-2xl, 1.75rem)', fontWeight: 'var(--weight-bold, 700)', marginTop: '4px' }}>
                  {network.nodes.length} <span style={{ fontSize: 'var(--text-sm, 0.875rem)', fontWeight: 'normal' }}>facilities</span>
                </div>
              </NeuCard>

              <NeuCard style={{ padding: 'var(--space-4, 1rem)' }}>
                <span style={{ fontSize: 'var(--text-xs, 0.75rem)', color: 'var(--sapContent_LabelColor, #556b82)', textTransform: 'uppercase' }}>
                  Network Status
                </span>
                <div style={{ fontSize: 'var(--text-md, 1rem)', fontWeight: 'var(--weight-bold, 700)', marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <NeuChip variant="error">1 Disrupted</NeuChip>
                  <NeuChip variant="warning">2 Warning</NeuChip>
                  <NeuChip variant="success">7 Operational</NeuChip>
                </div>
              </NeuCard>
            </div>

            {/* Flowchart of Existing Supply Chains */}
            <section aria-labelledby="flowchart-heading" style={{ marginBottom: 'var(--space-6, 2rem)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3, 0.75rem)' }}>
                <h2 id="flowchart-heading" style={{ fontSize: 'var(--text-lg, 1.125rem)', margin: 0, fontWeight: 'var(--weight-bold, 700)' }}>
                  Supply Network Flowchart
                </h2>
                <span style={{ fontSize: 'var(--text-xs, 0.75rem)', color: 'var(--sapContent_LabelColor, #556b82)' }}>
                  Upstream Tier 3 Wafer Fabs → Tier 2 Materials &amp; Dies → Tier 1 Assembly → Buyer Plant
                </span>
              </div>

              <div
                className="ae-flowchart-container"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-5, 1.5rem)',
                  background: 'var(--sapBackgroundColor, #f5f6f7)',
                  padding: 'var(--space-4, 1rem)',
                  borderRadius: '8px',
                  border: '1px solid var(--sapTile_BorderColor, #d9d9d9)',
                }}
              >
                {/* Tier 3: Wafer Fabs */}
                <div>
                  <div style={{ fontSize: 'var(--text-xs, 0.75rem)', fontWeight: 'var(--weight-bold, 700)', color: 'var(--sapContent_LabelColor, #556b82)', textTransform: 'uppercase', marginBottom: '8px' }}>
                    Tier 3 — Wafer Fabrication
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-3, 0.75rem)' }}>
                    {tier3Nodes.map((node) => (
                      <NodeCard key={node.node_id} node={node} />
                    ))}
                  </div>
                </div>

                {/* Flow indicator */}
                <div style={{ textAlign: 'center', color: 'var(--sapContent_LabelColor, #556b82)', fontSize: '18px', userSelect: 'none' }} aria-hidden="true">
                  ↓
                </div>

                {/* Tier 2: Material & Die Processing */}
                <div>
                  <div style={{ fontSize: 'var(--text-xs, 0.75rem)', fontWeight: 'var(--weight-bold, 700)', color: 'var(--sapContent_LabelColor, #556b82)', textTransform: 'uppercase', marginBottom: '8px' }}>
                    Tier 2 — Die Sort, Dicing &amp; Ceramic Substrates
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-3, 0.75rem)' }}>
                    {tier2Nodes.map((node) => (
                      <NodeCard key={node.node_id} node={node} />
                    ))}
                  </div>
                </div>

                {/* Flow indicator */}
                <div style={{ textAlign: 'center', color: 'var(--sapContent_LabelColor, #556b82)', fontSize: '18px', userSelect: 'none' }} aria-hidden="true">
                  ↓
                </div>

                {/* Tier 1: Module Assembly */}
                <div>
                  <div style={{ fontSize: 'var(--text-xs, 0.75rem)', fontWeight: 'var(--weight-bold, 700)', color: 'var(--sapContent_LabelColor, #556b82)', textTransform: 'uppercase', marginBottom: '8px' }}>
                    Tier 1 — Module Assembly Suppliers
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-3, 0.75rem)' }}>
                    {tier1Nodes.map((node) => (
                      <NodeCard key={node.node_id} node={node} />
                    ))}
                  </div>
                </div>

                {/* Flow indicator */}
                <div style={{ textAlign: 'center', color: 'var(--sapContent_LabelColor, #556b82)', fontSize: '18px', userSelect: 'none' }} aria-hidden="true">
                  ↓
                </div>

                {/* Tier 0: Buyer Plant */}
                <div>
                  <div style={{ fontSize: 'var(--text-xs, 0.75rem)', fontWeight: 'var(--weight-bold, 700)', color: 'var(--sapContent_LabelColor, #556b82)', textTransform: 'uppercase', marginBottom: '8px' }}>
                    Tier 0 — Buyer Manufacturing Facility
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-3, 0.75rem)' }}>
                    {tier0Nodes.map((node) => (
                      <NodeCard key={node.node_id} node={node} />
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* Accessible Collapsed Text Equivalent (FB-15 / FB-18 requirement) */}
            <details
              className="ae-accessible-details"
              style={{
                marginBottom: 'var(--space-6, 2rem)',
                padding: 'var(--space-3, 0.75rem) var(--space-4, 1rem)',
                borderRadius: '8px',
                border: '1px solid var(--sapTile_BorderColor, #d9d9d9)',
                background: 'var(--sapTile_Background, #ffffff)',
              }}
            >
              <summary
                style={{
                  cursor: 'pointer',
                  fontWeight: 'var(--weight-semibold, 600)',
                  fontSize: 'var(--text-sm, 0.875rem)',
                  color: 'var(--color-primary, #0070f2)',
                  padding: '4px 0',
                }}
              >
                Text version: View tabular supply network node inventory and status
              </summary>

              <div style={{ marginTop: 'var(--space-3, 0.75rem)', overflowX: 'auto' }}>
                <table
                  className="ae-table"
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: 'var(--text-xs, 0.75rem)',
                  }}
                  aria-label="Supply network node inventory, transit stock, and status summary"
                >
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--sapTile_BorderColor, #d9d9d9)', textAlign: 'left' }}>
                      <th style={{ padding: '8px' }} scope="col">Node ID</th>
                      <th style={{ padding: '8px' }} scope="col">Facility Name</th>
                      <th style={{ padding: '8px' }} scope="col">Role</th>
                      <th style={{ padding: '8px' }} scope="col">Country</th>
                      <th style={{ padding: '8px' }} scope="col">Status</th>
                      <th style={{ padding: '8px', textAlign: 'right' }} scope="col">On Hand</th>
                      <th style={{ padding: '8px', textAlign: 'right' }} scope="col">In Transit</th>
                      <th style={{ padding: '8px' }} scope="col">Status Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {network.nodes.map((node) => (
                      <tr
                        key={node.node_id}
                        style={{ borderBottom: '1px solid var(--sapTile_BorderColor, #e5e5e5)' }}
                      >
                        <td style={{ padding: '8px', fontFamily: 'var(--font-mono, monospace)', fontWeight: 'bold' }}>
                          {node.node_id}
                        </td>
                        <td style={{ padding: '8px' }}>{node.label}</td>
                        <td style={{ padding: '8px' }}>{node.role.replace(/_/g, ' ')}</td>
                        <td style={{ padding: '8px' }}>{node.country}</td>
                        <td style={{ padding: '8px' }}>{getNodeStatusBadge(node.status)}</td>
                        <td style={{ padding: '8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {node.inventory_on_hand.toLocaleString()}
                        </td>
                        <td style={{ padding: '8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {node.stock_in_transit.toLocaleString()}
                        </td>
                        <td style={{ padding: '8px', color: 'var(--sapContent_LabelColor, #556b82)' }}>
                          {node.status_reason}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        )}
      </PageBody>
    </div>
  );
}

function NodeCard({ node }: { node: SupplyNetworkNode }) {
  const borderColor = getNodeBorderColor(node.status);
  const sparklineColor =
    node.status === 'disrupted'
      ? 'var(--sapNegativeColor, #b00)'
      : node.status === 'warning'
        ? 'var(--sapCriticalColor, #e9730c)'
        : 'var(--sapBrandColor, #0070f2)';

  return (
    <div
      className="ae-network-node-card"
      data-node-id={node.node_id}
      style={{
        backgroundColor: 'var(--sapTile_Background, #ffffff)',
        borderRadius: '6px',
        border: '1px solid var(--sapTile_BorderColor, #d9d9d9)',
        borderLeft: `5px solid ${borderColor}`,
        padding: 'var(--space-3, 0.75rem)',
        boxShadow: 'var(--sapContent_Shadow0, 0 1px 3px rgba(0,0,0,0.06))',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span
          className="mono"
          style={{
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: 'var(--text-xs, 0.75rem)',
            fontWeight: 'var(--weight-bold, 700)',
            color: 'var(--sapTextColor, #1d2d3e)',
          }}
        >
          {node.node_id}
        </span>
        {getNodeStatusBadge(node.status)}
      </div>

      <div style={{ fontWeight: 'var(--weight-semibold, 600)', fontSize: 'var(--text-sm, 0.875rem)', marginBottom: '8px' }}>
        {node.label}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px',
          fontSize: 'var(--text-xs, 0.75rem)',
          marginBottom: '8px',
          background: 'var(--sapBackgroundColor, #f8f9fa)',
          padding: '6px 8px',
          borderRadius: '4px',
        }}
      >
        <div>
          <span style={{ color: 'var(--sapContent_LabelColor, #556b82)' }}>On Hand: </span>
          <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{node.inventory_on_hand.toLocaleString()}</strong>
        </div>
        <div>
          <span style={{ color: 'var(--sapContent_LabelColor, #556b82)' }}>In Transit: </span>
          <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{node.stock_in_transit.toLocaleString()}</strong>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
        <span style={{ fontSize: 'var(--text-xs, 0.75rem)', color: 'var(--sapContent_LabelColor, #556b82)' }}>
          Movement over time:
        </span>
        <Sparkline data={node.movement_history} color={sparklineColor} />
      </div>

      <div style={{ fontSize: '0.6875rem', color: 'var(--sapContent_LabelColor, #556b82)', lineHeight: 1.3 }}>
        {node.status_reason}
      </div>
    </div>
  );
}
