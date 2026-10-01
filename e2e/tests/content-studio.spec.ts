import { test } from '@playwright/test';

// Screen: /content — docs/module-3/screens/content-studio.md
// Cards: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/04-module-3.md
//
// Builds prototype v1 (screen-content/renderContent) only — v2/content2 is a
// superseded draft and is never exercised here.

test.describe.skip('AI Copywriting Matrix', () => {
  test('switching platform tabs shows that platform\'s own options (2 for Naver, 3 for the rest)', async ({ page }) => {
    test.fixme();
  });

  test('approving an option on Instagram does not affect Facebook\'s approval state', async ({ page }) => {
    test.fixme();
  });

  test('char counter turns red past the platform limit', async ({ page }) => {
    test.fixme();
  });
});

test.describe.skip('Visual Direction Board', () => {
  test('switching platform tabs swaps the shot-list content', async ({ page }) => {
    test.fixme();
  });
});

test.describe.skip('Publish Composer', () => {
  test('a disconnected platform cannot be added to Publish to without completing Connect first', async ({ page }) => {
    test.fixme();
  });

  test('publish button tooltip matches the first unmet reason in priority order', async ({ page }) => {
    test.fixme();
  });
});

test.describe.skip('Compliance Audit Panel', () => {
  test('ticking the agreement with caption + media staged runs the full 6-step audit animation', async ({ page }) => {
    test.fixme();
  });

  test('pass/fail result matches fixture OMCS data and colors the gauge accordingly', async ({ page }) => {
    test.fixme();
  });
});

test.describe.skip('Content Board & Publish Action', () => {
  test('publishing to 2 platforms adds 2 posts to the board immediately under "Published"', async ({ page }) => {
    test.fixme();
  });

  test('All/Draft/Published filter tabs show the correct subset', async ({ page }) => {
    test.fixme();
  });
});
