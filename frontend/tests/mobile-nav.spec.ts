import { expect, test } from '@playwright/test';

// Closed drawer items are translated off-screen (not display:none), so open/closed is
// asserted with toBeInViewport in addition to toBeVisible.
const commandItemSelector = 'ui5-side-navigation-item[data-id="command"]';
const menuSelector = 'ui5-button[slot="startButton"]';

test.describe('Mobile navigation drawer (390x844)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('menu button opens the drawer and a nav item navigates', async ({ page }) => {
    await page.goto('/');
    const commandItem = page.locator(commandItemSelector);
    await expect(commandItem).not.toBeInViewport();

    await page.locator(menuSelector).click();
    await expect(commandItem).toBeVisible();
    await expect(commandItem).toBeInViewport();

    await commandItem.click();
    await expect(page).toHaveURL(/#command$/);
    await expect(page.getByRole('heading', { name: 'Command Center' })).toBeVisible();
    // Navigating closes the drawer.
    await expect(commandItem).not.toBeInViewport();
  });

  test('"Close navigation" closes the drawer', async ({ page }) => {
    await page.goto('/');
    const commandItem = page.locator(commandItemSelector);

    await page.locator(menuSelector).click();
    await expect(commandItem).toBeInViewport();
    await page.locator('ui5-side-navigation-item[text="Close navigation"]').click();
    await expect(commandItem).not.toBeInViewport();
    await expect(page.locator('.sidebar-backdrop')).toHaveCount(0);
  });
});

// Below 600px UI5 renders the drawer full-width, so the backdrop is only exposed on wider
// mobile viewports (600-767px), where the closed state is the icon rail.
test.describe('Mobile navigation drawer backdrop (700x844)', () => {
  test.use({ viewport: { width: 700, height: 844 } });

  test('clicking the backdrop closes the drawer', async ({ page }) => {
    await page.goto('/');
    const commandItem = page.locator(commandItemSelector);

    await page.locator(menuSelector).click();
    await expect(commandItem).toBeInViewport();
    await page.locator('.sidebar-backdrop').click({ position: { x: 690, y: 600 } });
    // Closed at this width means the icon-only rail, not an off-screen drawer.
    await expect(page.locator('.sidebar-backdrop')).toHaveCount(0);
    await expect(commandItem).toHaveAttribute('side-nav-collapsed', '');
  });
});

// Every sidebar item must navigate to its own screen when clicked (no stray overlays
// intercepting the hit), on desktop and on phone widths.
const navIds = ['supply-network', 'command', 'early-warnings', 'evaluations', 'execution', 'supply-graph', 'audit-trail'];
for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  test.describe(`Sidebar item click targets (${viewport.width}x${viewport.height})`, () => {
    test.use({ viewport });

    test('clicking each item navigates to its screen', async ({ page }) => {
      await page.goto('/');
      for (const id of navIds) {
        if (viewport.width < 768) await page.locator(menuSelector).click();
        const item = page.locator(`ui5-side-navigation-item[data-id="${id}"]`);
        await expect(item).toBeInViewport();
        await item.click();
        await expect(page).toHaveURL(new RegExp(`#${id}$`));
        if (viewport.width < 768) await expect(item).not.toBeInViewport();
      }
    });
  });
}
