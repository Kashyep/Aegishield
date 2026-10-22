import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

async function expectNoAccessibilityViolations(page: import('@playwright/test').Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()
  const summary = results.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    nodes: violation.nodes.map((node) => ({ target: node.target, summary: node.failureSummary })),
  }))
  expect(summary).toEqual([])
}

test.beforeEach(async ({ page }) => {
  await page.goto('/#command')
  await expect(page.getByRole('heading', { name: 'Command Center' })).toBeVisible()
  await expect(page.getByLabel('Simulated identity')).toHaveValue('USR-PRIYA')
})

test('keeps P1 blocked and presents a contract-backed P2 approval modal', async ({ page }) => {
  const p1 = page.locator('.plan-card').filter({ hasText: 'P1 Fastest-cheapest' })
  const p2 = page.locator('.plan-card').filter({ hasText: 'P2 AegisShield verified' })
  const p1Approval = p1.getByRole('button', { name: 'Approve' })
  const p2Approval = p2.getByRole('button', { name: 'Approve' })

  await expect(p1Approval).toBeDisabled()
  await expect(p1.getByText('Cannot be approved: 2 blocking findings. P1 remains blocked.')).toBeVisible()
  await expect(p2.getByText('₹6,18,000')).toBeVisible()
  await page.getByLabel('Simulated identity').selectOption('USR-VIEW')
  await expect(p2Approval).toBeDisabled()
  await page.getByLabel('Simulated identity').selectOption('USR-PRIYA')
  await expect(p2Approval).toBeEnabled()
  await p2Approval.click()

  const dialog = page.getByRole('dialog', { name: 'Review P2 AegisShield verified' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('sha256:3324f97f2eb3e8bc5c9f759e50d99488656e70a8ec194faea6848df207b0adf0')).toBeVisible()
  await expect(dialog.getByLabel('Justification (optional for approval)')).toBeVisible()
  await expect(dialog.getByText('Fixture mode contains no decision response.')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Approve plan' })).toBeDisabled()

  await expectNoAccessibilityViolations(page)

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(p2Approval).toBeFocused()
})

test('shows linked LC excerpts and route-specific rule results without inventing excluded metadata', async ({ page }) => {
  const p1 = page.locator('.plan-card').filter({ hasText: 'P1 Fastest-cheapest' })
  await p1.getByRole('button', { name: 'Review evidence' }).click()
  await page.getByRole('button', { name: /Route transships while the credit prohibits/ }).click()

  const drawer = page.getByRole('dialog', { name: 'Finding details' })
  await expect(drawer.getByText(':43T:NOT ALLOWED')).toHaveCount(2)
  await expect(drawer.getByText(':47A:UCP 600 SUB-ARTICLE 20(C) IS EXCLUDED.')).toHaveCount(2)
  await expect(drawer.getByRole('table', { name: 'Rules included in the evaluation response' })).toBeVisible()
  await expect(drawer.getByText('TR-0003')).toBeVisible()
  await expect(drawer.getByText('Superseded')).toBeVisible()
  await expect(drawer.getByText(/Excluded-rule dates and authority are not included/)).toBeVisible()
  await expectNoAccessibilityViolations(page)
})

test('completes Command Center to evaluation findings, evidence, and P2 approval', async ({ page }) => {
  const apiRequests: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/api/v1/')) apiRequests.push(request.url())
  })
  const fixtureResponse = await page.request.get('/stubs/evaluation_EVAL-0001.json')
  expect(fixtureResponse.ok()).toBeTruthy()
  const fixture = await fixtureResponse.json() as {
    evaluation_id: string
    status: string
    comparison: {
      baseline_loss_inr: number
      recommended_plan_id: string
      plans: { plan_id: string; label: string; net_avoided_loss_inr: number; check_outcome_counts: { blocked: number } }[]
    }
    plans: { plan_id: string; plan_hash: string; status: string }[]
    findings: { finding_id: string; title: string; evidence_ids: string[] }[]
    evidence: { evidence_id: string; excerpt: string | null }[]
  }

  await expect(page.getByText(`${fixture.evaluation_id} · ${fixture.status}`)).toBeVisible()
  await expect(page.getByText(`₹${fixture.comparison.baseline_loss_inr.toLocaleString('en-IN')}`)).toBeVisible()
  const blockedSummary = fixture.comparison.plans.find((plan) => plan.plan_id === 'PLN-0001')
  const approvedCandidate = fixture.comparison.plans.find((plan) => plan.plan_id === 'PLN-0002')
  const planRecord = fixture.plans.find((plan) => plan.plan_id === 'PLN-0002')
  expect(blockedSummary).toBeDefined()
  expect(approvedCandidate).toBeDefined()
  expect(planRecord?.status).toBe('pending_approval')
  await expect(page.locator('.plan-card').filter({ hasText: blockedSummary?.label ?? '' }).getByText(
    `Cannot be approved: ${blockedSummary?.check_outcome_counts.blocked} blocking findings. P1 remains blocked.`,
  )).toBeVisible()
  await expect(page.locator('.plan-card').filter({ hasText: approvedCandidate?.label ?? '' }).getByText(
    `₹${approvedCandidate?.net_avoided_loss_inr.toLocaleString('en-IN') ?? ''}`,
  )).toBeVisible()

  await page.getByRole('button', { name: /View evaluation details/ }).click()
  await expect(page.getByRole('heading', { name: `${fixture.evaluation_id} · ${fixture.status}` })).toBeVisible()
  const targetFinding = fixture.findings.find((finding) => finding.evidence_ids.length > 0)
  expect(targetFinding).toBeDefined()
  await expect(page.getByRole('heading', { name: 'Findings' })).toBeVisible()
  await expect(page.getByText(`${fixture.findings.length} findings from the evaluation fixture.`)).toBeVisible()
  const findingButton = page.getByRole('button', { name: new RegExp(targetFinding?.title ?? 'no-finding') })
  await findingButton.click()
  const evidenceDialog = page.getByRole('dialog', { name: 'Finding details' })
  await expect(evidenceDialog.getByRole('heading', { name: targetFinding?.title })).toBeVisible()
  const citedEvidence = fixture.evidence.find((evidence) => evidence.evidence_id === targetFinding?.evidence_ids[0])
  expect(citedEvidence).toBeDefined()
  if (citedEvidence?.excerpt) {
    await expect(evidenceDialog.getByText(citedEvidence.excerpt, { exact: true })).toBeVisible()
  }
  await evidenceDialog.getByRole('button', { name: 'Close finding details' }).click()

  await page.getByRole('button', { name: /Command Center/ }).click()
  const p2Card = page.locator('.plan-card').filter({ hasText: approvedCandidate?.label ?? '' })
  await p2Card.getByRole('button', { name: 'Approve' }).click()
  const approvalDialog = page.getByRole('dialog', { name: `Review ${planRecord?.label}` })
  await expect(approvalDialog.getByText(planRecord?.plan_hash ?? '', { exact: true })).toBeVisible()
  await expect(approvalDialog.getByText('pending approval')).toBeVisible()
  await expect(approvalDialog.getByText('Fixture mode contains no decision response.')).toBeVisible()
  await expect(approvalDialog.getByRole('button', { name: 'Approve plan' })).toBeDisabled()
  expect(apiRequests).toEqual([])
})

test('provides a keyboard-operable text alternative for the supply graph', async ({ page }) => {
  await page.getByRole('button', { name: /Supply graph/ }).click()
  await expect(page.getByRole('heading', { name: 'Text alternative: supply links' })).toBeVisible()
  await expect(page.getByRole('table', { name: 'Facility records in this graph fixture' })).toBeVisible()
  const link = page.getByRole('button', { name: /supplies/ }).first()
  await link.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('region', { name: 'Selected facility details' })).toBeVisible()

  await expectNoAccessibilityViolations(page)
})

test('does not present evaluation steps as audit events or claim fixture verification', async ({ page }) => {
  const apiRequests: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/api/v1/')) apiRequests.push(request.url())
  })
  await page.getByRole('button', { name: /Execution/ }).click()
  await expect(page.getByText(/No execution record is included in the fixtures/)).toBeVisible()
  await expect(page.getByText('The API reports this simulated execution as completed.')).toHaveCount(0)

  await page.getByRole('button', { name: /Audit trail/ }).click()
  await expect(page.getByText(/Fixture mode contains no audit-event records/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Verify chain' })).toBeDisabled()
  await expect(page.getByText('1. disruption sensing')).toHaveCount(0)
  expect(apiRequests).toEqual([])
})
