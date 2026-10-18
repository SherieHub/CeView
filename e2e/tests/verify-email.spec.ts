import { test, expect } from '@playwright/test';
import {
  E2E_PASSWORD,
  latestEmailCode,
  registerViaApi,
  requireBackend,
  requireTestSupport,
  verifyViaApi,
} from './support/stack';

// Email verification, change-email and forgot-password against the real stack. Emails are never
// delivered: the backend runs with EMAIL_PROVIDER=log and CEVIEW_TEST_SUPPORT_ENABLED=true, and
// the specs read each code through that hook (support/stack.ts -> latestEmailCode).

function freshEmail(tag: string) {
  return `e2e-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@ceview.local`;
}

test.describe('Email verification', () => {
  test.beforeEach(async () => {
    await requireBackend();
    await requireTestSupport();
  });

  test('sign-up lands on Verify your email; a wrong code is refused, the right one continues', async ({ page }) => {
    const email = freshEmail('signup');
    await page.goto('/login');
    await page.getByRole('tab', { name: 'Create account' }).click();
    await page.getByLabel('First name').fill('E2E');
    await page.getByLabel('Last name').fill('Tester');
    await page.getByLabel('Contact number').fill('+63 917 000 0000');
    await page.getByPlaceholder('you@example.com').fill(email);
    await page.getByPlaceholder('••••••••').fill(E2E_PASSWORD);
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page).toHaveURL(/\/verify-email$/, { timeout: 30_000 });
    await expect(page.getByRole('heading', { name: 'Verify your email' })).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();

    const right = await latestEmailCode(email);
    const wrong = right === '000000' ? '111111' : '000000';
    await page.getByLabel('Verification code').fill(wrong);
    await page.getByRole('button', { name: 'Verify email' }).click();
    await expect(page.getByRole('alert')).toContainText('attempts left');
    await expect(page).toHaveURL(/\/verify-email$/);

    await page.getByLabel('Verification code').fill(right);
    await page.getByRole('button', { name: 'Verify email' }).click();
    await expect(page).toHaveURL(/\/onboarding$/, { timeout: 30_000 });
  });

  test('an unverified account that signs in is held at /verify-email, and cannot skip it by URL', async ({ page }) => {
    const email = freshEmail('login');
    await registerViaApi(email);

    await page.goto('/login');
    await page.getByPlaceholder('you@example.com').fill(email);
    await page.getByPlaceholder('••••••••').fill(E2E_PASSWORD);
    await page.getByRole('button', { name: 'Sign in', exact: true }).last().click();
    await expect(page).toHaveURL(/\/verify-email$/, { timeout: 30_000 });

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/verify-email$/);
  });

  test('a mistyped email can be corrected, and the code then goes to the new address', async ({ page }) => {
    const typo = freshEmail('typo');
    const right = freshEmail('right');
    await registerViaApi(typo);

    await page.goto('/login');
    await page.getByPlaceholder('you@example.com').fill(typo);
    await page.getByPlaceholder('••••••••').fill(E2E_PASSWORD);
    await page.getByRole('button', { name: 'Sign in', exact: true }).last().click();
    await expect(page).toHaveURL(/\/verify-email$/, { timeout: 30_000 });

    await page.getByRole('button', { name: /wrong email\? change it/i }).click();
    await page.getByLabel('New email').fill(right);
    await page.getByRole('button', { name: /send code to this email/i }).click();
    await expect(page.getByText(`sent a 6-digit code to ${right}`)).toBeVisible();

    await page.getByLabel('Verification code').fill(await latestEmailCode(right));
    await page.getByRole('button', { name: 'Verify email' }).click();
    await expect(page).toHaveURL(/\/onboarding$/, { timeout: 30_000 });
  });

  test('forgot password: code + new password signs the user in', async ({ page }) => {
    const email = freshEmail('reset');
    await registerViaApi(email);
    await verifyViaApi(email, E2E_PASSWORD);

    await page.goto('/login');
    await page.getByRole('link', { name: 'Forgot password?' }).click();
    await expect(page).toHaveURL(/\/forgot-password$/);
    await page.getByLabel('Email').fill(email);
    await page.getByRole('button', { name: 'Send code' }).click();

    await page.getByLabel('Verification code').fill(await latestEmailCode(email));
    await page.getByLabel('New password').fill('Brand9NewPass');
    await page.getByRole('button', { name: 'Reset password' }).click();

    await expect(page).toHaveURL(/\/(onboarding|dashboard)$/, { timeout: 30_000 });
  });

  test('forgot password for an unknown email says so', async ({ page }) => {
    await page.goto('/forgot-password');
    await page.getByLabel('Email').fill(freshEmail('nobody'));
    await page.getByRole('button', { name: 'Send code' }).click();

    await expect(page.getByRole('alert')).toContainText('No account found');
  });
});
