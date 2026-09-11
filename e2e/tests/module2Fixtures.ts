import type { Page } from '@playwright/test';

type Alert = Record<string, unknown>;

function chartData() {
  const history = Array.from({ length: 12 }, (_, index) => ({
    week: index === 11 ? 'Current' : `Wk -${11 - index}`,
    weekStartDate: `2026-06-${String(1 + index * 2).padStart(2, '0')}`,
    history: 40 + index, forecast: null, seasonality: 60 + index / 2,
  }));
  const forecast = Array.from({ length: 12 }, (_, index) => ({
    week: `Wk +${index + 1}`, weekStartDate: null,
    history: null, forecast: 52 + index, seasonality: null,
  }));
  return [...history, ...forecast];
}

function market(id: string, name: string, rank: number) {
  return {
    id, rank, name, city: id === 'usa' ? 'Los Angeles' : 'Seoul', matchScore: 90 - rank,
    directive: 'Use this measured demand window to plan promotion.', directFlight: id !== 'usa',
    flightHours: id === 'usa' ? '16h+ (via MNL)' : '4h 30m', distanceKm: 3000,
    nearestAirport: 'ICN', destinationAirport: 'CEB', accessibilityScore: 8, flightFrequency: 7,
    fareMinPhp: 8000, fareMaxPhp: 15000, fareSource: 'reference', fareAsOf: '2026-08-24',
    airlines: [{ name: 'Sample Air', code: 'SA', frequency: '7x / week', direct: id !== 'usa' }],
    peakMonths: ['Apr', 'May'], peakMonthsSource: 'reference', currency: 'KRW',
    forexLabel: 'PHP per 1 KRW', gdpValue: 2.1, forexValue: 0.0416, seasonalityScore: 0.72,
    yoyRatio: null, spikeIndicator: false, surgeLevel: 'WARNING', upliftPct: 30.5,
    windowOpenDate: '2026-08-24T00:00:00Z', scorer: 'linear', gdpSource: null, forexSource: null,
    macroAsOf: null, forecastConfidence: 0.65, lowConfidence: true, forecastSource: 'stub-v1',
    dataAsOf: '2026-08-24T00:00:00Z', dataStale: false, dataStaleCause: null,
    economyInsight: 'No macro history is available for this fixture.',
    seasonalityInsight: 'No seasonal basis is available for this fixture.',
    gdpTrend: [], forexTrend: [], chartData: chartData(),
  };
}

export const DEMAND_ALERT: Alert = {
  id: 'alert-korea', date: 'Week of Aug 24, 2026', title: 'Demand window — South Korea',
  market: 'South Korea', marketId: 'korea', category: 'Accommodation & Staycation',
  trend: 'Rising demand window', isRead: false, alertLevel: 'WARNING',
  alertMessage: 'Demand window detected for South Korea — the 4-week forecast is 30.5% above the rolling baseline.',
  windowOpenDate: '2026-08-24T00:00:00Z', upliftPct: 30.5,
};

/** Route the real API client to deterministic browser-test responses. */
export async function mockModule2Api(page: Page, options: { initiallyEmpty?: boolean; aiDown?: boolean } = {}) {
  let refreshed = false;
  const markets = [market('korea', 'South Korea', 1), market('japan', 'Japan', 2), market('usa', 'United States', 3)];
  await page.route('**/api/forecasting/ensure**', route => route.fulfill({ status: 204 }));
  await page.route('**/api/forecasting/status', route => route.fulfill({ json: { available: !options.aiDown } }));
  await page.route('**/api/notifications/keyword-trends', route => route.fulfill({ json: { notifications: [] } }));
  await page.route('**/api/notifications/*/read', route => route.fulfill({ status: 204 }));
  await page.route('**/api/notifications', route => route.fulfill({ json: { notifications: options.initiallyEmpty && !refreshed ? [] : [DEMAND_ALERT] } }));
  await page.route('**/api/forecasting/analyze', route => { refreshed = true; return route.fulfill({ json: { markets } }); });
  await page.route('**/api/forecasting/markets?category=*', route => route.fulfill({ json: { markets } }));
}

/** Lets the hand-off assertion cross from the auth-bypassing preview to /content. */
export async function seedAuthenticatedContentRoute(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('ceview.auth', JSON.stringify({ accessToken: 'e2e-token', profileCompleted: true }));
  });
  await page.route('**/api/business-profile', route => route.fulfill({
    json: {
      businessProfileId: '00000000-0000-0000-0000-000000000001', businessName: 'E2E Resort',
      categories: ['Accommodation & Staycation'], coreServices: [], description: '', uvp: '',
      imagePreview: null, uniquenessScore: 0.82,
    },
  }));
}
