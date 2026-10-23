import type { Page } from '@playwright/test';
import { requireBackend, requireTestSupport } from '../support/stack';
import { test, expect, useOperator } from '../support/fixtures';
import { alertCard, openDashboard, statTile } from '../support/dashboard';
import { expectScrimOff, scrim } from '../support/ui';

// "Top Philippines Region Market" — a labelled PREVIEW: the regional figures are illustrative
// (frontend/components/module-2/2.1-dashboard/regionSamples.ts), not live forecasts.
const op = useOperator('dash-regions', { demandWindow: true });

test.beforeEach(async () => {
  await requireBackend();
  await requireTestSupport();
});

const panel = (page: Page) => page.locator('section.dash-regions');
const region = (page: Page, name: string) => page.getByRole('dialog', { name: `${name} region details` });

async function selectAlert(page: Page) {
  await openDashboard(page, op.current);
  await alertCard(page).click();
}

test.describe('Region ranking', () => {
  test('is labelled as a preview, and asks for an alert before listing regions', async ({ page }) => {
    await openDashboard(page, op.current);
    await expect(panel(page).getByRole('heading', { name: /Top Philippines Region Market/ })).toBeVisible();
    await expect(panel(page).getByText('Preview rankings — live regional forecasts are not available yet.')).toBeAttached();
    await expect(panel(page).getByText('Select a surge alert')).toBeVisible();
    await expect(panel(page).locator('.rank-card')).toHaveCount(0);
  });

  test('lists 17 regions in score order once an alert is selected', async ({ page }) => {
    await selectAlert(page);
    const cards = panel(page).locator('.rank-card');
    await expect(cards).toHaveCount(17);
    await expect(cards.first().locator('h3')).toHaveText('CALABARZON');
    await expect(cards.first().locator('.rank-pts')).toContainText('78');
    await expect(cards.first()).toHaveAttribute('data-lead', 'true');
    await expect(cards.last().locator('h3')).toHaveText('BARMM');
    await expect(cards.last().locator('.rank-pts')).toContainText('35');
    const scores = (await cards.locator('.rank-pts').allInnerTexts()).map((t) => Number(t.match(/\d+/)![0]));
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  test('shows the selected alert\'s category beside the heading', async ({ page }) => {
    await selectAlert(page);
    await expect(panel(page).locator('.markets-note')).toHaveText('Coastal & Island');
  });

  test('collapsing the alert returns to the placeholder', async ({ page }) => {
    await selectAlert(page);
    await alertCard(page).click();
    await expect(panel(page).getByText('Select a surge alert')).toBeVisible();
  });
});

test.describe('Region drawer', () => {
  test('opens from a region row with a preview notice, and Escape closes it', async ({ page }) => {
    await selectAlert(page);
    await panel(page).getByRole('button', { name: 'View Metro Manila region details' }).click();
    const d = region(page, 'Metro Manila');
    await expect(d).toBeVisible();
    await expect(d.getByRole('heading', { name: 'Metro Manila' })).toBeVisible();
    await expect(d.getByText('Preview data')).toBeVisible();
    await expect(d).toContainText('Live regional forecasts are not available yet.');
    await expect(scrim(page)).toHaveClass(/\bon\b/);
    await page.keyboard.press('Escape');
    await expect(page.locator('.drawer[data-open="true"]')).toHaveCount(0);
    await expectScrimOff(page);
  });

  test('has the same sections as a market radar: signals, forecast, insights, carriers', async ({ page }) => {
    await selectAlert(page);
    await panel(page).getByRole('button', { name: 'View CALABARZON region details' }).click();
    const d = region(page, 'CALABARZON');
    await expect(d.getByRole('heading', { name: 'Demand Forecast' })).toBeVisible();
    await expect(d.getByRole('tab', { name: 'Purchasing Power' })).toHaveAttribute('aria-selected', 'true');
    await d.getByRole('tab', { name: 'Seasonal Patterns' }).click();
    await expect(d.locator('#radar-panel-season')).toBeVisible();
    await expect(d.getByRole('region', { name: 'Route and carriers' })).toBeVisible();
  });

  test('the Philippines tile opens the leading region without selecting an alert', async ({ page }) => {
    await openDashboard(page, op.current);
    await statTile(page, 'Top market for Philippines').click();
    await expect(region(page, 'CALABARZON')).toBeVisible();
  });

  test('the dropdown switcher moves between regions', async ({ page }) => {
    await selectAlert(page);
    await panel(page).getByRole('button', { name: 'View CALABARZON region details' }).click();
    const d = region(page, 'CALABARZON');
    await d.getByRole('button', { name: 'Switch region: CALABARZON' }).click();
    const menu = d.getByRole('menu', { name: 'Switch region' });
    await expect(menu.getByRole('menuitemradio')).toHaveCount(17);
    await expect(menu.getByRole('menuitemradio', { name: /CALABARZON/ })).toHaveAttribute('aria-checked', 'true');
    await menu.getByRole('menuitemradio', { name: /Davao Region/ }).click();
    await expect(region(page, 'Davao Region')).toBeVisible();
    await expect(region(page, 'Davao Region').getByRole('button', { name: 'Switch region: Davao Region' })).toBeFocused();
  });

  test('Escape closes only the open switcher first, then the drawer', async ({ page }) => {
    await selectAlert(page);
    await panel(page).getByRole('button', { name: 'View CALABARZON region details' }).click();
    const d = region(page, 'CALABARZON');
    await d.getByRole('button', { name: 'Switch region: CALABARZON' }).click();
    await expect(d.getByRole('menu', { name: 'Switch region' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(d.getByRole('menu', { name: 'Switch region' })).toHaveCount(0);
    await expect(d).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.drawer[data-open="true"]')).toHaveCount(0);
  });

  test('arrow keys move through the switcher menu', async ({ page }) => {
    await selectAlert(page);
    await panel(page).getByRole('button', { name: 'View CALABARZON region details' }).click();
    const d = region(page, 'CALABARZON');
    await d.getByRole('button', { name: 'Switch region: CALABARZON' }).click();
    const items = d.getByRole('menuitemradio');
    await expect(items.first()).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(items.nth(1)).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(items.first()).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(items.last()).toBeFocused();
  });

  test('"Target this market" is disabled and explains why', async ({ page }) => {
    await selectAlert(page);
    await panel(page).getByRole('button', { name: 'View CALABARZON region details' }).click();
    const d = region(page, 'CALABARZON');
    const target = d.getByRole('button', { name: /Target this market/ });
    await expect(target).toBeDisabled();
    await expect(target).toHaveAttribute('title', /Regional targeting isn't available yet/);
    await expect(d.locator('.radar-target-note')).toContainText("Regional targeting isn't available yet");
  });

  // STUB: Content Studio can only target the three international markets today.
  test.fixme('"Target this market" in a region drawer targets that region in Content Studio', async ({ page }) => {
    await selectAlert(page);
    await panel(page).getByRole('button', { name: 'View CALABARZON region details' }).click();
    await region(page, 'CALABARZON').getByRole('button', { name: /Target this market/ }).click();
    await expect(page).toHaveURL(/\/content$/);
    await expect(page.getByText('CALABARZON')).toBeVisible();
  });
});
