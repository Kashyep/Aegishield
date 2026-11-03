import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { DependencyResult, GraphView, GraphViewNode } from '../api/types'
import {
  STATUS_ACCENT_VAR, STATUS_RANK, STATUS_TAG_DESIGN, STATUS_TAG_LABEL, STATUS_TEXT, STATUS_TEXT_VAR, SWIMLANE_TIERS, tierIndex,
  type SwimlaneTier,
} from './graphStatus'
import '@ui5/webcomponents/dist/Popover.js'
import '@ui5/webcomponents/dist/Button.js'
import '@ui5/webcomponents/dist/Tag.js'
import '../styles/graph.css'

type PathFilter = 'all' | 'P1' | 'P2'
type Box = { x: number; y: number; w: number; laneY: number }
type LaneBox = { tier: SwimlaneTier; x: number; y: number; w: number; h: number }
interface GraphLayout { width: number; height: number; stacked: boolean; nodes: Record<string, Box>; lanes: LaneBox[] }

/** Geometry in CSS px. The SVG is drawn at the measured container width, so 1 unit = 1 CSS px. */
const PAD = 16
const NODE_H = 126
const ROW_GAP = 16
const COL_GAP = 120
const LANE_HEAD = 64
const STACK_HEAD = 44
const STACK_MIN_NODE_W = 240
const STACK_GAP = 16
const BAND_GAP = 40
/** Below this width the tiers stack as horizontal bands instead of side-by-side columns. */
const COLUMN_MIN_WIDTH = 1040
const PILL_STACK_STEP = 116
const FALLBACK_WIDTH = 960
const PILL_CHAR_W = 7.4
const EXPOSURE_KIND = 'shared_disrupted_dependency'
const PATH_KIND: Record<string, string> = {
  shared_disrupted_dependency: 'Shared dependency on the disrupted site',
  independent: 'Independent upstream path',
  shared_undisrupted: 'Shared with the primary supplier, not disrupted',
}
const OUTCOME_TEXT: Record<string, string> = { passed: 'Passed', needs_review: 'Needs review', blocked: 'Blocked' }
const LEGEND_STATUSES = ['disrupted', 'blocked', 'candidate_passed', 'affected_primary', 'buyer', 'normal'] as const

function byTierThenSeverity(a: GraphViewNode, b: GraphViewNode): number {
  return tierIndex(a.role) - tierIndex(b.role)
    || (STATUS_RANK[a.status] ?? 5) - (STATUS_RANK[b.status] ?? 5)
    || a.label.localeCompare(b.label)
    || a.id.localeCompare(b.id)
}

/** Lays the nodes out in tier lanes, sized from the measured width. Pure function of the data and the width. */
function buildLayout(nodes: GraphViewNode[], measuredWidth: number): GraphLayout {
  const width = Math.max(280, measuredWidth || FALLBACK_WIDTH)
  const stacked = width < COLUMN_MIN_WIDTH
  const tiers: GraphViewNode[][] = SWIMLANE_TIERS.map(() => [])
  for (const node of [...nodes].sort(byTierThenSeverity)) tiers[tierIndex(node.role)].push(node)
  const positions: Record<string, Box> = {}

  if (!stacked) {
    const nodeW = Math.floor((width - 2 * PAD - 16 - 3 * COL_GAP) / 4)
    const colX = (t: number) => PAD + 8 + t * (nodeW + COL_GAP)
    const maxRows = Math.max(1, ...tiers.map((list) => list.length))
    const laneH = LANE_HEAD + 8 + maxRows * NODE_H + (maxRows - 1) * ROW_GAP + 12
    tiers.forEach((list, t) => list.forEach((node, i) => {
      positions[node.id] = { x: colX(t), y: 8 + LANE_HEAD + 8 + i * (NODE_H + ROW_GAP), w: nodeW, laneY: 8 }
    }))
    const lanes = SWIMLANE_TIERS.map((tier, t) => ({ tier, x: colX(t) - 8, y: 8, w: nodeW + 16, h: laneH }))
    return { width, height: laneH + 24, stacked, nodes: positions, lanes }
  }

  const innerW = width - 2 * PAD
  const perRow = Math.max(1, Math.floor((innerW + STACK_GAP) / (STACK_MIN_NODE_W + STACK_GAP)))
  const nodeW = Math.floor((innerW - (perRow - 1) * STACK_GAP) / perRow)
  const lanes: LaneBox[] = []
  let y = 8
  SWIMLANE_TIERS.forEach((tier, t) => {
    const list = tiers[t]
    if (list.length === 0) return
    const rows = Math.ceil(list.length / perRow)
    const h = STACK_HEAD + 8 + rows * NODE_H + (rows - 1) * ROW_GAP + 12
    lanes.push({ tier, x: 8, y, w: width - 16, h })
    list.forEach((node, i) => {
      positions[node.id] = {
        x: PAD + (i % perRow) * (nodeW + STACK_GAP),
        y: y + STACK_HEAD + 8 + Math.floor(i / perRow) * (NODE_H + ROW_GAP),
        w: nodeW,
        laneY: y,
      }
    })
    y += h + BAND_GAP
  })
  const height = lanes.length > 0 ? y - BAND_GAP + 16 : 24
  return { width, height, stacked, nodes: positions, lanes }
}

/**
 * Edge curve between two node boxes, plus where its part-id pill goes. In columns the pill sits in the
 * empty gap between tiers. In stacked bands it sits in the gap above the target band, spread across
 * the edges that arrive at the same target, so it never lands on a card.
 */
function edgeGeometry(source: Box, target: Box, stacked: boolean, slot: { index: number; count: number }): { d: string; px: number; py: number } {
  if (stacked) {
    const sx = source.x + source.w / 2
    const sy = source.y + NODE_H
    const tx = target.x + target.w / 2
    const ty = target.y
    const midY = (sy + ty) / 2
    return {
      d: `M ${sx} ${sy} C ${sx} ${midY}, ${tx} ${midY}, ${tx} ${ty}`,
      px: tx + (slot.index - (slot.count - 1) / 2) * PILL_STACK_STEP,
      py: target.laneY - BAND_GAP / 2,
    }
  }
  const sx = source.x + source.w
  const sy = source.y + NODE_H / 2
  const tx = target.x
  const ty = target.y + NODE_H / 2
  // Pill sits in the empty gap directly before the target tier (never inside an intermediate tier).
  const mx = (sx + tx) / 2
  return { d: `M ${sx} ${sy} C ${mx} ${sy}, ${mx} ${ty}, ${tx} ${ty}`, px: tx - COL_GAP / 2, py: ty + (slot.index - (slot.count - 1) / 2) * 26 }
}

function KpiTile({ kpi, label, value, hint, tone }: { kpi: string; label: string; value: number; hint: string; tone: 'negative' | 'critical' | 'information' | 'positive' }) {
  return (
    <li className="dg-kpi" data-kpi={kpi} data-tone={tone}>
      <span className="dg-kpi-label">{label}</span>
      <span className="dg-kpi-value" data-value={value}>{value}</span>
      <span className="dg-kpi-hint">{hint}</span>
    </li>
  )
}

// ⚡ Bolt Optimization:
// Wrapped DependencyGraph in React.memo so parent re-renders (tab switches, selection in other panes)
// do not re-run the layout. Layout depends only on the view and the measured canvas width.
export const DependencyGraph = React.memo(function DependencyGraph({ view, result, candidates, onFocusSupplier, selectedNodeId, onSelectNode }: {
  view: GraphView
  result?: DependencyResult
  candidates: { supplierId: string; label: string }[]
  onFocusSupplier: (supplierId: string) => void
  selectedNodeId: string | null
  onSelectNode: (node: GraphViewNode | null) => void
}) {
  const [activeFilter, setActiveFilter] = useState<PathFilter>('all')
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [measuredWidth, setMeasuredWidth] = useState(0)
  const canvasRef = useRef<HTMLDivElement>(null)
  const hasNodes = view.nodes.length > 0
  const nodeById = useMemo(() => Object.fromEntries(view.nodes.map((node) => [node.id, node])), [view.nodes])
  const focusEdgeIds = useMemo(() => new Set(view.paths.flatMap((path) => path.edge_ids)), [view.paths])
  const layout = useMemo(() => buildLayout(view.nodes, measuredWidth), [view.nodes, measuredWidth])
  const focusPassed = result?.outcome === 'passed'
  const blockedPath = view.paths.find((path) => path.kind === EXPOSURE_KIND)
  const focusLabel = candidates.find((c) => c.supplierId === view.focus_supplier_id)?.label ?? view.focus_supplier_id
  const selectedNode = selectedNodeId ? nodeById[selectedNodeId] : null
  const confidences = useMemo(() => [...new Set(view.edges.map((edge) => edge.confidence ?? 'not recorded'))], [view.edges])
  const counts = useMemo(() => ({
    disrupted: view.nodes.filter((node) => node.status === 'disrupted').length,
    atRisk: view.nodes.filter((node) => node.status === 'blocked' || node.status === 'affected_primary').length,
    candidates: view.edges.filter((edge) => edge.candidate).length,
  }), [view.nodes, view.edges])

  // Filter sets derived from the evidence paths. P1 = the exposure path to the disrupted site;
  // P2 = the verified upstream paths plus passed candidates (and their proposed supply links).
  const filterSets = useMemo(() => {
    const exposure = view.paths.filter((path) => path.kind === EXPOSURE_KIND)
    const verified = view.paths.filter((path) => path.kind !== EXPOSURE_KIND)
    const passedIds = new Set(view.nodes.filter((node) => node.status === 'candidate_passed').map((node) => node.id))
    const passedCandidateEdges = view.edges.filter((edge) => edge.candidate && passedIds.has(edge.source))
    return {
      P1: {
        available: exposure.length > 0,
        nodes: new Set(exposure.flatMap((path) => path.node_ids)),
        edges: new Set(exposure.flatMap((path) => path.edge_ids)),
      },
      P2: {
        available: verified.length > 0 || passedCandidateEdges.length > 0,
        nodes: new Set([...verified.flatMap((path) => path.node_ids), ...passedIds]),
        edges: new Set([...verified.flatMap((path) => path.edge_ids), ...passedCandidateEdges.map((edge) => edge.id)]),
      },
    }
  }, [view.paths, view.nodes, view.edges])

  // Measure the canvas: the SVG and cards are drawn at this width, so text never scales.
  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    setMeasuredWidth(Math.floor(el.getBoundingClientRect().width))
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver((entries) => {
      const width = Math.floor(entries[0]?.contentRect.width ?? 0)
      if (width > 0) setMeasuredWidth(width)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasNodes])

  // Latest selection, read by the popover's close handler. A popover closing for a
  // previous node must not clear the node that has since been selected.
  const latestSelectedIdRef = useRef(selectedNodeId)
  useEffect(() => { latestSelectedIdRef.current = selectedNodeId }, [selectedNodeId])

  // Focus = the selected node, otherwise the node under the pointer or keyboard focus.
  const focusId = selectedNodeId ?? hoverId
  const focusNeighbours = useMemo(() => {
    if (!focusId) return null
    const ids = new Set<string>([focusId])
    for (const edge of view.edges) {
      if (edge.source === focusId) ids.add(edge.target)
      if (edge.target === focusId) ids.add(edge.source)
    }
    return ids
  }, [focusId, view.edges])
  if (!hasNodes) {
    return (
      <section className="dg" aria-label="Dependency evidence graph">
        <div className="dg-empty" role="status">
          <strong>No supply relationships for this disruption</strong>
          <p>The evaluation returned no facilities for {view.focus_supplier_id}. Choose another candidate or re-run the evaluation.</p>
        </div>
      </section>
    )
  }

  const filterSet = activeFilter === 'all' ? null : filterSets[activeFilter]
  const nodeOffPath = (id: string) => filterSet !== null && !filterSet.nodes.has(id)
  const edgeOffPath = (id: string) => filterSet !== null && !filterSet.edges.has(id)
  const isLinkedEdge = (edge: { source: string; target: string }) => focusId !== null && (edge.source === focusId || edge.target === focusId)
  const nodeDimmed = (id: string) => nodeOffPath(id) || (focusNeighbours !== null && !focusNeighbours.has(id))
  // FB-14: proposed-candidate lines are drawn only from a passed candidate, and only in the P2 view
  // or in the view of a passed candidate. The blocked candidate's proposed line is never drawn.
  const candidateDrawn = (edge: { candidate: boolean; source: string }) =>
    edge.candidate && nodeById[edge.source]?.status === 'candidate_passed' && (activeFilter === 'P2' || (activeFilter === 'all' && focusPassed))

  return (
    <section className="dg" aria-label="Dependency evidence graph">
      <ul className="dg-kpis" aria-label="Supply graph summary">
        <KpiTile kpi="disrupted" label="Disrupted sites" value={counts.disrupted} hint={`of ${view.nodes.length} facilities`} tone="negative" />
        <KpiTile kpi="at-risk" label="At risk" value={counts.atRisk} hint="blocked candidates and affected primaries" tone="critical" />
        <KpiTile kpi="paths" label="Evidence paths" value={view.paths.length} hint={`recorded for ${view.focus_supplier_id}`} tone="information" />
        <KpiTile kpi="candidates" label="Candidate links" value={counts.candidates} hint="proposed supply links" tone="positive" />
      </ul>

      <div className="dg-toolbar" role="toolbar" aria-label="Supply chain filter toolbar">
        <span className="dg-toolbar-label" id="dg-filter-label">Show path:</span>
        <div className="dg-seg" role="group" aria-label="Show path">
          {([
            { filter: 'all', label: 'All', available: true },
            { filter: 'P1', label: 'P1 path', available: filterSets.P1.available },
            { filter: 'P2', label: 'P2 path', available: filterSets.P2.available },
          ] as const).map((option) => (
            <button
              key={option.filter}
              type="button"
              className="dg-seg-btn"
              data-filter={option.filter}
              aria-pressed={activeFilter === option.filter}
              disabled={!option.available}
              onClick={() => setActiveFilter(option.filter)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <span className="dg-toolbar-hint">
          P1 is the exposure path to the disrupted site. P2 is the verified upstream path and any passed candidate.
        </span>
      </div>

      {selectedNode && (
        <ui5-popover
          key={selectedNode.id}
          id="graph-node-popover"
          opener={`node-${selectedNode.id}`}
          open={true}
          headerText={selectedNode.label}
          placement="Bottom"
          preventFocusRestore
          onclose={() => {
            // UI5 also closes the popover when its opener scrolls out of view; that must not deselect the node.
            const opener = document.getElementById(`node-${selectedNode.id}`)?.getBoundingClientRect()
            const openerInView = !!opener && opener.bottom > 0 && opener.right > 0 && opener.top < window.innerHeight && opener.left < window.innerWidth
            if (openerInView && latestSelectedIdRef.current === selectedNode.id) onSelectNode(null)
          }}
          style={{ minWidth: '320px', maxWidth: '400px' }}
        >
          <div className="dg-popover-body">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
              <span className="mono" style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                {selectedNode.id}
              </span>
              <ui5-tag design={STATUS_TAG_DESIGN[selectedNode.status] ?? 'Neutral'}>
                {STATUS_TEXT[selectedNode.status] ?? selectedNode.status}
              </ui5-tag>
            </div>
            <dl className="dg-popover-dl">
              <div><dt>Organization</dt><dd>{selectedNode.org_name}</dd></div>
              <div><dt>Country</dt><dd>{selectedNode.country}</dd></div>
              <div><dt>Role</dt><dd>{selectedNode.role.replace(/_/g, ' ')}</dd></div>
              <div><dt>Status</dt><dd>{selectedNode.status}</dd></div>
            </dl>
            <div style={{ marginTop: 'var(--space-3)', display: 'flex', justifyContent: 'flex-end' }}>
              <ui5-button design="Transparent" onClick={() => onSelectNode(null)}>
                Close
              </ui5-button>
            </div>
          </div>
        </ui5-popover>
      )}

      <div className="dg-candidates" role="group" aria-label="Candidate supplier to explain">
        <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>Explain candidate:</span>
        {candidates.map((c) => {
          const isActive = c.supplierId === view.focus_supplier_id
          return (
            <button key={c.supplierId} className={`dg-candidate ${isActive ? 'is-active' : ''}`} aria-pressed={isActive} onClick={() => onFocusSupplier(c.supplierId)}>
              {c.supplierId} · {c.label}
            </button>
          )
        })}
      </div>

      {result && <section className={`dependency-verdict ${result.outcome}`} aria-live="polite" aria-label="Dependency check result">
        <strong>{view.focus_supplier_id} · {OUTCOME_TEXT[result.outcome] ?? result.outcome}</strong>
        <span>{result.reason_code.replace(/_/g, ' ').toLowerCase()} · searched {result.max_depth} hops upstream · coverage {result.coverage.complete ? 'complete' : 'incomplete'}</span>
        {blockedPath && <p>{focusLabel} is not independent: its path {blockedPath.path_id} reaches the disrupted site {blockedPath.node_ids.slice(1).map((id) => nodeById[id]?.label ?? id).join(' ← ')}. The red links show this path.</p>}
        {!blockedPath && result.outcome === 'passed' && <p>No upstream path from {focusLabel} reaches the disrupted site within {result.max_depth} hops. Blue links show its verified upstream paths.</p>}
      </section>}

      <div className="dg-legend" role="group" aria-label="Graph legend">
        {LEGEND_STATUSES.map((status) => (
          <span key={status}><i className="dg-swatch" style={{ '--dg-accent': STATUS_ACCENT_VAR[status] } as React.CSSProperties} aria-hidden="true" />{STATUS_TEXT[status]}</span>
        ))}
        <span><i className="dg-line" data-line="default" aria-hidden="true" />Supply link</span>
        <span><i className="dg-line" data-line="path" aria-hidden="true" />Evidence path to disruption</span>
        <span><i className="dg-line" data-line="focus" aria-hidden="true" />Upstream path of selected candidate</span>
        <span><i className="dg-line" data-line="candidate" aria-hidden="true" />Proposed supply (candidate)</span>
        <span>Link confidence: {confidences.join(', ')}</span>
      </div>

      <div className="dg-canvas" ref={canvasRef} style={{ height: layout.height + 2 }} /* +2 for the 1px border (border-box sizing) */ data-layout={layout.stacked ? 'stacked' : 'columns'}>
        <svg
          className="dg-svg"
          style={{ width: layout.width, height: layout.height }}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          role="img"
          aria-labelledby="supply-graph-title"
          aria-describedby="supply-graph-description"
        >
          <title id="supply-graph-title">Dependency evidence graph for {view.focus_supplier_id}</title>
          <desc id="supply-graph-description">Arrows show goods flowing from provider to consumer. The evidence paths and every link are also listed as text below the graphic.</desc>
          <defs>
            {['default', 'path', 'focus', 'candidate'].map((kind) => (
              <marker key={kind} id={`graph-arrow-${kind}`} className={`dg-arrow-${kind}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
                <path d="M 0 0 L 10 5 L 0 10 z" />
              </marker>
            ))}
          </defs>
          <g className="tier-swimlanes" aria-hidden="true">
            {layout.lanes.map((lane) => (
              <rect key={lane.tier.id} className="dg-lane-bg" x={lane.x} y={lane.y} width={lane.w} height={lane.h} rx={10} />
            ))}
          </g>
          {view.edges.map((edge) => {
            if (edge.candidate && !candidateDrawn(edge)) return null
            const incoming = view.edges.filter((other) => other.target === edge.target && (!other.candidate || candidateDrawn(other))).map((other) => other.id)
            const slot = { index: Math.max(0, incoming.indexOf(edge.id)), count: incoming.length || 1 }
            const source = layout.nodes[edge.source] as Box | undefined
            const target = layout.nodes[edge.target] as Box | undefined
            if (!source || !target) return null
            const geometry = edgeGeometry(source, target, layout.stacked, slot)
            const kind = edge.highlighted ? 'path' : edge.candidate ? 'candidate' : focusEdgeIds.has(edge.id) ? 'focus' : 'default'
            const pillText = edge.part_id || (edge.candidate ? 'PROPOSED' : 'SUPPLIES')
            const pillWidth = Math.max(56, Math.ceil(pillText.length * PILL_CHAR_W + 16))
            const sourceLabel = nodeById[edge.source]?.label ?? edge.source
            const targetLabel = nodeById[edge.target]?.label ?? edge.target
            return (
              <g
                key={edge.id}
                data-edge-id={edge.id}
                data-kind={kind}
                className={`dg-edge${edgeOffPath(edge.id) || (focusId !== null && !isLinkedEdge(edge)) ? ' is-dimmed' : ''}${isLinkedEdge(edge) ? ' is-linked' : ''}`}
              >
                <path d={geometry.d} markerEnd={`url(#graph-arrow-${kind})`} />
                <g className="dg-pill edge-callout-pill" transform={`translate(${geometry.px} ${geometry.py})`}>
                  <rect x={-pillWidth / 2} y={-10} width={pillWidth} height={20} rx={10} />
                  <text textAnchor="middle" y={4}>{pillText}</text>
                </g>
                <title>{`${edge.id}: ${sourceLabel} ${edge.candidate ? 'would supply' : 'supplies'} ${targetLabel}. Type ${edge.type.toLowerCase().replace(/_/g, ' ')}, part ${edge.part_id || 'not recorded'}, confidence ${edge.confidence ?? 'not recorded'}, source ${edge.source_ref ?? 'not recorded'}.${edge.candidate ? ' Proposed, not yet supplying.' : ''}`}</title>
              </g>
            )
          })}
        </svg>

        {layout.lanes.map((lane) => (
          <div key={lane.tier.id} className={`dg-lane-head${layout.stacked ? ' is-stacked' : ''}`} style={{ left: lane.x + 8, top: lane.y + (layout.stacked ? 10 : 12), width: lane.w - 16 }}>
            <span className="dg-lane-kicker">{lane.tier.tier}</span>
            <span className="dg-lane-title">{lane.tier.title}</span>
          </div>
        ))}

        {view.nodes.map((node) => {
          const box = layout.nodes[node.id] as Box | undefined
          if (!box) return null
          const selected = node.id === selectedNodeId
          const tier = SWIMLANE_TIERS[tierIndex(node.role)]
          const tagText = STATUS_TAG_LABEL[node.status] ?? node.role.replace(/_/g, ' ')
          return (
            <button
              key={node.id}
              type="button"
              id={`node-${node.id}`}
              data-node-id={node.id}
              data-status={node.status}
              className={`dg-node${selected ? ' is-selected' : ''}${nodeDimmed(node.id) ? ' is-dimmed' : ''}`}
              aria-label={`${node.label}, ${node.id}, ${STATUS_TEXT[node.status] ?? node.status}, ${tier.tier} ${tier.title}`}
              aria-expanded={selected}
              title={`${node.label}, ${node.org_name}, ${node.role.replace(/_/g, ' ')}`}
              style={{
                left: box.x,
                top: box.y,
                width: box.w,
                height: NODE_H,
                '--dg-accent': STATUS_ACCENT_VAR[node.status] ?? 'var(--color-border)',
                '--dg-text': STATUS_TEXT_VAR[node.status] ?? 'var(--color-text-muted)',
              } as React.CSSProperties}
              onClick={() => onSelectNode(node)}
              onMouseEnter={() => setHoverId(node.id)}
              onMouseLeave={() => setHoverId(null)}
              onFocus={() => setHoverId(node.id)}
              onBlur={() => setHoverId(null)}
            >
              <span className="dg-node-tag">{tagText}</span>
              <span className="dg-node-label">{node.label}</span>
              <span className="dg-node-id">{node.id}</span>
              <span className="dg-node-meta">{node.country} · {node.role.replace(/_/g, ' ')}</span>
            </button>
          )
        })}
      </div>
      <p className="dg-note">Select a facility to see its details and direct links. Arrows show provider-to-consumer flow. All organisations are synthetic.</p>
      <div className="table-scroll" role="region" aria-label="Scrollable facility records table" tabIndex={0}>
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
                  <small className="mono" style={{ display: 'block', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>{node.id}</small>
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
      <section className="graph-text-alternative" aria-labelledby="graph-text-heading">
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
        <details className="graph-text-expander">
          <summary>
            Text version: all supply links ({view.edges.length} links recorded)
          </summary>
          <p>
            Each entry is a link in its recorded direction: provider to consumer. Select one to focus its consumer in the graphic.
          </p>
          <ol>
            {view.edges.map((edge) => {
              const source = nodeById[edge.source]
              const target = nodeById[edge.target]
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
              )
            })}
          </ol>
        </details>
      </section>
    </section>
  )
})
