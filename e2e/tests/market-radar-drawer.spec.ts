import { expect, test } from '@playwright/test';
import { mockModule2Api, seedAuthenticatedContentRoute } from './module2Fixtures';

test.describe('Module 2 Market Radar drawer', () => {
  test('opens from a category ranking, renders chart and both tabs with missing trend data', async ({ page }) => {
    await mockModule2Api(page);
    await page.goto('/preview/dashboard');
    await expect(page.getByRole('button', { name: /Demand window — South Korea/ })).toBeVisible();
    await page.getByRole('button', { name: /Demand window — South Korea/ }).click();
    await page.getByLabel('Top Target Markets').getByRole('button', { name: /South Korea/ }).click();

    await expect(page.getByRole('dialog', { name: /South Korea market radar/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Demand Forecast' })).toBeVisible();
    await expect(page.getByText('No trend data available')).toHaveCount(2);
    await page.getByRole('tab', { name: 'Seasonal Patterns' }).click();
    await expect(page.getByText('Seasonality index')).toBeVisible();
    await page.getByRole('tab', { name: 'Purchasing Power' }).click();
    await expect(page.getByText('Fare reference: reference')).toBeVisible();
  });

  test('hands the selected market to Module 3', async ({ page }) => {
    await seedAuthenticatedContentRoute(page);
    await mockModule2Api(page);
    await page.goto('/preview/dashboard');
    await expect(page.getByRole('button', { name: /Demand window — South Korea/ })).toBeVisible();
    await page.getByRole('button', { name: /Demand window — South Korea/ }).click();
    await page.getByLabel('Top Target Markets').getByRole('button', { name: /South Korea/ }).click();
    await page.getByRole('button', { name: 'Target this market' }).click();
    await expect(page).toHaveURL(/\/content$/);
  });
});
