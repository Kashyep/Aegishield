import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

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
  expect(summary).toEqual([]);
}

const MOCK_COMPLETED_EXECUTION = {
  schema_version: '1.0.0',
  execution_id: 'EXE-0001',
  plan_id: 'PLN-0002',
  plan_version: 1,
  decision_id: 'DEC-0001',
  status: 'completed',
  simulated: true,
  started_at: '2026-10-26T10:00:00Z',
  finished_at: '2026-10-26T10:00:04Z',
  error: null,
  steps: [
    {
      seq: 1,
      step_type: 'REDUCE_PO',
      refs: { po_id: 'PO-7001', from_qty: 900, to_qty: 300 },
      description: 'Reduce delayed PO-7001 from 900 to 300 units under its force-majeure clause (simulated)',
      status: 'succeeded',
      simulated: true,
      proposed_sap_mapping: 'S/4HANA purchase order change',
      error: null,
    },
    {
      seq: 2,
      step_type: 'CREATE_PO',
      refs: {
        supplier_id: 'SUP-B',
        quote_id: 'QT-ALT-99',
        qty: 450,
        unit_price_inr: 1200,
        lc_id: 'LC-2026-0088',
        lc_drawing_inr: 540000,
      },
      description: 'Create PO for 450 units from Thai Semiconductor Co under LC-2026-0088 (simulated)',
      status: 'succeeded',
      simulated: true,
      proposed_sap_mapping: 'S/4HANA purchase order with SAP Global Trade Services documentary credit reference',
      error: null,
    },
    {
      seq: 3,
      step_type: 'BOOK_FREIGHT',
      refs: { route_option_id: 'RT-ALT-AIR', qty: 450 },
      description: 'Book direct sailing PKG to INMAA ETD 2026-10-28 (simulated)',
      status: 'succeeded',
      simulated: true,
      proposed_sap_mapping: 'SAP Transportation Management freight order',
      error: null,
    },
    {
      seq: 4,
      step_type: 'CREATE_STOCK_TRANSFER',
      refs: { inventory_source_id: 'INV-BLR-01', to_location_id: 'LOC-PLANT-MAA', qty: 100 },
      description: 'Transfer 100 units Plant North to Plant Chennai (simulated)',
      status: 'succeeded',
      simulated: true,
      proposed_sap_mapping: 'S/4HANA stock transport order',
      error: null,
    },
    {
      seq: 5,
      step_type: 'RESERVE_STOCK',
      refs: { inventory_source_id: 'INV-MAA-01', order_id: 'SO-1001', qty: 300 },
      description: 'Reserve 300 plant units for SO-1001 (simulated)',
      status: 'succeeded',
      simulated: true,
      proposed_sap_mapping: 'S/4HANA reservation',
      error: null,
    },
    {
      seq: 6,
      step_type: 'NOTIFY_CUSTOMER',
      refs: { order_id: 'SO-1002', customer_id: 'CUST-001', qty_late: 50, days_late: 2 },
      description: 'Notify customer CUST-001 for SO-1002: 50 units delayed 2 days (simulated)',
      status: 'succeeded',
      simulated: true,
      proposed_sap_mapping: 'S/4HANA delivery confirmation change notice',
      error: null,
    },
  ],
};

const MOCK_FAILED_EXECUTION = {
  ...MOCK_COMPLETED_EXECUTION,
  execution_id: 'EXE-0002',
  status: 'failed',
  finished_at: '2026-10-26T10:00:02Z',
  error: { message: 'Bank rejected MT707 documentary credit amendment: discrepancy in expiry date' },
  steps: [
    {
      ...MOCK_COMPLETED_EXECUTION.steps[0],
      status: 'failed',
      error: { message: 'Bank rejected MT707 amendment' },
    },
  ],
};

test.describe('Simulated Execution Screen (D7, FB-12)', () => {
  test('renders empty state in fixture mode with D8 Workspace heading', async ({ page }) => {
    await page.goto('/#execution');

    // Page header
    await expect(page.getByRole('heading', { name: 'Simulated execution' })).toBeVisible();
    await expect(page.getByText('WORKSPACE / EXECUTION')).toBeVisible();

    // D8 Workspace heading
    const workspaceHeading = page.locator('ui5-title[level="H3"]').filter({ hasText: 'Workspace' });
    await expect(workspaceHeading).toBeVisible();

    // Empty state text
    await expect(
      page.getByText(/No execution record is included in the fixtures/)
    ).toBeVisible();

    // Launch list with plan cards
    await expect(page.locator('.execution-launch-list')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Load or start simulated execution' }).first()
    ).toBeVisible();

    // No WCAG AA accessibility violations in empty state
    await expectNoAccessibilityViolations(page);
  });

  test('redesigns execution around 4-step wizard with summary card, status icons, and timings (D7, FB-12)', async ({
    page,
  }) => {
    await page.goto('/#execution');

    // Load mock execution data via custom event
    await page.evaluate((mockData) => {
      window.dispatchEvent(new CustomEvent('load-demo-execution', { detail: mockData }));
    }, MOCK_COMPLETED_EXECUTION);

    // 1. Summary Card & D8 Headings
    const summaryCard = page.getByRole('region', { name: 'Execution summary' });
    await expect(summaryCard).toBeVisible();

    // D8 Headings: Workspace, Execution, Plan, Decision, Started
    await expect(summaryCard.locator('ui5-title[level="H3"]').filter({ hasText: 'Workspace' })).toBeVisible();
    await expect(summaryCard.locator('ui5-title[level="H4"]').filter({ hasText: 'Execution' })).toBeVisible();
    await expect(summaryCard.locator('ui5-title[level="H4"]').filter({ hasText: 'Plan' })).toBeVisible();
    await expect(summaryCard.locator('ui5-title[level="H4"]').filter({ hasText: 'Decision' })).toBeVisible();
    await expect(summaryCard.locator('ui5-title[level="H4"]').filter({ hasText: 'Started' })).toBeVisible();

    // Semibold values and mono IDs
    await expect(summaryCard.getByText('EXE-0001')).toBeVisible();
    await expect(summaryCard.getByText(/PLN-0002/)).toBeVisible();
    await expect(summaryCard.getByText('DEC-0001')).toBeVisible();

    // Timing badges
    await expect(summaryCard.locator('.ae-timing-badge')).toBeVisible();
    await expect(summaryCard.getByText('4.0s')).toBeVisible();

    // Status icon and tag
    await expect(summaryCard.locator('ui5-tag').filter({ hasText: 'completed' })).toBeVisible();

    // Recovery metrics & SAP mappings in summary card (FB-12)
    await expect(summaryCard.locator('ui5-title[level="H4"]').filter({ hasText: 'Recovery metrics' })).toBeVisible();
    await expect(summaryCard.getByText('Net avoided loss')).toBeVisible();
    await expect(summaryCard.getByText('₹6,18,000')).toBeVisible();
    await expect(summaryCard.getByText('Recovery cost')).toBeVisible();
    await expect(summaryCard.getByText('Residual loss')).toBeVisible();
    await expect(summaryCard.locator('ui5-title[level="H4"]').filter({ hasText: 'SAP mappings' })).toBeVisible();
    await expect(summaryCard.getByText('GTS (Trade Finance)')).toBeVisible();
    await expect(summaryCard.getByText('MM (Materials Management)')).toBeVisible();
    // 2. The 4-step ui5-wizard process flow (D7)
    const wizard = page.locator('ui5-wizard');
    await expect(wizard).toBeVisible();

    // Step 1: MT707 AMEND-2026-0019
    await expect(page.getByText('Step 1. MT707 AMEND-2026-0019')).toBeVisible();
    await expect(page.getByText(/SWIFT MT707 documentary credit amendment request/)).toBeVisible();
    await expect(page.locator('.ae-refs').filter({ hasText: 'AMEND-2026-0019' })).toBeVisible();
    await expect(page.getByText(/0.8s/)).toBeVisible();

    // Step 2: MM PO re-issue
    await expect(page.getByText('Step 2. MM PO re-issue')).toBeVisible();
    await expect(page.getByText(/SAP S\/4HANA Materials Management/)).toBeVisible();
    await expect(page.getByText(/1. REDUCE PO/)).toBeVisible();
    await expect(page.getByText(/2. CREATE PO/)).toBeVisible();
    await expect(page.getByText(/1.2s/)).toBeVisible();

    // Step 3: TM consignment + AIFTA Form AI
    await expect(page.getByText('Step 3. TM consignment + AIFTA Form AI')).toBeVisible();
    await expect(page.getByText(/preferential origin certification under the ASEAN-India/)).toBeVisible();
    await expect(page.getByText(/3. BOOK FREIGHT/)).toBeVisible();
    await expect(page.getByText(/1.4s/)).toBeVisible();

    // Step 4: SD ATP reallocation
    await expect(page.getByText('Step 4. SD ATP reallocation')).toBeVisible();
    await expect(page.getByText(/4. CREATE STOCK TRANSFER/)).toBeVisible();
    await expect(page.getByText(/5. RESERVE STOCK/)).toBeVisible();
    await expect(page.getByText(/6. NOTIFY CUSTOMER/)).toBeVisible();
    await expect(page.getByText(/0.6s/)).toBeVisible();

    // Proposed SAP mappings
    await expect(page.getByText(/SAP Global Trade Services/).first()).toBeVisible();
    await expect(page.getByText(/SAP Transportation Management/).first()).toBeVisible();

    // Preserved disclosure text
    await expect(page.getByText('Every row below is simulated. No SAP system was changed.')).toBeVisible();
    await expect(page.getByText('The API reports this simulated execution as completed.')).toBeVisible();

    // No accessibility violations on full simulated execution view
    await expectNoAccessibilityViolations(page);
  });

  test('displays failure state with negative indicator and skipped steps warning', async ({ page }) => {
    await page.goto('/#execution');

    // Load mock failed execution data
    await page.evaluate((mockData) => {
      window.dispatchEvent(new CustomEvent('load-demo-execution', { detail: mockData }));
    }, MOCK_FAILED_EXECUTION);

    // Negative tag / status
    await expect(page.locator('ui5-tag').filter({ hasText: 'failed' }).first()).toBeVisible();

    // Step 1 failed
    await expect(page.getByText('Step 1. MT707 AMEND-2026-0019')).toBeVisible();

    // Failure notice
    await expect(
      page.getByText('Execution failed. Later steps, if any, are skipped. No automatic retry or compensation is performed.')
    ).toBeVisible();

    // Accessibility check on failed state
    await expectNoAccessibilityViolations(page);
  });
});
