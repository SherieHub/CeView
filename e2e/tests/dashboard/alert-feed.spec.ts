import { api } from '../support/api';
import { requireBackend, requireTestSupport } from '../support/stack';
import { test, expect, useOperator } from '../support/fixtures';
import { provisionOperator, updateProfile } from '../support/operator';
import { seedDemandWindow } from '../support/demandWindow';
import { alertCard, alertTitle, marketsPanel, openDashboard, statTile } from '../support/dashboard';

// "Surge Alerts" — the list of demand-window alerts for the operator's categories.
const op = useOperator('dash-feed', { demandWindow: true });

test.beforeEach(async () => {
  await requireBackend();
  await requireTestSupport();
});

test.describe('An alert card', () => {
  test('shows the date, title, message, market, category and trend', async ({ page }) => {
    await openDashboard(page, op.current);
    const card = alertCard(page, alertTitle('South Korea', 'Coastal & Island'));
    await expect(card).toBeVisible();
    await expect(card.locator('.text-meta').first()).toHaveText(/^[A-Z][a-z]{2} \d{1,2}, \d{4}$/);
    await expect(card).toContainText('Demand window detected for South Korea');
    await expect(card).toContainText('38.0% above the rolling baseline');
    await expect(card.locator('.chip-row .chip').nth(0)).toHaveText('South Korea');
    await expect(card.locator('.chip-row .chip').nth(1)).toHaveText('Coastal & Island');
    await expect(card.locator('.chip-row .chip').nth(2)).toHaveText('Rising demand window');
    await expect(card).toContainText('View target markets');
  });

  test('a warning-level alert is flagged as a surge and is unread', async ({ page }) => {
    await openDashboard(page, op.current);
    const card = alertCard(page);
    await expect(card.locator('.chip--critical')).toContainText('Surge');
    await expect(card.locator('.alert-dot')).toBeVisible();
    await expect(card.locator('.sr', { hasText: 'Unread' })).toHaveCount(1);
  });

  test('a critical alert reads "Critical demand window"', async ({ page }) => {
    const own = await provisionOperator('dash-feed-crit');
    await seedDemandWindow(own, { level: 'CRITICAL', market: 'japan', upliftPct: 61, yoyRatio: 1.3 });
    await openDashboard(page, own);
    const card = alertCard(page);
    await expect(card).toContainText('Critical demand window for Japan');
    await expect(card.locator('.chip--critical')).toContainText('Surge');
    await expect(card.locator('.chip-row .chip').nth(2)).toHaveText('Sudden interest spike');
  });
});

test.describe('Selecting an alert', () => {
  test('expands it, reveals the ranked markets for its category and marks it read', async ({ page }) => {
    const own = await provisionOperator('dash-feed-select', { demandWindow: true });
    await openDashboard(page, own);
    await expect(marketsPanel(page).getByText('Select a surge alert')).toBeVisible();

    const card = alertCard(page);
    await card.click();
    await expect(card).toHaveAttribute('aria-expanded', 'true');
    await expect(card).toHaveAttribute('data-selected', 'true');
    await expect(card).toContainText('Hide target markets');
    await expect(card.locator('.alert-dot')).toHaveCount(0);
    await expect(marketsPanel(page).locator('.markets-note')).toHaveText('Coastal & Island');
    await expect(marketsPanel(page).locator('.rank-card')).toHaveCount(3);
  });

  test('clicking the open alert again collapses it, and it stays read', async ({ page }) => {
    const own = await provisionOperator('dash-feed-collapse', { demandWindow: true });
    await openDashboard(page, own);
    const card = alertCard(page);
    await card.click();
    await card.click();
    await expect(card).toHaveAttribute('aria-expanded', 'false');
    await expect(card).toContainText('View target markets');
    await expect(marketsPanel(page).getByText('Select a surge alert')).toBeVisible();
    await expect(card.locator('.alert-dot')).toHaveCount(0);
  });

  test('the read state is saved on the server and survives a reload', async ({ page }) => {
    const own = await provisionOperator('dash-feed-persist', { demandWindow: true });
    await openDashboard(page, own);
    await alertCard(page).click();
    await expect(statTile(page, 'Unread alerts').locator('.stat-value')).toHaveText('0');
    await expect
      .poll(async () => (await api(own.token).getOrThrow('/api/notifications')).notifications[0].isRead)
      .toBe(true);
    await page.reload();
    await expect(alertCard(page)).toBeVisible();
    await expect(alertCard(page).locator('.alert-dot')).toHaveCount(0);
    await expect(statTile(page, 'Unread alerts').locator('.stat-value')).toHaveText('0');
  });

  test('can be driven from the keyboard', async ({ page }) => {
    const own = await provisionOperator('dash-feed-keys', { demandWindow: true });
    await openDashboard(page, own);
    const card = alertCard(page);
    await card.focus();
    await page.keyboard.press('Enter');
    await expect(card).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Space');
    await expect(card).toHaveAttribute('aria-expanded', 'false');
  });

  test('the alert list is a focusable scroll region', async ({ page }) => {
    await openDashboard(page, op.current);
    const region = page.getByRole('region', { name: 'Surge alert list' });
    await expect(region).toHaveAttribute('tabindex', '0');
  });
});

test.describe('Whose alerts appear', () => {
  test('only alerts in the operator\'s own categories are listed', async ({ page }) => {
    const two = await provisionOperator('dash-feed-cats', { categories: ['Coastal & Island', 'Adventure & Nature'] });
    await seedDemandWindow(two, { category: 'Coastal & Island', market: 'korea' });
    await seedDemandWindow(two, { category: 'Adventure & Nature', market: 'japan' });
    await openDashboard(page, two);
    await expect(alertCard(page)).toHaveCount(2);

    // Narrow the profile to one category: the other category's alert disappears from the feed.
    await updateProfile(two, { categories: ['Adventure & Nature'] });
    await openDashboard(page, two);
    await expect(alertCard(page)).toHaveCount(1);
    await expect(alertCard(page)).toContainText(alertTitle('Japan', 'Adventure & Nature'));
  });

  test('with alerts only in other categories the feed says nothing matches and offers category editing', async ({ page }) => {
    const own = await provisionOperator('dash-feed-nomatch', { demandWindow: true });
    await updateProfile(own, { categories: ['Urban & City'] });
    await openDashboard(page, own);
    await expect(page.getByText('No surge alerts for your categories yet')).toBeVisible();
    await expect(page.getByText('Nothing is currently trending for Urban & City.')).toBeVisible();
    await page.getByRole('link', { name: 'Edit business categories' }).click();
    await expect(page).toHaveURL(/\/settings\/profile$/);
  });

  test('another operator\'s alerts are never shown', async ({ page }) => {
    const mine = await provisionOperator('dash-feed-mine', { categories: ['Coastal & Island'] });
    await seedDemandWindow(mine, { market: 'korea' });
    const theirs = await provisionOperator('dash-feed-theirs', { categories: ['Coastal & Island'] });
    await seedDemandWindow(theirs, { market: 'japan' });
    await openDashboard(page, mine);
    await expect(alertCard(page)).toHaveCount(1);
    await expect(alertCard(page)).toContainText('South Korea');
    await expect(alertCard(page)).not.toContainText('Japan');
  });

  test('the API refuses to read another operator\'s notifications by profile id', async () => {
    const mine = await provisionOperator('dash-feed-api-a');
    const theirs = await provisionOperator('dash-feed-api-b');
    const res = await api(mine.token).get(`/api/notifications?profileId=${theirs.businessProfileId}`);
    expect(res.status).toBe(403);
  });

  test('marking another operator\'s alert read is a silent no-op that leaves it unread', async () => {
    const mine = await provisionOperator('dash-feed-read-a', { demandWindow: true });
    const theirs = await provisionOperator('dash-feed-read-b');
    const alertId = (await api(mine.token).getOrThrow('/api/notifications')).notifications[0].id;
    expect((await api(theirs.token).patch(`/api/notifications/${alertId}/read`)).status).toBe(204);
    expect((await api(mine.token).getOrThrow('/api/notifications')).notifications[0].isRead).toBe(false);
  });
});
