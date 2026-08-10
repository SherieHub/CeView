import { test } from '@playwright/test';

// Screen: /settings/platforms — docs/module-3/screens/settings-platforms.md
// Card: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/04-module-3.md
//   ("Settings: Platforms")

test.describe.skip('Platforms', () => {
  test('connecting a platform immediately unlocks it in Content Studio\'s picker without a reload', async ({ page }) => {
    test.fixme();
  });

  test('disconnecting a platform selected mid-publish removes it from Content Studio\'s selection', async ({ page }) => {
    test.fixme();
  });

  test('connect flow: redirecting spinner -> scope-grant list -> Grant scope -> connected toast', async ({ page }) => {
    test.fixme();
  });
});
