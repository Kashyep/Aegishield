import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { navTo } from '../tests/helpers/nav'

// Blocked-plan override against the live API. P1 carries a needs_review trade_compliance finding, which only a
// trade_compliance_officer may acknowledge, so the override is completed as USR-ARJUN. USR-PRIYA is checked first:
// her override stays disabled and says why.

const P1_NAME = 'P1 Fastest-cheapest'
const P1_REVIEW = 'Review P1 Fastest-cheapest'
const OVERRIDE_BUTTON = 'Approve anyway (override)'
const OVERRIDE_CHECKBOX = 'I understand the risks and approve this blocked plan as an override'
const LONG_JUSTIFICATION = 'Shipper accepts the transhipment risk under the bank waiver.'

const p1Card = (page: Page) => page.locator('.plan-card').filter({ hasText: P1_NAME })

// Switch identity the way the user does: the topbar role switcher. The simulated-identity select is kept in sync by the
// same actorId state, so it is asserted too.
async function switchIdentity(page: Page, actorId: 'USR-PRIYA' | 'USR-ARJUN') {
  await page.locator(`ui5-segmented-button-item[data-actor="${actorId}"]`).click()
  await expect(page.getByLabel('Simulated identity')).toHaveValue(actorId)
}

async function openCommandCenterWithEvaluation(page: Page) {
  await page.goto('/#command')
  await page.getByRole('button', { name: 'Reset demo' }).click()
  await page.getByRole('dialog', { name: 'Reset demo?' }).getByRole('button', { name: 'Reset demo' }).click()
  await expect(page.locator('#demo-toast').filter({ hasText: 'Demo reset' })).toBeVisible()
  await page.locator('header').filter({ hasText: 'SUPPLY CHAIN RESILIENCE' }).getByRole('button', { name: 'Run evaluation' }).click()
  await expect(page.getByText(/Evaluation EVAL-\d+ is completed\./)).toBeVisible({ timeout: 40_000 })
  await navTo(page, 'Command Center')
  await expect(page.getByRole('heading', { name: 'Command Center' })).toBeVisible()
}

test('blocked P1 can be approved only as a recorded override, and the override persists', async ({ page }) => {
  await openCommandCenterWithEvaluation(page)

  // As the supply planner, the override is refused client-side and the reason is shown.
  await switchIdentity(page, 'USR-PRIYA')
  await p1Card(page).getByRole('button', { name: 'Attempt approval' }).click()
  const priyaDialog = page.getByRole('dialog', { name: P1_REVIEW })
  await expect(priyaDialog).toBeVisible()
  await expect(priyaDialog.getByText('This plan is blocked.')).toBeVisible()
  await expect(priyaDialog.getByRole('button', { name: OVERRIDE_BUTTON })).toBeDisabled()
  await expect(priyaDialog.getByText('Acknowledge every review finding with a note of at least 5 characters.')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(priyaDialog).toBeHidden()

  // As the trade compliance officer: acknowledge the review finding, then build up the override step by step.
  await switchIdentity(page, 'USR-ARJUN')
  await p1Card(page).getByRole('button', { name: 'Review & override…' }).click()
  const dialog = page.getByRole('dialog', { name: P1_REVIEW })
  await expect(dialog).toBeVisible()
  // The override is in the footer, and the reason it is still disabled is pinned above the footer, in view without scrolling.
  const footer = dialog.locator('ui5-bar[slot="footer"]')
  const override = footer.getByRole('button', { name: OVERRIDE_BUTTON })
  await expect(override).toBeDisabled()
  const hint = dialog.locator('.override-sticky-hint')
  await expect(hint).toContainText('Acknowledge every review finding with a note of at least 5 characters.')
  await expect(hint).toBeInViewport()

  await dialog.getByLabel('I acknowledge this review finding').check()
  await dialog.getByLabel('Acknowledgement note').fill('Certificate of origin reviewed.')
  await expect(override).toBeDisabled()

  await dialog.getByLabel(/Justification/).fill('too short')
  await dialog.getByRole('checkbox', { name: OVERRIDE_CHECKBOX }).check()
  await expect(override).toBeDisabled()

  await dialog.getByLabel(/Justification/).fill(LONG_JUSTIFICATION)
  await expect(override).toBeEnabled()
  await expect(hint).toContainText('Ready:')
  await expect(hint).toBeInViewport()

  // The enabled override is the footer action; click that one.
  await footer.getByRole('button', { name: OVERRIDE_BUTTON }).click()
  await expect(page.locator('#demo-toast').filter({ hasText: 'Plan PLN-0001 approved with override by USR-ARJUN.' })).toBeVisible()
  await expect(dialog).toBeHidden()
  await expect(p1Card(page)).toContainText('approved')
  await expect(p1Card(page).locator('.override-tag')).toContainText('Override')

  // The override survives a reload: the backend overlay returns the approved status and the override flag.
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Command Center' })).toBeVisible()
  await expect(p1Card(page)).toContainText('approved')
  await expect(p1Card(page).locator('.override-tag')).toContainText('Override')

  // The audit trail records the override, and the chain still verifies.
  await navTo(page, 'Audit trail')
  await expect(page.locator('.audit-override').filter({ hasText: 'Override of blocked plan' }).first()).toBeVisible()
  await expect(page.locator('.audit-override').first()).toContainText('FND-LC-TRANSHIPMENT-RT-C-SIN')
  await page.getByRole('button', { name: 'Verify chain' }).click()
  await expect(page.locator('.audit-verified')).toContainText(/Chain valid/)
})
