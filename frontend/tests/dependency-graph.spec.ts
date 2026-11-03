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
  // FB-14: Proposed candidate dotted lines must NOT be drawn on disrupted view
  await expect(page.locator('[data-edge-id="CAND-SUP-B"]')).toHaveCount(0)
  await expect(page.locator('[data-kind="candidate"]')).toHaveCount(0)
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
  // FB-14: Candidate dotted line is drawn in candidate/P2 view (SUP-C)
  expect(await edgeKind(page, 'CAND-SUP-C')).toBe('candidate')
  await expect(page.locator('[data-edge-id="CAND-SUP-C"]')).toBeVisible()
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
  await expect(dialog.getByRole('button', { name: 'Request LC amendment' })).toBeEnabled()
  await expect(dialog.getByRole('button', { name: 'Approve plan' })).toBeDisabled()
})

test('FB-14: proposed candidate dotted lines are isolated from disrupted view and only shown in candidate/P2 view', async ({ page }) => {
  await page.goto('/#supply-graph')
  // Disrupted view (SUP-B): candidate dotted lines must NOT be drawn
  await expect(page.locator('[data-kind="candidate"]')).toHaveCount(0)
  await expect(page.locator('[data-edge-id="CAND-SUP-B"]')).toHaveCount(0)
  await expect(page.locator('[data-edge-id="CAND-SUP-C"]')).toHaveCount(0)

  // Candidate / P2 view (SUP-C): candidate dotted line is drawn
  await page.getByRole('button', { name: /^SUP-C/ }).click()
  await expect(page.locator('[data-edge-id="CAND-SUP-C"]')).toBeVisible()
  expect(await edgeKind(page, 'CAND-SUP-C')).toBe('candidate')
  // CAND-SUP-B is not drawn on P2 view
  await expect(page.locator('[data-edge-id="CAND-SUP-B"]')).toHaveCount(0)
})

test('FB-13, FB-15, FB-16: supply graph styling, swimlanes, callout pills, popovers, and filter toolbar', async ({ page }) => {
  await page.goto('/#supply-graph')

  // FB-13: "Workspace" bold ui5-title
  const workspaceTitle = page.locator('ui5-title').filter({ hasText: 'Workspace' })
  await expect(workspaceTitle).toBeVisible()

  // FB-16: Filter toolbar (All / P1 / P2)
  const filterToolbar = page.getByRole('toolbar', { name: 'Supply chain filter toolbar' })
  await expect(filterToolbar).toBeVisible()
  const allBtn = filterToolbar.getByRole('button', { name: 'All' })
  const p1Btn = filterToolbar.getByRole('button', { name: /P1/ })
  const p2Btn = filterToolbar.getByRole('button', { name: /P2/ })
  await expect(allBtn).toBeVisible()
  await expect(p1Btn).toBeVisible()
  await expect(p2Btn).toBeVisible()

  // FB-16: Tier swimlanes
  await expect(page.locator('.tier-swimlanes')).toBeVisible()
  await expect(page.getByText('TIER 2', { exact: true })).toBeVisible()
  await expect(page.getByText('TIER 1.5', { exact: true })).toBeVisible()
  await expect(page.getByText('TIER 1', { exact: true })).toBeVisible()
  await expect(page.getByText('OEM BUYER', { exact: true })).toBeVisible()

  // FB-16: Edge callout pills
  await expect(page.locator('.edge-callout-pill').first()).toBeVisible()

  // FB-16: Clicking a node opens a ui5-popover
  const fabNode = page.locator('[data-node-id="FAC-FABZ"]')
  await expect(fabNode).toBeVisible()
  await fabNode.click()
  const popover = page.locator('ui5-popover#graph-node-popover')
  await expect(popover).toBeVisible()
  await expect(popover).toContainText('FAC-FABZ')
  await expect(popover).toContainText('Zenith Kulim wafer fab')

  // FB-15: Facility records directly below the graph, then alternative supply links
  const facilityRecordsTable = page.getByRole('table', { name: 'Facility records in this graph fixture' })
  await expect(facilityRecordsTable).toBeVisible()
  const expander = page.locator('details.graph-text-expander')
  await expect(expander).toBeVisible()
  await expect(expander).toContainText('Text version: all supply links')

  // FB-16: Test P2 filter activates P2 candidate line
  await p2Btn.click()
  await expect(page.locator('[data-edge-id="CAND-SUP-C"]')).toBeVisible()

  // Accessibility check on updated graph view
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
  expect(results.violations.map((v) => v.id)).toEqual([])
})
