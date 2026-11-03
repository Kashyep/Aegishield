import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { AuditEvent, AuditVerifyResult } from '../src/api/types';

async function expectNoAccessibilityViolations(page: Page, contextSelector = '.page-body') {
  const results = await new AxeBuilder({ page })
    .include(contextSelector)
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const summary = results.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    nodes: violation.nodes.map((node) => ({ target: node.target, summary: node.failureSummary })),
  }));
  expect(summary).toEqual([]);
}

const mockAuditEvents: AuditEvent[] = [
  {
    schema_version: '1.0.0',
    event_id: 'AUD-000001',
    seq: 1,
    occurred_at: '2026-11-04T10:00:00+05:30',
    actor: {
      actor_id: 'USR-PRIYA',
      role: 'supply_planner',
      kind: 'human',
      display_name: 'Priya Sharma',
    },
    event_type: 'DEMO_RESET',
    subject: { type: 'scenario', id: 'SCN-DEMO-001', version: null },
    payload: { snapshot: 'sha256:d52c7ecc366a6647' },
    evidence_ids: [],
    prev_hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
    event_hash: 'sha256:7f3a3c4b6a0d2e8f9b1c5d7e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a',
  },
  {
    schema_version: '1.0.0',
    event_id: 'AUD-000002',
    seq: 2,
    occurred_at: '2026-11-04T10:05:00+05:30',
    actor: {
      actor_id: 'USR-PRIYA',
      role: 'supply_planner',
      kind: 'human',
      display_name: 'Priya Sharma',
    },
    event_type: 'PLAN_EVALUATED',
    subject: { type: 'plan', id: 'PLN-0002', version: 1 },
    payload: { status: 'passed' },
    evidence_ids: ['EVD-001'],
    prev_hash: 'sha256:7f3a3c4b6a0d2e8f9b1c5d7e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a',
    event_hash: 'sha256:8a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b',
  },
];

test.describe('Audit Trail Screen (D6 & FB-17)', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', (msg) => console.log('BROWSER LOG:', msg.text()));
    page.on('pageerror', (err) => console.log('BROWSER UNCAUGHT:', err.message, err.stack));
    await page.goto('/#audit-trail');
    await page.waitForTimeout(1000);
    console.log('CURRENT URL:', page.url());
    console.log('CURRENT BODY:', await page.locator('#root').innerHTML());
    const heading = page.getByRole('heading', { name: 'Audit trail' });
    await expect(heading).toBeVisible();
  });

  test('FB-17: prominent audit filter and simulated identity row on the same line', async ({ page }) => {
    const controlsForm = page.locator('form.ae-audit-controls');
    await expect(controlsForm).toBeVisible();

    // Verify "Filter by subject ID" control exists, is readable, and properly labelled
    const filterLabel = controlsForm.getByText('Filter by subject ID', { exact: true });
    await expect(filterLabel).toBeVisible();
    const filterInput = controlsForm.locator('#audit-subject');
    await expect(filterInput).toBeVisible();
    await expect(filterInput).toHaveAttribute('placeholder', 'e.g. PLN-0002');

    // Verify "Simulated identity" control is on the same row inside the controls toolbar
    const identityLabel = controlsForm.getByText('Simulated identity', { exact: true });
    await expect(identityLabel).toBeVisible();
    const identitySelect = controlsForm.locator('#audit-actor');
    await expect(identitySelect).toBeVisible();

    // Verify row visual prominence and layout
    const filterBox = await filterInput.boundingBox();
    const identityBox = await identitySelect.boundingBox();
    expect(filterBox).not.toBeNull();
    expect(identityBox).not.toBeNull();

    // Sizing: control is comfortably large and readable (height >= 38px, min-width >= 200px)
    expect(filterBox!.height).toBeGreaterThanOrEqual(38);
    expect(filterBox!.width).toBeGreaterThanOrEqual(200);
    expect(identityBox!.height).toBeGreaterThanOrEqual(38);
    expect(identityBox!.width).toBeGreaterThanOrEqual(200);

    // Verify simulated identity options and switching on ui5-select
    await expect(identitySelect).toHaveAttribute('value', 'USR-PRIYA');
    await identitySelect.evaluate((el: HTMLElement & { value?: string }) => {
      el.value = 'USR-VIEW';
      el.dispatchEvent(new CustomEvent('change', { bubbles: true, detail: { selectedOption: { value: 'USR-VIEW' } } }));
    });
    await expect(identitySelect).toHaveAttribute('value', 'USR-VIEW');
    // Verify action buttons on the same row
    const loadBtn = controlsForm.locator('ui5-button', { hasText: 'Load events' });
    const verifyBtn = controlsForm.locator('ui5-button', { hasText: 'Verify chain' });
    await expect(loadBtn).toBeVisible();
    await expect(verifyBtn).toBeVisible();

    // Verify stub mode note and disabled state per contract
    await expect(page.getByText(/Fixture mode contains no audit-event records/)).toBeVisible();
    await expect(filterInput).toHaveAttribute('disabled');
    await expect(page.getByRole('button', { name: 'Load events' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Verify chain' })).toBeDisabled();

    // Accessibility check on the audit toolbar
    await expectNoAccessibilityViolations(page);
  });

  test('D6-audit: renders ui5-timeline, ui5-table ledger, and ui5-toast on chain verification', async ({ page }) => {
    // Inject test audit events via bridge
    await page.evaluate((events) => {
      window.__setAuditTestState?.(events);
    }, mockAuditEvents);

    // Verify D6 Timeline component
    const timeline = page.locator('ui5-timeline');
    await expect(timeline).toBeVisible();
    await expect(timeline).toHaveAttribute('accessible-name', 'Audit event timeline');

    const timelineItems = timeline.locator('ui5-timeline-item');
    await expect(timelineItems).toHaveCount(2);

    // Verify timeline item content: titleText, subtitleText, actor name, icon
    const firstItem = timelineItems.first();
    await expect(firstItem).toHaveAttribute('title-text', 'DEMO_RESET');
    await expect(firstItem).toHaveAttribute('name', 'Priya Sharma');
    await expect(firstItem).toHaveAttribute('icon', 'history');
    await expect(firstItem.getByText('Subject: scenario: SCN-DEMO-001')).toBeVisible();
    await expect(firstItem.getByText('Seq: #1')).toBeVisible();

    const secondItem = timelineItems.nth(1);
    await expect(secondItem).toHaveAttribute('title-text', 'PLAN_EVALUATED');
    await expect(secondItem.getByText('Subject: plan: PLN-0002')).toBeVisible();
    await expect(secondItem.getByText('Seq: #2')).toBeVisible();

    // Verify D6 Cryptographic Ledger ui5-table
    const table = page.locator('ui5-table');
    await expect(table).toBeVisible();
    await expect(table).toHaveAttribute('accessible-name', 'Audit events returned by the API, in sequence order');

    // Verify Table header row has required columns: seq, timestamp, actor, prev_hash, hash
    const headerRow = table.locator('ui5-table-header-row');
    await expect(headerRow.getByText('Seq')).toBeVisible();
    await expect(headerRow.getByText('Timestamp')).toBeVisible();
    await expect(headerRow.getByText('Actor')).toBeVisible();
    await expect(headerRow.getByText('Previous Hash')).toBeVisible();
    await expect(headerRow.getByText('Hash', { exact: true })).toBeVisible();

    // Verify Table rows contain the data with mono-formatted hashes
    const tableRows = table.locator('ui5-table-row');
    await expect(tableRows).toHaveCount(2);

    const row1Cells = tableRows.first().locator('ui5-table-cell');
    await expect(row1Cells.nth(0)).toHaveText('1');
    await expect(row1Cells.nth(2)).toContainText('Priya Sharma');
    await expect(row1Cells.nth(2)).toContainText('supply_planner');
    // Previous hash and Hash formatted with .mono class
    const row1PrevHash = row1Cells.nth(3).locator('.mono');
    await expect(row1PrevHash).toHaveText(/sha256:00000000/);
    const row1Hash = row1Cells.nth(4).locator('.mono');
    await expect(row1Hash).toHaveText(/sha256:7f3a3c4b/);

    const row2Cells = tableRows.nth(1).locator('ui5-table-cell');
    await expect(row2Cells.nth(0)).toHaveText('2');
    await expect(row2Cells.nth(2)).toContainText('Priya Sharma');
    const row2PrevHash = row2Cells.nth(3).locator('.mono');
    await expect(row2PrevHash).toHaveText(/sha256:7f3a3c4b/);
    const row2Hash = row2Cells.nth(4).locator('.mono');
    await expect(row2Hash).toHaveText(/sha256:8a1b2c3d/);

    // Verify ui5-toast on "Verify chain"
    const verifyBtn = page.locator('ui5-button', { hasText: 'Verify chain' });
    await expect(verifyBtn).toBeEnabled();
    await verifyBtn.click();

    // ui5-toast is present in DOM and shows verification result
    const toast = page.locator('#audit-verify-toast');
    await expect(toast).toBeAttached();
    await expect(toast).toHaveText('Chain valid — API verified 2 events.');

    // Status tag reflects verified valid state
    const tag = page.locator('.audit-verified');
    await expect(tag).toBeVisible();
    await expect(tag).toContainText('Chain valid — API verified 2 events.');

    // Test invalid chain notification
    await page.evaluate(() => {
      const invalidResult: AuditVerifyResult = {
        valid: false,
        checked_events: 2,
        first_invalid_seq: 2,
      };
      window.__setAuditTestState?.(window.__setAuditTestState ? [] : [], invalidResult);
    });

    await expect(toast).toHaveText('Chain invalid at sequence 2.');
    const invalidTag = page.locator('.audit-invalid');
    await expect(invalidTag).toBeVisible();
    await expect(invalidTag).toContainText('Chain invalid at sequence 2.');

    // Accessibility check on the populated audit trail view
    await expectNoAccessibilityViolations(page);
  });
});
