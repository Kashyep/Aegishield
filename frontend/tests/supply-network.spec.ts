import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function expectNoAccessibilityViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const summary = results.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    nodes: violation.nodes.map((node) => ({ target: node.target, summary: node.failureSummary })),
  }));
  expect(summary).toEqual([]);
}

test.describe('Supply Network home screen (FB-18)', () => {
  test('displays Simulated label, node IDs, on-hand numbers, and passes accessibility checks', async ({ page }) => {
    await page.goto('/#supply-network');

    // Heading is visible
    await expect(page.getByRole('heading', { name: 'Supply Network', level: 1 })).toBeVisible();

    // Simulated indicator is clearly visible
    await expect(page.getByText('Simulated', { exact: true })).toBeVisible();
    await expect(page.getByText(/Simulated supply chain network topology/i)).toBeVisible();

    // Total on-hand and in-transit numbers are displayed
    await expect(page.getByText('4,020', { exact: false })).toBeVisible();
    await expect(page.getByText('900', { exact: false }).first()).toBeVisible();

    // Key supply network node IDs are present
    await expect(page.locator('[data-node-id="FAC-KAV-BLR"]')).toBeVisible();
    await expect(page.locator('[data-node-id="FAC-FABZ"]')).toBeVisible();
    await expect(page.locator('[data-node-id="FAC-A-PEN"]')).toBeVisible();
    await expect(page.locator('[data-node-id="FAC-B-CHB"]')).toBeVisible();
    await expect(page.locator('[data-node-id="FAC-C-BDG"]')).toBeVisible();

    // Node details: on hand numbers
    const blrCard = page.locator('[data-node-id="FAC-KAV-BLR"]');
    await expect(blrCard.getByText('250')).toBeVisible();
    await expect(blrCard.locator('ui5-tag', { hasText: 'OPERATIONAL' })).toBeVisible();

    const fabzCard = page.locator('[data-node-id="FAC-FABZ"]');
    await expect(fabzCard.locator('ui5-tag', { hasText: 'DISRUPTED' })).toBeVisible();
    const details = page.locator('details.ae-accessible-details');
    await expect(details).toBeVisible();
    await details.locator('summary').click();
    const table = page.getByRole('table', { name: /Supply network node inventory/i });
    await expect(table).toBeVisible();
    await expect(table.getByText('FAC-KAV-BLR').first()).toBeVisible();
    await expect(table.getByText('FAC-FABZ').first()).toBeVisible();
    // Accessibility check on the entire screen
    await expectNoAccessibilityViolations(page);
  });

  test('is the default route when the app opens with no hash', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Supply Network', level: 1 })).toBeVisible();
    await expect(page.locator('ui5-side-navigation-item[data-id="supply-network"]').first()).toHaveAttribute('text', 'Supply Network');
  });
});
