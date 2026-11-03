import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('FB-11: Button designs in CommandCenter and Approval Modal', () => {
  test('unblocked plan P2 has Positive Approve button and Default Review evidence button', async ({ page }) => {
    await page.goto('/#command');
    await expect(page.getByRole('heading', { name: 'Command Center' })).toBeVisible();

    // Locate unblocked plan P2
    const p2Card = page.locator('.plan-card').filter({ hasText: 'P2 AegisShield verified' });
    await expect(p2Card).toBeVisible();

    // Verify "Approve" button has UI5 button design="Positive"
    const p2ApproveBtn = p2Card.locator('ui5-button').filter({ hasText: 'Approve' });
    await expect(p2ApproveBtn).toBeVisible();
    await expect(p2ApproveBtn).toHaveAttribute('design', 'Positive');

    // Verify secondary action "Review evidence" has complementary design="Default"
    const p2ReviewBtn = p2Card.locator('ui5-button').filter({ hasText: 'Review evidence' });
    await expect(p2ReviewBtn).toBeVisible();
    await expect(p2ReviewBtn).toHaveAttribute('design', 'Default');

    // Verify blocked plan P1 has Positive Approve (disabled) and Default secondary action
    const p1Card = page.locator('.plan-card').filter({ hasText: 'P1 Fastest-cheapest' });
    await expect(p1Card).toBeVisible();

    const p1ApproveBtn = p1Card.locator('ui5-button').filter({ hasText: 'Approve' });
    await expect(p1ApproveBtn).toHaveAttribute('design', 'Positive');
    await expect(p1Card.getByRole('button', { name: 'Approve' })).toBeDisabled();

    const p1AttemptBtn = p1Card.locator('ui5-button').filter({ hasText: 'Attempt approval' });
    await expect(p1AttemptBtn).toHaveAttribute('design', 'Default');

    // Open approval dialog for unblocked plan P2
    await p2ApproveBtn.click();
    const dialog = page.getByRole('dialog', { name: 'Review P2 AegisShield verified' });
    await expect(dialog).toBeVisible();

    // Verify approval dialog's "Approve plan" button has UI5 button design="Positive"
    const dialogApproveBtn = dialog.locator('ui5-button').filter({ hasText: 'Approve plan' });
    await expect(dialogApproveBtn).toBeVisible();
    await expect(dialogApproveBtn).toHaveAttribute('design', 'Positive');

    // Verify dialog's "Cancel" button uses complementary design="Transparent"
    const cancelBtn = dialog.locator('ui5-button').filter({ hasText: 'Cancel' });
    await expect(cancelBtn).toBeVisible();
    await expect(cancelBtn).toHaveAttribute('design', 'Transparent');

    // Close dialog
    await cancelBtn.click();
    await expect(dialog).toBeHidden();

    // Accessibility check
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations.map((v) => v.id)).toEqual([]);
  });

  test('blocked plan P1 approval modal displays Positive Approve plan button and Transparent Cancel button', async ({ page }) => {
    await page.goto('/#command');
    await expect(page.getByRole('heading', { name: 'Command Center' })).toBeVisible();

    const p1Card = page.locator('.plan-card').filter({ hasText: 'P1 Fastest-cheapest' });
    const p1AttemptBtn = p1Card.locator('ui5-button').filter({ hasText: 'Attempt approval' });
    await p1AttemptBtn.click();

    const dialog = page.getByRole('dialog', { name: 'Review P1 Fastest-cheapest' });
    await expect(dialog).toBeVisible();

    // Blocked plan dialog has disabled Positive "Approve plan" button
    const dialogApproveBtn = dialog.locator('ui5-button').filter({ hasText: 'Approve plan' });
    await expect(dialogApproveBtn).toBeVisible();
    await expect(dialogApproveBtn).toHaveAttribute('design', 'Positive');
    await expect(dialog.getByRole('button', { name: 'Approve plan' })).toBeDisabled();

    // And Transparent Cancel button
    const cancelBtn = dialog.locator('ui5-button').filter({ hasText: 'Cancel' });
    await expect(cancelBtn).toBeVisible();
    await expect(cancelBtn).toHaveAttribute('design', 'Transparent');

    await cancelBtn.click();
    await expect(dialog).toBeHidden();
  });
});
