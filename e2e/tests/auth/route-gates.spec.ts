import { requireBackend } from '../support/stack';
import { test, expect, useOperator } from '../support/fixtures';
import { provisionOperator, signIn } from '../support/operator';

// The layered route guards in App.tsx, outermost first: RedirectIfAuthenticated → AuthGate →
// EmailVerificationGate → ProfileCompletionGate → ProfileGate → AppShell.
const APP_ROUTES = [
  '/dashboard',
  '/content',
  '/calendar',
  '/performance',
  '/settings/profile',
  '/settings/platforms',
  '/settings/workspace',
];
const GATED_ROUTES = [...APP_ROUTES, '/onboarding', '/complete-profile'];

const onboarded = useOperator('route-gates', { demandWindow: true });

test.beforeEach(async () => {
  await requireBackend();
});

test.describe('Signed out', () => {
  for (const route of [...GATED_ROUTES, '/verify-email', '/no-such-page']) {
    test(`${route} redirects to /login`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/\/login$/);
      await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    });
  }

  test('the public pages stay open', async ({ page }) => {
    for (const [route, heading] of [
      ['/', /traveler demand/i],
      ['/terms', /terms/i],
      ['/privacy', /privacy/i],
      ['/login', /welcome back/i],
      ['/forgot-password', /reset your password/i],
    ] as const) {
      await page.goto(route);
      await expect(page, route).toHaveURL(new RegExp(`${route === '/' ? '/$' : route}$`));
      await expect(page.getByRole('heading', { name: heading }).first(), route).toBeVisible();
    }
  });
});

test.describe('Signed in, email not verified', () => {
  for (const route of [...GATED_ROUTES, '/no-such-page']) {
    test(`${route} redirects to /verify-email`, async ({ page }) => {
      const op = await provisionOperator('rg-unverified', { stage: 'unverified' });
      await signIn(page, op, route, { emailVerified: false });
      await expect(page).toHaveURL(/\/verify-email$/);
    });
  }

  test('a session stored without the verified flag is corrected by the first rejected request', async ({ page }) => {
    const op = await provisionOperator('rg-unknown-flag', { stage: 'unverified' });
    // Sessions saved before email verification shipped have no emailVerified key at all.
    await signIn(page, op, '/dashboard', { emailVerified: undefined });
    await expect(page).toHaveURL(/\/verify-email$/, { timeout: 30_000 });
    const stored = JSON.parse((await page.evaluate(() => localStorage.getItem('ceview.auth')))!);
    expect(stored.emailVerified).toBe(false);
  });
});

test.describe('Signed in, verified, no business profile yet', () => {
  for (const route of [...APP_ROUTES, '/complete-profile', '/no-such-page']) {
    test(`${route} redirects to /onboarding`, async ({ page }) => {
      const op = await provisionOperator('rg-new', { stage: 'verified' });
      await signIn(page, op, route);
      await expect(page).toHaveURL(/\/onboarding$/);
      await expect(page.getByText('Step 1 of 5')).toBeVisible();
    });
  }

  test('/onboarding itself stays reachable', async ({ page }) => {
    const op = await provisionOperator('rg-new-stay', { stage: 'verified' });
    await signIn(page, op, '/onboarding');
    await expect(page).toHaveURL(/\/onboarding$/);
  });
});

test.describe('Signed in and onboarded', () => {
  test('/onboarding redirects to the dashboard', async ({ page }) => {
    await signIn(page, onboarded.current, '/onboarding');
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('/verify-email redirects to the dashboard', async ({ page }) => {
    await signIn(page, onboarded.current, '/verify-email');
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('/complete-profile redirects to the dashboard', async ({ page }) => {
    await signIn(page, onboarded.current, '/complete-profile');
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  for (const route of ['/login', '/forgot-password', '/']) {
    test(`${route} redirects to the dashboard`, async ({ page }) => {
      await signIn(page, onboarded.current, route);
      await expect(page).toHaveURL(/\/dashboard$/);
    });
  }

  test('/settings redirects to /settings/profile', async ({ page }) => {
    await signIn(page, onboarded.current, '/settings');
    await expect(page).toHaveURL(/\/settings\/profile$/);
  });

  test('an unknown settings tab redirects to /settings/profile', async ({ page }) => {
    await signIn(page, onboarded.current, '/settings/bogus');
    await expect(page).toHaveURL(/\/settings\/profile$/);
  });

  test('an unknown path redirects to the dashboard', async ({ page }) => {
    await signIn(page, onboarded.current, '/no-such-page');
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  for (const route of APP_ROUTES) {
    test(`${route} opens directly and survives a hard reload`, async ({ page }) => {
      await signIn(page, onboarded.current, route);
      await expect(page).toHaveURL(new RegExp(`${route}$`));
      await expect(page.getByRole('navigation', { name: 'Main', exact: true })).toBeVisible();
      await page.reload();
      await expect(page).toHaveURL(new RegExp(`${route}$`));
      await expect(page.getByRole('navigation', { name: 'Main', exact: true })).toBeVisible();
    });
  }

  test('the legal pages are readable while signed in', async ({ page }) => {
    await signIn(page, onboarded.current, '/terms');
    await expect(page).toHaveURL(/\/terms$/);
    await page.goto('/privacy');
    await expect(page).toHaveURL(/\/privacy$/);
  });
});

test.describe('Session expiry', () => {
  // KNOWN GAP: apiClient has no 401 handling (only 403 EMAIL_NOT_VERIFIED is wired to the session),
  // so a token the backend rejects — expired, or its operator deleted — leaves the user inside a
  // shell whose every request fails instead of signing them out.
  test.fail('a rejected (401) token signs the user out to /login', async ({ page }) => {
    const op = await provisionOperator('rg-401', { stage: 'verified' });
    await signIn(page, { ...op, token: 'not-a-valid-token' }, '/dashboard');
    await expect(page).toHaveURL(/\/login$/, { timeout: 15_000 });
  });
});
