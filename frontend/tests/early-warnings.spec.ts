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

test('open Early warnings -> sees 97/100, WARNING, heuristic index, not a probability, switch to Now -> 100/100', async ({ page }) => {
  await page.goto('/#command')

  // Navigate to Early warnings from sidebar nav
  await page.getByRole('button', { name: 'Early warnings' }).click()

  // Heading is visible
  await expect(page.getByRole('heading', { name: 'Early warnings' })).toBeVisible()

  // Pre-notice expectations: 97/100, WARNING, and case-insensitive heuristic index disclaimer
  await expect(page.getByText('97/100', { exact: true })).toBeVisible()
  await expect(page.getByText('WARNING', { exact: true })).toBeVisible()
  await expect(page.getByText(/heuristic index, not a probability/i)).toBeVisible()

  // Accessibility check on pre-notice view
  await expectNoAccessibilityViolations(page)

  // Switch to Now (scenario clock)
  await page.getByRole('button', { name: 'Now (scenario clock)' }).click()

  // Now expectations: 100/100
  await expect(page.getByText('100/100', { exact: true })).toBeVisible()

  // Accessibility check on scenario clock view
  await expectNoAccessibilityViolations(page)
})

test('DA-17: approval modal lists active warnings for P1 via SUP-B, and none for P2', async ({ page }) => {
  await page.goto('/#command')

  // Switch to USR-ARJUN (trade compliance officer) who can open P1's LC amendment / review modal
  await page.getByLabel('Simulated identity').selectOption('USR-ARJUN')

  const p1 = page.locator('.plan-card').filter({ hasText: 'P1 Fastest-cheapest' })
  await p1.getByRole('button', { name: 'Request LC amendment' }).click()

  const p1Dialog = page.getByRole('dialog', { name: 'Review P1 Fastest-cheapest' })
  await expect(p1Dialog).toBeVisible()

  // P1 uses SUP-B: must show the Kulim fab warning via SUP-B
  await expect(p1Dialog.getByText(/Active early warnings/i)).toBeVisible()
  await expect(p1Dialog.getByText('Zenith Kulim wafer fab', { exact: true })).toBeVisible()
  await expect(p1Dialog.getByText(/EWS-FAC-FABZ/)).toBeVisible()

  // Accessibility check on approval modal with active early warnings
  await expectNoAccessibilityViolations(page)

  // Close P1 dialog
  await p1Dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(p1Dialog).toBeHidden()

  // Switch to USR-PRIYA and open P2 approval modal
  await page.getByLabel('Simulated identity').selectOption('USR-PRIYA')
  const p2 = page.locator('.plan-card').filter({ hasText: 'P2 AegisShield verified' })
  await p2.getByRole('button', { name: 'Approve' }).click()

  const p2Dialog = page.getByRole('dialog', { name: 'Review P2 AegisShield verified' })
  await expect(p2Dialog).toBeVisible()

  // P2 uses SUP-C only: must show NO early warnings
  await expect(p2Dialog.getByText(/Active early warnings/i)).toBeHidden()
  await expect(p2Dialog.getByText(/Zenith Kulim wafer fab/i)).toBeHidden()

  // Close P2 dialog
  await p2Dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(p2Dialog).toBeHidden()
})
