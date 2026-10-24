import { expect, type Page } from '@playwright/test';
import { signIn, type Operator } from './operator';

/** The seeded alert's title for a (market, category) pair: "Demand window alert — <market> — <category>". */
export const alertTitle = (market: string, category: string) => `Demand window alert — ${market} — ${category}`;

export const alertCard = (page: Page, title?: string | RegExp) =>
  page.locator('button.alert-card', title ? { hasText: title } : undefined);

export const statTile = (page: Page, label: string | RegExp) =>
  page.locator('.stat-tile', { has: page.locator('.stat-label', { hasText: label }) });

export const marketsPanel = (page: Page) => page.getByRole('region', { name: 'Top International Market' });

export const radarDrawer = (page: Page, marketName: string) =>
  page.getByRole('dialog', { name: `${marketName} market radar` });

/** Signs in and waits for the dashboard to finish loading (alerts listed, or an empty state shown). */
export async function openDashboard(page: Page, op: Operator, query = '') {
  await signIn(page, op, `/dashboard${query}`);
  await expect(page.getByRole('heading', { name: 'Surge Alerts', exact: true })).toBeVisible();
  await expect(page.locator('section[aria-label="Surge Alerts"][aria-busy="true"]')).toHaveCount(0, { timeout: 60_000 });
}

/**
 * Opens the dashboard, selects the first alert (which loads the ranked markets) and clicks the
 * given market's card, leaving that market's radar drawer open.
 */
export async function openRadar(page: Page, op: Operator, marketName = 'South Korea') {
  await openDashboard(page, op);
  await alertCard(page).first().click();
  await marketsPanel(page).locator('.rank-card', { hasText: marketName }).click();
  await expect(radarDrawer(page, marketName)).toBeVisible();
}
