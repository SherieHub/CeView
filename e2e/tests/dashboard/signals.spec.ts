import { requireBackend, requireTestSupport } from '../support/stack';
import { test, expect, useOperator } from '../support/fixtures';
import { provisionOperator, updateProfile } from '../support/operator';
import { seedDemandWindow } from '../support/demandWindow';
import { alertCard, openDashboard, radarDrawer, statTile } from '../support/dashboard';

// The four tiles under the greeting.
const op = useOperator('dash-signals', { demandWindow: true });

test.beforeEach(async () => {
  await requireBackend();
  await requireTestSupport();
});

test.describe('Signal tiles', () => {
  test('count the unread alerts and the active surges', async ({ page }) => {
    await openDashboard(page, op.current);
    await expect(statTile(page, 'Unread alerts').locator('.stat-value')).toHaveText('1');
    await expect(statTile(page, 'Unread alerts')).toContainText('Across your categories');
    await expect(statTile(page, 'Active surges').locator('.stat-value')).toHaveText('1');
    await expect(statTile(page, 'Active surges')).toContainText('South Korea');
  });

  test('name the strongest international market with its score and category', async ({ page }) => {
    await openDashboard(page, op.current);
    const tile = statTile(page, 'Top market for International');
    await expect(tile.locator('.stat-value')).toHaveText('South Korea');
    await expect(tile).toContainText('82/100 · Coastal & Island');
    await expect(tile).toBeEnabled();
  });

  test('name the leading Philippine region (a labelled preview)', async ({ page }) => {
    await openDashboard(page, op.current);
    const tile = statTile(page, 'Top market for Philippines');
    await expect(tile.locator('.stat-value')).toHaveText('CALABARZON');
    await expect(tile).toContainText('78/100 · Coastal & Island');
  });

  test('reading an alert brings the unread count to zero', async ({ page }) => {
    const own = await provisionOperator('dash-signals-read', { demandWindow: true });
    await openDashboard(page, own);
    await alertCard(page).click();
    await expect(statTile(page, 'Unread alerts').locator('.stat-value')).toHaveText('0');
    await expect(statTile(page, 'Unread alerts')).toContainText('You are all caught up');
  });

  test('two alerts in two categories add up', async ({ page }) => {
    const two = await provisionOperator('dash-signals-two', { categories: ['Coastal & Island', 'Adventure & Nature'] });
    await seedDemandWindow(two, { category: 'Coastal & Island', market: 'korea' });
    await seedDemandWindow(two, { category: 'Adventure & Nature', market: 'japan', level: 'CRITICAL' });
    await openDashboard(page, two);
    await expect(statTile(page, 'Unread alerts').locator('.stat-value')).toHaveText('2');
    await expect(statTile(page, 'Active surges').locator('.stat-value')).toHaveText('2');
    await expect(statTile(page, 'Active surges')).toContainText(/South Korea.*Japan|Japan.*South Korea/);
  });

  test('the international tile opens that market\'s radar', async ({ page }) => {
    await openDashboard(page, op.current);
    await statTile(page, 'Top market for International').click();
    await expect(page).toHaveURL(/\/dashboard\?market=korea$/);
    await expect(radarDrawer(page, 'South Korea')).toBeVisible();
  });

  test('the Philippines tile opens the region drawer', async ({ page }) => {
    await openDashboard(page, op.current);
    await statTile(page, 'Top market for Philippines').click();
    await expect(page.getByRole('dialog', { name: 'CALABARZON region details' })).toBeVisible();
  });

  test('with no ranked market the international tile is disabled and says so', async ({ page }) => {
    const own = await provisionOperator('dash-signals-nomarket', { demandWindow: true });
    // Move the profile to a category that has no forecast; the alert in the old category is hidden.
    await updateProfile(own, { categories: ['Urban & City'] });
    await openDashboard(page, own);
    const tile = statTile(page, 'Top market for International');
    await expect(tile.locator('.stat-value')).toHaveText('—');
    await expect(tile).toContainText('No markets ranked yet');
    await expect(tile).toBeDisabled();
    await expect(statTile(page, 'Unread alerts').locator('.stat-value')).toHaveText('0');
    await expect(statTile(page, 'Active surges')).toContainText('Nothing above threshold');
    // The Philippines preview does not depend on a ranked international market.
    await expect(statTile(page, 'Top market for Philippines')).toContainText('78/100');
    await expect(statTile(page, 'Top market for Philippines')).not.toContainText('·');
  });
});
