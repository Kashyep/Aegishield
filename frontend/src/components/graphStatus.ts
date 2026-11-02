/** Plain-language node status for GraphView statuses (text, not colour alone). */
export const STATUS_TEXT: Record<string, string> = {
  disrupted: 'disrupted (root cause)',
  blocked: 'candidate supplier, blocked',
  candidate_passed: 'candidate supplier, passed',
  affected_primary: 'primary supplier, affected',
  buyer: 'buyer plant',
  normal: 'no finding',
}

/** Fiori Horizon CSS semantic variable per node status (D2 4px left accent). */
export const STATUS_ACCENT_VAR: Record<string, string> = {
  disrupted: 'var(--sapNegativeColor, #e52929)',
  blocked: 'var(--sapNegativeColor, #e52929)',
  candidate_passed: 'var(--sapPositiveColor, #107e3e)',
  affected_primary: 'var(--sapCriticalColor, #e9730c)',
  buyer: 'var(--sapInformativeColor, #0a6ed1)',
  normal: 'var(--sapNeutralColor, var(--sapTile_BorderColor, #89919a))',
}

/** Fiori Horizon tag design per node status. */
export const STATUS_TAG_DESIGN: Record<string, 'Negative' | 'Positive' | 'Critical' | 'Information' | 'Neutral'> = {
  disrupted: 'Negative',
  blocked: 'Negative',
  candidate_passed: 'Positive',
  affected_primary: 'Critical',
  buyer: 'Information',
  normal: 'Neutral',
}

/** Swimlane column metadata for FB-16 tier swimlanes. */
export interface SwimlaneTier {
  col: number
  id: string
  tier: string
  title: string
  description: string
  x: number
  width: number
}

export const SWIMLANE_TIERS: SwimlaneTier[] = [
  { col: 0, id: 'tier-2', tier: 'TIER 2', title: 'Fabrication & Materials', description: 'Wafer fabs & raw material suppliers', x: 18, width: 235 },
  { col: 1, id: 'tier-1-5', tier: 'TIER 1.5', title: 'Die Processing', description: 'Silicon wafer slicing & die testing', x: 334, width: 235 },
  { col: 2, id: 'tier-1', tier: 'TIER 1', title: 'Assembly & Packaging', description: 'Contract module assembly (EMS)', x: 660, width: 235 },
  { col: 3, id: 'tier-0', tier: 'OEM BUYER', title: 'Receiving Plant', description: 'Zenith final integration Bangalore', x: 970, width: 235 },
]
