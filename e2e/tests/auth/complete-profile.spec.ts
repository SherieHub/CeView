import { api } from '../support/api';
import { requireBackend } from '../support/stack';
import { test, expect, useOperator } from '../support/fixtures';
import { signIn } from '../support/operator';

// /complete-profile is the one-time contact-number step for accounts that signed up without one
// (in practice Google sign-ups). Password sign-ups always have a number, and there is no test hook
// to blank an account's number, so these scenarios mark the *stored session* as incomplete — which
// is exactly what ProfileCompletionGate reads — while the account itself already has a number.
const op = useOperator('complete-profile', { demandWindow: true });

test.beforeEach(async () => {
  await requireBackend();
});

const incomplete = { profileCompleted: false };

test.describe('Complete your profile', () => {
  test('a completed operator who opens it is sent to the dashboard', async ({ page }) => {
    await signIn(page, op.current, '/complete-profile');
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('an incomplete session is held there from every app route', async ({ page }) => {
    for (const route of ['/dashboard', '/content', '/calendar', '/performance', '/settings/profile']) {
      await signIn(page, op.current, route, incomplete);
      await expect(page, route).toHaveURL(/\/complete-profile$/);
    }
    await expect(page.getByRole('heading', { name: 'Complete your profile' })).toBeVisible();
  });

  test('Continue is disabled until a contact number is typed', async ({ page }) => {
    await signIn(page, op.current, '/complete-profile', incomplete);
    const next = page.getByRole('button', { name: 'Continue' });
    await expect(next).toBeDisabled();
    await page.getByLabel('Contact number').fill('0917 555 0123');
    await expect(next).toBeEnabled();
    await page.getByLabel('Contact number').fill('');
    await expect(next).toBeDisabled();
  });

  test('saving the number completes the profile and opens the app', async ({ page }) => {
    await signIn(page, op.current, '/complete-profile', incomplete);
    await page.getByLabel('Contact number').fill('0917 555 0123');
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });
    const stored = JSON.parse((await page.evaluate(() => localStorage.getItem('ceview.auth')))!);
    expect(stored.profileCompleted).toBe(true);
    // The number was written to the account.
    const profile = await api(op.current.token).getOrThrow('/api/auth/profile');
    expect(profile.contactNumber).toBe('0917 555 0123');
    expect(profile.phoneVerified).toBe(false);
    // …and the gate stays open after a reload.
    await page.reload();
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});
