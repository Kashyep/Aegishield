export type Screen = 'command' | 'evaluation-progress' | 'evaluations' | 'execution' | 'supply-graph' | 'audit-trail'

export const navItems: { id: Exclude<Screen, 'evaluation-progress'>; label: string; icon: string }[] = [
  { id: 'command', label: 'Command Center', icon: '▦' },
  { id: 'evaluations', label: 'Evaluations', icon: '◉' },
  { id: 'execution', label: 'Execution', icon: '▶' },
  { id: 'supply-graph', label: 'Supply graph', icon: '◇' },
  { id: 'audit-trail', label: 'Audit trail', icon: '▤' },
]

const labels: Record<Screen, string> = {
  command: 'Command Center',
  'evaluation-progress': 'Evaluation progress',
  evaluations: 'Evaluations',
  execution: 'Execution',
  'supply-graph': 'Supply graph',
  'audit-trail': 'Audit trail',
}

export function screenLabel(screen: Screen): string {
  return labels[screen]
}

export function readScreenFromHash(): Screen {
  const candidate = window.location.hash.slice(1) as Screen
  return candidate in labels ? candidate : 'command'
}

export function writeScreenToHash(screen: Screen): void {
  window.history.pushState(null, '', `#${screen}`)
}
