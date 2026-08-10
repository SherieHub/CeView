import { test } from '@playwright/test';

// Screen: /dashboard — docs/module-2/screens/dashboard.md
// Cards: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/03-module-2.md

test.describe.skip('Alert Feed & Category Filtering', () => {
  test('only alerts matching the operator\'s own categories render', async ({ page }) => {
    test.fixme();
  });

  test('clicking an alert marks it read (unread dot disappears)', async ({ page }) => {
    test.fixme();
  });
});

test.describe.skip('Markets Reveal', () => {
  test('selecting two alerts of different categories produces different market rankings', async ({ page }) => {
    test.fixme();
  });

  test('deselecting the selected alert collapses back to single-column', async ({ page }) => {
    test.fixme();
  });

  test('clicking a rank card opens the Market Radar drawer for that market', async ({ page }) => {
    test.fixme();
  });
});

test.describe.skip('States & Refresh Forecast', () => {
  test('loading state shows 3 skeleton cards', async ({ page }) => {
    test.fixme();
  });

  test('empty state (no forecast run yet) shows "No notifications yet"', async ({ page }) => {
    test.fixme();
  });

  test('zero matching alerts shows the category-naming empty state', async ({ page }) => {
    test.fixme();
  });

  test('ai-down state shows the amber banner and alerts still render from cache', async ({ page }) => {
    test.fixme();
  });

  test('Refresh forecast disables the button, shows a spinner label, and shows a toast on completion', async ({ page }) => {
    test.fixme();
  });
});
