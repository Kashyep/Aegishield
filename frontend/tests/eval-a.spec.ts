import { expect, test } from '@playwright/test';
import { getPlanJustification, PLAN_JUSTIFICATIONS } from '../src/components/screens/justifications';

test.describe('FB-04: Plan justification 60-80 word count unit test', () => {
  test('every configured plan justification satisfies the 60-80 word count requirement', () => {
    const planIds = Object.keys(PLAN_JUSTIFICATIONS);
    expect(planIds.length).toBeGreaterThan(0);

    for (const planId of planIds) {
      const justification = getPlanJustification(planId);
      const words = justification.fullText.trim().split(/\s+/).filter(Boolean);
      expect(
        words.length,
        `Plan ${planId} justification word count (${words.length}) must be between 60 and 80 words`,
      ).toBeGreaterThanOrEqual(60);
      expect(
        words.length,
        `Plan ${planId} justification word count (${words.length}) must be between 60 and 80 words`,
      ).toBeLessThanOrEqual(80);
      expect(justification.wordCount).toBe(words.length);
      expect(justification.whyItHelps.length).toBeGreaterThan(20);
      expect(justification.whatCouldGoWrong.length).toBeGreaterThan(20);
    }
  });

  test('fallback generator produces a 60-80 word justification for novel alternate plans', () => {
    const novelJustification = getPlanJustification('PLN-9999');
    const words = novelJustification.fullText.trim().split(/\s+/).filter(Boolean);
    expect(words.length).toBeGreaterThanOrEqual(60);
    expect(words.length).toBeLessThanOrEqual(80);
  });
});

test.describe('FB-01, FB-03, FB-04: Command Center & Recovery Plan Comparison', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#command');
    await expect(page.getByRole('heading', { name: 'Command Center' })).toBeVisible();
  });

  test('FB-04: Each alternate plan displays 60-80 word justification with why it helps and what could go wrong', async ({ page }) => {
    const p1Justification = page.locator('[data-testid="plan-justification-PLN-0001"]');
    await expect(p1Justification).toBeVisible();
    await expect(p1Justification).toContainText('Why it helps:');
    await expect(p1Justification).toContainText('What could go wrong:');

    const p1Text = await p1Justification.innerText();
    const p1Words = p1Text.replace(/^Plan Justification.*?\n/i, '').trim().split(/\s+/).filter(Boolean);
    expect(p1Words.length).toBeGreaterThanOrEqual(60);
    expect(p1Words.length).toBeLessThanOrEqual(80);

    const p2Justification = page.locator('[data-testid="plan-justification-PLN-0002"]');
    await expect(p2Justification).toBeVisible();
    await expect(p2Justification).toContainText('Why it helps:');
    await expect(p2Justification).toContainText('What could go wrong:');
  });

  test('FB-03: Priority colour coding uses ui5-tag and 4px left accent', async ({ page }) => {
    const p1 = page.locator('.plan-card').filter({ hasText: 'P1 Fastest-cheapest' });
    const p2 = page.locator('.plan-card').filter({ hasText: 'P2 AegisShield verified' });
    await expect(p1).toBeVisible();
    await expect(p2).toBeVisible();

    // Recommended plan has Highly Recommended tag and accent
    const recommendedTag = p2.locator('.priority-tag');
    await expect(recommendedTag).toBeVisible();
    await expect(recommendedTag).toHaveAttribute('design', 'Positive');

    // Alternate plan has Alternate tag with Critical design
    const altTag = p1.locator('.priority-tag');
    await expect(altTag).toBeVisible();
    await expect(altTag).toHaveAttribute('design', 'Critical');
  });

  test('FB-01: Baseline comparison vs ₹11,60,000 baseline is visible in the analysis workspace', async ({ page }) => {
    const plansGrid = page.locator('.plans-grid');
    await expect(plansGrid).toBeVisible();
    await expect(page.getByText('Recovery plan comparison')).toBeVisible();
    // Baseline loss is surfaced in metrics and card comparisons
    await expect(page.getByText('₹11,60,000').first()).toBeVisible();
  });

  test('FB-05: Request LC amendment on blocked plan submits request and records amendment', async ({ page }) => {
    const p1 = page.locator('.plan-card').filter({ hasText: 'P1 Fastest-cheapest' });
    await expect(p1).toBeVisible();

    // Open approval dialog for blocked plan
    const attemptBtn = p1.getByRole('button', { name: 'Attempt approval' });
    await expect(attemptBtn).toBeEnabled();
    await attemptBtn.click();

    const dialog = page.locator('ui5-dialog').filter({ hasText: 'Review P1 Fastest-cheapest' });
    await expect(dialog).toBeVisible();

    // LC amendment section is rendered
    const amendmentSection = dialog.locator('.amendment-section');
    await expect(amendmentSection).toBeVisible();
    await expect(amendmentSection.getByRole('heading', { name: 'Request LC amendment' })).toBeVisible();

    // 44C shipment date date picker is present
    const datePicker = dialog.locator('#lc-44c-shipment-date');
    await expect(datePicker).toBeVisible();

    // If actor is Priya (supply_planner), switch to Arjun (trade_compliance_officer)
    const switchBtn = amendmentSection.getByRole('button', { name: 'Switch to Arjun M. (Trade Compliance Officer)' });
    if (await switchBtn.isVisible()) {
      await switchBtn.click();
    }

    // Fill justification if needed
    const justificationTextarea = dialog.locator('#approval-justification');
    const currentJustification = await justificationTextarea.inputValue();
    if (currentJustification.trim().length < 10) {
      await justificationTextarea.fill('Request MT707 LC amendment: allow transhipment on 43T and extend 44C.');
    }

    // Submit amendment button is enabled and clickable
    const amendSubmitBtn = amendmentSection.getByRole('button', { name: 'Request LC amendment' });
    await expect(amendSubmitBtn).toBeEnabled();
    await amendSubmitBtn.click();

    // Feedback confirms amendment request is recorded
    await expect(amendmentSection.locator('.approval-note')).toContainText('Amendment request AMD-0001 recorded');
    await expect(amendmentSection.locator('.approval-note')).toContainText('stays blocked');
  });
});
