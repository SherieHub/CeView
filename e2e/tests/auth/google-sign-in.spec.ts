import { api } from '../support/api';
import { requireBackend } from '../support/stack';
import { test, expect } from '../support/fixtures';

// "Continue with Google" needs Firebase (a browser popup) and a Firebase-configured backend. The e2e
// stack has neither (docker-compose.e2e.yml blanks FIREBASE_CREDENTIALS_JSON, the dev server blanks
// VITE_FIREBASE_*), so this covers the not-configured behaviour and the request validation; a
// completed Google sign-in cannot be driven locally.
test.beforeEach(async () => {
  await requireBackend();
});

test.describe('Continue with Google', () => {
  for (const tab of ['Sign in', 'Create account']) {
    test(`with Firebase unconfigured, the ${tab} tab shows an error and stays on /login`, async ({ page }) => {
      await page.goto('/login');
      await page.getByRole('tab', { name: tab }).click();
      await page.getByRole('button', { name: 'Continue with Google' }).click();
      await expect(page.getByRole('alert')).toContainText('Something went wrong signing in with Google');
      await expect(page).toHaveURL(/\/login$/);
      // The button is usable again (not stuck on "Signing in…").
      await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeEnabled();
      expect(await page.evaluate(() => localStorage.getItem('ceview.auth'))).toBeNull();
    });
  }

  test('POST /api/auth/google rejects an unknown intent with 400', async () => {
    const res = await api().post('/api/auth/google', { idToken: 'x', intent: 'signup' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'invalid intent' });
  });

  test('POST /api/auth/google requires an idToken and an intent', async () => {
    expect((await api().post('/api/auth/google', { intent: 'login' })).status).toBe(400);
    expect((await api().post('/api/auth/google', { idToken: 'x' })).status).toBe(400);
  });

  test('POST /api/auth/google with a bad token is 503 when Google sign-in is not configured, 401 when it is', async () => {
    const res = await api().post('/api/auth/google', { idToken: 'not-a-real-token', intent: 'login' });
    expect([401, 503]).toContain(res.status);
    if (res.status === 503) expect(res.body).toEqual({ error: 'Google sign-in is not configured' });
    else expect(res.body).toEqual({ error: 'invalid Google credential' });
  });
});
