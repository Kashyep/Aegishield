import React, { useMemo } from 'react'
import type { DependencyResult, GraphView, GraphViewNode } from '../api/types'
import { STATUS_TEXT } from './graphStatus'

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
    sorted.forEach((node, index) => { positions[node.id] = { x: COL_X[Number(col)], y: 36 + index * gap } })
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
  onSelectNode: (node: GraphViewNode) => void
}) {
  const positions = useMemo(() => layoutGraph(view), [view])
  const nodeById = useMemo(() => Object.fromEntries(view.nodes.map((node) => [node.id, node])), [view.nodes])
  const focusEdgeIds = useMemo(() => new Set(view.paths.flatMap((path) => path.edge_ids)), [view.paths])
  const height = useMemo(() => Math.max(...Object.values(positions).map((p) => p.y)) + NODE_H + 40, [positions])
  const isConnected = (nodeId: string) => view.edges.some((edge) => (edge.source === selectedNodeId && edge.target === nodeId) || (edge.target === selectedNodeId && edge.source === nodeId))
  const blockedPath = view.paths.find((path) => path.kind === 'shared_disrupted_dependency')
  const focusLabel = candidates.find((c) => c.supplierId === view.focus_supplier_id)?.label ?? view.focus_supplier_id

  return (
    <section className="dependency-graph" aria-label="Dependency evidence graph">
      <div className="graph-focus" role="group" aria-label="Candidate supplier to explain">
        <span>Explain candidate:</span>
        {candidates.map((c) => <button key={c.supplierId} className={`focus-button ${c.supplierId === view.focus_supplier_id ? 'active' : ''}`} aria-pressed={c.supplierId === view.focus_supplier_id} onClick={() => onFocusSupplier(c.supplierId)}>{c.supplierId} · {c.label}</button>)}
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
          {['default', 'path', 'focus', 'candidate'].map((kind) => <marker key={kind} id={`graph-arrow-${kind}`} className={`arrow-${kind}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" /></marker>)}
        </defs>
        {view.edges.map((edge) => {
          const from = positions[edge.source]
          const to = positions[edge.target]
          if (!from || !to) return null
          const startX = from.x + NODE_W
          const endX = to.x - 10
          const middleX = (startX + endX) / 2
          const kind = edge.highlighted ? 'path' : edge.candidate ? 'candidate' : focusEdgeIds.has(edge.id) ? 'focus' : 'default'
          const connected = selectedNodeId !== null && (edge.source === selectedNodeId || edge.target === selectedNodeId)
          return <g key={edge.id} data-edge-id={edge.id} data-kind={kind} className={`graph-edge edge-${kind} ${selectedNodeId ? connected ? 'is-connected' : 'is-dimmed' : ''}`}>
            <path d={`M ${startX} ${from.y + NODE_H / 2} C ${middleX} ${from.y + NODE_H / 2}, ${middleX} ${to.y + NODE_H / 2}, ${endX} ${to.y + NODE_H / 2}`} markerEnd={`url(#graph-arrow-${kind})`} />
            <title>{edge.id}: {nodeById[edge.source]?.label ?? edge.source} supplies {nodeById[edge.target]?.label ?? edge.target}{edge.candidate ? ' (proposed)' : ''}</title>
          </g>
        })}
        {view.nodes.map((node) => {
          const position = positions[node.id]
          const selected = node.id === selectedNodeId
          return <g key={node.id} data-node-id={node.id} data-status={node.status} className={`graph-node status-${node.status} ${selected ? 'is-selected' : ''} ${selectedNodeId && !selected && !isConnected(node.id) ? 'is-dimmed' : ''}`} transform={`translate(${position.x} ${position.y})`} onClick={() => onSelectNode(node)}>
            <rect width={NODE_W} height={NODE_H} rx="10" />
            <text x="13" y="24" className="node-tag">{STATUS_TAG[node.status] ?? node.role.replace(/_/g, ' ').toUpperCase()}</text>
            <text x="13" y="49" className="node-label">{node.label}</text>
            <text x="13" y="69" className="node-meta">{node.id} · {node.country}</text>
            <title>{node.org_name}: {STATUS_TEXT[node.status] ?? node.status}</title>
          </g>
        })}
      </svg>
    </div>
    <p className="graph-note">Select a facility to see its details and direct links. Arrows show provider-to-consumer flow. All organisations are synthetic.</p>
    <section className="graph-text-alternative" aria-labelledby="graph-text-heading">
      <h2 id="graph-text-heading">Text alternative: supply links</h2>
      <h3>Evidence paths for {view.focus_supplier_id}</h3>
      <ol className="evidence-paths">{view.paths.map((path, index) => <li key={path.path_id}><strong>{path.path_id} · {PATH_KIND[path.kind] ?? path.kind.replace(/_/g, ' ')}</strong><code>{view.text_alternative[index]}</code></li>)}</ol>
      <h3>All supply links</h3>
      <p>Each entry is a link in its recorded direction: provider to consumer. Select one to focus its consumer in the graphic.</p>
      <ol>{view.edges.map((edge) => {
        const source = nodeById[edge.source]
        const target = nodeById[edge.target]
        return <li key={edge.id}><button className="graph-link-button" onClick={() => target && onSelectNode(target)}>{source?.label ?? edge.source} ({source?.country ?? 'country not recorded'}) {edge.candidate ? 'would supply' : 'supplies'} {target?.label ?? edge.target} ({target?.country ?? 'country not recorded'})</button><span>{edge.id} · {edge.candidate ? 'proposed candidate supply' : `${edge.part_id} · ${edge.confidence ?? 'confidence not recorded'} · source ${edge.source_ref ?? 'not recorded'}`}{edge.highlighted ? ' · on the evidence path to the disruption' : ''}</span></li>
      })}</ol>
      <div className="table-scroll" role="region" aria-label="Scrollable facility records table" tabIndex={0}><table className="audit-table"><caption>Facility records in this graph fixture</caption><thead><tr><th scope="col">Facility</th><th scope="col">Organization</th><th scope="col">Country</th><th scope="col">Role</th><th scope="col">Status</th></tr></thead><tbody>{view.nodes.map((node) => <tr key={node.id}><td>{node.label}<small>{node.id}</small></td><td>{node.org_name}</td><td>{node.country}</td><td>{node.role.replace(/_/g, ' ')}</td><td>{STATUS_TEXT[node.status] ?? node.status}</td></tr>)}</tbody></table></div>
    </section>
    </section>
  )
})

