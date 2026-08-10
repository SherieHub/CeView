import { test, expect } from '@playwright/test';

// Owned by Foundation — Shell & Routing
// (docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/01-foundation.md)
//
// Full-stack test — exercises frontend -> Spring Boot -> FastAPI wiring end to
// end against the real docker-compose stack (see RUNNING.md / the CI e2e
// workflow). Pattern to copy: navigate, wait for a real UI element that only
// appears once data has loaded, and assert no server error banner shows.
//
// The whole app is gated behind login (AuthGate -> LoginPage), so every
// authenticated flow has to log in first. Credentials below are one of the 9
// seeded demo operator accounts documented in
// backend/spring-boot/src/main/resources/db/migration/SEED_CREDENTIALS.md
// (seed/demo only, never used in production — safe to hardcode here).
const SEED_EMAIL = 'ramon.delacruz@ceview.local';
const SEED_PASSWORD = 'MoalboalDive2024!';

// These two tests are carried over unchanged from the old smoke.spec.ts and
// pass against the app as it stands today — they exercise Login/AuthGate,
// which the Foundation — Shell & Routing card does not remove, only sits
// behind a router. They are the pre-existing baseline this file preserves,
// not new work for that card.
test.describe('Shell & Routing — existing coverage', () => {
  test('unauthenticated visit shows the login page, not the app', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
    await expect(page.getByPlaceholder('you@example.com')).toBeVisible();

    // The main app shell (sidebar nav) must not be reachable pre-login. Note:
    // both the login page and the sidebar render an "h1" reading "CeView", so
    // that heading alone can't distinguish the two screens — the sidebar's
    // nav-only "Campaign Analytics" tab is the reliable app-only signal.
    // TODO(Foundation — Shell & Routing, card 2): once the new Sidebar's NAV
    // table ships, this tab is renamed "Performance" (see 01-foundation.md) —
    // update this assertion in the same PR that ships the new Sidebar, not
    // before, so this check never goes stale relative to what's deployed.
    await expect(page.getByRole('button', { name: 'Campaign Analytics' })).toHaveCount(0);
  });

  test('login with seeded credentials loads homepage, sidebar renders, and Campaign Analytics tab navigates without a server error', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();

    await page.getByPlaceholder('you@example.com').fill(SEED_EMAIL);
    await page.getByPlaceholder('••••••••').fill(SEED_PASSWORD);
    await page.getByRole('button', { name: 'Sign In' }).click();

    await expect(page.getByRole('heading', { name: /CeView/i })).toBeVisible();

    // TODO(Foundation — Shell & Routing, card 2): rename to the new "Performance"
    // tab / route (`/performance`) in the same PR that ships the new Sidebar.
    const campaignAnalyticsTab = page.getByRole('button', { name: 'Campaign Analytics' });
    await expect(campaignAnalyticsTab).toBeVisible();
    await campaignAnalyticsTab.click();

    // Dismiss button only renders inside ServerErrorBanner — its absence means
    // no backend call surfaced a fatal error on this tab.
    await expect(page.getByRole('button', { name: 'Dismiss' })).toHaveCount(0);
  });
});

test.describe.skip('Shell & Routing — router + overlay stack', () => {
  // New coverage for Foundation Card 2 (01-foundation.md). Un-skip and fill
  // in once react-router-dom routes, AppShell, and the Drawer/Modal overlay
  // stack ship. Written as placeholders now so the file's final shape is
  // visible before the card starts.

  test('direct navigation to /dashboard, /content, /calendar, /performance, /settings/:tab all render the correct route without a full page reload', async ({ page }) => {
    test.fixme();
  });

  test('profile-completeness guard redirects /onboarding -> /dashboard once uniquenessScore is set, and the reverse while it is null', async ({ page }) => {
    test.fixme();
  });

  test('overlay stack: opening a drawer then a modal over it closes only the modal on first Escape, and the scrim stays visible until both are closed', async ({ page }) => {
    test.fixme();
  });
});
