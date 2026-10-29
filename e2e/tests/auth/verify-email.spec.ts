import { api } from '../support/api';
import { latestEmailCode, requireBackend, requireTestSupport } from '../support/stack';
import { test, expect } from '../support/fixtures';
import { provisionOperator, signIn, uniqueEmail, type Operator } from '../support/operator';

// /verify-email. Codes are read through the backend's test-support hook (EMAIL_PROVIDER=log), and
// every test uses its own freshly-registered account because the resend cooldown (60 s) and the
// 5-wrong-guess lock are per account.
test.beforeEach(async () => {
  await requireBackend();
  await requireTestSupport();
});

const unverified = (tag: string) => provisionOperator(`ve-${tag}`, { stage: 'unverified' });

async function openVerify(page: import('@playwright/test').Page, op: Operator) {
  await signIn(page, op, '/verify-email', { emailVerified: false });
  await expect(page.getByRole('heading', { name: 'Verify your email' })).toBeVisible();
}

const codeInput = (page: import('@playwright/test').Page) => page.getByLabel('Verification code');
const verifyButton = (page: import('@playwright/test').Page) => page.getByRole('button', { name: 'Verify email' });

function wrongCodeFor(right: string) {
  return right === '000000' ? '111111' : '000000';
}

test.describe('Arriving on the page', () => {
  test('names the address and says a code was already sent moments ago', async ({ page }) => {
    const op = await unverified('arrive');
    await openVerify(page, op);
    await expect(page.getByText(`Enter the 6-digit code we sent to`)).toBeVisible();
    await expect(page.getByRole('strong').filter({ hasText: op.email })).toBeVisible();
    // Registration sent the code a moment ago, so the automatic send on arrival hits the cooldown.
    await expect(page.getByRole('status')).toContainText('We already sent you a code a moment ago');
  });

  test('after the cooldown has passed, arriving sends a fresh code', async ({ page }) => {
    test.slow();
    const op = await unverified('arrive-late');
    const first = await latestEmailCode(op.email);
    await new Promise((r) => setTimeout(r, 62_000));
    await openVerify(page, op);
    await expect(page.getByRole('status')).toContainText(`We sent a 6-digit code to ${op.email}.`);
    const second = await latestEmailCode(op.email);
    // A fresh code supersedes the first (a 1-in-a-million collision would be a coincidence).
    if (second !== first) {
      await codeInput(page).fill(first);
      await verifyButton(page).click();
      await expect(page.getByRole('alert')).toContainText('That code is not correct');
    }
    await codeInput(page).fill(second);
    await verifyButton(page).click();
    await expect(page).toHaveURL(/\/onboarding$/, { timeout: 30_000 });
  });

  test('the resend button is disabled with a countdown right after a send', async ({ page }) => {
    const op = await unverified('countdown');
    await openVerify(page, op);
    const resend = page.getByRole('button', { name: /^Resend code in \d+s$/ });
    await expect(resend).toBeDisabled();
    const seconds = Number((await resend.innerText()).match(/\d+/)![0]);
    expect(seconds).toBeGreaterThan(0);
    expect(seconds).toBeLessThanOrEqual(60);
  });

  test('an unverified operator cannot reach the app by URL', async ({ page }) => {
    const op = await unverified('gate');
    await signIn(page, op, '/dashboard', { emailVerified: false });
    await expect(page).toHaveURL(/\/verify-email$/);
    await page.goto('/performance');
    await expect(page).toHaveURL(/\/verify-email$/);
  });
});

test.describe('Entering the code', () => {
  test('Verify email is disabled until all 6 digits are entered, and non-digits are stripped', async ({ page }) => {
    const op = await unverified('digits');
    await openVerify(page, op);
    await expect(verifyButton(page)).toBeDisabled();
    await codeInput(page).fill('12ab34');
    await expect(codeInput(page)).toHaveValue('1234');
    await expect(verifyButton(page)).toBeDisabled();
    await codeInput(page).fill('1234567890');
    await expect(codeInput(page)).toHaveValue('123456');
    await expect(verifyButton(page)).toBeEnabled();
  });

  test('a wrong code counts down the attempts left', async ({ page }) => {
    const op = await unverified('wrong');
    await openVerify(page, op);
    const wrong = wrongCodeFor(await latestEmailCode(op.email));
    await codeInput(page).fill(wrong);
    await verifyButton(page).click();
    await expect(page.getByRole('alert')).toContainText('That code is not correct. 4 attempts left.');
    await verifyButton(page).click();
    await expect(page.getByRole('alert')).toContainText('That code is not correct. 3 attempts left.');
    await expect(page).toHaveURL(/\/verify-email$/);
  });

  test('five wrong codes lock the code, even for the right one', async ({ page }) => {
    const op = await unverified('lock');
    await openVerify(page, op);
    const right = await latestEmailCode(op.email);
    const wrong = wrongCodeFor(right);
    await codeInput(page).fill(wrong);
    for (let i = 0; i < 5; i++) await verifyButton(page).click();
    await expect(page.getByRole('alert')).toContainText('That code is not correct. 0 attempts left.');
    await codeInput(page).fill(right);
    await verifyButton(page).click();
    await expect(page.getByRole('alert')).toContainText('Too many wrong attempts. Request a new code.');
    await expect(page).toHaveURL(/\/verify-email$/);
  });

  test('"1 attempt left" is singular', async ({ page }) => {
    const op = await unverified('singular');
    await openVerify(page, op);
    await codeInput(page).fill(wrongCodeFor(await latestEmailCode(op.email)));
    for (let i = 0; i < 4; i++) await verifyButton(page).click();
    await expect(page.getByRole('alert')).toContainText('That code is not correct. 1 attempt left.');
  });

  test('an expired code is refused with a request-a-new-one message', async ({ page }) => {
    const op = await unverified('expired');
    await openVerify(page, op);
    const right = await latestEmailCode(op.email);
    const res = await api().post('/api/test-support/email-codes/expire', { email: op.email });
    expect(res.body.expired).toBeGreaterThanOrEqual(1);
    await codeInput(page).fill(right);
    await verifyButton(page).click();
    await expect(page.getByRole('alert')).toContainText('That code has expired. Request a new one.');
    await expect(page).toHaveURL(/\/verify-email$/);
  });

  test('the right code verifies the email and continues to onboarding', async ({ page }) => {
    const op = await unverified('right');
    await openVerify(page, op);
    await codeInput(page).fill(await latestEmailCode(op.email));
    await verifyButton(page).click();
    // No business profile yet, so ProfileGate forwards /dashboard to /onboarding.
    await expect(page).toHaveURL(/\/onboarding$/, { timeout: 30_000 });
    await expect(page.getByText('Email verified')).toBeVisible();
    const stored = JSON.parse((await page.evaluate(() => localStorage.getItem('ceview.auth')))!);
    expect(stored.emailVerified).toBe(true);
    // The server agrees.
    const login = await api().post('/api/auth/login', { email: op.email, password: op.password });
    expect(login.body.emailVerified).toBe(true);
  });

  test('a verified code cannot be reused', async () => {
    const op = await unverified('reuse');
    const client = api(op.token);
    const code = await latestEmailCode(op.email);
    expect((await client.post('/api/auth/email-verification/verify', { code })).status).toBe(200);
    // Verifying an already-verified account is a harmless no-op.
    expect((await client.post('/api/auth/email-verification/verify', { code })).status).toBe(200);
  });
});

test.describe('Resending', () => {
  test('a resend after the cooldown replaces the old code', async ({ page }) => {
    test.slow();
    const op = await unverified('resend');
    await openVerify(page, op);
    const first = await latestEmailCode(op.email);
    await expect(page.getByRole('button', { name: 'Resend code', exact: true })).toBeEnabled({ timeout: 75_000 });
    await page.getByRole('button', { name: 'Resend code', exact: true }).click();
    await expect(page.getByRole('status')).toContainText(`We sent a 6-digit code to ${op.email}.`);
    await expect(page.getByRole('button', { name: /^Resend code in \d+s$/ })).toBeDisabled();
    const second = await latestEmailCode(op.email);
    if (second !== first) {
      await codeInput(page).fill(first);
      await verifyButton(page).click();
      await expect(page.getByRole('alert')).toContainText('That code is not correct');
    }
    await codeInput(page).fill(second);
    await verifyButton(page).click();
    await expect(page).toHaveURL(/\/onboarding$/, { timeout: 30_000 });
  });

  test('POST /email-verification/send inside the cooldown is 429 RESEND_COOLDOWN with a retry time', async () => {
    const op = await unverified('cooldown-api');
    const res = await api(op.token).post('/api/auth/email-verification/send');
    expect(res.status).toBe(429);
    expect(res.body.code).toBe('RESEND_COOLDOWN');
    expect(res.body.retryAfterSeconds).toBeGreaterThan(0);
    expect(res.body.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  test('POST /email-verification/send on a verified account is 409 ALREADY_VERIFIED', async () => {
    const op = await provisionOperator('ve-already', { stage: 'verified' });
    const res = await api(op.token).post('/api/auth/email-verification/send');
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ALREADY_VERIFIED');
  });
});

test.describe('Changing the address', () => {
  async function openChangeForm(page: import('@playwright/test').Page) {
    await page.getByRole('button', { name: /wrong email\? change it/i }).click();
    await expect(page.getByLabel('New email')).toBeVisible();
  }

  test('the code goes to the corrected address and verifies the account', async ({ page }) => {
    const op = await unverified('change');
    const corrected = uniqueEmail('ve-corrected');
    await openVerify(page, op);
    await openChangeForm(page);
    await page.getByLabel('New email').fill(corrected);
    await page.getByRole('button', { name: /send code to this email/i }).click();
    await expect(page.getByRole('status')).toContainText(`We sent a 6-digit code to ${corrected}.`);
    await expect(page.getByRole('strong').filter({ hasText: corrected })).toBeVisible();
    // The form closes and the stored session names the new address.
    await expect(page.getByLabel('New email')).toHaveCount(0);
    expect(JSON.parse((await page.evaluate(() => localStorage.getItem('ceview.auth')))!).email).toBe(corrected);

    await codeInput(page).fill(await latestEmailCode(corrected));
    await verifyButton(page).click();
    await expect(page).toHaveURL(/\/onboarding$/, { timeout: 30_000 });
    // The old address can no longer sign in.
    expect((await api().post('/api/auth/login', { email: op.email, password: op.password })).status).toBe(401);
    expect((await api().post('/api/auth/login', { email: corrected, password: op.password })).status).toBe(200);
  });

  test('a code sent to the old address stops working after the change', async ({ page }) => {
    const op = await unverified('change-old');
    const oldCode = await latestEmailCode(op.email);
    await openVerify(page, op);
    await openChangeForm(page);
    await page.getByLabel('New email').fill(uniqueEmail('ve-new'));
    await page.getByRole('button', { name: /send code to this email/i }).click();
    await expect(page.getByRole('status')).toContainText('We sent a 6-digit code to');
    await codeInput(page).fill(oldCode);
    await verifyButton(page).click();
    await expect(page.getByRole('alert')).toContainText('That code is not correct');
  });

  test('an address another account already uses is refused', async ({ page }) => {
    const op = await unverified('change-taken');
    const other = await provisionOperator('ve-owner', { stage: 'verified' });
    await openVerify(page, op);
    await openChangeForm(page);
    await page.getByLabel('New email').fill(other.email);
    await page.getByRole('button', { name: /send code to this email/i }).click();
    await expect(page.getByRole('alert')).toContainText('That email is already in use');
    await expect(page.getByLabel('New email')).toBeVisible();
  });

  test('your current address is refused as unchanged', async ({ page }) => {
    const op = await unverified('change-same');
    await openVerify(page, op);
    await openChangeForm(page);
    await page.getByLabel('New email').fill(op.email);
    await page.getByRole('button', { name: /send code to this email/i }).click();
    await expect(page.getByRole('alert')).toContainText('That is already your email address.');
  });

  test('the button toggles the form open and closed', async ({ page }) => {
    const op = await unverified('change-toggle');
    await openVerify(page, op);
    await openChangeForm(page);
    await page.getByRole('button', { name: /wrong email\? change it/i }).click();
    await expect(page.getByLabel('New email')).toHaveCount(0);
  });

  test('the hourly code limit is reported with a wait time', async ({ page }) => {
    const op = await unverified('change-limit');
    const client = api(op.token);
    // Registration sent code 1; four address changes bring it to 5 — the per-hour maximum.
    let current = op.email;
    for (let i = 0; i < 4; i++) {
      current = uniqueEmail(`ve-limit${i}`);
      const res = await client.patch('/api/auth/email', { email: current });
      expect(res.status).toBe(200);
    }
    await openVerify(page, { ...op, email: current });
    await openChangeForm(page);
    await page.getByLabel('New email').fill(uniqueEmail('ve-limit-ui'));
    await page.getByRole('button', { name: /send code to this email/i }).click();
    await expect(page.getByRole('alert')).toContainText(/Too many codes requested\. Try again in \d+ minutes\./);
  });
});

test.describe('Leaving', () => {
  test('Sign out clears the session and returns to the landing page', async ({ page }) => {
    const op = await unverified('signout');
    await openVerify(page, op);
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/$/);
    expect(await page.evaluate(() => localStorage.getItem('ceview.auth'))).toBeNull();
    await page.goto('/verify-email');
    await expect(page).toHaveURL(/\/$/);
  });

  test('a verified operator is taken off /verify-email', async ({ page }) => {
    const op = await provisionOperator('ve-verified', { stage: 'onboarded', demandWindow: true });
    await signIn(page, op, '/verify-email');
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('a verified operator with no profile is taken off /verify-email to onboarding', async ({ page }) => {
    const op = await provisionOperator('ve-verified-new', { stage: 'verified' });
    await signIn(page, op, '/verify-email');
    await expect(page).toHaveURL(/\/onboarding$/);
  });
});
