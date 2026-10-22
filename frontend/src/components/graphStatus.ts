/** Plain-language node status for GraphView statuses (text, not colour alone). */
export const STATUS_TEXT: Record<string, string> = {
  disrupted: 'disrupted (root cause)',
  blocked: 'candidate supplier, blocked',
  candidate_passed: 'candidate supplier, passed',
  affected_primary: 'primary supplier, affected',
  buyer: 'buyer plant',
  normal: 'no finding',
}
