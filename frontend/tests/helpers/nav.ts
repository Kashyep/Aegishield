import type { Page } from '@playwright/test';

/**
 * Click a sidebar navigation item by its visible label.
 * The items are <ui5-side-navigation-item> elements whose shadow DOM exposes
 * role="treeitem" with the label as accessible name.
 */
export async function navTo(page: Page, label: string): Promise<void> {
  await page.getByRole('treeitem', { name: label, exact: true }).click();
}
