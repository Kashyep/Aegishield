import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

async function expectNoAccessibilityViolations(page: Page) {
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

test('attempting approval on a blocked plan surfaces PLAN_BLOCKED refusal message in stub mode', async ({ page }) => {
  const p1 = page.locator('.plan-card').filter({ hasText: 'P1 Fastest-cheapest' })
  await expect(p1).toBeVisible()

  // Approve button is visually discouraged/disabled on blocked plan, but Attempt approval is enabled for Priya
  await expect(p1.getByRole('button', { name: 'Approve' })).toBeDisabled()
  const attemptBtn = p1.getByRole('button', { name: 'Attempt approval' })
  await expect(attemptBtn).toBeEnabled()
  await attemptBtn.click()

  const dialog = page.getByRole('dialog', { name: 'Review P1 Fastest-cheapest' })
  await expect(dialog).toBeVisible()

  // The modal has the deliberate attempt approval button enabled
  const submitBtn = dialog.getByRole('button', { name: 'Attempt approval (blocked)' })
  await expect(submitBtn).toBeEnabled()
  await submitBtn.click()

  // Submitting returns 422 PLAN_BLOCKED, rendered in .api-error
  const apiError = dialog.locator('.api-error')
  await expect(apiError).toBeVisible()
  await expect(apiError).toContainText('Cannot approve: this plan is blocked by its fixture checks.')

  await expectNoAccessibilityViolations(page)

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
})

test('attempt approval button is disabled when actor lacks approver role', async ({ page }) => {
  await page.getByLabel('Simulated identity').selectOption('USR-VIEW')
  const p1 = page.locator('.plan-card').filter({ hasText: 'P1 Fastest-cheapest' })
  await expect(p1.getByRole('button', { name: 'Attempt approval' })).toBeDisabled()
})
