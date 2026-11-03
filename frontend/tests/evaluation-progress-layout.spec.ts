import { test, expect, type Page } from '@playwright/test';

async function openProgress(page: Page, width: number, height = 900): Promise<void> {
  await page.setViewportSize({ width, height });
  await page.goto('/#evaluation-progress');
  await expect(page.locator('.ae-progress-step').first()).toBeVisible();
}

test.describe('Evaluation progress step cards layout', () => {
  for (const width of [1440, 1880]) {
    test(`each step card is wider than 60% of its container at ${width}px`, async ({ page }) => {
      await openProgress(page, width);
      const cards = page.locator('.ae-progress-step');
      const count = await cards.count();
      expect(count).toBeGreaterThan(0);
      for (let i = 0; i < count; i++) {
        const card = cards.nth(i);
        const ratio = await card.evaluate((el) => {
          const container = el.parentElement as HTMLElement;
          return el.getBoundingClientRect().width / container.getBoundingClientRect().width;
        });
        expect(ratio, `step card ${i + 1} width ratio`).toBeGreaterThan(0.6);

        // The ui5-card host can be full width while its content squeezes into
        // one grid track, so also measure the content body and the title.
        const content = await card.evaluate((el) => {
          const container = el.parentElement as HTMLElement;
          const cw = container.getBoundingClientRect().width;
          const body = el.querySelector<HTMLElement>('.ae-card-body');
          const title = el.querySelector<HTMLElement>('.ae-step-main h2');
          const lh = title ? parseFloat(getComputedStyle(title).lineHeight) || parseFloat(getComputedStyle(title).fontSize) * 1.2 : 0;
          return {
            bodyRatio: body ? body.getBoundingClientRect().width / cw : 0,
            titleRatio: title ? title.getBoundingClientRect().width / cw : 0,
            titleLines: title && lh ? Math.round(title.getBoundingClientRect().height / lh) : 0,
          };
        });
        expect(content.bodyRatio, `step card ${i + 1} content body width ratio`).toBeGreaterThan(0.6);
        expect(content.titleRatio, `step card ${i + 1} title width ratio`).toBeGreaterThan(0.2);
        expect(content.titleLines, `step card ${i + 1} title should stay on one line`).toBe(1);
      }
    });
  }

  for (const width of [390, 1024, 1440, 1880]) {
    test(`no text inside a step card is clipped at ${width}px`, async ({ page }) => {
      await openProgress(page, width);
      const cards = page.locator('.ae-progress-step');
      const count = await cards.count();
      for (let i = 0; i < count; i++) {
        const problems = await cards.nth(i).evaluate((card) => {
          const cardRect = card.getBoundingClientRect();
          const out: string[] = [];
          const nodes = card.querySelectorAll<HTMLElement>('h2, p, time, ui5-tag, .ae-step-main');
          nodes.forEach((el) => {
            const r = el.getBoundingClientRect();
            if (r.right > cardRect.right + 1 || r.left < cardRect.left - 1) out.push(`outside card: ${el.tagName}`);
            if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow !== 'visible') {
              out.push(`overflowing: ${el.tagName}`);
            }
          });
          return out;
        });
        expect(problems, `step card ${i + 1}`).toEqual([]);
      }
      const overflowsPage = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      expect(overflowsPage).toBe(false);
    });
  }
});
