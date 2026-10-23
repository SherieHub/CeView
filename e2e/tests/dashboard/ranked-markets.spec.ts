import { requireBackend, requireTestSupport } from '../support/stack';
import { test, expect, useOperator } from '../support/fixtures';
import { alertCard, marketsPanel, openDashboard, radarDrawer } from '../support/dashboard';
import { expectNoJunk } from '../support/ai';

// "Top International Market" — the markets ranked for the selected alert's category.
const op = useOperator('dash-ranked', { demandWindow: true });

test.beforeEach(async () => {
  await requireBackend();
  await requireTestSupport();
});

test.describe('Top International Market', () => {
  test('asks for an alert before showing any ranking', async ({ page }) => {
    await openDashboard(page, op.current);
    await expect(marketsPanel(page).getByRole('heading', { name: 'Top International Market' })).toBeVisible();
    await expect(marketsPanel(page).locator('.markets-note')).toHaveText('Based on your selected alert');
    await expect(marketsPanel(page).getByText('Select a surge alert')).toBeVisible();
    await expect(marketsPanel(page).locator('.rank-card')).toHaveCount(0);
  });

  test('lists the three markets in rank order with scores out of 100', async ({ page }) => {
    await openDashboard(page, op.current);
    await alertCard(page).click();
    const cards = marketsPanel(page).locator('.rank-card');
    await expect(cards).toHaveCount(3);
    await expect(cards.locator('h3')).toHaveText(['South Korea', 'Japan', 'United States']);
    await expect(cards.locator('.rank-no')).toHaveText(['1', '2', '3']);
    await expect(cards.nth(0).locator('.rank-pts')).toContainText('82');
    await expect(cards.nth(0)).toHaveAttribute('data-lead', 'true');
    await expect(cards.nth(1)).toHaveAttribute('data-lead', 'false');
    await expectNoJunk(marketsPanel(page));
  });

  test('every score is a whole number between 0 and 100', async ({ page }) => {
    await openDashboard(page, op.current);
    await alertCard(page).click();
    const scores = await marketsPanel(page).locator('.rank-pts').allInnerTexts();
    for (const s of scores) {
      const match = s.match(/^\s*(\d+)(?!\.)/);
      expect(match, `score text "${s}"`).not.toBeNull();
      const n = Number(match![1]);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(100);
    }
  });

  test('only the market with the active demand window is marked "Surge active"', async ({ page }) => {
    await openDashboard(page, op.current);
    await alertCard(page).click();
    const cards = marketsPanel(page).locator('.rank-card');
    await expect(cards.nth(0)).toContainText('Surge active');
    await expect(cards.nth(1)).not.toContainText('Surge active');
    await expect(cards.nth(2)).not.toContainText('Surge active');
  });

  test('each card carries its city and distance as a tooltip', async ({ page }) => {
    await openDashboard(page, op.current);
    await alertCard(page).click();
    await expect(marketsPanel(page).locator('.rank-card').nth(0)).toHaveAttribute('title', /^Seoul · [\d,]+ km to Cebu$/);
  });

  test('clicking a card opens that market\'s radar and sets ?market=', async ({ page }) => {
    await openDashboard(page, op.current);
    await alertCard(page).click();
    await marketsPanel(page).locator('.rank-card', { hasText: 'Japan' }).click();
    await expect(page).toHaveURL(/\/dashboard\?market=japan$/);
    await expect(radarDrawer(page, 'Japan')).toBeVisible();
  });

  test('collapsing the alert returns the panel to its placeholder', async ({ page }) => {
    await openDashboard(page, op.current);
    await alertCard(page).click();
    await alertCard(page).click();
    await expect(marketsPanel(page).getByText('Select a surge alert')).toBeVisible();
  });
});
