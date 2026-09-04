import { test, expect } from '@playwright/test';
import { requireBackend, SEED_OPERATOR } from './support/stack';

// Screen: /settings/profile — docs/module-1/screens/settings-business-profile.md
// Card: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/02-module-1.md
//   ("Settings: Business Profile")
//
// Real docker-compose stack, same pattern as journey.spec.ts — PUT
// /api/business-profile is a real, implemented endpoint (also used by
// onboarding), unlike the Platforms/Workspace endpoints below in this
// directory, which are still proposed-only.

test.describe('Business Profile', () => {
  test.beforeEach(async () => {
    await requireBackend();
  });

  async function login(page: import('@playwright/test').Page) {
    await page.goto('/');
    await page.getByPlaceholder('you@example.com').fill(SEED_OPERATOR.email);
    await page.getByPlaceholder('••••••••').fill(SEED_OPERATOR.password);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  }

  test('editing a field and clicking Save persists via PUT /api/business-profile', async ({ page }) => {
    await login(page);
    await page.goto('/settings/profile');

    const nameField = page.getByLabel(/business name/i);
    const original = await nameField.inputValue();
    const edited = `${original} (e2e)`;

    const [saveResponse] = await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/business-profile') && res.request().method() === 'PUT',
      ),
      (async () => {
        await nameField.fill(edited);
        await page.getByRole('button', { name: /save changes/i }).click();
      })(),
    ]);
    expect(saveResponse.ok()).toBe(true);
    await expect(page.getByText(/business profile saved/i)).toBeVisible();

    // Verify the write actually persisted server-side, not just the toast:
    // reload fresh (a new ProfileProvider, refetching GET /api/business-profile)
    // and confirm the edited value comes back.
    await page.reload();
    await expect(page.getByLabel(/business name/i)).toHaveValue(edited);

    // Restore the seed so this test (and every other spec depending on
    // this operator's business name) stays idempotent across runs.
    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/business-profile') && res.request().method() === 'PUT',
      ),
      (async () => {
        await page.getByLabel(/business name/i).fill(original);
        await page.getByRole('button', { name: /save changes/i }).click();
      })(),
    ]);
    await expect(page.getByText(/business profile saved/i)).toBeVisible();
  });

  test('removing the last remaining category is blocked with a toast', async ({ page }) => {
    await login(page);
    await page.goto('/settings/profile');

    // The seeded operator (SEED_CREDENTIALS.md) has exactly one category —
    // Coastal & Island — so it's already the last remaining one.
    const chip = page.getByRole('button', { name: 'Coastal & Island' });
    await expect(chip).toHaveAttribute('aria-pressed', 'true');

    await chip.click();

    await expect(chip).toHaveAttribute('aria-pressed', 'true'); // unchanged — blocked
    await expect(page.getByText(/at least one category must stay selected/i)).toBeVisible();
  });
});
