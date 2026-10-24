import { expect, test } from '@playwright/test'

test('reset, evaluate, graph, LC amendment and P2 approval against the live API', async ({ page }) => {
  await page.goto('/#command')
  await page.getByRole('button', { name: 'Reset demo' }).click()
  await page.getByRole('dialog', { name: 'Reset demo?' }).getByRole('button', { name: 'Reset demo' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Demo reset' })).toBeVisible()

  await page.getByRole('button', { name: 'Run evaluation' }).click()
  await expect(page.getByText('Evaluation EVAL-0001 is completed.')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByLabel('LLM mode')).toHaveText('LLM: recorded')

  await page.getByRole('button', { name: /Supply graph/ }).click()
  await expect(page.getByRole('img', { name: 'Dependency evidence graph for SUP-B' })).toBeVisible()
  await expect(page.locator('[data-kind="path"]')).toHaveCount(2)
  await page.getByRole('button', { name: /^SUP-C/ }).click()
  await expect(page.getByRole('region', { name: 'Dependency check result' })).toContainText('SUP-C · Passed')

  await page.getByRole('button', { name: /Command Center/ }).click()
  await page.getByLabel('Simulated identity').selectOption('USR-ARJUN')
  await page.locator('.plan-card').filter({ hasText: 'P1 Fastest-cheapest' }).getByRole('button', { name: 'Request LC amendment' }).click()
  const p1 = page.getByRole('dialog', { name: 'Review P1 Fastest-cheapest' })
  await p1.getByLabel(/Justification/).fill('Direct sailing unavailable; ask bank to allow transhipment.')
  await p1.getByRole('button', { name: 'Request LC amendment' }).click()
  await expect(p1.getByText(/Amendment request AMD-0001 recorded .* stays blocked/)).toBeVisible()
  await page.keyboard.press('Escape')

  await page.getByLabel('Simulated identity').selectOption('USR-PRIYA')
  await page.locator('.plan-card').filter({ hasText: 'P2 AegisShield verified' }).getByRole('button', { name: 'Approve' }).click()
  const p2 = page.getByRole('dialog', { name: 'Review P2 AegisShield verified' })
  await p2.getByRole('button', { name: 'Approve plan' }).click()
  await expect(p2).toBeHidden()
  await expect(page.locator('.plan-card').filter({ hasText: 'P2 AegisShield verified' })).toContainText('approved')

  await page.getByRole('button', { name: /Audit trail/ }).click()
  await page.getByRole('button', { name: 'Verify chain' }).click()
  await expect(page.getByText(/Chain valid/)).toBeVisible()
})
