import type { Page } from '@playwright/test';
import { requireBackend, requireTestSupport } from '../support/stack';
import { test, expect, useOperator } from '../support/fixtures';
import { provisionOperator } from '../support/operator';
import { seedDemandWindow } from '../support/demandWindow';
import { alertCard, marketsPanel, openDashboard, openRadar, radarDrawer } from '../support/dashboard';
import { expectNoJunk } from '../support/ai';
import { expectNoHorizontalOverflow, expectScrimOff, scrim } from '../support/ui';

// The market radar drawer, opened from a ranked market, the Top-market tile or ?market=<id>.
const op = useOperator('dash-radar', { demandWindow: true });

test.beforeEach(async () => {
  await requireBackend();
  await requireTestSupport();
});

const kr = (page: Page) => radarDrawer(page, 'South Korea');
const tab = (page: Page, name: string) => page.getByRole('tab', { name });

test.describe('Opening and closing', () => {
  test('a ranked-market card opens the drawer for that market', async ({ page }) => {
    await openDashboard(page, op.current);
    await alertCard(page).click();
    await marketsPanel(page).locator('.rank-card').first().click();
    await expect(page).toHaveURL(/\/dashboard\?market=korea$/);
    await expect(kr(page)).toBeVisible();
    await expect(scrim(page)).toHaveClass(/\bon\b/);
  });

  // KNOWN BUG: the dashboard only loads ranked markets once an alert is selected or a category is
  // pinned, and the drawer looks the market up in that list — so a bare /dashboard?market=korea
  // (a shared or reloaded link) renders no drawer at all.
  test.fail('a ?market= deep link opens it on load', async ({ page }) => {
    await openDashboard(page, op.current, '?market=korea');
    await expect(kr(page)).toBeVisible();
  });

  test('a reload with ?market= in the URL keeps the market in the address bar', async ({ page }) => {
    await openRadar(page, op.current, 'South Korea');
    await page.reload();
    await expect(page).toHaveURL(/\/dashboard\?market=korea$/);
  });

  test('an unknown market id leaves the drawer closed', async ({ page }) => {
    await openDashboard(page, op.current, '?market=narnia');
    await expect(page.locator('.drawer[data-open="true"]')).toHaveCount(0);
  });

  test('Escape closes it, clears ?market= and turns the scrim off', async ({ page }) => {
    await openRadar(page, op.current, 'South Korea');
    await expect(kr(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.locator('.drawer[data-open="true"]')).toHaveCount(0);
    await expectScrimOff(page);
  });

  test('the Close button closes it', async ({ page }) => {
    await openRadar(page, op.current, 'South Korea');
    await kr(page).getByRole('button', { name: 'Close' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expectScrimOff(page);
  });

  test('clicking the scrim closes it', async ({ page }) => {
    await openRadar(page, op.current, 'South Korea');
    await scrim(page).click({ position: { x: 5, y: 300 } });
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('browser Back closes it, and Forward reopens it', async ({ page }) => {
    await openDashboard(page, op.current);
    await alertCard(page).click();
    await marketsPanel(page).locator('.rank-card').first().click();
    await expect(kr(page)).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.locator('.drawer[data-open="true"]')).toHaveCount(0);
    await page.goForward();
    await expect(kr(page)).toBeVisible();
  });

  test('can be reopened after closing', async ({ page }) => {
    await openRadar(page, op.current, 'South Korea');
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(/\/dashboard$/);
    await marketsPanel(page).locator('.rank-card').first().click();
    await expect(kr(page)).toBeVisible();
  });
});

test.describe('Header and switching market', () => {
  test('shows rank, name, city, distance, flight time and route', async ({ page }) => {
    await openRadar(page, op.current, 'South Korea');
    const d = kr(page);
    await expect(d.locator('.radar-head .rank-no')).toHaveText('1');
    await expect(d.getByRole('heading', { name: 'South Korea' })).toBeVisible();
    await expect(d.locator('.radar-head-top .text-meta')).toContainText(/Seoul · [\d,]+ km · .*direct/);
    await expect(d.locator('.radar-route')).toContainText('ICN');
    await expect(d.locator('.radar-route')).toContainText('CEB');
  });

  test('the switcher lists the three markets with the current one pressed', async ({ page }) => {
    await openRadar(page, op.current, 'South Korea');
    const group = kr(page).getByRole('group', { name: 'Switch market' });
    await expect(group.getByRole('button')).toHaveCount(3);
    await expect(group.getByRole('button', { name: 'South Korea' })).toHaveAttribute('aria-pressed', 'true');
    await expect(group.getByRole('button', { name: 'Japan' })).toHaveAttribute('aria-pressed', 'false');
  });

  test('choosing another market swaps the drawer and the URL, and resets the tabs', async ({ page }) => {
    await openRadar(page, op.current, 'South Korea');
    await page.getByRole('button', { name: '12WK' }).click();
    await tab(page, 'Seasonal Patterns').click();
    await kr(page).getByRole('group', { name: 'Switch market' }).getByRole('button', { name: 'Japan' }).click();
    await expect(page).toHaveURL(/\?market=japan$/);
    const jp = radarDrawer(page, 'Japan');
    await expect(jp).toBeVisible();
    await expect(jp.getByRole('heading', { name: 'Japan' })).toBeVisible();
    await expect(jp.getByRole('button', { name: '4WK' })).toHaveAttribute('aria-pressed', 'true');
    await expect(jp.getByRole('tab', { name: 'Purchasing Power' })).toHaveAttribute('aria-selected', 'true');
  });
});

test.describe('Planning signals and forecast', () => {
  test('a warning-level window says "Active demand window" with the uplift', async ({ page }) => {
    await openRadar(page, op.current, 'South Korea');
    await expect(kr(page).getByText('Active demand window')).toBeVisible();
    await expect(kr(page).getByText('The 4-week forecast is 38.0% above its rolling baseline.')).toBeVisible();
  });

  test('a market with no window says "No active surge"', async ({ page }) => {
    await openRadar(page, op.current, 'Japan');
    await expect(radarDrawer(page, 'Japan').getByText('No active surge')).toBeVisible();
  });

  test('a critical window says "Surge confirmed" with the year-on-year ratio', async ({ page }) => {
    const own = await provisionOperator('dash-radar-crit');
    await seedDemandWindow(own, { level: 'CRITICAL', market: 'korea', yoyRatio: 1.3, upliftPct: 55 });
    await openRadar(page, own, 'South Korea');
    await expect(kr(page).getByText('Surge confirmed')).toBeVisible();
    await expect(kr(page).getByText('year-on-year comparison (ratio 1.30)')).toBeVisible();
  });

  test('the strategic directive is shown', async ({ page }) => {
    await openRadar(page, op.current, 'South Korea');
    await expect(kr(page).getByText('Strategic directive')).toBeVisible();
    await expect(kr(page).getByText(/South Korea has a 38\.0% forecast uplift above its rolling baseline/)).toBeVisible();
  });

  test('the forecast chart renders with Observed and Forecast series and the zone key', async ({ page }) => {
    await openRadar(page, op.current, 'South Korea');
    const chart = kr(page).locator('.radar-forecast');
    await expect(chart.getByRole('heading', { name: 'Demand Forecast' })).toBeVisible();
    await expect(chart.locator('.recharts-wrapper')).toBeVisible();
    await expect(chart.locator('.recharts-legend-wrapper')).toContainText('Observed');
    await expect(chart.locator('.recharts-legend-wrapper')).toContainText('Forecast');
    await expect(kr(page).locator('.zone-key li')).toHaveCount(3);
    await expect(kr(page).locator('.zone-key')).toContainText('Raise rates early');
  });

  test('the 4WK / 12WK switch changes the pressed state', async ({ page }) => {
    await openRadar(page, op.current, 'South Korea');
    const seg = kr(page).getByRole('group', { name: 'Forecast timeframe' });
    await expect(seg.getByRole('button', { name: '4WK' })).toHaveAttribute('aria-pressed', 'true');
    await seg.getByRole('button', { name: '12WK' }).click();
    await expect(seg.getByRole('button', { name: '12WK' })).toHaveAttribute('aria-pressed', 'true');
    await expect(seg.getByRole('button', { name: '4WK' })).toHaveAttribute('aria-pressed', 'false');
    await expect(kr(page).locator('.recharts-wrapper').first()).toBeVisible();
  });

  test('names the forecast engine', async ({ page }) => {
    await openRadar(page, op.current, 'South Korea');
    await expect(kr(page).locator('.radar-engine')).toContainText('Forecast engine:');
  });
});

test.describe('Market insights', () => {
  test('Purchasing Power is the default tab and shows the four tiles', async ({ page }) => {
    await openRadar(page, op.current, 'South Korea');
    await expect(tab(page, 'Purchasing Power')).toHaveAttribute('aria-selected', 'true');
    const panel = kr(page).locator('#radar-panel-economy');
    await expect(panel).toBeVisible();
    for (const label of ['GDP growth', 'Avg flight price', 'Accessibility']) {
      await expect(panel.locator('.stat-label', { hasText: label })).toBeVisible();
    }
    await expect(panel.locator('.stat-tile').filter({ hasText: 'GDP growth' })).toContainText('2.10%');
    await expect(panel.locator('.stat-tile').filter({ hasText: 'Accessibility' })).toContainText(/\d+\/10/);
    await expect(panel.locator('.stat-tile').filter({ hasText: 'Avg flight price' })).toContainText(/₱[\d,]+ – ₱[\d,]+/);
    await expect(kr(page).locator('#radar-panel-season')).toBeHidden();
    await expectNoJunk(panel);
  });

  test('shows currency and GDP trend sparklines labelled with their length', async ({ page }) => {
    await openRadar(page, op.current, 'South Korea');
    const panel = kr(page).locator('#radar-panel-economy');
    await expect(panel.locator('.radar-trends .eyebrow').first()).toContainText(/· \d+ months?/);
    await expect(panel.locator('.radar-trends .eyebrow').nth(1)).toContainText(/GDP growth · \d+ years?/);
  });

  test('Seasonal Patterns shows seasonality, "N/A" year-on-year when there is no prior year, and peak months', async ({ page }) => {
    await openRadar(page, op.current, 'South Korea');
    await tab(page, 'Seasonal Patterns').click();
    await expect(tab(page, 'Seasonal Patterns')).toHaveAttribute('aria-selected', 'true');
    const panel = kr(page).locator('#radar-panel-season');
    await expect(panel).toBeVisible();
    await expect(kr(page).locator('#radar-panel-economy')).toBeHidden();
    await expect(panel.locator('.stat-tile').filter({ hasText: 'Seasonality' }).locator('.stat-value')).toHaveText('0.60');
    await expect(panel.locator('.stat-tile').filter({ hasText: 'Seasonality' })).toContainText('Weak — emerging');
    await expect(panel.locator('.stat-tile').filter({ hasText: 'Year on year' }).locator('.stat-value')).toHaveText('N/A');
    await expect(panel).toContainText('Under 59 weeks of history — not yet comparable');
    await expect(panel).toContainText('Route reference data — not enough demand history yet to derive');
    await expect(panel.locator('.month-grid li')).toHaveCount(12);
    await expect(panel).toContainText(/Seasonality index · \d+ weeks?/);
    await expect(panel).toContainText('Shown for measured weeks only — not projected into the forecast.');
  });

  test('Seasonal Patterns shows a numeric year-on-year ratio when one exists', async ({ page }) => {
    const own = await provisionOperator('dash-radar-yoy');
    await seedDemandWindow(own, { market: 'korea', yoyRatio: 1.3 });
    await openRadar(page, own, 'South Korea');
    await tab(page, 'Seasonal Patterns').click();
    const yoy = kr(page).locator('#radar-panel-season .stat-tile').filter({ hasText: 'Year on year' });
    await expect(yoy.locator('.stat-value')).toHaveText('1.30');
    await expect(yoy).toContainText('Pattern repeated last year');
  });

  test('a year-on-year ratio under 1 reads "Softer than last year"', async ({ page }) => {
    const own = await provisionOperator('dash-radar-yoy-soft');
    await seedDemandWindow(own, { market: 'korea', yoyRatio: 0.8 });
    await openRadar(page, own, 'South Korea');
    await tab(page, 'Seasonal Patterns').click();
    await expect(kr(page).locator('#radar-panel-season')).toContainText('Softer than last year');
  });

  test('Route & Carriers lists the airlines with direct/via chips and the fare source', async ({ page }) => {
    await openRadar(page, op.current, 'South Korea');
    const routes = kr(page).getByRole('region', { name: 'Route and carriers' });
    await expect(routes).toContainText('Route & Carriers');
    await expect(routes.locator('.carrier-list li').first()).toContainText('Direct');
    await expect(routes).toContainText('Route & fare figures:');
    expect(await routes.locator('.carrier-list li').count()).toBeGreaterThan(0);
  });
});

test.describe('Target this market', () => {
  test('closes the drawer and opens Content Studio', async ({ page }) => {
    await openRadar(page, op.current, 'South Korea');
    await kr(page).getByRole('button', { name: /Target this market/ }).click();
    await expect(page).toHaveURL(/\/content$/);
    await expect(page.getByRole('navigation', { name: 'Main', exact: true }).getByRole('button', { name: 'Content Studio' })).toHaveAttribute('aria-current', 'page');
    await expectScrimOff(page);
  });
});

test.describe('Phone layout', () => {
  test('@mobile the drawer fills the width, can be closed, and the page does not scroll sideways', async ({ page }) => {
    await openRadar(page, op.current, 'South Korea');
    const box = await kr(page).boundingBox();
    const viewport = page.viewportSize()!;
    expect(box!.width).toBeGreaterThanOrEqual(viewport.width * 0.9);
    await expectNoHorizontalOverflow(page);
    await kr(page).getByRole('button', { name: 'Close' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});
