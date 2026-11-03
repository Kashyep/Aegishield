import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/#command')
  await expect(page.getByRole('heading', { name: 'Command Center' })).toBeVisible()
  await expect(page.getByLabel('Simulated identity')).toHaveValue('USR-PRIYA')
})

test('Approve explains why it is disabled for a viewer', async ({ page }) => {
  await page.getByLabel('Simulated identity').selectOption('USR-VIEW')
  const reason = 'Only Supply Planner or Trade Compliance Officer can approve.'
  const p2 = page.locator('.plan-card').filter({ hasText: 'P2 AegisShield verified' })
  const approve = p2.getByRole('button', { name: 'Approve', exact: true })

  await expect(approve).toBeDisabled()
  await expect(approve).toHaveAttribute('title', reason)
  // UI5 appends its design name ("Positive Action") to the accessible
  // description of a Positive button, so the reason is matched as a prefix.
  await expect(approve).toHaveAccessibleDescription(new RegExp(`^${reason.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`))
})
