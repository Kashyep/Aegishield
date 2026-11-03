import { expect, test } from '@playwright/test'
import { navTo } from '../tests/helpers/nav'

// Runs against a production `vite build` (live mode) served by the backend at /, as on BTP.
test('production build talks to the API (not stubs) and can approve P2', async ({ page }) => {
  const stubRequests: string[] = []
  const apiRequests: string[] = []
  page.on('request', (req) => {
    const path = new URL(req.url()).pathname
    if (path.startsWith('/stubs/')) stubRequests.push(path)
    if (path.startsWith('/api/v1/')) apiRequests.push(path)
  })

  await page.goto('/#command')
  // The badge comes from GET /api/v1/health, so it only says "recorded" in live mode.
  await expect(page.getByLabel('LLM mode')).toHaveText('LLM: recorded')

  await page.locator('header').filter({ hasText: 'SUPPLY CHAIN RESILIENCE' }).getByRole('button', { name: 'Run evaluation' }).click()
  await expect(page.getByText(/Evaluation EVAL-\d+ is completed\./)).toBeVisible({ timeout: 60_000 })
  await navTo(page, 'Command Center')

  await page.locator('.plan-card').filter({ hasText: 'P2 AegisShield verified' }).getByRole('button', { name: 'Approve' }).click()
  const p2 = page.getByRole('dialog', { name: 'Review P2 AegisShield verified' })
  await expect(p2.getByText(/Fixture mode contains no decision response/)).toHaveCount(0)
  await p2.getByRole('button', { name: 'Approve plan' }).click()
  await expect(p2).toBeHidden()
  await expect(page.locator('.plan-card').filter({ hasText: 'P2 AegisShield verified' })).toContainText('approved')

  await page.reload()
  await navTo(page, 'Command Center')
  await expect(page.locator('.plan-card').filter({ hasText: 'P2 AegisShield verified' })).toContainText('approved')

  expect(stubRequests, 'a live production build must not load /stubs').toEqual([])
  expect(apiRequests.length).toBeGreaterThan(0)
})
