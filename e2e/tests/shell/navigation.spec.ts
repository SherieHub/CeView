import { requireBackend } from '../support/stack';
import { test, expect, useOperator } from '../support/fixtures';
import { signIn, signInViaUi } from '../support/operator';
import { expectSameDocument, markDocument } from '../support/ui';

// The app shell's sidebar. One onboarded operator with a seeded forecast is shared by the file.
const op = useOperator('shell-nav', { demandWindow: true });

test.beforeEach(async () => {
  await requireBackend();
});

const ITEMS = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Content Studio', path: '/content' },
  { label: 'Calendar', path: '/calendar' },
  { label: 'Performance', path: '/performance' },
  { label: 'Business Profile', path: '/settings/profile' },
  { label: 'Platforms', path: '/settings/platforms' },
  { label: 'Workspace', path: '/settings/workspace' },
] as const;

const nav = (page: import('@playwright/test').Page) => page.getByRole('navigation', { name: 'Main', exact: true });
const item = (page: import('@playwright/test').Page, label: string) => nav(page).getByRole('button', { name: label, exact: true });

test.describe('Sidebar', () => {
  test('lists the seven destinations under four section headings', async ({ page }) => {
    await signIn(page, op.current, '/dashboard');
    for (const section of ['Intelligence', 'Create', 'Measure', 'Settings']) {
      await expect(nav(page).getByText(section, { exact: true })).toBeVisible();
    }
    for (const { label } of ITEMS) await expect(item(page, label)).toBeVisible();
  });

  for (const { label, path } of ITEMS) {
    test(`${path} marks "${label}" as the current page, and only that item`, async ({ page }) => {
      await signIn(page, op.current, path);
      await expect(item(page, label)).toHaveAttribute('aria-current', 'page');
      await expect(nav(page).locator('[aria-current="page"]')).toHaveCount(1);
    });
  }

  test('clicking each destination navigates without reloading the page', async ({ page }) => {
    await signIn(page, op.current, '/dashboard');
    const mark = await markDocument(page);
    for (const { label, path } of ITEMS.slice(1)) {
      await item(page, label).click();
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(item(page, label)).toHaveAttribute('aria-current', 'page');
    }
    await item(page, 'Dashboard').click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expectSameDocument(page, mark);
  });

  test('browser back and forward move between destinations', async ({ page }) => {
    await signIn(page, op.current, '/dashboard');
    await item(page, 'Calendar').click();
    await item(page, 'Performance').click();
    await page.goBack();
    await expect(page).toHaveURL(/\/calendar$/);
    await expect(item(page, 'Calendar')).toHaveAttribute('aria-current', 'page');
    await page.goBack();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goForward();
    await expect(page).toHaveURL(/\/calendar$/);
  });

  test('the rail shows who is signed in', async ({ page }) => {
    await signIn(page, op.current, '/dashboard');
    await expect(nav(page).getByText(op.current.email)).toBeVisible();
  });
});

test.describe('Collapsing the sidebar', () => {
  test('the toggle collapses and expands the rail, and the choice survives a reload', async ({ page }) => {
    await signIn(page, op.current, '/dashboard');
    const wrap = page.locator('.app-wrap');
    await expect(wrap).toHaveAttribute('data-collapsed', 'false');
    const toggle = nav(page).getByRole('button', { name: 'Collapse sidebar' });
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await toggle.click();
    await expect(wrap).toHaveAttribute('data-collapsed', 'true');
    await expect(nav(page).getByRole('button', { name: 'Expand sidebar' })).toHaveAttribute('aria-expanded', 'false');
    expect(await page.evaluate(() => localStorage.getItem('ceview.sidebarCollapsed'))).toBe('true');

    await page.reload();
    await expect(wrap).toHaveAttribute('data-collapsed', 'true');
    // Collapsed items are still usable (their label becomes a tooltip).
    await expect(item(page, 'Calendar')).toHaveAttribute('title', 'Calendar');
    await item(page, 'Calendar').click();
    await expect(page).toHaveURL(/\/calendar$/);

    await nav(page).getByRole('button', { name: 'Expand sidebar' }).click();
    await expect(wrap).toHaveAttribute('data-collapsed', 'false');
    expect(await page.evaluate(() => localStorage.getItem('ceview.sidebarCollapsed'))).toBe('false');
  });
});

test.describe('Signing out from the sidebar', () => {
  test('clears the session and returns to the landing page, and a reload stays signed out', async ({ page }) => {
    await signInViaUi(page, op.current.email, op.current.password);
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });
    await nav(page).getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/$/);
    expect(await page.evaluate(() => localStorage.getItem('ceview.auth'))).toBeNull();
    await page.reload();
    await expect(page).toHaveURL(/\/$/);
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/$/);
  });
});

test.describe('Unread-alert badge', () => {
  // KNOWN BUG: the Dashboard row is meant to carry the unread-alert count, but UnreadAlertsProvider
  // (services/unreadAlertsStore.tsx) is never mounted in App.tsx, so useUnreadAlerts() always returns
  // the no-op store and the badge never renders.
  test.fail('the Dashboard row shows the number of unread alerts', async ({ page }) => {
    await signIn(page, op.current, '/dashboard');
    await expect(item(page, 'Dashboard').locator('.sb-badge')).toHaveText(/1/);
  });
});

test.describe('Notifications bell', () => {
  // STUB: the bell is rendered disabled with the tooltip "Not wired yet".
  test.fixme('opens a list of the operator\'s alerts', async ({ page }) => {
    await signIn(page, op.current, '/dashboard');
    const bell = page.getByRole('button', { name: 'Notifications' });
    await expect(bell).toBeEnabled();
    await bell.click();
    await expect(page.getByRole('dialog', { name: /notifications/i })).toBeVisible();
  });
});
