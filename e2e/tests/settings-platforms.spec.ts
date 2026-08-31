import { test, expect } from '@playwright/test';
import { requireBackend, SEED_OPERATOR } from './support/stack';

// Screen: /settings/platforms — docs/module-3/screens/settings-platforms.md
// Card: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/04-module-3.md
//   ("Settings: Platforms")
//
// The connect/disconnect endpoints have no backend implementation yet
// (docs/module-3/backend/PlatformConnectionController.md — specified, not
// implemented), so this stubs just /api/connections and drives everything
// else — login, routing, Content Studio's real gating — against the real
// stack, same as login.spec.ts's "Platforms connect modal" test. Swap the
// route stub for a real assertion once that controller lands.

test.describe('Platforms', () => {
  test.beforeEach(async () => {
    await requireBackend();
  });

  /** Mutable in-memory connections the route handler below reads/writes,
   *  standing in for the not-yet-implemented backend table. */
  let connections = [
    { platform: 'instagram', connected: true, handle: '@cebu.dive', connectedAt: '2026-05-01T00:00:00Z' },
    { platform: 'tiktok', connected: false, handle: null, connectedAt: null },
    { platform: 'facebook', connected: false, handle: null, connectedAt: null },
  ];

  async function mockConnections(page: import('@playwright/test').Page) {
    connections = [
      { platform: 'instagram', connected: true, handle: '@cebu.dive', connectedAt: '2026-05-01T00:00:00Z' },
      { platform: 'tiktok', connected: false, handle: null, connectedAt: null },
      { platform: 'facebook', connected: false, handle: null, connectedAt: null },
    ];
    await page.route('**/api/connections', (route) => route.fulfill({ json: connections }));
    await page.route('**/api/connections/*/connect', async (route) => {
      const platform = new URL(route.request().url()).pathname.split('/').at(-2);
      connections = connections.map((c) => (c.platform === platform ? { ...c, connected: true } : c));
      await route.fulfill({ json: { ok: true } });
    });
    await page.route('**/api/connections/*/disconnect', async (route) => {
      const platform = new URL(route.request().url()).pathname.split('/').at(-2);
      connections = connections.map((c) => (c.platform === platform ? { ...c, connected: false, handle: null } : c));
      await route.fulfill({ json: { ok: true } });
    });
  }

  async function login(page: import('@playwright/test').Page) {
    await page.goto('/');
    await page.getByPlaceholder('you@example.com').fill(SEED_OPERATOR.email);
    await page.getByPlaceholder('••••••••').fill(SEED_OPERATOR.password);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  }

  test('connect flow: redirecting spinner -> scope-grant list -> Grant scope -> connected toast', async ({ page }) => {
    await mockConnections(page);
    await login(page);
    await page.goto('/settings/platforms');

    await page.getByRole('button', { name: 'Connect' }).first().click();
    await expect(page.getByText(/redirecting to/i)).toBeVisible();
    await expect(page.getByText(/requesting permission/i)).toBeVisible({ timeout: 3_000 });

    await page.getByRole('button', { name: /grant scope/i }).click();

    await expect(page.getByText(/connected to/i)).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('connecting a platform unlocks it in Content Studio\'s publish picker without a reload', async ({ page }) => {
    await mockConnections(page);
    await page.route('**/api/notifications', (route) =>
      route.fulfill({
        json: {
          notifications: [
            {
              id: 'n1', date: 'Week of Aug 3, 2026', title: 'Demand Surge — South Korea', market: 'South Korea',
              marketId: 'korea', category: 'Coastal & Island', trend: 'Beachfront Luxury', isRead: false,
              alertLevel: 'WARNING', alertMessage: 'Predicted demand is above baseline.',
            },
          ],
        },
      }),
    );
    await page.route('**/api/forecasting/markets*', (route) =>
      route.fulfill({
        json: {
          markets: [{
            id: 'korea', rank: 1, name: 'South Korea', city: 'Seoul', flag: 'KR', matchScore: 92,
            directive: '', directFlight: true, flightHours: '4h', distanceKm: 2600, nearestAirport: 'ICN',
            destinationAirport: 'CEB', accessibilityScore: 90, flightFrequency: 14, avgFlightPrice: '$300',
            airlines: [], peakMonths: [], currency: 'KRW', forexLabel: 'PHP per 1 KRW', gdpValue: 2.1,
            forexValue: 0.042, seasonalityScore: 80, yoyRatio: null, spikeIndicator: true,
            economyInsight: '', seasonalityInsight: '', gdpTrend: [], forexTrend: [], chartData: [],
            dataAsOf: null, dataStale: false,
          }],
        },
      }),
    );
    await page.route('**/api/content/generate', (route) =>
      route.fulfill({
        json: {
          market: { country: 'South Korea', city: 'Seoul', flag: 'KR' },
          framework: 'SOR', source: 'groq',
          captions: {
            instagram: { optionNames: [], options: [], optionMetadata: [], guide: [] },
            tiktok: { optionNames: [], options: [], optionMetadata: [], guide: [] },
            facebook: { optionNames: [], options: [], optionMetadata: [], guide: [] },
          },
        },
      }),
    );
    await page.route('**/api/creative-direction/generate', (route) =>
      route.fulfill({ json: { shotListRecommendations: [], visualRecommendations: [], lightingSuggestions: [], moodboardReferences: [] } }),
    );

    await login(page);
    await page.goto('/content');

    await page.getByRole('heading', { name: 'Demand Surge — South Korea' }).click();
    await page.getByRole('heading', { name: 'South Korea' }).click();

    const tiktokCheckbox = page.getByRole('checkbox', { name: 'TikTok' });
    await expect(tiktokCheckbox).toBeDisabled();

    // Connect TikTok elsewhere in the app — sidebar clicks only, so this is
    // client-side routing, never a full reload (login.spec.ts's own
    // no-full-reload test establishes this is how the sidebar navigates).
    await page.getByRole('button', { name: 'Platforms' }).click();
    await page.getByRole('button', { name: 'Connect' }).first().click(); // tiktok is the first disconnected row
    await page.getByText(/redirecting to/i).waitFor();
    await page.getByText(/requesting permission/i).waitFor({ timeout: 3_000 });
    await page.getByRole('button', { name: /grant scope/i }).click();

    await page.getByRole('button', { name: 'Content Studio' }).click();
    await expect(page.getByRole('checkbox', { name: 'TikTok' })).toBeEnabled();
  });

  test('disconnecting a platform removes it from Content Studio\'s in-progress selection', async ({ page }) => {
    await mockConnections(page);
    await page.route('**/api/notifications', (route) =>
      route.fulfill({
        json: {
          notifications: [
            {
              id: 'n1', date: 'Week of Aug 3, 2026', title: 'Demand Surge — South Korea', market: 'South Korea',
              marketId: 'korea', category: 'Coastal & Island', trend: 'Beachfront Luxury', isRead: false,
              alertLevel: 'WARNING', alertMessage: 'Predicted demand is above baseline.',
            },
          ],
        },
      }),
    );
    await page.route('**/api/forecasting/markets*', (route) =>
      route.fulfill({
        json: {
          markets: [{
            id: 'korea', rank: 1, name: 'South Korea', city: 'Seoul', flag: 'KR', matchScore: 92,
            directive: '', directFlight: true, flightHours: '4h', distanceKm: 2600, nearestAirport: 'ICN',
            destinationAirport: 'CEB', accessibilityScore: 90, flightFrequency: 14, avgFlightPrice: '$300',
            airlines: [], peakMonths: [], currency: 'KRW', forexLabel: 'PHP per 1 KRW', gdpValue: 2.1,
            forexValue: 0.042, seasonalityScore: 80, yoyRatio: null, spikeIndicator: true,
            economyInsight: '', seasonalityInsight: '', gdpTrend: [], forexTrend: [], chartData: [],
            dataAsOf: null, dataStale: false,
          }],
        },
      }),
    );
    await page.route('**/api/content/generate', (route) =>
      route.fulfill({
        json: {
          market: { country: 'South Korea', city: 'Seoul', flag: 'KR' },
          framework: 'SOR', source: 'groq',
          captions: {
            instagram: { optionNames: [], options: [], optionMetadata: [], guide: [] },
            tiktok: { optionNames: [], options: [], optionMetadata: [], guide: [] },
            facebook: { optionNames: [], options: [], optionMetadata: [], guide: [] },
          },
        },
      }),
    );
    await page.route('**/api/creative-direction/generate', (route) =>
      route.fulfill({ json: { shotListRecommendations: [], visualRecommendations: [], lightingSuggestions: [], moodboardReferences: [] } }),
    );

    await login(page);
    await page.goto('/content');
    await page.getByRole('heading', { name: 'Demand Surge — South Korea' }).click();
    await page.getByRole('heading', { name: 'South Korea' }).click();

    // Instagram starts connected — select it for publishing.
    const instagramCheckbox = page.getByRole('checkbox', { name: 'Instagram' });
    await expect(instagramCheckbox).toBeEnabled();
    await instagramCheckbox.check();
    await expect(instagramCheckbox).toBeChecked();

    // Disconnect elsewhere in the app — client-side navigation, not a reload
    // (see the previous test's comment on why that matters here).
    await page.getByRole('button', { name: 'Platforms' }).click();
    await page.getByRole('button', { name: 'Disconnect' }).click();

    await page.getByRole('button', { name: 'Content Studio' }).click();
    const stillThere = page.getByRole('checkbox', { name: 'Instagram' });
    await expect(stillThere).not.toBeChecked();
    await expect(stillThere).toBeDisabled();
  });
});
