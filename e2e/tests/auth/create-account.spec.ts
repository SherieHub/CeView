import type { Page } from '@playwright/test';
import { api } from '../support/api';
import { E2E_PASSWORD, registerViaApi, requireBackend, requireTestSupport } from '../support/stack';
import { test, expect } from '../support/fixtures';
import { provisionOperator, uniqueEmail } from '../support/operator';

// /login → "Create account" tab. Firebase is blank in e2e, so the contact number is a plain field
// (no SMS) and a sign-up goes straight to /verify-email.
const PASSWORD_HINT = 'At least 8 characters, with a letter and a number.';

test.beforeEach(async () => {
  await requireBackend();
  await requireTestSupport();
});

async function openSignUp(page: Page) {
  await page.goto('/login');
  await page.getByRole('tab', { name: 'Create account' }).click();
}

async function fillSignUp(
  page: Page,
  v: { first?: string; last?: string; phone?: string; email: string; password: string },
) {
  if (v.first !== undefined) await page.getByLabel('First name').fill(v.first);
  if (v.last !== undefined) await page.getByLabel('Last name').fill(v.last);
  if (v.phone !== undefined) await page.getByLabel('Contact number').fill(v.phone);
  await page.getByLabel('Email').fill(v.email);
  await page.getByLabel('Password', { exact: true }).fill(v.password);
}

const submitButton = (page: Page) => page.locator('form').getByRole('button', { name: 'Create account' });

function watchRegisterRequests(page: Page) {
  const seen = { count: 0 };
  page.on('request', (r) => {
    if (r.url().endsWith('/api/auth/register')) seen.count += 1;
  });
  return seen;
}

test.describe('Create account tab', () => {
  test('shows the sign-up fields and the password hint', async ({ page }) => {
    await openSignUp(page);
    await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Create account' })).toHaveAttribute('aria-selected', 'true');
    for (const label of ['First name', 'Last name', 'Contact number', 'Email']) {
      await expect(page.getByLabel(label)).toBeVisible();
    }
    await expect(page.getByText(PASSWORD_HINT)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Forgot password?' })).toHaveCount(0);
  });

  test('the link under the form opens the same tab as the tab button, and switches back', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  });

  test('Create account stays disabled until a contact number is entered', async ({ page }) => {
    await openSignUp(page);
    await fillSignUp(page, { first: 'Ana', last: 'Cruz', email: uniqueEmail('ca-phone'), password: E2E_PASSWORD });
    await expect(submitButton(page)).toBeDisabled();
    await page.getByLabel('Contact number').fill('+63 917 123 4567');
    await expect(submitButton(page)).toBeEnabled();
    await page.getByLabel('Contact number').fill('   ');
    await expect(submitButton(page)).toBeDisabled();
  });

  test('a blank first name is blocked by the browser and sends no request', async ({ page }) => {
    const seen = watchRegisterRequests(page);
    await openSignUp(page);
    await fillSignUp(page, {
      first: '', last: 'Cruz', phone: '+63 917 123 4567', email: uniqueEmail('ca-req'), password: E2E_PASSWORD,
    });
    await submitButton(page).click();
    await expect(page).toHaveURL(/\/login$/);
    expect(seen.count).toBe(0);
  });

  for (const [why, password] of [
    ['is shorter than 8 characters', 'Ab1'],
    ['has no digit', 'LettersOnlyHere'],
    ['has no letter', '123456789012'],
  ] as const) {
    test(`a password that ${why} is refused before any request`, async ({ page }) => {
      const seen = watchRegisterRequests(page);
      await openSignUp(page);
      await fillSignUp(page, {
        first: 'Ana', last: 'Cruz', phone: '+63 917 123 4567', email: uniqueEmail('ca-weak'), password,
      });
      await submitButton(page).click();
      await expect(page.getByRole('alert')).toContainText(`Choose a stronger password. ${PASSWORD_HINT}`);
      await expect(page).toHaveURL(/\/login$/);
      expect(seen.count).toBe(0);
    });
  }

  test('a password over 72 bytes is refused', async ({ page }) => {
    await openSignUp(page);
    await fillSignUp(page, {
      first: 'Ana', last: 'Cruz', phone: '+63 917 123 4567', email: uniqueEmail('ca-long'),
      password: 'A1' + 'x'.repeat(71),
    });
    await submitButton(page).click();
    await expect(page.getByRole('alert')).toContainText('Choose a stronger password');
  });

  test('a valid sign-up lands on /verify-email naming the address, with an unverified session', async ({ page }) => {
    const email = uniqueEmail('ca-ok');
    await openSignUp(page);
    await fillSignUp(page, { first: 'Ana', last: 'Cruz', phone: '+63 917 123 4567', email, password: E2E_PASSWORD });
    await submitButton(page).click();
    await expect(page).toHaveURL(/\/verify-email$/, { timeout: 30_000 });
    await expect(page.getByRole('heading', { name: 'Verify your email' })).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();
    const stored = JSON.parse((await page.evaluate(() => localStorage.getItem('ceview.auth')))!);
    expect(stored).toMatchObject({ emailVerified: false, profileCompleted: true, email });
  });

  test('the contact number is saved with the account, unverified', async ({ page }) => {
    const email = uniqueEmail('ca-phone-saved');
    await openSignUp(page);
    await fillSignUp(page, { first: 'Ana', last: 'Cruz', phone: '0917 555 0101', email, password: E2E_PASSWORD });
    await submitButton(page).click();
    await expect(page).toHaveURL(/\/verify-email$/, { timeout: 30_000 });
    const token = JSON.parse((await page.evaluate(() => localStorage.getItem('ceview.auth')))!).accessToken;
    // /api/auth/** is exempt from the email-verification filter, so this works while unverified.
    const profile = await api(token).get('/api/auth/profile');
    expect(profile.status).toBe(200);
    expect(profile.body).toEqual({ contactNumber: '0917 555 0101', phoneVerified: false });
  });

  test('an email that belongs to a verified account is refused as already in use', async ({ page }) => {
    const existing = await provisionOperator('ca-taken', { stage: 'verified' });
    await openSignUp(page);
    await fillSignUp(page, {
      first: 'Ana', last: 'Cruz', phone: '+63 917 123 4567', email: existing.email, password: E2E_PASSWORD,
    });
    await submitButton(page).click();
    await expect(page.getByRole('alert')).toContainText('That email is already in use');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('re-registering an address that never verified takes the account over and ends the old token', async ({ page }) => {
    const email = uniqueEmail('ca-takeover');
    const oldToken = await registerViaApi(email);

    await openSignUp(page);
    await fillSignUp(page, {
      first: 'New', last: 'Owner', phone: '+63 917 123 4567', email, password: 'Another9Pass',
    });
    await submitButton(page).click();
    await expect(page).toHaveURL(/\/verify-email$/, { timeout: 30_000 });

    // The unverified row was replaced, so the first registration's token maps to no one.
    const stale = await api(oldToken).post('/api/auth/email-verification/send');
    expect(stale.status).toBe(401);
    expect(stale.body.message).toContain('operator no longer exists');
    // The new owner's password works; the first one's no longer does.
    expect((await api().post('/api/auth/login', { email, password: 'Another9Pass' })).status).toBe(200);
    expect((await api().post('/api/auth/login', { email, password: E2E_PASSWORD })).status).toBe(401);
  });

  test('Continue with Google is offered on this tab too', async ({ page }) => {
    await openSignUp(page);
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeEnabled();
  });
});
