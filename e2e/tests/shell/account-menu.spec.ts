import { requireBackend } from '../support/stack';
import { test, expect } from '../support/fixtures';
import { provisionOperator, signIn } from '../support/operator';
import { PNG_1X1 } from '../support/files';

// The top bar's account menu.
test.beforeEach(async () => {
  await requireBackend();
});

const BUSINESS = 'Reef Divers';
const avatar = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: `Account menu for ${BUSINESS}` });
const menu = (page: import('@playwright/test').Page) => page.getByRole('menu', { name: 'Account' });

async function openAs(page: import('@playwright/test').Page, extra: { imagePreview?: string } = {}) {
  const op = await provisionOperator('shell-account', { businessName: BUSINESS, demandWindow: true, ...extra });
  await signIn(page, op, '/dashboard');
  await expect(avatar(page)).toBeVisible();
  return op;
}

test.describe('Account menu', () => {
  test('the avatar shows the business initials and is named for the business', async ({ page }) => {
    await openAs(page);
    await expect(avatar(page)).toContainText('RD');
    await expect(avatar(page)).toHaveAttribute('aria-haspopup', 'menu');
    await expect(avatar(page)).toHaveAttribute('aria-expanded', 'false');
  });

  test('a saved profile photo replaces the initials', async ({ page }) => {
    await openAs(page, { imagePreview: `data:image/png;base64,${PNG_1X1.toString('base64')}` });
    await expect(avatar(page).locator('img.topbar-avatar-img')).toHaveAttribute('src', /^data:image\/png/);
    await expect(avatar(page)).not.toContainText('RD');
  });

  test('opening it shows the business name and email', async ({ page }) => {
    const op = await openAs(page);
    await avatar(page).click();
    await expect(avatar(page)).toHaveAttribute('aria-expanded', 'true');
    await expect(menu(page)).toBeVisible();
    await expect(menu(page).getByText(BUSINESS, { exact: true })).toBeVisible();
    await expect(menu(page).getByText(op.email, { exact: true })).toBeVisible();
    await expect(menu(page).getByRole('menuitem')).toHaveText(['View profile', 'Sign out']);
  });

  test('"View profile" opens Settings → Business Profile and closes the menu', async ({ page }) => {
    await openAs(page);
    await avatar(page).click();
    await menu(page).getByRole('menuitem', { name: 'View profile' }).click();
    await expect(page).toHaveURL(/\/settings\/profile$/);
    await expect(menu(page)).toHaveCount(0);
  });

  test('"Sign out" ends the session', async ({ page }) => {
    await openAs(page);
    await avatar(page).click();
    await menu(page).getByRole('menuitem', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/$/);
    expect(await page.evaluate(() => localStorage.getItem('ceview.auth'))).toBeNull();
  });

  test('Escape closes the menu', async ({ page }) => {
    await openAs(page);
    await avatar(page).click();
    await expect(menu(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menu(page)).toHaveCount(0);
    await expect(avatar(page)).toHaveAttribute('aria-expanded', 'false');
  });

  test('clicking outside closes the menu', async ({ page }) => {
    await openAs(page);
    await avatar(page).click();
    await expect(menu(page)).toBeVisible();
    await page.locator('main').click({ position: { x: 5, y: 5 } });
    await expect(menu(page)).toHaveCount(0);
  });

  test('clicking the avatar again toggles it closed', async ({ page }) => {
    await openAs(page);
    await avatar(page).click();
    await avatar(page).click();
    await expect(menu(page)).toHaveCount(0);
  });

  test('the notifications bell is present but disabled (not built yet)', async ({ page }) => {
    await openAs(page);
    const bell = page.getByRole('button', { name: 'Notifications' });
    await expect(bell).toBeDisabled();
    await expect(bell).toHaveAttribute('title', 'Not wired yet');
  });
});
