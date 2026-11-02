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

test.describe('Evaluations & Findings (WorkerEvalB: FB-02, FB-06, FB-07, FB-08, FB-09, FB-10)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#evaluations');
    await expect(page.getByRole('heading', { name: 'Evaluations' })).toBeVisible();
  });

  test('FB-08: plan card sections follow strict order: Validation status -> Financial status -> Check results', async ({ page }) => {
    const planCard = page.locator('.plan-card').first();
    await expect(planCard).toBeVisible();

    const valSection = planCard.locator('[data-section="validation-status"]');
    const finSection = planCard.locator('[data-section="financial-status"]');
    const chkSection = planCard.locator('[data-section="check-results"]');

    await expect(valSection).toBeVisible();
    await expect(finSection).toBeVisible();
    await expect(chkSection).toBeVisible();

    await expect(valSection.getByText('Validation status')).toBeVisible();
    await expect(finSection.getByText('Financial status')).toBeVisible();
    await expect(chkSection.getByText('Check results')).toBeVisible();

    const finBox = await finSection.boundingBox();
    const chkBox = await chkSection.boundingBox();

    expect(valBox).not.toBeNull();
    expect(finBox).not.toBeNull();
    expect(chkBox).not.toBeNull();

    // Verify vertical order: Validation status above Financial status above Check results
    expect(valBox!.y).toBeLessThan(finBox!.y);
    expect(finBox!.y).toBeLessThan(chkBox!.y);

    await expectNoAccessibilityViolations(page);
  });

  test('FB-07: validation status is colour-coded with Positive/Negative/Critical UI5 tags', async ({ page }) => {
    const planCards = page.locator('.plan-card');
    await expect(planCards.first()).toBeVisible();

    // In EVAL-0001: P1 is blocked (Negative), P2 is passed (Positive)
    const p1Card = planCards.filter({ hasText: 'P1' });
    const p2Card = planCards.filter({ hasText: 'P2' });

    if (await p1Card.count() > 0) {
      const p1Tag = p1Card.locator('[data-section="validation-status"] ui5-tag');
      await expect(p1Tag).toBeVisible();
      const design = await p1Tag.getAttribute('design');
      expect(design).toBe('Negative');
    }

    if (await p2Card.count() > 0) {
      const p2Tag = p2Card.locator('[data-section="validation-status"] ui5-tag');
      await expect(p2Tag).toBeVisible();
      const design = await p2Tag.getAttribute('design');
      expect(design).toBe('Positive');
    }

    await expectNoAccessibilityViolations(page);
  });

  test('FB-02: findings default to most relevant scenario findings with Show more expander', async ({ page }) => {
    const findingItems = page.locator('.ae-finding-item');
    // Initially should show top 3 relevant findings
    await expect(findingItems).toHaveCount(3);

    // Expand button should exist with "Show more"
    const expandBtn = page.getByRole('button', { name: /Show more/i });
    await expect(expandBtn).toBeVisible();

    // Click to expand
    await expandBtn.click();

    // Should now show all findings (23 in EVAL-0001)
    await expect(findingItems).toHaveCount(23);

    // Button should now allow collapsing
    const collapseBtn = page.getByRole('button', { name: /Show less/i });
    await expect(collapseBtn).toBeVisible();
    await collapseBtn.click();
    await expect(findingItems).toHaveCount(3);

    await expectNoAccessibilityViolations(page);
  });

  test('FB-06: Review evidence opens a ui5-dialog without page scrolling', async ({ page }) => {
    const planCard = page.locator('.plan-card').first();
    const reviewBtn = planCard.getByRole('button', { name: /Review evidence/i });
    await expect(reviewBtn).toBeVisible();

    // Record scroll position before click
    const scrollBefore = await page.evaluate(() => window.scrollY);

    await reviewBtn.click();

    // Dialog should open
    const dialog = page.locator('ui5-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/Plan findings/i)).toBeVisible();

    // Dialog also has the ordered sections: Validation status, Financial status, Check results
    await expect(dialog.locator('[data-section="validation-status"]')).toBeVisible();
    await expect(dialog.locator('[data-section="financial-status"]')).toBeVisible();
    await expect(dialog.locator('[data-section="check-results"]')).toBeVisible();

    // Verify page scroll position didn't jump down the page
    const scrollAfter = await page.evaluate(() => window.scrollY);
    expect(Math.abs(scrollAfter - scrollBefore)).toBeLessThan(50);

    // Close button dismisses dialog
    const closeBtn = dialog.getByRole('button', { name: 'Close' });
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();

    await expect(dialog).toBeHidden();
    await expectNoAccessibilityViolations(page);
  });
});
