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

  /** A 1x1 transparent PNG, inlined so staging media needs no fixture file on disk. */
  const TINY_PNG_BASE64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

  /**
   * Content Studio's platform picker moved into the Publish modal in the
   * studio rebuild — it used to sit inline in the composer, reachable the
   * moment a market was picked, which is what the two tests below originally
   * assumed. The modal only opens once the compliance audit has passed, so
   * reaching the picker now means staging a caption and media and running
   * that audit first.
   */
  async function stageAndOpenPublish(page: import('@playwright/test').Page) {
    await page.route('**/api/compliance/omcs-analyze', (route) =>
      route.fulfill({
        json: {
          profileSemanticScore: 85.5,
          rubricEvaluationData: { scores: {}, total: 83.4 },
          recommendationsPictureScore: 83.4,
          pubmatConsistencyScore: 81.0,
          consistencyExplanation: 'Consistent.',
          omcsScore: 83.8,
          status: 'Pass',
          feedback: 'Passes comfortably.',
        },
      }),
    );

    await page.getByRole('button', { name: 'Select' }).click();
    await page.locator('input[type="file"]').setInputFiles({
      name: 'media.png', mimeType: 'image/png', buffer: Buffer.from(TINY_PNG_BASE64, 'base64'),
    });
    await page.getByRole('button', { name: 'Run Compliance Audit' }).click();
    // Six 420ms stepper ticks stand between the click and the modal's trigger.
    await page.getByRole('button', { name: /^Publish/ }).click({ timeout: 15_000 });
    await expect(page.getByRole('dialog', { name: 'Publish' })).toBeVisible();
  }

  /** One real Instagram option — the mocked /api/content/generate response
   *  used to return every platform empty, which rendered zero caption cards
   *  and made the picker (now behind that selection) unreachable. */
  const CAPTIONS_WITH_ONE_OPTION = {
    instagram: {
      optionNames: ['Option 1'],
      options: ['A staged caption for e2e.'],
      optionMetadata: [{
        core_business_context: '', market_cultural_localization: '', psychological_elements: '',
        creative_tone_atmosphere: '', algorithmic_platform_architecture: '',
      }],
      guide: [],
    },
    tiktok: { optionNames: [], options: [], optionMetadata: [], guide: [] },
    facebook: { optionNames: [], options: [], optionMetadata: [], guide: [] },
  };

  test('connect flow: redirecting spinner -> scope-grant list -> Grant scope -> connected toast', async ({ page }) => {
    await mockConnections(page);
    await login(page);
    await page.goto('/settings/platforms');

    // exact: true — a plain { name: 'Connect' } also matches Instagram's
    // "Disconnect" button (substring match is Playwright's default), which
    // sorts first in DOM order and opens no modal at all.
    await page.getByRole('button', { name: 'Connect', exact: true }).first().click();
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
          captions: CAPTIONS_WITH_ONE_OPTION,
        },
      }),
    );
    await page.route('**/api/creative-direction/generate', (route) =>
      route.fulfill({ json: { visualGuide: [], shots: [], moodboard: { palette: '', references: [] } } }),
    );

    await login(page);
    await page.goto('/content');

    await page.getByRole('heading', { name: 'Demand Surge — South Korea' }).click();
    await page.getByRole('heading', { name: 'South Korea' }).click();

    // The picker lives inside the Publish modal, reachable once the audit has
    // passed — see stageAndOpenPublish's own comment for why.
    await stageAndOpenPublish(page);
    await expect(page.getByRole('checkbox', { name: 'TikTok' })).toBeDisabled();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('dialog', { name: 'Publish' })).toHaveCount(0);

    // Connect TikTok elsewhere in the app — sidebar clicks only, so this is
    // client-side routing, never a full reload (login.spec.ts's own
    // no-full-reload test establishes this is how the sidebar navigates).
    await page.getByRole('button', { name: 'Platforms' }).click();
    // exact: true — see the earlier connect-flow test's comment on why.
    await page.getByRole('button', { name: 'Connect', exact: true }).first().click(); // tiktok is the first disconnected row
    await page.getByText(/redirecting to/i).waitFor();
    await page.getByText(/requesting permission/i).waitFor({ timeout: 3_000 });
    await page.getByRole('button', { name: /grant scope/i }).click();

    // Content Studio's own draft (caption, media, audit) is local component
    // state, so it does not survive the round trip through /settings/platforms
    // — only the picked target and the connection itself are shared state
    // (TargetSelectionProvider / connectionsStore, both mounted above the
    // route's <Outlet/>). Redoing the audit is what reaches the picker again;
    // it is the shared connection state underneath it this test is about.
    await page.getByRole('button', { name: 'Content Studio' }).click();
    await stageAndOpenPublish(page);
    await expect(page.getByRole('checkbox', { name: 'TikTok' })).toBeEnabled();
  });

  test('disconnecting a platform locks it back out of Content Studio\'s publish picker', async ({ page }) => {
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
          captions: CAPTIONS_WITH_ONE_OPTION,
        },
      }),
    );
    await page.route('**/api/creative-direction/generate', (route) =>
      route.fulfill({ json: { visualGuide: [], shots: [], moodboard: { palette: '', references: [] } } }),
    );

    await login(page);
    await page.goto('/content');
    await page.getByRole('heading', { name: 'Demand Surge — South Korea' }).click();
    await page.getByRole('heading', { name: 'South Korea' }).click();

    // Instagram starts connected — selectable in the picker, in the Publish
    // modal (see stageAndOpenPublish's own comment for why it lives there now).
    await stageAndOpenPublish(page);
    const instagramCheckbox = page.getByRole('checkbox', { name: 'Instagram' });
    await expect(instagramCheckbox).toBeEnabled();
    await instagramCheckbox.check();
    await expect(instagramCheckbox).toBeChecked();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('dialog', { name: 'Publish' })).toHaveCount(0);

    // Disconnect elsewhere in the app — client-side navigation, not a reload
    // (see the previous test's comment on why that matters here).
    await page.getByRole('button', { name: 'Platforms' }).click();
    await page.getByRole('button', { name: 'Disconnect' }).click();

    // Content Studio's own draft is local state and does not survive the round
    // trip (see the previous test's comment) — the connection state
    // underneath it does, which is what this asserts: a platform disconnected
    // elsewhere cannot be picked again without reconnecting it first.
    await page.getByRole('button', { name: 'Content Studio' }).click();
    await stageAndOpenPublish(page);
    await expect(page.getByRole('checkbox', { name: 'Instagram' })).toBeDisabled();
  });
});
