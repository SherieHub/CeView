import { requireBackend } from '../support/stack';
import { test, expect, useOperator } from '../support/fixtures';
import { signIn } from '../support/operator';
import { expectNoHorizontalOverflow } from '../support/ui';

// At phone width the sidebar becomes a slide-over opened from the top bar's Menu button.
// All tests here carry @mobile so they run only in the Pixel 7 project.
const op = useOperator('shell-mobile', { demandWindow: true });

test.beforeEach(async () => {
  await requireBackend();
});

const burger = (page: import('@playwright/test').Page) => page.getByRole('button', { name: 'Menu', exact: true });
const wrap = (page: import('@playwright/test').Page) => page.locator('.app-wrap');
const rail = (page: import('@playwright/test').Page) => page.getByRole('navigation', { name: 'Main', exact: true });

test.describe('Mobile navigation', () => {
  test('@mobile the rail starts closed and the Menu button opens it', async ({ page }) => {
    await signIn(page, op.current, '/dashboard');
    await expect(wrap(page)).toHaveAttribute('data-sidebar-open', 'false');
    await expect(burger(page)).toHaveAttribute('aria-expanded', 'false');
    await burger(page).click();
    await expect(wrap(page)).toHaveAttribute('data-sidebar-open', 'true');
    await expect(burger(page)).toHaveAttribute('aria-expanded', 'true');
    await expect(rail(page).getByRole('button', { name: 'Calendar', exact: true })).toBeInViewport();
  });

  test('@mobile the Close menu backdrop closes the rail', async ({ page }) => {
    await signIn(page, op.current, '/dashboard');
    await burger(page).click();
    await page.getByRole('button', { name: 'Close menu' }).click({ position: { x: 380, y: 400 } });
    await expect(wrap(page)).toHaveAttribute('data-sidebar-open', 'false');
  });

  test('@mobile choosing a destination navigates and closes the rail', async ({ page }) => {
    await signIn(page, op.current, '/dashboard');
    await burger(page).click();
    await rail(page).getByRole('button', { name: 'Calendar', exact: true }).click();
    await expect(page).toHaveURL(/\/calendar$/);
    await expect(wrap(page)).toHaveAttribute('data-sidebar-open', 'false');
  });

  test('@mobile signing out from the rail returns to /login', async ({ page }) => {
    await signIn(page, op.current, '/dashboard');
    await burger(page).click();
    await rail(page).getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/login$/);
  });

  for (const route of ['/dashboard', '/content', '/calendar', '/performance', '/settings/profile', '/settings/platforms', '/settings/workspace']) {
    test(`@mobile ${route} does not scroll sideways`, async ({ page }) => {
      await signIn(page, op.current, route);
      await expect(burger(page)).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });
  }
});

test.describe('Desktop navigation', () => {
  test('the Menu button is hidden at desktop width, where the rail is always shown', async ({ page }) => {
    await signIn(page, op.current, '/dashboard');
    await expect(burger(page)).toBeHidden();
    await expect(rail(page)).toBeVisible();
  });
});
