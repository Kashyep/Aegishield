import { expect, test, type Page } from '@playwright/test';

const ROUTES = [
  '#supply-network',
  '#command',
  '#evaluations',
  '#execution',
  '#supply-graph',
  '#early-warnings',
  '#audit-trail',
] as const;

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 390, height: 844 },
];

const NAV_ITEMS = [
  { id: 'supply-network', label: 'Supply Network' },
  { id: 'command', label: 'Command Center' },
  { id: 'early-warnings', label: 'Early warnings' },
  { id: 'evaluations', label: 'Evaluations' },
  { id: 'execution', label: 'Execution' },
  { id: 'supply-graph', label: 'Supply graph' },
  { id: 'audit-trail', label: 'Audit trail' },
] as const;

// Phone widths are excluded from the inline sidebar click/keyboard/icon checks:
// on phones the navigation is a drawer that starts closed. Its open/close
// behaviour is covered by the phone drawer test at the end of this file.
const DESKTOP_VIEWPORTS = VIEWPORTS.filter((vp) => vp.width >= 768);

async function gotoRoute(page: Page, route: string): Promise<void> {
  await page.goto(`/${route}`);
  await expect(page.locator('ui5-side-navigation-item[data-id="command"]')).toBeAttached();
  await page.waitForLoadState('load');
}

/** On phone widths the sidebar opens as a drawer that covers the topbar; close it via its own item. */
async function closeDrawerIfOpen(page: Page): Promise<void> {
  const close = page.locator('ui5-side-navigation-item[text="Close navigation"]');
  if (await close.isVisible().catch(() => false)) {
    await close.click();
    await expect(close).toBeHidden();
  }
}

test.describe('hit testing: no element is covered at its centre or quarter points', () => {
  for (const route of ROUTES) {
    for (const vp of VIEWPORTS) {
      test(`${route} @ ${vp.width}x${vp.height}`, async ({ page }) => {
        await page.setViewportSize(vp);
        await gotoRoute(page, route);
        await closeDrawerIfOpen(page);

        const result = await page.evaluate(() => {
          const within = (el: Element, node: Node | null): boolean => {
            let n: Node | null = node;
            while (n) {
              if (n === el) return true;
              n = n.parentNode ?? (n as ShadowRoot).host ?? null;
            }
            return false;
          };
          const offenders: string[] = [];
          let tested = 0;
          for (const el of Array.from(document.querySelectorAll('ui5-button, button, ui5-side-navigation-item'))) {
            const cs = getComputedStyle(el);
            if (cs.display === 'none' || cs.visibility === 'hidden') continue;
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) continue;
            // Centre plus the four quarter points. Extreme corners are deliberately not sampled: they fall
            // outside rounded inner buttons, so a miss there says nothing about the hit target.
            const samples: [number, number][] = [[0.5, 0.5], [0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]];
            for (const [fx, fy] of samples) {
              const x = r.left + r.width * fx;
              const y = r.top + r.height * fy;
              if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue;
              tested++;
              const hit = document.elementFromPoint(x, y);
              if (!within(el, hit)) {
                const label = el.getAttribute('text') || el.getAttribute('aria-label') || (el.textContent ?? '').trim();
                offenders.push(`${el.tagName.toLowerCase()} "${label.slice(0, 40)}" at ${fx * 100}%,${fy * 100}% covered by ${hit?.tagName.toLowerCase() ?? 'null'}`);
              }
            }
          }
          return { tested, offenders };
        });

        expect(result.tested).toBeGreaterThan(0);
        expect(result.offenders).toEqual([]);
      });
    }
  }
});

test.describe('sidebar clicks land on the item they are drawn over', () => {
  for (const vp of DESKTOP_VIEWPORTS) {
    test(`every sidebar item navigates @ ${vp.width}x${vp.height}`, async ({ page }) => {
      await page.setViewportSize(vp);
      for (const item of NAV_ITEMS) {
        const start = item.id === 'command' ? '#supply-network' : '#command';
        await gotoRoute(page, start);

        const treeitem = page.getByRole('treeitem', { name: item.label, exact: true });
        const box = await treeitem.boundingBox();
        expect(box).not.toBeNull();
        await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);

        await expect.poll(() => page.evaluate(() => location.hash), { message: `click on "${item.label}"` }).toBe(`#${item.id}`);
      }
    });
  }
});

test.describe('keyboard navigation of the sidebar', () => {
  for (const vp of DESKTOP_VIEWPORTS) {
    test(`ArrowDown + Enter opens the next screen @ ${vp.width}x${vp.height}`, async ({ page }) => {
      await page.setViewportSize(vp);
      await gotoRoute(page, '#supply-network');

      await page.getByRole('treeitem', { name: 'Supply Network', exact: true }).focus();
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');

      await expect.poll(() => page.evaluate(() => location.hash)).toBe('#command');
      await expect(page.getByRole('heading', { name: 'Command Center', level: 1 })).toBeVisible();
    });
  }
});

test.describe('clicking a ui5-button icon triggers the button', () => {
  for (const vp of DESKTOP_VIEWPORTS) {
    test(`topbar menu icon toggles the sidebar @ ${vp.width}x${vp.height}`, async ({ page }) => {
      await page.setViewportSize(vp);
      await gotoRoute(page, '#command');
      await closeDrawerIfOpen(page);

      const nav = page.locator('ui5-side-navigation');
      const widthOf = () => nav.evaluate((el) => el.getBoundingClientRect().width);
      const before = await widthOf();

      await page.locator('ui5-button[slot="startButton"] ui5-icon').click();

      await expect.poll(widthOf).not.toBe(before);
    });
  }
});

test.describe('phone drawer', () => {
  test('topbar menu opens the drawer, a nav item navigates and closes it @ 390x844', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await gotoRoute(page, '#command')
    await closeDrawerIfOpen(page)

    const menu = page.locator('ui5-button[slot="startButton"] ui5-icon')
    await menu.click()

    const auditItem = page.getByRole('treeitem', { name: 'Audit trail', exact: true })
    await expect(auditItem).toBeVisible()
    await expect(page.locator('ui5-side-navigation-item[text="Close navigation"]')).toBeVisible()

    await auditItem.click()

    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#audit-trail')
    await expect(page.locator('ui5-side-navigation-item[text="Close navigation"]')).toHaveCount(0)
    await expect(page.locator('.sidebar-backdrop')).toHaveCount(0)
  })

  test('closed drawer is visibility:hidden and has no hit area @ 390x844', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await gotoRoute(page, '#execution')
    await closeDrawerIfOpen(page)

    const nav = page.locator('ui5-side-navigation')
    const navState = () => nav.evaluate((el) => {
      const r = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      const samples: [number, number][] = []
      for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4; j++) samples.push([(innerWidth * i) / 4 - 0.5, (innerHeight * j) / 4 - 0.5])
      const hitNav = samples.some(([x, y]) => {
        let n: Node | null = document.elementFromPoint(Math.max(0, x), Math.max(0, y))
        while (n) { if (n === el) return true; n = n.parentNode ?? (n as ShadowRoot).host ?? null }
        return false
      })
      return { visibility: cs.visibility, right: r.right, hitNav }
    })

    // The slide-out takes 0.3s; visibility turns hidden when it finishes.
    await expect.poll(async () => (await navState()).visibility, { timeout: 2000 }).toBe('hidden')
    const state = await navState()
    expect(state.right).toBeLessThanOrEqual(0)
    expect(state.hitNav).toBe(false)

    // Hidden items are also removed from the keyboard focus order and accessibility tree.
    await expect(page.getByRole('treeitem', { name: 'Audit trail', exact: true })).toBeHidden()
  })

  test('Escape and the backdrop dismiss the drawer @ 390x844', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await gotoRoute(page, '#command')
    await closeDrawerIfOpen(page)

    const menu = page.locator('ui5-button[slot="startButton"] ui5-icon')
    const closeItem = page.locator('ui5-side-navigation-item[text="Close navigation"]')

    await menu.click()
    await expect(closeItem).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(closeItem).toHaveCount(0)

    await menu.click()
    await expect(closeItem).toBeVisible()
    await page.locator('.sidebar-backdrop').click({ position: { x: 370, y: 400 } })
    await expect(closeItem).toHaveCount(0)
  })
})
