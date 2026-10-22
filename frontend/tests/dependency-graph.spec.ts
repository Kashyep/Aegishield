import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

const edgeKind = (page: import('@playwright/test').Page, id: string) => page.locator(`[data-edge-id="${id}"]`).getAttribute('data-kind')
const nodeStatus = (page: import('@playwright/test').Page, id: string) => page.locator(`[data-node-id="${id}"]`).getAttribute('data-status')

test('DA-05: highlights exactly the Chonburi <- Kedah <- Zenith evidence path for SUP-B', async ({ page }) => {
  await page.goto('/#supply-graph')
  await expect(page.getByRole('img', { name: 'Dependency evidence graph for SUP-B' })).toBeVisible()
  expect(await edgeKind(page, 'E-004')).toBe('path')
  expect(await edgeKind(page, 'E-005')).toBe('path')
  for (const id of ['E-001', 'E-002', 'E-003', 'E-006', 'E-007', 'E-008', 'E-009']) expect(await edgeKind(page, id)).not.toBe('path')
  expect(await edgeKind(page, 'CAND-SUP-B')).toBe('candidate')
  expect(await nodeStatus(page, 'FAC-FABZ')).toBe('disrupted')
  expect(await nodeStatus(page, 'FAC-B-CHB')).toBe('blocked')
  expect(await nodeStatus(page, 'FAC-C-BDG')).toBe('candidate_passed')
  const verdict = page.getByRole('region', { name: 'Dependency check result' })
  await expect(verdict).toContainText('SUP-B · Blocked')
  await expect(verdict).toContainText('is not independent')
  await expect(page.getByText('PATH-SUP-B-1 · Shared dependency on the disrupted site')).toBeVisible()
  await expect(page.getByText(/FAC-B-CHB\) <-SUPPLIES\[IGBT semiconductor die; E-004/)).toBeVisible()

  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
  expect(results.violations.map((v) => v.id)).toEqual([])
})

test('switching to SUP-C shows a passed candidate with no disruption path', async ({ page }) => {
  await page.goto('/#supply-graph')
  await page.getByRole('button', { name: /^SUP-C/ }).click()
  await expect(page.getByRole('img', { name: 'Dependency evidence graph for SUP-C' })).toBeVisible()
  await expect(page.getByRole('button', { name: /^SUP-C/ })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('[data-kind="path"]')).toHaveCount(0)
  expect(await edgeKind(page, 'E-007')).toBe('focus')
  expect(await edgeKind(page, 'E-008')).toBe('focus')
  await expect(page.getByRole('region', { name: 'Dependency check result' })).toContainText('SUP-C · Passed')
})

test('LLM badge reflects the evaluation mode and blocked P1 offers an LC amendment only to compliance', async ({ page }) => {
  await page.goto('/#command')
  await expect(page.getByLabel('LLM mode')).toHaveText('LLM: off (templates)')
  const p1 = page.locator('.plan-card').filter({ hasText: 'P1 Fastest-cheapest' })
  const amend = p1.getByRole('button', { name: 'Request LC amendment' })
  await expect(amend).toBeDisabled()
  await page.getByLabel('Simulated identity').selectOption('USR-ARJUN')
  await expect(amend).toBeEnabled()
  await amend.click()
  const dialog = page.getByRole('dialog', { name: 'Review P1 Fastest-cheapest' })
  const changes = dialog.getByRole('table', { name: 'Requested changes to LC-SYN-0117' })
  await expect(changes).toContainText('43TNOT ALLOWEDALLOWED')
  await expect(changes).toContainText('47AUCP 600 SUB-ARTICLE 20(C) IS EXCLUDED.(deleted)')
  await expect(dialog.getByRole('button', { name: 'Request LC amendment' })).toBeDisabled()
  await expect(dialog.getByRole('button', { name: 'Approve plan' })).toBeDisabled()
})
