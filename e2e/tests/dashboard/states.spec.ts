import { execSync } from 'node:child_process';
import { requireBackend, requireTestSupport } from '../support/stack';
import { test, expect } from '../support/fixtures';
import { provisionOperator, updateProfile } from '../support/operator';
import { seedDemandWindow } from '../support/demandWindow';
import { alertCard, openDashboard, statTile } from '../support/dashboard';

// How the dashboard looks while loading, with nothing to show, with stale data, on errors and when
// the forecast service is down.
test.beforeEach(async () => {
  await requireBackend();
  await requireTestSupport();
});

test.describe('Loading', () => {
  test('shows skeletons and a loading subtitle until the alerts arrive, then settles', async ({ page }) => {
    const op = await provisionOperator('dash-load', { demandWindow: true });
    await page.route('**/api/notifications', async (route) => {
      await new Promise((r) => setTimeout(r, 2500));
      await route.continue();
    });
    const { signIn } = await import('../support/operator');
    await signIn(page, op, '/dashboard');
    await expect(page.getByText('Loading your latest surge alerts…')).toBeVisible();
    await expect(page.locator('section[aria-label="Surge Alerts"][aria-busy="true"]')).toBeVisible();
    await expect(page.locator('.stat-row[aria-busy="true"]')).toBeVisible();
    await expect(page.getByText('Loading your latest surge alerts…')).toHaveCount(0, { timeout: 30_000 });
    await expect(alertCard(page)).toBeVisible();
    await expect(page.locator('.stat-row[aria-busy="true"]')).toHaveCount(0);
  });
});

test.describe('Nothing to show yet', () => {
  test('a new operator with no forecast sees "No notifications yet" and no ranked market', async ({ page }) => {
    const op = await provisionOperator('dash-empty');
    await openDashboard(page, op);
    await expect(page.getByText('No forecast data yet — run your first analysis to start receiving alerts.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'No notifications yet' })).toBeVisible();
    await expect(page.getByText('Market trend data will appear here once your profile has been analysed')).toBeVisible();
    await expect(statTile(page, 'Top market for International')).toBeDisabled();
    await expect(page.getByRole('region', { name: 'Top International Market' })).toHaveCount(0);
    // No API error is raised for a forecast that has simply never run.
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('a profile with no categories is told to finish onboarding, with no retry', async ({ page }) => {
    const op = await provisionOperator('dash-nocats');
    await updateProfile(op, { categories: [] });
    await openDashboard(page, op);
    const panel = page.getByRole('alert');
    await expect(panel.getByRole('heading', { name: 'Complete onboarding first' })).toBeVisible();
    await expect(panel).toContainText('This screen needs a saved business profile before it can load data.');
    await expect(panel).toContainText('Dashboard');
    await expect(panel.getByRole('button', { name: /retry/i })).toHaveCount(0);
  });
});

test.describe('Stale data', () => {
  test('data older than 48 hours shows how old it is and when it was last fetched', async ({ page }) => {
    const op = await provisionOperator('dash-stale');
    await seedDemandWindow(op, { staleDays: 3 });
    await openDashboard(page, op);
    await expect(page.getByText('Data is 3 days old.')).toBeVisible();
    await expect(page.getByText(/Last successful fetch: \d{4}-\d{2}-\d{2}\./)).toBeVisible();
    await expect(page.getByText('The numbers below are real measurements — they have simply not refreshed.')).toBeVisible();
  });

  test('data younger than 48 hours shows no banner', async ({ page }) => {
    const op = await provisionOperator('dash-fresh');
    await seedDemandWindow(op, { staleDays: 1 });
    await openDashboard(page, op);
    await expect(alertCard(page)).toBeVisible();
    await expect(page.getByText(/Data is \d+ days? old/)).toHaveCount(0);
  });

  test('the banner also shows on a dashboard with no alert selected (it reads the top market)', async ({ page }) => {
    const op = await provisionOperator('dash-stale-cold');
    await seedDemandWindow(op, { staleDays: 5 });
    await openDashboard(page, op);
    await expect(alertCard(page).locator('[aria-expanded="true"]')).toHaveCount(0);
    await expect(page.getByText('Data is 5 days old.')).toBeVisible();
  });
});

test.describe('Errors', () => {
  // The failures are injected in the browser: the real backend answers this endpoint reliably.
  test('a failed alert load shows the error panel with the request, status and a Retry button', async ({ page }) => {
    const op = await provisionOperator('dash-error', { demandWindow: true });
    await page.route('**/api/notifications', (route) => route.fulfill({ status: 500, json: { error: 'boom' } }));
    await openDashboard(page, op);
    const panel = page.getByRole('alert').filter({ hasText: 'Something went wrong' });
    await expect(panel).toContainText('The request to the backend did not succeed.');
    await expect(panel).toContainText('GET /api/notifications');
    await expect(panel).toContainText('500');
    await expect(panel.getByRole('button', { name: 'Retry' })).toBeVisible();
  });

  test('Retry re-runs the load and brings the alerts back', async ({ page }) => {
    const op = await provisionOperator('dash-retry', { demandWindow: true });
    await page.route('**/api/notifications', (route) => route.fulfill({ status: 500, json: { error: 'boom' } }));
    await openDashboard(page, op);
    const panel = page.getByRole('alert').filter({ hasText: 'Something went wrong' });
    await expect(panel).toBeVisible();
    await page.unroute('**/api/notifications');
    // dispatchEvent: see the known-bug test below — a real mouse click cannot reach the button.
    await panel.getByRole('button', { name: 'Retry' }).dispatchEvent('click');
    await expect(alertCard(page)).toBeVisible();
    await expect(page.getByRole('alert').filter({ hasText: 'Something went wrong' })).toHaveCount(0);
  });

  // KNOWN BUG: the error panel is rendered under the signal tiles (they overlap its lower edge), so
  // a user's mouse click on Retry lands on a tile instead.
  test.fail('the Retry button can be clicked with the mouse', async ({ page }) => {
    const op = await provisionOperator('dash-retry-click', { demandWindow: true });
    await page.route('**/api/notifications', (route) => route.fulfill({ status: 500, json: { error: 'boom' } }));
    await openDashboard(page, op);
    await page.getByRole('alert').getByRole('button', { name: 'Retry' }).click({ timeout: 4000 });
  });
});

test.describe('Forecast service down', () => {
  // Stops the forecasting container; only runs with E2E_DEGRADED=1 (the "degraded" project).
  const container = 'ceview-fastapi-transformer';
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(() => {
    execSync(`docker stop ${container}`, { stdio: 'ignore' });
  });
  test.afterAll(() => {
    execSync(`docker start ${container}`, { stdio: 'ignore' });
  });

  test('@degraded keeps showing the last forecast under a warning banner', async ({ page }) => {
    test.setTimeout(120_000);
    const op = await provisionOperator('dash-down', { demandWindow: true });
    await openDashboard(page, op);
    const banner = page.getByRole('status').filter({ hasText: 'AI Forecast Service Unavailable.' });
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('read from your last successful forecast run');
    // The alerts and rankings the operator already had are still there.
    await expect(alertCard(page)).toBeVisible();
    await expect(statTile(page, 'Top market for International')).toContainText('cached');
    await expect(statTile(page, 'Top market for International').locator('.stat-value')).toHaveText('South Korea');
  });
});
