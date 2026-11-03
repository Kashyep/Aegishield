import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { DependencyResult, GraphView, GraphViewNode } from '../api/types'
import { STATUS_TEXT, STATUS_ACCENT_VAR, STATUS_TAG_DESIGN, SWIMLANE_TIERS } from './graphStatus'
import '@ui5/webcomponents/dist/Popover.js'
import '@ui5/webcomponents/dist/Button.js'
import '@ui5/webcomponents/dist/Tag.js'
/** Column per facility role, left (upstream) to right (buyer): goods flow provider -> consumer. */
const ROLE_COLUMN: Record<string, number> = { wafer_fab: 0, material_supplier: 0, die_processing: 1, module_assembly: 2, buyer_plant: 3 }
/** Preferred row order inside a column for the demo scenario; unknown ids fall back to id order. */
const ROW_ORDER = ['FAC-FABZ', 'FAC-SUBS', 'FAC-FABK', 'FAC-TSUB', 'FAC-Q-KDH', 'FAC-VDIE', 'FAC-A-PEN', 'FAC-B-CHB', 'FAC-C-BDG', 'FAC-KAV-BLR']
const NODE_W = 205
const NODE_H = 88
const COL_X = [28, 344, 670, 980]

const STATUS_TAG: Record<string, string> = {
  disrupted: '⚠ DISRUPTED · ROOT CAUSE',
  blocked: '✕ CANDIDATE · BLOCKED',
  candidate_passed: '✓ CANDIDATE · PASSED',
  affected_primary: '! PRIMARY SUPPLIER · AFFECTED',
  buyer: 'BUYER PLANT',
}
const PATH_KIND: Record<string, string> = {
  shared_disrupted_dependency: 'Shared dependency on the disrupted site',
  independent: 'Independent upstream path',
  shared_undisrupted: 'Shared with the primary supplier, not disrupted',
}
const OUTCOME_TEXT: Record<string, string> = { passed: 'Passed', needs_review: 'Needs review', blocked: 'Blocked' }

function layoutGraph(view: GraphView): Record<string, { x: number; y: number }> {
  const columns: Record<number, GraphViewNode[]> = {}
  for (const node of view.nodes) {
    const col = ROLE_COLUMN[node.role] ?? 1
    ;(columns[col] ??= []).push(node)
  }
  const rank = (id: string) => (ROW_ORDER.includes(id) ? ROW_ORDER.indexOf(id) : ROW_ORDER.length)
  const positions: Record<string, { x: number; y: number }> = {}
  for (const [col, nodes] of Object.entries(columns)) {
    const sorted = [...nodes].sort((a, b) => rank(a.id) - rank(b.id) || a.id.localeCompare(b.id))
    const gap = sorted.length > 1 ? Math.min(170, 510 / (sorted.length - 1)) : 0
    sorted.forEach((node, index) => { positions[node.id] = { x: COL_X[Number(col)], y: 72 + index * gap } })
  }
  return positions
}

// ⚡ Bolt Optimization:
// Wrapped DependencyGraph in React.memo to prevent expensive re-renders
// when parent state changes (e.g. active tab switching).
// Extracted heavy computations like layoutGraph and array transformations
// into useMemo hooks. Expected impact: Eliminates layout recalculation on every tab switch/selection.
export const DependencyGraph = React.memo(function DependencyGraph({ view, result, candidates, onFocusSupplier, selectedNodeId, onSelectNode }: {
  view: GraphView
  result?: DependencyResult
  candidates: { supplierId: string; label: string }[]
  onFocusSupplier: (supplierId: string) => void
  selectedNodeId: string | null
  onSelectNode: (node: GraphViewNode | null) => void
}) {
  const [activeFilter, setActiveFilter] = useState<'all' | 'P1' | 'P2'>('all')
  const positions = useMemo(() => layoutGraph(view), [view])
  const nodeById = useMemo(() => Object.fromEntries(view.nodes.map((node) => [node.id, node])), [view.nodes])
  const focusEdgeIds = useMemo(() => new Set(view.paths.flatMap((path) => path.edge_ids)), [view.paths])
  const height = useMemo(() => Math.max(...Object.values(positions).map((p) => p.y)) + NODE_H + 40, [positions])
  const isConnected = (nodeId: string) => view.edges.some((edge) => (edge.source === selectedNodeId && edge.target === nodeId) || (edge.target === selectedNodeId && edge.source === nodeId))
  const blockedPath = view.paths.find((path) => path.kind === 'shared_disrupted_dependency')
  const focusLabel = candidates.find((c) => c.supplierId === view.focus_supplier_id)?.label ?? view.focus_supplier_id
  const selectedNode = selectedNodeId ? nodeById[selectedNodeId] : null
  // Latest selection, read by the popover's close handler. A popover closing for a
  // previous node must not clear the node that has since been selected.
  const latestSelectedIdRef = useRef(selectedNodeId)
  useEffect(() => { latestSelectedIdRef.current = selectedNodeId }, [selectedNodeId])

  return (
    <section className="dependency-graph" aria-label="Dependency evidence graph">
      {/* Filter toolbar (All / P1 / P2) per FB-16 */}
      <div
        className="graph-filter-toolbar"
        role="toolbar"
        aria-label="Supply chain filter toolbar"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 'var(--space-2, 0.5rem)',
          marginBottom: 'var(--space-3, 0.75rem)',
          padding: 'var(--space-2, 0.5rem) var(--space-3, 0.75rem)',
          borderRadius: 'var(--sapButton_BorderCornerRadius, 0.5rem)',
          backgroundColor: 'var(--sapList_AlternatingBackground, rgba(0,0,0,0.02))',
          border: '1px solid var(--sapTile_BorderColor, #d9d9d9)',
        }}
      >
        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--sapContent_LabelColor, var(--color-text-muted))', marginRight: 'var(--space-1)' }}>
          Scenario filter:
        </span>
        <button
          type="button"
          className={`filter-btn ${activeFilter === 'all' ? 'active' : ''}`}
          aria-pressed={activeFilter === 'all'}
          onClick={() => setActiveFilter('all')}
          style={{
            minHeight: '36px',
            padding: '0.375rem 0.875rem',
            fontSize: '0.875rem',
            fontWeight: 600,
            borderRadius: 'var(--sapButton_BorderCornerRadius, 0.5rem)',
            cursor: 'pointer',
            border: '1px solid',
            transition: 'all 0.15s ease',
            ...(activeFilter === 'all'
              ? {
                  backgroundColor: 'var(--sapButton_Emphasized_Background, #0070f2)',
                  color: 'var(--sapButton_Emphasized_TextColor, #ffffff)',
                  borderColor: 'var(--sapButton_Emphasized_BorderColor, #0070f2)',
                }
              : {
                  backgroundColor: 'var(--sapTile_Background, #ffffff)',
                  color: 'var(--sapTextColor, #1d2d3e)',
                  borderColor: 'var(--sapTile_BorderColor, #d9d9d9)',
                }),
          }}
        >
          All
        </button>
        <button
          type="button"
          className={`filter-btn ${activeFilter === 'P1' ? 'active' : ''}`}
          aria-pressed={activeFilter === 'P1'}
          onClick={() => {
            setActiveFilter('P1');
            onFocusSupplier('SUP-B');
          }}
          style={{
            minHeight: '36px',
            padding: '0.375rem 0.875rem',
            fontSize: '0.875rem',
            fontWeight: 600,
            borderRadius: 'var(--sapButton_BorderCornerRadius, 0.5rem)',
            cursor: 'pointer',
            border: '1px solid',
            transition: 'all 0.15s ease',
            ...(activeFilter === 'P1'
              ? {
                  backgroundColor: 'var(--sapButton_Emphasized_Background, #0070f2)',
                  color: 'var(--sapButton_Emphasized_TextColor, #ffffff)',
                  borderColor: 'var(--sapButton_Emphasized_BorderColor, #0070f2)',
                }
              : {
                  backgroundColor: 'var(--sapTile_Background, #ffffff)',
                  color: 'var(--sapTextColor, #1d2d3e)',
                  borderColor: 'var(--sapTile_BorderColor, #d9d9d9)',
                }),
          }}
        >
          P1 (Fastest-cheapest)
        </button>
        <button
          type="button"
          className={`filter-btn ${activeFilter === 'P2' ? 'active' : ''}`}
          aria-pressed={activeFilter === 'P2'}
          onClick={() => {
            setActiveFilter('P2');
            onFocusSupplier('SUP-C');
          }}
          style={{
            minHeight: '36px',
            padding: '0.375rem 0.875rem',
            fontSize: '0.875rem',
            fontWeight: 600,
            borderRadius: 'var(--sapButton_BorderCornerRadius, 0.5rem)',
            cursor: 'pointer',
            border: '1px solid',
            transition: 'all 0.15s ease',
            ...(activeFilter === 'P2'
              ? {
                  backgroundColor: 'var(--sapButton_Emphasized_Background, #0070f2)',
                  color: 'var(--sapButton_Emphasized_TextColor, #ffffff)',
                  borderColor: 'var(--sapButton_Emphasized_BorderColor, #0070f2)',
                }
              : {
                  backgroundColor: 'var(--sapTile_Background, #ffffff)',
                  color: 'var(--sapTextColor, #1d2d3e)',
                  borderColor: 'var(--sapTile_BorderColor, #d9d9d9)',
                }),
          }}
        >
          P2 (AegisShield verified)
        </button>
      </div>

      {selectedNode && (
        <ui5-popover
          key={selectedNode.id}
          id="graph-node-popover"
          opener={`node-${selectedNode.id}`}
          open={true}
          headerText={selectedNode.label}
          placement="Bottom"
          onclose={() => {
            // UI5 also closes the popover when its opener scrolls out of view; that must not deselect the node.
            const opener = document.getElementById(`node-${selectedNode.id}`)?.getBoundingClientRect()
            const openerInView = !!opener && opener.bottom > 0 && opener.right > 0 && opener.top < window.innerHeight && opener.left < window.innerWidth
            if (openerInView && latestSelectedIdRef.current === selectedNode.id) onSelectNode(null)
          }}
          style={{ minWidth: '320px', maxWidth: '400px' }}
        >
          <div style={{ padding: 'var(--space-3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
              <span
                className="mono"
                style={{
                  fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
                  fontSize: '0.8125rem',
                  fontWeight: 700,
                  color: 'var(--sapContent_LabelColor, var(--color-text-muted))',
                }}
              >
                {selectedNode.id}
              </span>
              <ui5-tag design={STATUS_TAG_DESIGN[selectedNode.status] ?? 'Neutral'}>
                {STATUS_TEXT[selectedNode.status] ?? selectedNode.status}
              </ui5-tag>
            </div>
            <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 'var(--space-2) var(--space-4)', margin: 0 }}>
              <div>
                <dt style={{ color: 'var(--sapContent_LabelColor, var(--color-text-muted))', fontSize: '0.75rem', fontWeight: 600 }}>Organization</dt>
                <dd style={{ margin: 0, fontWeight: 500, fontSize: '0.875rem' }}>{selectedNode.org_name}</dd>
              </div>
              <div>
                <dt style={{ color: 'var(--sapContent_LabelColor, var(--color-text-muted))', fontSize: '0.75rem', fontWeight: 600 }}>Country</dt>
                <dd style={{ margin: 0, fontWeight: 500, fontSize: '0.875rem' }}>{selectedNode.country}</dd>
              </div>
              <div>
                <dt style={{ color: 'var(--sapContent_LabelColor, var(--color-text-muted))', fontSize: '0.75rem', fontWeight: 600 }}>Role</dt>
                <dd style={{ margin: 0, fontWeight: 500, fontSize: '0.875rem' }}>{selectedNode.role.replace(/_/g, ' ')}</dd>
              </div>
              <div>
                <dt style={{ color: 'var(--sapContent_LabelColor, var(--color-text-muted))', fontSize: '0.75rem', fontWeight: 600 }}>Status</dt>
                <dd style={{ margin: 0, fontWeight: 500, fontSize: '0.875rem' }}>{selectedNode.status}</dd>
              </div>
            </dl>
            <div style={{ marginTop: 'var(--space-3)', display: 'flex', justifyContent: 'flex-end' }}>
              <ui5-button design="Transparent" onClick={() => onSelectNode(null)}>
                Close
              </ui5-button>
            </div>
          </div>
        </ui5-popover>
      )}
      <div
        className="graph-focus"
        role="group"
        aria-label="Candidate supplier to explain"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 'var(--space-3, 0.75rem)',
          margin: 'var(--space-2, 0.5rem) 0 var(--space-4, 1rem)',
        }}
      >
        <span style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--sapContent_LabelColor, var(--color-text-muted))' }}>
          Explain candidate:
        </span>
        {candidates.map((c) => {
          const isActive = c.supplierId === view.focus_supplier_id;
          return (
            <button
              key={c.supplierId}
              className={`focus-button ${isActive ? 'active' : ''}`}
              aria-pressed={isActive}
              onClick={() => onFocusSupplier(c.supplierId)}
              style={{
                minHeight: '44px',
                minWidth: '44px',
                padding: '0.625rem 1.25rem',
                fontSize: '0.9375rem',
                fontWeight: 600,
                borderRadius: 'var(--sapButton_BorderCornerRadius, 0.5rem)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                transition: 'background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease',
                ...(isActive
                  ? {
                      backgroundColor: 'var(--sapButton_Emphasized_Background, #0070f2)',
                      color: 'var(--sapButton_Emphasized_TextColor, #ffffff)',
                      borderColor: 'var(--sapButton_Emphasized_BorderColor, #0070f2)',
                      boxShadow: 'var(--sapContent_Shadow0, 0 1px 3px rgba(0,0,0,0.15))',
                    }
                  : {
                      backgroundColor: 'var(--sapTile_Background, #ffffff)',
                      color: 'var(--sapTextColor, #1d2d3e)',
                      borderColor: 'var(--sapTile_BorderColor, #d9d9d9)',
                    }),
              }}
            >
              {c.supplierId} · {c.label}
            </button>
          );
        })}
      </div>
      {result && <section className={`dependency-verdict ${result.outcome}`} aria-live="polite" aria-label="Dependency check result">
        <strong>{view.focus_supplier_id} · {OUTCOME_TEXT[result.outcome] ?? result.outcome}</strong>
        <span>{result.reason_code.replace(/_/g, ' ').toLowerCase()} · searched {result.max_depth} hops upstream · coverage {result.coverage.complete ? 'complete' : 'incomplete'}</span>
        {blockedPath && <p>{focusLabel} is not independent: its path {blockedPath.path_id} reaches the disrupted site {blockedPath.node_ids.slice(1).map((id) => nodeById[id]?.label ?? id).join(' ← ')}. The red links show this path.</p>}
        {!blockedPath && result.outcome === 'passed' && <p>No upstream path from {focusLabel} reaches the disrupted site within {result.max_depth} hops. Blue links show its verified upstream paths.</p>}
      </section>}
      <div className="graph-legend" role="group" aria-label="Graph legend">
        <span><i className="legend-dot disrupted" />Disrupted site</span>
        <span><i className="legend-dot blocked" />Blocked candidate</span>
        <span><i className="legend-dot passed" />Passed candidate</span>
        <span><i className="legend-dot affected" />Affected primary supplier</span>
        <span><i className="legend-line path" />Evidence path to disruption</span>
        <span><i className="legend-line focus" />Upstream path of selected candidate</span>
        <span><i className="legend-line candidate" />Proposed supply (candidate)</span>
      </div>
      <div className="graph-scroll">
      <svg className="supply-graph" viewBox={`0 0 1215 ${height}`} role="img" aria-labelledby="supply-graph-title" aria-describedby="supply-graph-description">
        <title id="supply-graph-title">Dependency evidence graph for {view.focus_supplier_id}</title>
        <desc id="supply-graph-description">Arrows show goods flowing from provider to consumer. The evidence paths and every link are also listed as text below the graphic.</desc>
        <defs>
          <style>
            {`
              @keyframes flowDash {
                from { stroke-dashoffset: 24; }
                to { stroke-dashoffset: 0; }
              }
              .graph-edge path {
                fill: none;
              }
              .graph-edge.edge-path path {
                stroke: var(--sapNegativeColor, #e52929);
                stroke-width: 3.5;
                stroke-dasharray: 7 4;
                animation: flowDash 1.2s linear infinite;
              }
              .graph-edge.edge-candidate path {
                stroke: var(--sapPositiveColor, #107e3e);
                stroke-width: 3;
                stroke-dasharray: 7 4;
                animation: flowDash 1.2s linear infinite;
              }
              .graph-edge.edge-focus path {
                stroke: var(--sapHighlightColor, #0a6ed1);
                stroke-width: 3;
                stroke-dasharray: 7 4;
                animation: flowDash 1.5s linear infinite;
              }
              .graph-edge.edge-default path {
                stroke: var(--sapTile_BorderColor, #b0b8c2);
                stroke-width: 2;
              }
            `}
          </style>
          {['default', 'path', 'focus', 'candidate'].map((kind) => (
            <marker key={kind} id={`graph-arrow-${kind}`} className={`arrow-${kind}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" />
            </marker>
          ))}
        </defs>
        {/* Tier swimlanes per FB-16 */}
        <g className="tier-swimlanes" aria-hidden="true">
          {SWIMLANE_TIERS.map((tier) => (
            <g key={tier.id} className="swimlane-column">
              <rect
                x={tier.x}
                y={10}
                width={tier.width}
                height={Math.max(100, height - 20)}
                rx="10"
                fill="var(--sapList_AlternatingBackground, rgba(0,0,0,0.015))"
                stroke="var(--sapTile_BorderColor, #e5e8ec)"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <rect
                x={tier.x + 8}
                y={16}
                width={tier.width - 16}
                height={34}
                rx="6"
                fill="var(--sapTile_Background, #ffffff)"
                stroke="var(--sapTile_BorderColor, #d9d9d9)"
                strokeWidth="1"
              />
              <text
                x={tier.x + 16}
                y={30}
                style={{
                  fill: 'var(--sapContent_LabelColor, #6a737d)',
                  fontSize: '9px',
                  fontWeight: 700,
                  letterSpacing: '0.6px',
                }}
              >
                {tier.tier}
              </text>
              <text
                x={tier.x + 16}
                y={44}
                style={{
                  fill: 'var(--sapTextColor, #1d2d3e)',
                  fontSize: '11px',
                  fontWeight: 600,
                }}
              >
                {tier.title}
              </text>
            </g>
          ))}
        </g>
        {view.edges.map((edge) => {
          const isCandidateP2View = activeFilter === 'P2' || (activeFilter === 'all' && view.focus_supplier_id === 'SUP-C')
          // FB-14: Proposed-candidate dotted lines must NOT be drawn on the disrupted supply-chain view; only in the candidate/P2 view.
          if (edge.candidate && (!isCandidateP2View || edge.id !== 'CAND-SUP-C')) {
            return null
          }
          const from = positions[edge.source]
          const to = positions[edge.target]
          if (!from || !to) return null
          const startX = from.x + NODE_W
          const endX = to.x - 10
          const middleX = (startX + endX) / 2
          const startY = from.y + NODE_H / 2
          const endY = to.y + NODE_H / 2
          const middleY = (startY + endY) / 2
          const kind = edge.highlighted ? 'path' : edge.candidate ? 'candidate' : focusEdgeIds.has(edge.id) ? 'focus' : 'default'
          const connected = selectedNodeId !== null && (edge.source === selectedNodeId || edge.target === selectedNodeId)
          const isFilterDimmed =
            activeFilter === 'P1'
              ? edge.source === 'FAC-C-BDG' || edge.target === 'FAC-C-BDG'
              : activeFilter === 'P2'
                ? edge.source === 'FAC-B-CHB' || edge.target === 'FAC-B-CHB'
                : false
          const dimmed = (selectedNodeId && !connected) || isFilterDimmed
          const pillText = edge.part_id || (edge.candidate ? 'PROPOSED' : 'SUPPLIES')
          const pillWidth = Math.max(54, pillText.length * 6.5 + 16)
          return (
            <g key={edge.id} data-edge-id={edge.id} data-kind={kind} className={`graph-edge edge-${kind} ${dimmed ? 'is-dimmed' : ''}`}>
              <path
                d={`M ${startX} ${startY} C ${middleX} ${startY}, ${middleX} ${endY}, ${endX} ${endY}`}
                markerEnd={`url(#graph-arrow-${kind})`}
              />
              <g className="edge-callout-pill" transform={`translate(${middleX}, ${middleY})`}>
                <rect
                  x={-pillWidth / 2}
                  y="-9"
                  width={pillWidth}
                  height="18"
                  rx="9"
                  fill="var(--sapTile_Background, #ffffff)"
                  stroke={kind === 'path' ? 'var(--sapNegativeColor, #e52929)' : kind === 'candidate' ? 'var(--sapPositiveColor, #107e3e)' : 'var(--sapTile_BorderColor, #d9d9d9)'}
                  strokeWidth="1"
                />
                <text
                  textAnchor="middle"
                  y="3.5"
                  className="mono"
                  style={{
                    fontSize: '9px',
                    fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
                    fontWeight: 600,
                    fill: kind === 'path' ? 'var(--sapNegativeColor, #e52929)' : kind === 'candidate' ? 'var(--sapPositiveColor, #107e3e)' : 'var(--sapContent_LabelColor, #556b82)',
                  }}
                >
                  {pillText}
                </text>
              </g>
              <title>{edge.id}: {nodeById[edge.source]?.label ?? edge.source} supplies {nodeById[edge.target]?.label ?? edge.target}{edge.candidate ? ' (proposed)' : ''}</title>
            </g>
          )
        })}
        {view.nodes.map((node) => {
          const position = positions[node.id]
          if (!position) return null
          const selected = node.id === selectedNodeId
          const isFilterDimmed =
            activeFilter === 'P1'
              ? node.id === 'FAC-C-BDG'
              : activeFilter === 'P2'
                ? node.id === 'FAC-B-CHB'
                : false
          const dimmed = (selectedNodeId && !selected && !isConnected(node.id)) || isFilterDimmed
          return (
            <g
              key={node.id}
              id={`node-${node.id}`}
              data-node-id={node.id}
              data-status={node.status}
              className={`graph-node status-${node.status} ${selected ? 'is-selected' : ''} ${dimmed ? 'is-dimmed' : ''}`}
              transform={`translate(${position.x} ${position.y})`}
              onClick={() => onSelectNode(node)}
            >
              <rect width={NODE_W} height={NODE_H} rx="8" fill="var(--sapTile_Background, #ffffff)" stroke="var(--sapTile_BorderColor, #d9d9d9)" strokeWidth={selected ? 2.5 : 1.5} />
              <rect x="0" y="0" width="4" height={NODE_H} rx="2" fill={STATUS_ACCENT_VAR[node.status] ?? 'var(--sapTile_BorderColor)'} />
              <text x="14" y="24" className="node-tag" style={{ fill: STATUS_ACCENT_VAR[node.status] ?? 'var(--sapContent_LabelColor)', fontSize: '9px', fontWeight: 700, letterSpacing: '0.5px' }}>
                {STATUS_TAG[node.status] ?? node.role.replace(/_/g, ' ').toUpperCase()}
              </text>
              <text x="14" y="47" className="node-label" style={{ fill: 'var(--sapTextColor, #1d2d3e)', fontSize: '13px', fontWeight: 600 }}>
                {node.label}
              </text>
              <text x="14" y="69" className="node-id mono" style={{ fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)', fontSize: '10px', fontWeight: 600, fill: 'var(--sapContent_LabelColor, #556b82)' }}>
                {node.id}
              </text>
              <text x="96" y="69" className="node-meta" style={{ fill: 'var(--sapContent_LabelColor, #556b82)', fontSize: '10px' }}>
                · {node.country}
              </text>
              <title>{node.org_name}: {STATUS_TEXT[node.status] ?? node.status}</title>
            </g>
          )
        })}
      </svg>
    </div>
    <p className="graph-note">Select a facility to see its details and direct links. Arrows show provider-to-consumer flow. All organisations are synthetic.</p>
    <div className="table-scroll" role="region" aria-label="Scrollable facility records table" tabIndex={0} style={{ marginTop: 'var(--space-4)' }}>
      <table className="audit-table">
        <caption>Facility records in this graph fixture</caption>
        <thead>
          <tr>
            <th scope="col">Facility</th>
            <th scope="col">Organization</th>
            <th scope="col">Country</th>
            <th scope="col">Role</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {view.nodes.map((node) => (
            <tr key={node.id}>
              <td>
                {node.label}
                <small className="mono" style={{ display: 'block', fontFamily: 'var(--font-mono, monospace)', color: 'var(--sapContent_LabelColor, var(--color-text-muted))' }}>{node.id}</small>
              </td>
              <td>{node.org_name}</td>
              <td>{node.country}</td>
              <td>{node.role.replace(/_/g, ' ')}</td>
              <td>{STATUS_TEXT[node.status] ?? node.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <section className="graph-text-alternative" aria-labelledby="graph-text-heading" style={{ marginTop: 'var(--space-4)' }}>
      <h2 id="graph-text-heading">Alternative supply links</h2>
      <h3>Evidence paths for {view.focus_supplier_id}</h3>
      <ol className="evidence-paths">
        {view.paths.map((path, index) => (
          <li key={path.path_id}>
            <strong>{path.path_id} · {PATH_KIND[path.kind] ?? path.kind.replace(/_/g, ' ')}</strong>
            <code>{view.text_alternative[index]}</code>
          </li>
        ))}
      </ol>
      <details className="graph-text-expander" style={{ marginTop: 'var(--space-3)' }}>
        <summary style={{ cursor: 'pointer', padding: 'var(--space-2) 0', fontWeight: 600, color: 'var(--sapLinkColor, var(--color-primary-text))' }}>
          Text version: all supply links ({view.edges.length} links recorded)
        </summary>
        <p style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-sm)', color: 'var(--sapContent_LabelColor, var(--color-text-muted))' }}>
          Each entry is a link in its recorded direction: provider to consumer. Select one to focus its consumer in the graphic.
        </p>
        <ol>
          {view.edges.map((edge) => {
            const source = nodeById[edge.source];
            const target = nodeById[edge.target];
            return (
              <li key={edge.id}>
                <button className="graph-link-button" onClick={() => target && onSelectNode(target)}>
                  {source?.label ?? edge.source} ({source?.country ?? 'country not recorded'}) {edge.candidate ? 'would supply' : 'supplies'} {target?.label ?? edge.target} ({target?.country ?? 'country not recorded'})
                </button>
                <span>
                  {edge.id} · {edge.candidate ? 'proposed candidate supply' : `${edge.part_id} · ${edge.confidence ?? 'confidence not recorded'} · source ${edge.source_ref ?? 'not recorded'}`}
                  {edge.highlighted ? ' · on the evidence path to the disruption' : ''}
                </span>
              </li>
            );
          })}
        </ol>
      </details>
    </section>
    </section>
  )
})

