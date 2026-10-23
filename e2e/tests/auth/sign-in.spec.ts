import { SEED_OPERATOR, requireBackend } from '../support/stack';
import { test, expect, useOperator } from '../support/fixtures';
import { provisionOperator, signIn, signInViaUi } from '../support/operator';

// /login → "Sign in" tab, against the real backend. An onboarded operator with a seeded forecast
// is shared by the file so a successful sign-in lands on a dashboard that doesn't start the live
// forecast pipeline.
const onboarded = useOperator('sign-in', { demandWindow: true });

test.beforeEach(async () => {
  await requireBackend();
});

test.describe('Sign in tab', () => {
  test('is the default tab and shows only the sign-in fields', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Sign in' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tab', { name: 'Create account' })).toHaveAttribute('aria-selected', 'false');
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
    await expect(page.getByLabel('First name')).toHaveCount(0);
    await expect(page.getByLabel('Contact number')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Forgot password?' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
  });

  test('an onboarded operator signs in and lands on the dashboard', async ({ page }) => {
    await signInViaUi(page, onboarded.current.email, onboarded.current.password);
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });
    await expect(page.getByRole('navigation', { name: 'Main', exact: true })).toBeVisible();
  });

  test('pressing Enter in the password field submits the form', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(onboarded.current.email);
    await page.getByLabel('Password', { exact: true }).fill(onboarded.current.password);
    await page.getByLabel('Password', { exact: true }).press('Enter');
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });
  });

  test('a verified operator with no business profile is sent to onboarding', async ({ page }) => {
    const op = await provisionOperator('sign-in-new', { stage: 'verified' });
    await signInViaUi(page, op.email, op.password);
    await expect(page).toHaveURL(/\/onboarding$/, { timeout: 30_000 });
  });

  test('an unverified operator is sent to verify their email', async ({ page }) => {
    const op = await provisionOperator('sign-in-unverified', { stage: 'unverified' });
    await signInViaUi(page, op.email, op.password);
    await expect(page).toHaveURL(/\/verify-email$/, { timeout: 30_000 });
  });

  test('a wrong password shows an error and stays on /login', async ({ page }) => {
    await signInViaUi(page, onboarded.current.email, 'NotThePassword9');
    await expect(page.getByRole('alert')).toContainText('Check your details');
    await expect(page).toHaveURL(/\/login$/);
    expect(await page.evaluate(() => localStorage.getItem('ceview.auth'))).toBeNull();
  });

  test('an unknown email gets the same error as a wrong password', async ({ page }) => {
    await signInViaUi(page, `nobody-${Date.now()}@ceview.local`, 'NotThePassword9');
    await expect(page.getByRole('alert')).toContainText('Check your details');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('empty fields are blocked by the browser and send no request', async ({ page }) => {
    let called = false;
    page.on('request', (r) => {
      if (r.url().endsWith('/api/auth/login')) called = true;
    });
    await page.goto('/login');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    expect(called).toBe(false);
  });

  test('the show/hide button toggles the password field', async ({ page }) => {
    await page.goto('/login');
    const password = page.getByLabel('Password', { exact: true });
    await password.fill('Hunter22secret');
    await expect(password).toHaveAttribute('type', 'password');
    await page.getByRole('button', { name: 'Show password' }).click();
    await expect(password).toHaveAttribute('type', 'text');
    await expect(page.getByRole('button', { name: 'Hide password' })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Hide password' }).click();
    await expect(password).toHaveAttribute('type', 'password');
  });

  test('"Forgot password?" opens the reset page', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('link', { name: 'Forgot password?' }).click();
    await expect(page).toHaveURL(/\/forgot-password$/);
    await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible();
  });

  test('the bottom link and the tab both switch to Create account', async ({ page }) => {
    await page.goto('/login');
    // In sign-in mode the only *button* named "Create account" is the link under the form.
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
    await page.getByRole('tab', { name: 'Sign in' }).click();
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  });

  test('a signed-in visitor to /login is redirected to the dashboard', async ({ page }) => {
    await signIn(page, onboarded.current, '/login');
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('the session survives a reload', async ({ page }) => {
    await signInViaUi(page, onboarded.current.email, onboarded.current.password);
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });
    await page.reload();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('navigation', { name: 'Main', exact: true })).toBeVisible();
  });

  test('the seeded demo operator can sign in (read-only smoke)', async ({ page }) => {
    await signInViaUi(page, SEED_OPERATOR.email, SEED_OPERATOR.password);
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });
  });
});
