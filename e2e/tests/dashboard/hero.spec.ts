import { requireBackend, requireTestSupport } from '../support/stack';
import { test, expect, useOperator } from '../support/fixtures';
import { provisionOperator } from '../support/operator';
import { pngFile, textFile } from '../support/files';
import { toast, expectNoHorizontalOverflow } from '../support/ui';
import { openDashboard } from '../support/dashboard';

// The dashboard's hero: greeting, uniqueness badge and the cover-photo menu.
const op = useOperator('dash-hero', { demandWindow: true, businessName: 'Reef Divers', uniquenessScore: 0.62 });

test.beforeEach(async () => {
  await requireBackend();
  await requireTestSupport();
});

const editButton = (page: import('@playwright/test').Page) => page.getByRole('button', { name: 'Edit cover photo' });
const coverMenu = (page: import('@playwright/test').Page) => page.getByRole('menu', { name: 'Cover photo' });
const customCover = (page: import('@playwright/test').Page) => page.locator('.dash-hero-photo img[src^="data:"]');

test.describe('Greeting and uniqueness badge', () => {
  test('greets the business by name', async ({ page }) => {
    await openDashboard(page, op.current);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Good morning,');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Reef Divers');
  });

  test('the subtitle invites the operator to pick an alert when there are alerts', async ({ page }) => {
    await openDashboard(page, op.current);
    await expect(page.getByText('Select an alert to see the markets ranked for its category.')).toBeVisible();
  });

  test('shows the uniqueness score as a 0–100 figure (stored as 0–1)', async ({ page }) => {
    await openDashboard(page, op.current);
    const badge = page.locator('.score-badge');
    await expect(badge.locator('.score-badge-disc')).toHaveText('62');
    await expect(badge).toContainText('Uniqueness');
  });

  test('rounds the score to a whole number', async ({ page }) => {
    const rounded = await provisionOperator('dash-hero-round', { demandWindow: true, uniquenessScore: 0.4449 });
    await openDashboard(page, rounded);
    await expect(page.locator('.score-badge-disc')).toHaveText('44');
  });

  // KNOWN BUG: onboarding saves 0 for a cohort too small to rank (so the operator can pass the
  // profile gate), and the dashboard then prints "0 Uniqueness" — the worst possible score — for a
  // business that was never ranked. AnalysisStep promises "no number" in that case.
  test.fail('an operator who was never ranked does not see a "0" uniqueness badge', async ({ page }) => {
    const unranked = await provisionOperator('dash-hero-unranked', { demandWindow: true, uniquenessScore: 0 });
    await openDashboard(page, unranked);
    await expect(page.locator('.score-badge-disc')).toHaveCount(0);
  });
});

test.describe('Cover photo', () => {
  test('the menu offers an upload, names the default photo\'s credit, and closes on Escape', async ({ page }) => {
    await openDashboard(page, op.current);
    await editButton(page).click();
    await expect(editButton(page)).toHaveAttribute('aria-expanded', 'true');
    await expect(coverMenu(page).getByRole('menuitem', { name: 'Upload a new photo' })).toBeVisible();
    await expect(coverMenu(page).getByRole('menuitem', { name: 'Use the default photo' })).toHaveCount(0);
    await expect(coverMenu(page)).toContainText('Current photo:');
    await page.keyboard.press('Escape');
    await expect(coverMenu(page)).toHaveCount(0);
  });

  test('clicking outside closes the menu', async ({ page }) => {
    await openDashboard(page, op.current);
    await editButton(page).click();
    await page.getByRole('heading', { name: 'Surge Alerts' }).click();
    await expect(coverMenu(page)).toHaveCount(0);
  });

  test('uploading a photo replaces the default, survives a reload, and can be reset', async ({ page }) => {
    const own = await provisionOperator('dash-hero-cover', { demandWindow: true });
    await openDashboard(page, own);
    await expect(customCover(page)).toHaveCount(0);

    await page.getByTestId('cover-photo-input').setInputFiles(pngFile('cover.png'));
    await expect(toast(page, 'Cover photo updated')).toBeVisible();
    await expect(customCover(page)).toHaveAttribute('src', /^data:image\/jpeg;base64,/);

    await page.reload();
    await expect(customCover(page)).toHaveAttribute('src', /^data:image\/jpeg;base64,/);

    await editButton(page).click();
    await expect(coverMenu(page).getByRole('menuitem', { name: 'Upload a new photo' })).toBeVisible();
    await coverMenu(page).getByRole('menuitem', { name: 'Use the default photo' }).click();
    await expect(toast(page, 'Cover photo reset to the default')).toBeVisible();
    await expect(customCover(page)).toHaveCount(0);
    await page.reload();
    await expect(customCover(page)).toHaveCount(0);
  });

  test('a file that is not an image is rejected with a toast and changes nothing', async ({ page }) => {
    const own = await provisionOperator('dash-hero-badcover', { demandWindow: true });
    await openDashboard(page, own);
    await page.getByTestId('cover-photo-input').setInputFiles(textFile());
    await expect(toast(page, 'That file could not be used as a photo')).toBeVisible();
    await expect(customCover(page)).toHaveCount(0);
  });

  test('each operator keeps their own cover photo in the browser', async ({ page }) => {
    const a = await provisionOperator('dash-hero-cover-a', { demandWindow: true });
    const b = await provisionOperator('dash-hero-cover-b', { demandWindow: true });
    await openDashboard(page, a);
    await page.getByTestId('cover-photo-input').setInputFiles(pngFile());
    await expect(customCover(page)).toBeVisible();
    await openDashboard(page, b);
    await expect(customCover(page)).toHaveCount(0);
  });
});

test.describe('Refresh forecast', () => {
  test('the button is present and enabled', async ({ page }) => {
    await openDashboard(page, op.current);
    await expect(page.getByRole('button', { name: 'Refresh forecast' })).toBeEnabled();
  });
});

test.describe('Phone layout', () => {
  test('@mobile the hero and the page fit a phone screen', async ({ page }) => {
    await openDashboard(page, op.current);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('.score-badge')).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});
