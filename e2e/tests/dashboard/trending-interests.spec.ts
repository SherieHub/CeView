import { requireBackend, requireTestSupport } from '../support/stack';
import { test, expect, useOperator } from '../support/fixtures';
import { openDashboard } from '../support/dashboard';

// "Trending Search Interests" — today a hard-coded, labelled preview (TrendingBusinessTypes.tsx).
const op = useOperator('dash-trending', { demandWindow: true });

test.beforeEach(async () => {
  await requireBackend();
  await requireTestSupport();
});

const section = (page: import('@playwright/test').Page) => page.locator('section.dash-business-trends');

test.describe('Trending Search Interests', () => {
  test('is labelled as preview data', async ({ page }) => {
    await openDashboard(page, op.current);
    await expect(section(page).getByRole('heading', { name: 'Trending Search Interests' })).toBeVisible();
    await expect(section(page)).toContainText('Preview data · Illustrative search interests across tourism themes.');
  });

  test('ranks eight themes with their category and score, highest first', async ({ page }) => {
    await openDashboard(page, op.current);
    const rows = section(page).locator('ol > li');
    await expect(rows).toHaveCount(8);
    await expect(rows.locator('h3')).toHaveText(['Beach', 'Bay', 'Sand', 'Diving', 'Fiesta', 'Spa', 'Dining', 'Cliff']);
    await expect(rows.locator('.business-trend-rank')).toHaveText(['1', '2', '3', '4', '5', '6', '7', '8']);
    const scores = (await rows.locator('.business-trend-score').allInnerTexts()).map(Number);
    expect(scores).toEqual([100, 92, 88, 84, 81, 76, 72, 68]);
    await expect(rows.first()).toContainText('Coastal & Island');
  });

  test('the list is a focusable scroll region', async ({ page }) => {
    await openDashboard(page, op.current);
    await expect(section(page).getByRole('region', { name: 'Trending search interests preview' })).toHaveAttribute('tabindex', '0');
  });

  // STUB: the figures are hard-coded and identical for every operator and category.
  test.fixme('shows live search interest for the operator\'s own categories', async ({ page }) => {
    await openDashboard(page, op.current);
    await expect(section(page)).not.toContainText('Preview data');
    await expect(section(page).locator('ol > li').first()).toContainText('Coastal & Island');
  });
});
