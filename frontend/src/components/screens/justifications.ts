export interface PlanJustification {
  whyItHelps: string;
  whatCouldGoWrong: string;
  fullText: string;
  wordCount: number;
}

export const PLAN_JUSTIFICATIONS: Record<string, { whyItHelps: string; whatCouldGoWrong: string }> = {
  'PLN-0001': {
    whyItHelps: 'This alternate plan restores production flow rapidly by leveraging existing inventory in plant stock alongside dual-origin module allocations from Thailand and Vietnam. By avoiding peak disruption delays, it achieves the highest paper savings of ₹8,26,000 without requiring facility retooling.',
    whatCouldGoWrong: 'However, critical vulnerabilities threaten execution: upstream wafer dependencies share an undisclosed Tier-2 fabrication bottleneck in Kulim, while container transhipment through Singapore directly breaches Letter of Credit clause 43T, risking catastrophic shipment seizure.',
  },
  'PLN-0002': {
    whyItHelps: 'This verified recovery route bypasses single-source dependencies by sourcing exclusively from certified alternative suppliers with verified trade compliance documentation and direct maritime transit. It ensures reliable assembly delivery, mitigating penalties while preserving customer commitments with net avoided loss of ₹6,18,000.',
    whatCouldGoWrong: 'However, trade-offs exist: recovery costs increase by ₹1,58,000 compared to unverified proposals, and tight buffer margins leave minimal tolerance for customs inspection delays or regional carrier container shortages during transit.',
  },
};

export function getPlanJustification(planId: string): PlanJustification {
  const custom = PLAN_JUSTIFICATIONS[planId] ?? {
    whyItHelps: 'This alternate plan mitigates schedule disruption by reallocating supply commitments across candidate trade channels, protecting customer delivery schedules and recovering net avoided loss against baseline penalties. It minimizes downtime through targeted inventory shifts and proactive logistics routing.',
    whatCouldGoWrong: 'However, operational risks remain elevated: unexpected carrier demurrage charges may increase recovery expenditures, while international border crossing clearance bottlenecks or raw material supply fluctuations could compromise arrival commitments if contingency buffers fail under stress.',
  };
  const fullText = `${custom.whyItHelps} ${custom.whatCouldGoWrong}`;
  const wordCount = fullText.trim().split(/\s+/).filter(Boolean).length;
  return {
    whyItHelps: custom.whyItHelps,
    whatCouldGoWrong: custom.whatCouldGoWrong,
    fullText,
    wordCount,
  };
}
