import { LayoutDashboard, ClipboardCheck, PlayCircle, Network, ScrollText, Radar, Globe, type LucideIcon } from 'lucide-react'

export type Screen = 'supply-network' | 'command' | 'evaluation-progress' | 'evaluations' | 'execution' | 'supply-graph' | 'audit-trail' | 'early-warnings'

export const navItems: { id: Exclude<Screen, 'evaluation-progress'>; label: string; icon: LucideIcon }[] = [
  { id: 'supply-network', label: 'Supply Network', icon: Globe },
  { id: 'command', label: 'Command Center', icon: LayoutDashboard },
  { id: 'early-warnings', label: 'Early warnings', icon: Radar },
  { id: 'evaluations', label: 'Evaluations', icon: ClipboardCheck },
  { id: 'execution', label: 'Execution', icon: PlayCircle },
  { id: 'supply-graph', label: 'Supply graph', icon: Network },
  { id: 'audit-trail', label: 'Audit trail', icon: ScrollText },
]

const labels: Record<Screen, string> = {
  'supply-network': 'Supply Network',
  command: 'Command Center',
  'early-warnings': 'Early warnings',
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
  return candidate in labels ? candidate : 'supply-network'
}

export function writeScreenToHash(screen: Screen): void {
  window.history.pushState(null, '', `#${screen}`)
}
