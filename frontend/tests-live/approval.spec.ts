import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { navTo } from '../tests/helpers/nav'
import liveConfig from '../playwright.live.config'

// Same API origin the official live config starts and the frontend calls (its webServer health URL is `${API}/api/v1/health`).
const API = new URL((liveConfig.webServer as Array<{ url?: string }>)[0].url ?? '').origin

const P2_NAME = 'P2 AegisShield verified'
const P2_REVIEW = 'Review P2 AegisShield verified'

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

const p2Card = (page: Page) => page.locator('.plan-card').filter({ hasText: P2_NAME })

test('approval succeeds, shows a toast, and survives a reload', async ({ page }) => {
  await openCommandCenterWithEvaluation(page)
  await expect(p2Card(page).getByRole('button', { name: 'Approve', exact: true })).toBeEnabled()

  await p2Card(page).getByRole('button', { name: 'Approve', exact: true }).click()
  await page.getByRole('dialog', { name: P2_REVIEW }).getByRole('button', { name: 'Approve plan' }).click()

  await expect(page.locator('#demo-toast').filter({ hasText: 'Plan PLN-0002 approved by USR-PRIYA.' })).toBeVisible()
  await expect(page.getByRole('dialog', { name: P2_REVIEW })).toBeHidden()

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Command Center' })).toBeVisible()
  await expect(p2Card(page).getByRole('button', { name: /Start .*execution/i })).toBeVisible()
  await expect(p2Card(page).getByRole('button', { name: 'Approve', exact: true })).toHaveCount(0)
})

test('a double-click on the confirm button sends exactly one decision POST', async ({ page }) => {
  await openCommandCenterWithEvaluation(page)

  let decisionPosts = 0
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().includes('/api/v1/plans/PLN-0002/decisions')) decisionPosts += 1
  })

  await p2Card(page).getByRole('button', { name: 'Approve', exact: true }).click()
  const confirm = page.getByRole('dialog', { name: P2_REVIEW }).getByRole('button', { name: 'Approve plan' })
  await confirm.dblclick()

  await expect(page.locator('#demo-toast').filter({ hasText: 'Plan PLN-0002 approved by USR-PRIYA.' })).toBeVisible()
  expect(decisionPosts).toBe(1)
})

test('re-approving a plan already decided on the server shows DECISION_EXISTS, without a crash', async ({ page }) => {
  await openCommandCenterWithEvaluation(page)
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))

  // Open the review while the UI still believes PLN-0002 is pending, then decide it elsewhere.
  await p2Card(page).getByRole('button', { name: 'Approve', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: P2_REVIEW })
  const plan = await page.request.get(`${API}/api/v1/plans/PLN-0002`)
  const { version, plan_hash: planHash } = await plan.json()
  const other = await page.request.post(`${API}/api/v1/plans/PLN-0002/decisions`, {
    headers: { 'X-Actor-Id': 'USR-PRIYA', 'Idempotency-Key': `other-tab-${Date.now()}` },
    data: { action: 'approve', plan_version: version, plan_hash: planHash, justification: null, acknowledgements: [] },
  })
  expect(other.status()).toBe(201)

  await dialog.getByRole('button', { name: 'Approve plan' }).click()
  const apiError = dialog.locator('.api-error')
  await expect(apiError).toContainText('A decision already exists for this plan version.')
  await expect(dialog).toBeVisible()
  expect(pageErrors).toEqual([])
})

test('a 500 from the decisions API shows an error in the modal and does not mark the plan approved', async ({ page }) => {
  await openCommandCenterWithEvaluation(page)
  await page.route('**/api/v1/plans/PLN-0002/decisions', (route) => route.fulfill({
    status: 500,
    contentType: 'application/problem+json',
    body: JSON.stringify({ type: 'about:blank', title: 'Internal Server Error', status: 500, code: 'INTERNAL_ERROR', detail: 'Injected failure for approval test.', instance: '/api/v1/plans/PLN-0002/decisions' }),
  }))

  await p2Card(page).getByRole('button', { name: 'Approve', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: P2_REVIEW })
  await dialog.getByRole('button', { name: 'Approve plan' }).click()

  await expect(dialog.locator('.api-error')).toContainText('Injected failure for approval test.')
  await expect(page.locator('#demo-toast').filter({ hasText: 'approved by' })).toHaveCount(0)
  await expect(p2Card(page).getByRole('button', { name: 'Approve', exact: true })).toBeEnabled()
  await expect(p2Card(page).getByRole('button', { name: /Start .*execution/i })).toHaveCount(0)
})
