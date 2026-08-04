import { test, expect } from '@playwright/test';

// Full-stack smoke test — exercises frontend -> Spring Boot -> FastAPI wiring
// end to end against the real docker-compose stack (see RUNNING.md / the CI
// e2e workflow). Pattern to copy: navigate, wait for a real UI element that
// only appears once data has loaded, and assert no server error banner shows.
//
// The whole app is now gated behind login (AuthGate -> LoginPage), so every
// authenticated flow has to log in first. Credentials below are one of the 9
// seeded demo operator accounts documented in
// backend/spring-boot/src/main/resources/db/migration/SEED_CREDENTIALS.md
// (seed/demo only, never used in production — safe to hardcode here).
const SEED_EMAIL = 'ramon.delacruz@ceview.local';
const SEED_PASSWORD = 'MoalboalDive2024!';

test('unauthenticated visit shows the login page, not the app', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
  await expect(page.getByPlaceholder('you@example.com')).toBeVisible();

  // The main app shell (sidebar nav) must not be reachable pre-login. Note:
  // both the login page and the sidebar render an "h1" reading "CeView", so
  // that heading alone can't distinguish the two screens — the sidebar's
  // nav-only "Campaign Analytics" tab is the reliable app-only signal.
  await expect(page.getByRole('button', { name: 'Campaign Analytics' })).toHaveCount(0);
});

test('login with seeded credentials loads homepage, sidebar renders, and Campaign Analytics tab navigates without a server error', async ({ page }) => {
  await page.goto('/');

  // Confirm the login page renders first.
  await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();

  await page.getByPlaceholder('you@example.com').fill(SEED_EMAIL);
  await page.getByPlaceholder('••••••••').fill(SEED_PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();

  await expect(page.getByRole('heading', { name: /CeView/i })).toBeVisible();

  const campaignAnalyticsTab = page.getByRole('button', { name: 'Campaign Analytics' });
  await expect(campaignAnalyticsTab).toBeVisible();
  await campaignAnalyticsTab.click();

  // Dismiss button only renders inside ServerErrorBanner — its absence means
  // no backend call surfaced a fatal error on this tab.
  await expect(page.getByRole('button', { name: 'Dismiss' })).toHaveCount(0);
});
