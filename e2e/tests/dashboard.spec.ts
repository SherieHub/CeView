import { expect, test } from '@playwright/test';
import { mockModule2Api } from './module2Fixtures';

test.describe('Module 2 dashboard', () => {
  test('cold load shows the empty state, then refresh reveals persisted alerts', async ({ page }) => {
    await mockModule2Api(page, { initiallyEmpty: true });
    await page.goto('/preview/dashboard');
    await expect(page.getByText('No notifications yet')).toBeVisible();

    await page.getByRole('button', { name: 'Refresh forecast' }).click();
    await expect(page.getByText('Demand window — South Korea')).toBeVisible();
    await expect(page.getByText('Forecast refreshed — 3 markets re-ranked')).toBeVisible();
  });

  test('selecting an alert loads rankings for its category', async ({ page }) => {
    await mockModule2Api(page);
    await page.goto('/preview/dashboard');
    await page.getByRole('button', { name: /Demand window — South Korea/ }).click();

    await expect(page.getByRole('heading', { name: 'Top Target Markets' })).toBeVisible();
    await expect(page.getByLabel('Top Target Markets').getByText('Accommodation & Staycation')).toBeVisible();
    await expect(page.getByLabel('Top Target Markets').getByRole('button', { name: /South Korea/ })).toBeVisible();
  });

  test('keeps cached alerts visible in AI-down mode', async ({ page }) => {
    await mockModule2Api(page, { aiDown: true });
    await page.goto('/preview/dashboard');
    await expect(page.getByText('AI Forecast Service Unavailable.')).toBeVisible();
    await expect(page.getByText('Demand window — South Korea')).toBeVisible();
  });
});
