import type { Page } from '@playwright/test';
import { api } from '../support/api';
import { latestEmailCode, requireBackend, requireTestSupport } from '../support/stack';
import { test, expect } from '../support/fixtures';
import { provisionOperator, signIn, uniqueEmail, type Operator } from '../support/operator';

// /forgot-password: request a code, then enter it with a new password, which signs the user in.
const NEW_PASSWORD = 'Brand9NewPass';
const PASSWORD_HINT = 'At least 8 characters, with a letter and a number.';

test.beforeEach(async () => {
  await requireBackend();
  await requireTestSupport();
});

async function requestCode(page: Page, email: string) {
  await page.goto('/forgot-password');
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Send code' }).click();
  await expect(page.getByLabel('Verification code')).toBeVisible();
}

const resetButton = (page: Page) => page.getByRole('button', { name: 'Reset password' });

/** A verified operator with no business profile — resets land it on /onboarding. */
const verifiedOperator = (tag: string) => provisionOperator(`fp-${tag}`, { stage: 'verified' });

test.describe('Reset your password', () => {
  test('is reachable from the sign-in page and starts on the email step', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('link', { name: 'Forgot password?' }).click();
    await expect(page).toHaveURL(/\/forgot-password$/);
    await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible();
    await expect(page.getByText('Enter your email and we’ll send you a code.')).toBeVisible();
    await expect(page.getByLabel('Verification code')).toHaveCount(0);
  });

  test('a code and a new password reset the password and sign the user in', async ({ page }) => {
    const op = await verifiedOperator('ok');
    await requestCode(page, op.email);
    await expect(page.getByText(`Enter the 6-digit code we sent to`)).toBeVisible();
    await expect(page.getByRole('strong').filter({ hasText: op.email })).toBeVisible();

    await page.getByLabel('Verification code').fill(await latestEmailCode(op.email));
    await page.getByLabel('New password').fill(NEW_PASSWORD);
    await resetButton(page).click();

    await expect(page).toHaveURL(/\/onboarding$/, { timeout: 30_000 });
    await expect(page.getByText('Password updated')).toBeVisible();
    // The old password is dead, the new one works.
    expect((await api().post('/api/auth/login', { email: op.email, password: op.password })).status).toBe(401);
    expect((await api().post('/api/auth/login', { email: op.email, password: NEW_PASSWORD })).status).toBe(200);
  });

  test('an onboarded operator lands on the dashboard after a reset', async ({ page }) => {
    const op = await provisionOperator('fp-onboarded', { stage: 'onboarded', demandWindow: true });
    await requestCode(page, op.email);
    await page.getByLabel('Verification code').fill(await latestEmailCode(op.email));
    await page.getByLabel('New password').fill(NEW_PASSWORD);
    await resetButton(page).click();
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });
  });

  test('an unknown email says no account was found', async ({ page }) => {
    await page.goto('/forgot-password');
    await page.getByLabel('Email').fill(uniqueEmail('fp-nobody'));
    await page.getByRole('button', { name: 'Send code' }).click();
    await expect(page.getByRole('alert')).toContainText('No account found with that email.');
    await expect(page.getByLabel('Verification code')).toHaveCount(0);
  });

  test('a weak new password is refused before any request', async ({ page }) => {
    const op = await verifiedOperator('weak');
    await requestCode(page, op.email);
    let confirmed = false;
    page.on('request', (r) => {
      if (r.url().endsWith('/api/auth/password-reset/confirm')) confirmed = true;
    });
    await page.getByLabel('Verification code').fill(await latestEmailCode(op.email));
    await page.getByLabel('New password').fill('short');
    await resetButton(page).click();
    await expect(page.getByRole('alert')).toContainText(`Choose a stronger password. ${PASSWORD_HINT}`);
    expect(confirmed).toBe(false);
    await expect(page).toHaveURL(/\/forgot-password$/);
  });

  test('a wrong code counts down the attempts left, and the right one still works', async ({ page }) => {
    const op = await verifiedOperator('wrong');
    await requestCode(page, op.email);
    const right = await latestEmailCode(op.email);
    await page.getByLabel('New password').fill(NEW_PASSWORD);
    await page.getByLabel('Verification code').fill(right === '000000' ? '111111' : '000000');
    await resetButton(page).click();
    await expect(page.getByRole('alert')).toContainText('That code is not correct. 4 attempts left.');
    await page.getByLabel('Verification code').fill(right);
    await resetButton(page).click();
    await expect(page).toHaveURL(/\/onboarding$/, { timeout: 30_000 });
  });

  test('Reset password needs 6 digits, and non-digits are stripped from the code', async ({ page }) => {
    const op = await verifiedOperator('digits');
    await requestCode(page, op.email);
    await expect(resetButton(page)).toBeDisabled();
    await page.getByLabel('Verification code').fill('12-34');
    await expect(page.getByLabel('Verification code')).toHaveValue('1234');
    await expect(resetButton(page)).toBeDisabled();
    await page.getByLabel('Verification code').fill('123456');
    await expect(resetButton(page)).toBeEnabled();
  });

  test('the resend button counts down after the code is sent', async ({ page }) => {
    const op = await verifiedOperator('countdown');
    await requestCode(page, op.email);
    const resend = page.getByRole('button', { name: /^Resend code in \d+s$/ });
    await expect(resend).toBeDisabled();
    const seconds = Number((await resend.innerText()).match(/\d+/)![0]);
    expect(seconds).toBeGreaterThan(0);
    expect(seconds).toBeLessThanOrEqual(60);
  });

  test('"Use a different email" returns to the first step and clears the code', async ({ page }) => {
    const op = await verifiedOperator('different');
    await requestCode(page, op.email);
    await page.getByLabel('Verification code').fill('123');
    await page.getByRole('button', { name: 'Use a different email' }).click();
    await expect(page.getByText('Enter your email and we’ll send you a code.')).toBeVisible();
    await expect(page.getByLabel('Email')).toHaveValue(op.email);
    // Going forward again (inside the cooldown) is refused, not silently resent.
    await page.getByRole('button', { name: 'Send code' }).click();
    await expect(page.getByRole('alert')).toContainText(/Please wait .* before requesting another code\./);
  });

  test('a reset on an account that never verified also verifies it', async ({ page }) => {
    const op = await provisionOperator('fp-unverified', { stage: 'unverified' });
    await requestCode(page, op.email);
    await page.getByLabel('Verification code').fill(await latestEmailCode(op.email));
    await page.getByLabel('New password').fill(NEW_PASSWORD);
    await resetButton(page).click();
    // Verified, so it skips /verify-email and goes straight to onboarding.
    await expect(page).toHaveURL(/\/onboarding$/, { timeout: 30_000 });
    const login = await api().post('/api/auth/login', { email: op.email, password: NEW_PASSWORD });
    expect(login.body.emailVerified).toBe(true);
  });

  test('Back to sign in returns to /login', async ({ page }) => {
    await page.goto('/forgot-password');
    await page.getByRole('link', { name: 'Back to sign in' }).click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('a signed-in visitor is redirected away', async ({ page }) => {
    const op: Operator = await provisionOperator('fp-signedin', { stage: 'onboarded', demandWindow: true });
    await signIn(page, op, '/forgot-password');
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('POST /password-reset/confirm with a bad password is 400 WEAK_PASSWORD', async () => {
    const op = await verifiedOperator('weak-api');
    const res = await api().post('/api/auth/password-reset/confirm', {
      email: op.email, code: '123456', newPassword: 'short',
    });
    expect(res.status).toBe(400);
  });

  test('POST /password-reset/confirm with no code issued is 400 NO_ACTIVE_CODE', async () => {
    const op = await provisionOperator('fp-nocode', { stage: 'verified' });
    // Verifying the email consumed the registration code, so nothing is active for a reset.
    const res = await api().post('/api/auth/password-reset/confirm', {
      email: op.email, code: '123456', newPassword: NEW_PASSWORD,
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('NO_ACTIVE_CODE');
  });
});
