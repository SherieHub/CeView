import { test } from '@playwright/test';

// Screen: /settings/profile — docs/module-1/screens/settings-business-profile.md
// Card: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/02-module-1.md
//   ("Settings: Business Profile")

test.describe.skip('Business Profile', () => {
  test('editing a field and clicking Save persists via apiClient.saveProfile and re-syncs the sidebar identity', async ({ page }) => {
    test.fixme();
  });

  test('removing the last remaining category is blocked with a toast', async ({ page }) => {
    test.fixme();
  });
});
