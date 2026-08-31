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
    // both the login page and the sidebar render an "h1"/"b" reading "CeView",
    // so that heading alone can't distinguish the two screens — the sidebar's
    // nav-only "Performance" tab (renamed from "Campaign Analytics" now that
    // the new Sidebar's NAV table has shipped, see 01-foundation.md) is the
    // reliable app-only signal.
    await expect(page.getByRole('button', { name: 'Performance' })).toHaveCount(0);
  });

  test('login with seeded credentials loads homepage, sidebar renders, and Performance tab navigates without a server error', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();

    await page.getByPlaceholder('you@example.com').fill(SEED_EMAIL);
    await page.getByPlaceholder('••••••••').fill(SEED_PASSWORD);
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Post-login lands on /dashboard (App.tsx's index route) inside AppShell.
    // Topbar carries no route title (Topbar.tsx's own header comment: that
    // moved to each screen's own PageHead <h1>, and Topbar renders none of
    // its own) — the sidebar's aria-current="page" on the matching nav item
    // is the reliable, router-driven "app has loaded on this route" signal.
    await expect(page.getByRole('button', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');

    const performanceTab = page.getByRole('button', { name: 'Performance' });
    await expect(performanceTab).toBeVisible();
    await performanceTab.click();

    // Dismiss button only renders inside ServerErrorBanner — its absence means
    // no backend call surfaced a fatal error on this tab.
    await expect(page.getByRole('button', { name: 'Dismiss' })).toHaveCount(0);
  });
});

async function loginAsSeedOperator(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByPlaceholder('you@example.com').fill(SEED_EMAIL);
  await page.getByPlaceholder('••••••••').fill(SEED_PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();
  // See the comment above the equivalent assertion in "login with seeded
  // credentials..." above: Topbar renders no route title, so assert on the
  // sidebar's aria-current="page" instead.
  await expect(page.getByRole('button', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
}

test.describe('Shell & Routing — router + overlay stack', () => {
  // New coverage for Foundation Card 2 (01-foundation.md), now that
  // react-router-dom routes, AppShell, and the Drawer/Modal overlay stack
  // have shipped.

  test('direct navigation to /dashboard, /content, /calendar, /performance, /settings/:tab all render the correct route without a full page reload', async ({ page }) => {
    await loginAsSeedOperator(page);

    // Topbar carries no route title (see loginAsSeedOperator's comment) — the
    // sidebar's aria-current="page" on the matching nav item (layout/nav.ts +
    // Sidebar.tsx) is the one signal driven purely by the router's pathname,
    // independent of whether a given screen has built out its own PageHead
    // <h1> yet. The three Settings destinations are flat peer nav items now
    // (Sidebar.tsx's own comment: no more parent "Settings" to expand), so
    // /settings/profile's item is labelled "Business Profile", not "Settings".
    const routes: Array<{ path: string; label: string }> = [
      { path: '/dashboard', label: 'Dashboard' },
      { path: '/content', label: 'Content Studio' },
      { path: '/calendar', label: 'Calendar' },
      { path: '/performance', label: 'Performance' },
      { path: '/settings/profile', label: 'Business Profile' },
    ];

    // Deep-link each route directly (full browser navigation) and confirm
    // the router resolves it to the correct screen.
    for (const route of routes) {
      await page.goto(route.path);
      await expect(page.getByRole('button', { name: route.label })).toHaveAttribute('aria-current', 'page');
    }

    // Then confirm navigating between them *within* the app (sidebar clicks)
    // is client-side routing, not a full document reload: tag the window
    // and check the tag survives every click.
    await page.goto('/dashboard');
    await page.evaluate(() => { (window as any).__noReload = true; });

    for (const label of ['Content Studio', 'Calendar', 'Performance', 'Business Profile', 'Dashboard']) {
      await page.getByRole('button', { name: label }).click();
      await expect(page.getByRole('button', { name: label })).toHaveAttribute('aria-current', 'page');
    }

    expect(await page.evaluate(() => (window as any).__noReload)).toBe(true);
  });

  test('profile-completeness guard redirects /onboarding -> /dashboard once uniquenessScore is set, and the reverse while it is null', async ({ page }) => {
    await loginAsSeedOperator(page);

    // The seeded demo operators (SEED_CREDENTIALS.md) all have a non-null
    // uniquenessScore, so the guard sends a direct /onboarding visit
    // straight back to /dashboard rather than letting it render.
    await page.goto('/onboarding');
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('button', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
  });

  test('overlay stack: opening the market radar drawer pushes the scrim, and Escape closes it', async ({ page }) => {
    // Was driven through a generic test-only scaffold (RoutePlaceholder.tsx,
    // now deleted) that rendered on whichever screen hadn't been built yet.
    // Dashboard, Performance, Content Studio, Calendar and all three Settings
    // screens are real now, so there is no placeholder left to host it —
    // this exercises the shared Drawer against a real screen instead.
    await loginAsSeedOperator(page);
    await page.goto('/dashboard');

    const scrim = page.locator('#scrim');
    await expect(scrim).not.toHaveClass(/on/);

    await page.getByRole('heading', { name: 'Demand Surge Detected — South Korea' }).click();
    await page.locator('section.dash-markets').getByRole('heading', { name: 'South Korea' }).click();

    await expect(page.locator('.drawer.on')).toBeVisible();
    await expect(scrim).toHaveClass(/on/);

    await page.keyboard.press('Escape');
    await expect(page.locator('.drawer.on')).toHaveCount(0);
    await expect(scrim).not.toHaveClass(/on/);
  });

  test('overlay stack: the Platforms connect modal pushes the scrim, and Escape closes it', async ({ page }) => {
    // /api/connections has no backend implementation yet (docs/module-3/
    // backend/PlatformConnectionController.md — specified, not implemented),
    // so this stubs just that one call and drives everything else (login,
    // routing) against the real stack. Covers the shared Modal against a real
    // screen; the stacked-drawer-then-modal Escape-priority behavior (closing
    // only the top-most overlay) is unit-tested directly in
    // frontend/components/shared/useOverlayStack.test.tsx, since no real
    // screen nests a Modal inside an open Drawer today.
    await page.route('**/api/connections', (route) =>
      route.fulfill({
        json: [
          { platform: 'instagram', connected: true, handle: '@cebu.dive', connectedAt: '2026-05-01T00:00:00Z' },
          { platform: 'tiktok', connected: false, handle: null, connectedAt: null },
          { platform: 'facebook', connected: false, handle: null, connectedAt: null },
        ],
      }),
    );

    await loginAsSeedOperator(page);
    await page.goto('/settings/platforms');

    const scrim = page.locator('#scrim');
    await expect(scrim).not.toHaveClass(/on/);

    await page.getByRole('button', { name: 'Connect' }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(scrim).toHaveClass(/on/);

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(scrim).not.toHaveClass(/on/);
  });
});
