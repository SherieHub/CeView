import { test, expect, type Page } from '@playwright/test';
import { mockModule2Api } from './module2Fixtures';
import { requireBackend, SEED_OPERATOR } from './support/stack';

// Public routes and shell behavior can be checked without a live backend.
// Keep a separate full-stack smoke test for real password authentication.
const PROFILE = {
  businessProfileId: '00000000-0000-0000-0000-000000000001',
  businessName: 'E2E Resort', categories: ['Accommodation & Staycation'],
  coreServices: [], description: '', uvp: '', imagePreview: null, uniquenessScore: 0.82,
};

async function mockAuthenticatedShell(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('ceview.auth', JSON.stringify({
      accessToken: 'e2e-shell-token', profileCompleted: true, emailVerified: true,
    }));
  });
  await page.route('**/api/**', route => route.fulfill({ json: [] }));
  await page.route('**/api/business-profile', route => route.fulfill({ json: PROFILE }));
  await mockModule2Api(page);
}

const mainNav = (page: Page) => page.getByRole('navigation', { name: 'Main', exact: true });

test.describe('Shell & Routing - public routes', () => {
  test('unauthenticated visit to /login shows the login page, not the app', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Email', exact: true })).toBeVisible();
    await expect(mainNav(page)).toHaveCount(0);
  });

  test('unauthenticated visit to / shows the public landing page, not the login form', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'See traveler demand before the opportunity passes.' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toHaveCount(0);
    await page.getByRole('link', { name: 'Sign In', exact: true }).first().click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  });
});

test.describe('Shell & Routing - live backend', () => {
  test.beforeEach(async () => { await requireBackend(); });

  test('login with seeded credentials loads the dashboard and navigates to Performance', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    await page.getByRole('textbox', { name: 'Email', exact: true }).fill(SEED_OPERATOR.email);
    await page.getByLabel('Password', { exact: true }).fill(SEED_OPERATOR.password);
    const loginResponse = page.waitForResponse(response => response.url().endsWith('/api/auth/login') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    expect((await loginResponse).status()).toBe(200);
    await expect(mainNav(page).getByRole('button', { name: 'Dashboard', exact: true })).toHaveAttribute('aria-current', 'page');
    await mainNav(page).getByRole('button', { name: 'Performance', exact: true }).click();
    await expect(page).toHaveURL(/\/performance$/);
    await expect(page.getByRole('heading', { name: 'Log campaign performance' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Dismiss', exact: true })).toHaveCount(0);
  });
});

test.describe('Shell & Routing - router and overlay stack (mocked API)', () => {
  test.beforeEach(async ({ page }) => { await mockAuthenticatedShell(page); });

  test('deep links render each route and sidebar navigation avoids a full reload', async ({ page }) => {
    const routes = [
      { path: '/dashboard', label: 'Dashboard' },
      { path: '/content', label: 'Content Studio' },
      { path: '/calendar', label: 'Calendar' },
      { path: '/performance', label: 'Performance' },
      { path: '/settings/profile', label: 'Business Profile' },
      { path: '/settings/platforms', label: 'Platforms' },
      { path: '/settings/workspace', label: 'Workspace' },
    ];
    for (const route of routes) {
      await page.goto(route.path);
      await expect(mainNav(page).getByRole('button', { name: route.label, exact: true })).toHaveAttribute('aria-current', 'page');
    }
    await page.evaluate(() => { (window as any).__noReload = true; });
    for (const route of routes) {
      await mainNav(page).getByRole('button', { name: route.label, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`${route.path}$`));
      await expect(mainNav(page).getByRole('button', { name: route.label, exact: true })).toHaveAttribute('aria-current', 'page');
      expect(await page.evaluate(() => (window as any).__noReload)).toBe(true);
    }
  });

  test('profile guard redirects completed profiles to Dashboard and incomplete profiles to onboarding', async ({ page }) => {
    await page.goto('/onboarding');
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(mainNav(page).getByRole('button', { name: 'Dashboard', exact: true })).toHaveAttribute('aria-current', 'page');

    await page.route('**/api/business-profile', route => route.fulfill({ json: { ...PROFILE, uniquenessScore: null } }));
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/onboarding$/);
    await expect(mainNav(page)).toHaveCount(0);
  });

  test('market radar drawer pushes the scrim and Escape closes it', async ({ page }) => {
    await page.goto('/dashboard');
    const scrim = page.locator('#scrim');
    await expect(scrim).not.toHaveClass(/on/);
    await page.getByRole('button', { name: /Demand window \u2014 South Korea/ }).click();
    await page.getByLabel('Top International Market').getByRole('button', { name: /South Korea/ }).click();
    const drawer = page.getByRole('dialog', { name: /South Korea market radar/ });
    await expect(drawer).toBeVisible();
    await expect(scrim).toHaveClass(/on/);
    await page.keyboard.press('Escape');
    await expect(drawer).not.toBeVisible();
    await expect(scrim).not.toHaveClass(/on/);
  });

  test('Facebook Page picker pushes the scrim and Escape closes it', async ({ page }) => {
    // Connect now redirects to OAuth. Page selection is the actual in-app modal.
    await page.route('**/api/social-connections', route => route.fulfill({ json: [
      { platform: 'facebook', status: 'NEEDS_PAGE', configured: true },
      { platform: 'instagram', status: 'NEEDS_PAGE', configured: true },
      { platform: 'tiktok', status: 'DISCONNECTED', configured: false },
    ] }));
    await page.route('**/api/social-connections/meta/pages', route => route.fulfill({ json: [
      { id: 'cebu-page', name: 'Cebu Page', instagramUsername: 'cebu' },
    ] }));
    await page.goto('/settings/platforms');
    const scrim = page.locator('#scrim');
    await expect(scrim).not.toHaveClass(/on/);
    await page.getByRole('button', { name: 'Choose Page', exact: true }).first().click();
    const picker = page.getByRole('dialog', { name: 'Choose a Facebook Page' });
    await expect(picker).toBeVisible();
    await expect(picker.getByRole('radio', { name: /Cebu Page/ })).toBeVisible();
    await expect(scrim).toHaveClass(/on/);
    await page.keyboard.press('Escape');
    await expect(picker).not.toBeVisible();
    await expect(scrim).not.toHaveClass(/on/);
  });
});
