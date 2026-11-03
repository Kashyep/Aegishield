/** Plain-language node status for GraphView statuses (text, not colour alone). */
export const STATUS_TEXT: Record<string, string> = {
  disrupted: 'disrupted (root cause)',
  blocked: 'candidate supplier, blocked',
  candidate_passed: 'candidate supplier, passed',
  affected_primary: 'primary supplier, affected',
  buyer: 'buyer plant',
  normal: 'no finding',
}

/** Short card tag per status. Normal facilities show their role instead. */
export const STATUS_TAG_LABEL: Record<string, string> = {
  disrupted: 'Root cause',
  blocked: 'Blocked',
  candidate_passed: 'Passed',
  affected_primary: 'Affected',
  buyer: 'Buyer',
}

/** Severity order inside a tier: most severe first. */
export const STATUS_RANK: Record<string, number> = {
  disrupted: 0,
  blocked: 1,
  affected_primary: 2,
  candidate_passed: 3,
  buyer: 4,
  normal: 5,
}

/** Accent colour per node status (the 4px card bar). Horizon semantic tokens only. */
export const STATUS_ACCENT_VAR: Record<string, string> = {
  disrupted: 'var(--color-error)',
  blocked: 'var(--color-error)',
  candidate_passed: 'var(--color-success)',
  affected_primary: 'var(--color-warning)',
  buyer: 'var(--color-info)',
  normal: 'var(--color-border)',
}

/** Text colour per node status, chosen to meet contrast on the card background. */
export const STATUS_TEXT_VAR: Record<string, string> = {
  disrupted: 'var(--color-error-text)',
  blocked: 'var(--color-error-text)',
  candidate_passed: 'var(--color-success-text)',
  affected_primary: 'var(--color-warning-text)',
  buyer: 'var(--color-info-text)',
  normal: 'var(--color-text-muted)',
}

/** Fiori tag design per node status (popover header). */
export const STATUS_TAG_DESIGN: Record<string, 'Negative' | 'Positive' | 'Critical' | 'Information' | 'Neutral'> = {
  disrupted: 'Negative',
  blocked: 'Negative',
  candidate_passed: 'Positive',
  affected_primary: 'Critical',
  buyer: 'Information',
  normal: 'Neutral',
}

/** Tier swimlanes, upstream (provider) to downstream (buyer). */
export interface SwimlaneTier {
  id: string
  tier: string
  title: string
}

export const SWIMLANE_TIERS: SwimlaneTier[] = [
  { id: 'tier-2', tier: 'TIER 2', title: 'Fabrication & Materials' },
  { id: 'tier-1-5', tier: 'TIER 1.5', title: 'Die Processing' },
  { id: 'tier-1', tier: 'TIER 1', title: 'Assembly & Packaging' },
  { id: 'tier-0', tier: 'OEM BUYER', title: 'Receiving Plant' },
]

/** Facility role to swimlane index. Unknown roles fall into the die-processing tier. */
const ROLE_TIER: Record<string, number> = {
  wafer_fab: 0,
  material_supplier: 0,
  die_processing: 1,
  module_assembly: 2,
  buyer_plant: 3,
}

export function tierIndex(role: string): number {
  return ROLE_TIER[role] ?? 1
}
