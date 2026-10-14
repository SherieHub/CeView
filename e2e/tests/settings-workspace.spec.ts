import { test, expect } from '@playwright/test';
import { requireBackend, SEED_OPERATOR } from './support/stack';

// Screen: /settings/workspace — docs/shared/workspace.md
//
// GET/POST /api/workspace/* have no backend implementation yet. This spec used to
// stub both routes and then assert the screen worked — a pass against a server that
// does not exist, while the real page spun forever and toasted "Invite sent" for an
// invite that went nowhere. It now asserts what an operator actually sees on the
// real stack, plus one flow against an explicitly SIMULATED backend.

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByPlaceholder('you@example.com').fill(SEED_OPERATOR.email);
  await page.getByPlaceholder('••••••••').fill(SEED_OPERATOR.password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test.describe('Workspace — real stack (no workspace backend)', () => {
  test.beforeEach(async () => {
    await requireBackend();
  });

  test('says team members are not available yet and disables invites', async ({ page }) => {
    await login(page);
    await page.goto('/settings/workspace');

    await expect(page.getByText(/team members and invites aren't available yet/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /send invite/i })).toBeDisabled();
    await expect(page.getByText(/invite sent to/i)).toHaveCount(0);
  });
});

test.describe('Workspace — SIMULATED backend (/api/workspace/* stubbed)', () => {
  test.beforeEach(async () => {
    await requireBackend();
  });

  test('an accepted invite adds a pending row and a confirmation toast', async ({ page }) => {
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

    // The row and toast appear only after the server accepted the invite.
    const pendingRow = page.getByRole('listitem').filter({ hasText: 'Hana Kim' });
    await expect(pendingRow).toBeVisible();
    await expect(pendingRow.getByText('Invite pending')).toBeVisible();
    await expect(page.getByText(/invite sent to hana\.kim@sunsetcove\.ph/i)).toBeVisible();
    await expect.poll(() => inviteRequestBody).toEqual({ email: 'hana.kim@sunsetcove.ph', role: 'Viewer' });
  });

  test('a rejected invite adds no row and never claims it was sent', async ({ page }) => {
    await page.route('**/api/workspace/members', (route) => route.fulfill({ json: [] }));
    await page.route('**/api/workspace/invite', (route) => route.fulfill({ status: 500, json: {} }));

    await login(page);
    await page.goto('/settings/workspace');

    await page.getByLabel(/invite by email/i).fill('jun@sunsetcove.ph');
    await page.getByRole('button', { name: /send invite/i }).click();

    await expect(page.getByText(/could not send the invite/i)).toBeVisible();
    await expect(page.getByText(/invite sent to/i)).toHaveCount(0);
    await expect(page.getByRole('listitem').filter({ hasText: 'Jun' })).toHaveCount(0);
  });
});
