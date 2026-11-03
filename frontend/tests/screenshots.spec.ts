import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

// Captures Fiori Horizon light/dark screenshots. Skipped unless SCREENSHOTS=1.
const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../docs/screenshots/fiori-horizon')

const THEMES = ['sap_horizon', 'sap_horizon_dark'] as const
type Theme = (typeof THEMES)[number]

const SCREENS: { slug: string; hash: string; ready: (page: Page) => Promise<void> }[] = [
  {
    slug: 'supply-network',
    hash: '#supply-network',
    ready: async (page) => { await expect(page.getByText('Supply Network', { exact: true }).first()).toBeVisible() },
  },
  {
    slug: 'command-center',
    hash: '#command',
    ready: async (page) => { await expect(page.getByRole('heading', { name: 'Command Center' })).toBeVisible() },
  },
  {
    slug: 'evaluation-progress',
    hash: '#evaluation-progress',
    ready: async (page) => { await expect(page.getByRole('heading', { name: 'Evaluation progress' })).toBeVisible() },
  },
  {
    slug: 'evaluations',
    hash: '#evaluations',
    ready: async (page) => { await expect(page.getByRole('heading', { name: 'Evaluations' }).first()).toBeVisible() },
  },
  {
    slug: 'execution',
    hash: '#execution',
    ready: async (page) => { await expect(page.getByText('Execution', { exact: true }).first()).toBeVisible() },
  },
  {
    slug: 'supply-graph',
    hash: '#supply-graph',
    ready: async (page) => { await expect(page.getByText('Supply graph', { exact: false }).first()).toBeVisible() },
  },
  {
    slug: 'early-warnings',
    hash: '#early-warnings',
    ready: async (page) => { await expect(page.getByRole('heading', { name: 'Active warnings' })).toBeVisible() },
  },
  {
    slug: 'audit-trail',
    hash: '#audit-trail',
    ready: async (page) => { await expect(page.getByText('Audit trail', { exact: false }).first()).toBeVisible() },
  },
]

test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })

test.describe('fiori-horizon screenshots', () => {
  test.skip(process.env.SCREENSHOTS !== '1', 'Set SCREENSHOTS=1 to capture screenshots')

  test.beforeAll(() => {
    mkdirSync(OUT_DIR, { recursive: true })
  })

  for (const theme of THEMES) {
    for (const screen of SCREENS) {
      test(`${screen.slug} (${theme})`, async ({ page }) => {
        await page.addInitScript((value: Theme) => {
          try { localStorage.setItem('aegis.theme', value) } catch { /* storage unavailable */ }
        }, theme)
        await page.goto(`/${screen.hash}`)
        await screen.ready(page)
        await page.waitForLoadState('networkidle')
        await page.screenshot({ path: resolve(OUT_DIR, `${screen.slug}-${theme}.png`), fullPage: true })
      })
    }
  }
})
