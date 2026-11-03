import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

type Fixture = {
  nodes: { id: string; status: string; role: string; label: string }[]
  edges: { id: string; source: string; target: string; candidate: boolean }[]
  paths: { kind: string; node_ids: string[]; edge_ids: string[] }[]
  text_alternative: string[]
}

const fixturePath = fileURLToPath(new URL('../public/stubs/graph_view_SUP-B.json', import.meta.url))
const fixture: Fixture = JSON.parse(readFileSync(fixturePath, 'utf8'))
const EXPOSURE = 'shared_disrupted_dependency'
const passedIds = new Set(fixture.nodes.filter((node) => node.status === 'candidate_passed').map((node) => node.id))
const exposurePaths = fixture.paths.filter((path) => path.kind === EXPOSURE)
const verifiedPaths = fixture.paths.filter((path) => path.kind !== EXPOSURE)
const p1Nodes = new Set(exposurePaths.flatMap((path) => path.node_ids))
const p2Nodes = new Set([...verifiedPaths.flatMap((path) => path.node_ids), ...passedIds])

async function openGraph(page: Page) {
  await page.goto('/#supply-graph')
  await expect(page.locator('.dg-canvas svg')).toBeVisible()
}

test('KPI tiles equal the counts derived from the graph fixture', async ({ page }) => {
  await openGraph(page)
  const disrupted = fixture.nodes.filter((node) => node.status === 'disrupted').length
  const atRisk = fixture.nodes.filter((node) => node.status === 'blocked' || node.status === 'affected_primary').length
  const candidates = fixture.edges.filter((edge) => edge.candidate).length
  await expect(page.locator('[data-kpi="disrupted"] .dg-kpi-value')).toHaveText(String(disrupted))
  await expect(page.locator('[data-kpi="at-risk"] .dg-kpi-value')).toHaveText(String(atRisk))
  await expect(page.locator('[data-kpi="paths"] .dg-kpi-value')).toHaveText(String(fixture.paths.length))
  await expect(page.locator('[data-kpi="candidates"] .dg-kpi-value')).toHaveText(String(candidates))
  expect(disrupted).toBe(1)
  expect(atRisk).toBe(2)
  expect(fixture.paths.length).toBe(2)
  expect(candidates).toBe(2)

  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).include('.dg').analyze()
  expect(results.violations.map((v) => v.id)).toEqual([])
})

test('P1 and P2 filters really filter: exactly the off-path nodes and links are dimmed', async ({ page }) => {
  await openGraph(page)
  const toolbar = page.getByRole('toolbar', { name: 'Supply chain filter toolbar' })

  const expectFilter = async (on: Set<string>, drawnCandidate: boolean, filter: 'P1' | 'P2') => {
    await toolbar.getByRole('button', { name: new RegExp(filter) }).click()
    for (const node of fixture.nodes) {
      const locator = page.locator(`[data-node-id="${node.id}"]`)
      if (on.has(node.id)) await expect(locator).not.toHaveClass(/is-dimmed/)
      else await expect(locator).toHaveClass(/is-dimmed/)
    }
    for (const edge of fixture.edges) {
      const locator = page.locator(`[data-edge-id="${edge.id}"]`)
      if (edge.candidate && (!drawnCandidate || !passedIds.has(edge.source))) {
        await expect(locator).toHaveCount(0)
        continue
      }
      const onPath = filter === 'P1'
        ? exposurePaths.some((path) => path.edge_ids.includes(edge.id))
        : verifiedPaths.some((path) => path.edge_ids.includes(edge.id)) || (edge.candidate && passedIds.has(edge.source))
      if (onPath) await expect(locator).not.toHaveClass(/is-dimmed/)
      else await expect(locator).toHaveClass(/is-dimmed/)
    }
  }

  await expectFilter(p1Nodes, false, 'P1')
  await expect(page.locator('[data-node-id="FAC-FABZ"]')).not.toHaveClass(/is-dimmed/)
  await expect(page.locator('[data-node-id="FAC-TSUB"]')).toHaveClass(/is-dimmed/)

  await expectFilter(p2Nodes, true, 'P2')
  await expect(page.locator('[data-node-id="FAC-FABZ"]')).toHaveClass(/is-dimmed/)
  await expect(page.locator('[data-edge-id="CAND-SUP-C"]')).toBeVisible()

  await toolbar.getByRole('button', { name: 'All' }).click()
  await expect(page.locator('.dg-node.is-dimmed')).toHaveCount(0)
  await expect(page.locator('.dg-edge.is-dimmed')).toHaveCount(0)
})

test('text stays at 12px or larger and the graphic never overflows at 1440, 1024 and 390 px', async ({ page }) => {
  await openGraph(page)
  for (const width of [1440, 1024, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await expect.poll(async () => page.evaluate(() => {
      const canvas = document.querySelector('.dg-canvas') as HTMLElement
      const svg = canvas.querySelector('svg') as SVGSVGElement
      return Math.abs(svg.getBoundingClientRect().width - canvas.clientWidth) < 2
    })).toBe(true)

    const metrics = await page.evaluate(() => {
      const canvas = document.querySelector('.dg-canvas') as HTMLElement
      const svg = canvas.querySelector('svg') as SVGSVGElement
      const scale = svg.getBoundingClientRect().width / svg.viewBox.baseVal.width
      const sizes: { text: string; rendered: number }[] = []
      const walker = document.createTreeWalker(canvas, NodeFilter.SHOW_TEXT)
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = node.textContent?.trim() ?? ''
        const el = node.parentElement
        if (!text || !el || el.closest('title, desc')) continue
        if (el.getBoundingClientRect().width === 0) continue
        const inSvg = el.closest('svg') !== null
        sizes.push({ text, rendered: parseFloat(getComputedStyle(el).fontSize) * (inSvg ? scale : 1) })
      }
      return {
        svgWidth: svg.getBoundingClientRect().width,
        canvasWidth: canvas.getBoundingClientRect().width,
        scrollWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
        sizes,
      }
    })

    expect(metrics.svgWidth, `svg width at ${width}`).toBeLessThanOrEqual(metrics.canvasWidth + 0.5)
    expect(metrics.scrollWidth, `page horizontal overflow at ${width}`).toBeLessThanOrEqual(metrics.viewportWidth)
    expect(metrics.sizes.length, `text found at ${width}`).toBeGreaterThan(20)
    const tooSmall = metrics.sizes.filter((item) => item.rendered < 12)
    expect(tooSmall, `text under 12px at ${width}`).toEqual([])
    const minNodeLabel = metrics.sizes.filter((item) => fixture.nodes.some((node) => node.label === item.text))
    expect(minNodeLabel.every((item) => item.rendered >= 14 - 0.01), `node labels at ${width}`).toBe(true)
  }
})

test('keyboard: Tab reaches a facility card and Enter opens the same popover as a click', async ({ page }) => {
  await openGraph(page)
  await page.getByRole('button', { name: /^SUP-B/ }).focus()
  let guard = 0
  while (guard++ < 60) {
    const id = await page.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset.nodeId ?? null)
    if (id === 'FAC-FABZ') break
    await page.keyboard.press('Tab')
  }
  await expect(page.locator('[data-node-id="FAC-FABZ"]')).toBeFocused()
  await expect(page.getByRole('button', { name: /Zenith Kulim wafer fab, FAC-FABZ, disrupted \(root cause\)/ })).toBeFocused()
  await page.keyboard.press('Enter')
  const popover = page.locator('ui5-popover#graph-node-popover')
  await expect(popover).toBeVisible()
  await expect(popover).toContainText('FAC-FABZ')
  await expect(popover).toContainText('Zenith Kulim wafer fab')
})

test('hovering a facility highlights its links and the edge tooltip names type, part, confidence and source', async ({ page }) => {
  await openGraph(page)
  await page.locator('[data-node-id="FAC-B-CHB"]').hover()
  await expect(page.locator('[data-edge-id="E-004"]')).toHaveClass(/is-linked/)
  await expect(page.locator('[data-edge-id="E-002"]')).not.toHaveClass(/is-linked/)
  const tooltip = await page.locator('[data-edge-id="E-004"] > title').textContent()
  expect(tooltip).toContain('part PRT-IGBT-DIE')
  expect(tooltip).toContain('confidence verified')
  expect(tooltip).toContain('source SRC-AUD-B-2026Q2')
})

test('empty state renders when the graph has zero facilities', async ({ page }) => {
  await page.route('**/graph_view_*.json', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ ...fixture, nodes: [], edges: [], paths: [], text_alternative: [] }),
  }))
  await page.goto('/#supply-graph')
  await expect(page.locator('[data-graph-state="empty"]')).toHaveCount(1)
  await expect(page.getByText('No supply relationships for this disruption')).toBeVisible()
  await expect(page.locator('[data-node-id]')).toHaveCount(0)
})

test('error state renders a negative message strip with a retry action when the graph request fails', async ({ page }) => {
  await page.route('**/graph_view_*.json', (route) => route.fulfill({ status: 500, contentType: 'text/plain', body: 'server error' }))
  await page.goto('/#supply-graph')
  const state = page.locator('[data-graph-state="error"]')
  await expect(state).toBeVisible()
  await expect(state.locator('ui5-message-strip')).toHaveAttribute('design', 'Negative')
  await expect(state.locator('ui5-message-strip')).toContainText('(500)')
  await expect(state.getByRole('button', { name: 'Retry' })).toBeVisible()
  await expect(state.getByRole('button', { name: 'Reload page' })).toHaveCount(0)
})

test('Retry refetches the graph in place after a failed request, without reloading the page', async ({ page }) => {
  let graphRequests = 0
  await page.route('**/graph_view_*.json', (route) => {
    graphRequests += 1
    if (graphRequests === 1) return route.fulfill({ status: 500, contentType: 'text/plain', body: 'server error' })
    return route.continue()
  })
  await page.goto('/#supply-graph')
  await expect(page.locator('[data-graph-state="error"]')).toBeVisible()
  // A full page reload would discard this marker; a refetch keeps it.
  await page.evaluate(() => { (window as unknown as { __noReload: boolean }).__noReload = true })

  await page.locator('[data-graph-state="error"]').getByRole('button', { name: 'Retry' }).click()

  await expect(page.locator('.dg-canvas svg')).toBeVisible()
  await expect(page.locator('[data-graph-state="error"]')).toHaveCount(0)
  expect(graphRequests).toBe(2)
  expect(await page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload)).toBe(true)
})

test('an evaluation that has not completed shows a neutral information strip with no retry action', async ({ page }) => {
  await page.route('**/evaluation_EVAL-0001.json', async (route) => {
    const response = await route.fetch()
    const body = await response.json()
    await route.fulfill({ response, json: { ...body, status: 'running' } })
  })
  await page.goto('/#supply-graph')
  const state = page.locator('[data-graph-state="pending"]')
  await expect(state).toBeVisible()
  await expect(state.locator('ui5-message-strip')).toHaveAttribute('design', 'Information')
  await expect(state.locator('ui5-message-strip')).toContainText('Run an evaluation to see the dependency graph.')
  await expect(state.getByRole('button', { name: 'Retry' })).toHaveCount(0)
  await expect(page.locator('[data-graph-state="error"]')).toHaveCount(0)
})

test.describe('layout: nothing clipped, pills clear of cards, legend laid out', () => {
  for (const width of [1440, 390]) {
    test(`every card sits inside the graph canvas and the canvas does not clip at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await openGraph(page)
      const result = await page.evaluate(() => {
        const canvas = document.querySelector('.dg-canvas') as HTMLElement
        const box = canvas.getBoundingClientRect()
        const cards = [...canvas.querySelectorAll('.dg-node')].map((el) => {
          const r = el.getBoundingClientRect()
          return { id: (el as HTMLElement).dataset.nodeId, bottom: r.bottom - box.top, right: r.right - box.left }
        })
        const table = document.querySelector('.table-scroll')?.getBoundingClientRect()
        return {
          cards,
          canvasHeight: box.height,
          canvasWidth: box.width,
          scrollHeight: canvas.scrollHeight,
          clientHeight: canvas.clientHeight,
          scrollWidth: canvas.scrollWidth,
          clientWidth: canvas.clientWidth,
          tableTopBelowCanvas: table ? table.top >= box.bottom - 1 : false,
        }
      })
      expect(result.cards.length).toBe(fixture.nodes.length)
      for (const card of result.cards) {
        expect(card.bottom, `card ${card.id} bottom`).toBeLessThanOrEqual(result.canvasHeight + 0.5)
        expect(card.right, `card ${card.id} right`).toBeLessThanOrEqual(result.canvasWidth + 0.5)
      }
      expect(result.scrollHeight).toBeLessThanOrEqual(result.clientHeight + 1)
      expect(result.scrollWidth).toBeLessThanOrEqual(result.clientWidth + 1)
      expect(result.tableTopBelowCanvas).toBe(true)
    })

    test(`no card text is clipped vertically at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await openGraph(page)
      const clipped = await page.evaluate(() => [...document.querySelectorAll('.dg-node > span')]
        .filter((el) => el.scrollHeight > el.clientHeight + 1 && getComputedStyle(el).webkitLineClamp === 'none')
        .map((el) => `${el.className}: ${el.textContent}`))
      expect(clipped).toEqual([])
      // Labels may clamp to two lines with an ellipsis, but must never hide a third line silently.
      const labelLines = await page.evaluate(() => [...document.querySelectorAll('.dg-node-label')].map((el) => Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight))))
      expect(labelLines.every((lines) => lines <= 2)).toBe(true)
    })

    test(`part-id pills do not overlap any card at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await openGraph(page)
      const overlaps = await page.evaluate(() => {
        const pills = [...document.querySelectorAll('.edge-callout-pill rect')].map((el) => ({ id: el.closest('[data-edge-id]')?.getAttribute('data-edge-id'), r: el.getBoundingClientRect() }))
        const cards = [...document.querySelectorAll('.dg-node')].map((el) => ({ id: (el as HTMLElement).dataset.nodeId, r: el.getBoundingClientRect() }))
        const hits: string[] = []
        for (const pill of pills) {
          for (const card of cards) {
            const intersects = pill.r.left < card.r.right - 0.5 && pill.r.right > card.r.left + 0.5 && pill.r.top < card.r.bottom - 0.5 && pill.r.bottom > card.r.top + 0.5
            if (intersects) hits.push(`pill ${pill.id} x card ${card.id}`)
          }
        }
        return { count: pills.length, hits }
      })
      expect(overlaps.count).toBeGreaterThan(0)
      expect(overlaps.hits).toEqual([])
    })
  }

  test('legend swatches are inline items with a fill and a gap before their label', async ({ page }) => {
    await openGraph(page)
    const legend = page.getByRole('group', { name: 'Graph legend' })
    const swatch = legend.locator('.dg-swatch').first()
    const item = legend.locator('span').first()
    const swatchBox = await swatch.boundingBox()
    const itemBox = await item.boundingBox()
    expect(swatchBox?.width).toBe(12)
    expect(swatchBox?.height).toBe(12)
    expect(await swatch.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)')
    expect(swatchBox?.x).toBeGreaterThanOrEqual(itemBox?.x ?? 0)
    const textGap = await item.evaluate((el) => getComputedStyle(el).columnGap)
    expect(textGap).toBe('8px')
  })
})
