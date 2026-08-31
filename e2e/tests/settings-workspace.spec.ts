import { test, expect } from '@playwright/test';
import { requireBackend, SEED_OPERATOR } from './support/stack';

// Screen: /settings/workspace — docs/shared/workspace.md
// Card: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/04-module-3.md
//   ("Settings: Workspace")
//
// GET/POST /api/workspace/* have no backend implementation yet
// (docs/shared/workspace.md, "API calls (proposed — not yet implemented)"),
// so this stubs both and drives login/routing against the real stack, same
// posture as settings-platforms.spec.ts.

test.describe('Workspace', () => {
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

  test('sending an invite immediately shows the pending member row with a derived display name', async ({ page }) => {
    await page.route('**/api/workspace/members', (route) =>
      route.fulfill({
        json: [{ name: 'Ramon Dela Cruz Jr.', email: SEED_OPERATOR.email, role: 'Owner', initials: 'RD' }],
      }),
    );
    let inviteRequestBody: unknown = null;
    await page.route('**/api/workspace/invite', async (route) => {
      inviteRequestBody = route.request().postDataJSON();
      await route.fulfill({ json: { ok: true } });
    });

    await login(page);
    await page.goto('/settings/workspace');

    await expect(page.getByText('Ramon Dela Cruz Jr.')).toBeVisible();

    await page.getByLabel(/invite by email/i).fill('hana.kim@sunsetcove.ph');
    await page.getByLabel(/role/i).selectOption('Viewer');
    await page.getByRole('button', { name: /send invite/i }).click();

    // Appears immediately, before the (stubbed) request necessarily resolves.
    await expect(page.getByText('Hana Kim')).toBeVisible();
    await expect(page.getByText('hana.kim@sunsetcove.ph')).toBeVisible();
    await expect(page.getByText('Invite pending')).toBeVisible();

    await expect.poll(() => inviteRequestBody).toEqual({ email: 'hana.kim@sunsetcove.ph', role: 'Viewer' });
  });

  test('a confirmation toast appears after sending an invite', async ({ page }) => {
    await page.route('**/api/workspace/members', (route) => route.fulfill({ json: [] }));
    await page.route('**/api/workspace/invite', (route) => route.fulfill({ json: { ok: true } }));

    await login(page);
    await page.goto('/settings/workspace');

    await page.getByLabel(/invite by email/i).fill('jun@sunsetcove.ph');
    await page.getByRole('button', { name: /send invite/i }).click();

    await expect(page.getByText(/invite sent to jun@sunsetcove\.ph/i)).toBeVisible();
  });
});
