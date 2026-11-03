import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const THEMES = ['sap_horizon', 'sap_horizon_dark'] as const
type Theme = (typeof THEMES)[number]

const SCREENS: { name: string; hash: string; ready: (page: Page) => Promise<void> }[] = [
  {
    name: 'Supply Network',
    hash: '#supply-network',
    ready: async (page) => { await expect(page.getByText('Supply Network', { exact: true }).first()).toBeVisible() },
  },
  {
    name: 'Command Center',
    hash: '#command',
    ready: async (page) => { await expect(page.getByRole('heading', { name: 'Command Center' })).toBeVisible() },
  },
  {
    name: 'Evaluation progress',
    hash: '#evaluation-progress',
    ready: async (page) => { await expect(page.getByRole('heading', { name: 'Evaluation progress' })).toBeVisible() },
  },
  {
    name: 'Evaluations',
    hash: '#evaluations',
    ready: async (page) => { await expect(page.getByRole('heading', { name: 'Evaluations' }).first()).toBeVisible() },
  },
  {
    name: 'Execution',
    hash: '#execution',
    ready: async (page) => { await expect(page.getByText('Execution', { exact: true }).first()).toBeVisible() },
  },
  {
    name: 'Supply Graph',
    hash: '#supply-graph',
    ready: async (page) => { await expect(page.getByText('Supply graph', { exact: false }).first()).toBeVisible() },
  },
  {
    name: 'Early Warnings',
    hash: '#early-warnings',
    ready: async (page) => { await expect(page.getByRole('heading', { name: 'Active warnings' })).toBeVisible() },
  },
  {
    name: 'Audit Trail',
    hash: '#audit-trail',
    ready: async (page) => { await expect(page.getByText('Audit trail', { exact: false }).first()).toBeVisible() },
  },
]

async function expectNoAccessibilityViolations(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()
  const summary = results.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    nodes: violation.nodes.map((node) => ({ target: node.target, summary: node.failureSummary })),
  }))
  const message = summary.length === 0
    ? `${label}: no violations`
    : `${label}: ${summary.map((v) => `${v.id} -> ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`).join(' ; ')}`
  expect(summary, message).toEqual([])
}

for (const theme of THEMES) {
  for (const screen of SCREENS) {
    test(`${screen.name} has no WCAG A/AA violations in ${theme}`, async ({ page }) => {
      await page.addInitScript((value: Theme) => {
        try { localStorage.setItem('aegis.theme', value) } catch { /* storage unavailable */ }
      }, theme)
      await page.goto(`/${screen.hash}`)
      await screen.ready(page)
      await page.waitForLoadState('networkidle')
      await expectNoAccessibilityViolations(page, `[${theme}] ${screen.name}`)
    })
  }
}
