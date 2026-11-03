import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function expectNoAccessibilityViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .exclude('.synthetic-banner')
    .exclude('ui5-shellbar')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const summary = results.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    nodes: violation.nodes.map((node) => ({ target: node.target, summary: node.failureSummary })),
  }));
  expect(summary.map(s => ({ id: s.id, targets: s.nodes.map(n => n.target) }))).toEqual([]);
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
    const valBox = await valSection.boundingBox();
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

    // Should now show all findings (31 in EVAL-0001)
    await expect(findingItems).toHaveCount(31);
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

  test('FB-10: evaluation overview to view evaluation tracks section viewing with green ticks and progress', async ({ page }) => {
    // Start from evaluation-progress screen to test the navigation path: Overview -> "View evaluation"
    await page.goto('/#evaluation-progress');
    await expect(page.getByRole('heading', { name: 'Evaluation progress' })).toBeVisible();

    // Verify FB-09 clarification: renamed to agent pipeline execution steps
    await expect(page.getByText('Agent pipeline execution steps').first()).toBeVisible();
    // Click "View evaluation"
    const viewEvalBtn = page.getByRole('button', { name: 'View evaluation' }).first();
    await expect(viewEvalBtn).toBeVisible();
    await viewEvalBtn.click();

    // Lands on evaluations screen
    await expect(page.getByRole('heading', { name: 'Evaluations' })).toBeVisible();

    // Review progress tracker should be visible
    const progressTracker = page.locator('.ae-review-progress');
    await expect(progressTracker).toBeVisible();

    // Overview section should be visible in viewport and its tick should turn green (data-status="viewed")
    const overviewTick = page.locator('[data-section-tick="overview"]');
    await expect(overviewTick).toBeVisible();
    await expect(overviewTick).toHaveAttribute('data-status', 'viewed');

    // Scroll down to the Findings section
    const findingsSection = page.locator('#section-findings');
    await findingsSection.scrollIntoViewIfNeeded();

    // Once scrolled into view, the findings tick should also turn green
    const findingsTick = page.locator('[data-section-tick="findings"]');
    await expect(findingsTick).toHaveAttribute('data-status', 'viewed');

    // And progress tracker shows updated section count
    await expect(progressTracker).toContainText('sections viewed');

    await expectNoAccessibilityViolations(page);
  });

  test('D6: decision matrix renders as ui5-table with tabular-nums currency right-aligned', async ({ page }) => {
    const matrixContainer = page.locator('.ae-decision-matrix');
    await expect(matrixContainer).toBeVisible();

    const table = matrixContainer.locator('ui5-table');
    await expect(table).toBeVisible();
    await expect(table).toHaveAttribute('accessible-name', 'Candidate plans decision matrix');

    const headerRow = table.locator('ui5-table-header-row');
    await expect(headerRow.getByText('Plan ID')).toBeVisible();
    await expect(headerRow.getByText('Description')).toBeVisible();
    await expect(headerRow.getByText('Status/Outcome')).toBeVisible();
    await expect(headerRow.getByText('Recovery Cost (₹)')).toBeVisible();
    await expect(headerRow.getByText('Residual Loss (₹)')).toBeVisible();
    await expect(headerRow.getByText('Net Avoided Loss (₹)')).toBeVisible();
    await expect(headerRow.getByText('Executability')).toBeVisible();

    const rows = table.locator('ui5-table-row');
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThanOrEqual(2);

    // Verify currency cells in row 1
    const firstRowCells = rows.first().locator('ui5-table-cell');
    const recoveryCostSpan = firstRowCells.nth(3).locator('span');
    const residualLossSpan = firstRowCells.nth(4).locator('span');
    const netAvoidedLossSpan = firstRowCells.nth(5).locator('span');

    await expect(recoveryCostSpan).toHaveCSS('text-align', 'right');
    await expect(recoveryCostSpan).toHaveCSS('font-variant-numeric', 'tabular-nums');
    await expect(residualLossSpan).toHaveCSS('text-align', 'right');
    await expect(residualLossSpan).toHaveCSS('font-variant-numeric', 'tabular-nums');
    await expect(netAvoidedLossSpan).toHaveCSS('text-align', 'right');
    await expect(netAvoidedLossSpan).toHaveCSS('font-variant-numeric', 'tabular-nums');

    await expectNoAccessibilityViolations(page);
  });
});
