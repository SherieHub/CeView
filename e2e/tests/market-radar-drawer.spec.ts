import { test } from '@playwright/test';

// Drawer on /dashboard?market=<id> — docs/module-2/screens/market-radar-drawer.md
// Cards: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/03-module-2.md

test.describe.skip('Shell, Directive & Demand Chart', () => {
  test('clicking a rank card opens the drawer at ?market=<id> with the correct directive and chart', async ({ page }) => {
    test.fixme();
  });

  test('4WK/12WK toggle changes the chart\'s visible window', async ({ page }) => {
    test.fixme();
  });

  test('browser back closes the drawer', async ({ page }) => {
    test.fixme();
  });

  test('"Target this market" closes the drawer and navigates to /content', async ({ page }) => {
    test.fixme();
  });
});

test.describe.skip('Economic & Seasonal Insights Tabs', () => {
  test('switching Purchasing Power <-> Seasonal Patterns swaps content without resetting the chart timeframe', async ({ page }) => {
    test.fixme();
  });

  test('YoY ratio shows N/A below 59 weeks of history', async ({ page }) => {
    test.fixme();
  });
});
