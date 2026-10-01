import { test } from '@playwright/test';

// Screen: /performance — docs/module-4/screens/performance.md
// Cards: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/05-module-4.md

test.describe.skip('Ingestion Form Entry State', () => {
  test('no campaign submitted shows only the 7-field ingestion form', async ({ page }) => {
    test.fixme();
  });

  test('submitting valid values transitions to the full analytics view', async ({ page }) => {
    test.fixme();
  });

  test('"New submission" clears the campaign and returns to the form', async ({ page }) => {
    test.fixme();
  });
});

test.describe.skip('KPI Cards, PES Gauge & Funnel', () => {
  test('a zero-denominator metric (e.g. adSpend: 0) shows the flagged-metric banner naming it', async ({ page }) => {
    test.fixme();
  });

  test('PES still renders a value in [0, 1] when a metric is flagged', async ({ page }) => {
    test.fixme();
  });
});

test.describe.skip('Trend Charts & AI Action Plan', () => {
  test('toggling 4/8 weeks updates both trend charts consistently', async ({ page }) => {
    test.fixme();
  });

  test('the 3 funnel diagnostics render in Weakest -> Moderate -> Alright order, not raw drop-size order', async ({ page }) => {
    test.fixme();
  });
});

test.describe.skip('Previously Published & Post Analytics Modal', () => {
  test('clicking a published post opens its analytics modal with the correct fixture data', async ({ page }) => {
    test.fixme();
  });

  test('a zero-reach post shows the "No data yet" empty state', async ({ page }) => {
    test.fixme();
  });

  test('platform filter tabs (All/TikTok/Instagram/Facebook) show the correct subset', async ({ page }) => {
    test.fixme();
  });
});
