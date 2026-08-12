/**
 * Module 2 market fixtures — transcribed from ui-ux-prototype.html:1104–1220
 * (MarketDto shape, 24-point ChartDataPoint[] history+forecast series).
 */

export interface ChartDataPoint {
  week: string;
  history: number | null;
  forecast: number | null;
  seasonality: number;
  forex: number;
  gdp: number;
  spike: 0 | 1;
}

interface BuildChartDataInput {
  base: number;
  amp: number;
  drift: number;
  seasonBase: number;
  seasonPhase: number;
  forex: number;
  forexAmp: number;
  gdp: number;
  spikeAt: number | null;
  weekly: number[];
}

/** Deterministic 24-point series: 12 history ("Wk -11"…"Current") + 12 forecast. */
export function buildChartData(o: BuildChartDataInput): ChartDataPoint[] {
  const pts: ChartDataPoint[] = [];
  for (let i = 11; i >= 0; i--) {
    const t = 11 - i;
    const v = o.base + Math.sin(t / 2.4) * o.amp + t * o.drift;
    const isCurrent = i === 0;
    pts.push({
      week: isCurrent ? 'Current' : 'Wk -' + i,
      history: +Math.max(8, Math.min(100, v)).toFixed(1),
      forecast: isCurrent ? o.weekly[0] : null,
      seasonality: +Math.max(10, Math.min(100, o.seasonBase + Math.sin((t + o.seasonPhase) / 2) * 13)).toFixed(1),
      forex: +(o.forex + Math.sin(t / 3) * o.forexAmp).toFixed(4),
      gdp: o.gdp,
      spike: o.spikeAt !== null && t === o.spikeAt ? 1 : 0,
    });
  }
  for (let w = 1; w <= 12; w++) {
    pts.push({
      week: 'Wk +' + w,
      history: null,
      forecast: o.weekly[w - 1],
      seasonality: +Math.max(10, Math.min(100, o.seasonBase + Math.sin((11 + w + o.seasonPhase) / 2) * 13)).toFixed(1),
      forex: o.forex,
      gdp: o.gdp,
      spike: 0,
    });
  }
  return pts;
}

export interface Airline {
  name: string;
  code: string;
  frequency: string;
  direct: boolean;
}

export interface Market {
  id: string;
  rank: number;
  name: string;
  city: string;
  flag: string;
  matchScore: number;
  directive: string;
  directFlight: boolean;
  flightHours: string;
  distanceKm: number;
  nearestAirport: string;
  destinationAirport: string;
  accessibilityScore: number;
  flightFrequency: number;
  avgFlightPrice: string;
  airlines: Airline[];
  peakMonths: string[];
  currency: string;
  forexLabel: string;
  gdpValue: number;
  forexValue: number;
  seasonalityScore: number;
  yoyRatio: number | null;
  spikeIndicator: boolean;
  economyInsight: string;
  seasonalityInsight: string;
  gdpTrend: { year: number; value: number }[];
  forexTrend: { date: string; value: number }[];
  chartData: ChartDataPoint[];
}

export const MOCK_MARKETS: Market[] = [
  {
    id: 'korea', rank: 1, name: 'South Korea', city: 'Seoul', flag: 'KR', matchScore: 87,
    directive: 'South Korean demand is surging — the 2σ spike is YoY-confirmed, so this is a seasonal inflection, not a viral blip. Publish Korean-language healing/호캉스 content within 48 hours and raise weekend rates before the window peaks.',
    directFlight: true, flightHours: '3h 45m', distanceKm: 2640,
    nearestAirport: "ICN — Incheon Int'l", destinationAirport: "CEB — Mactan-Cebu Int'l",
    accessibilityScore: 9, flightFrequency: 14, avgFlightPrice: '₱8,000 – ₱15,000',
    airlines: [
      { name: 'Korean Air', code: 'KE', frequency: '7x / week', direct: true },
      { name: 'Cebu Pacific', code: '5J', frequency: '5x / week', direct: true },
      { name: 'Air Busan', code: 'BX', frequency: '2x / week', direct: true },
    ],
    peakMonths: ['Jul', 'Aug', 'Dec', 'Jan'],
    currency: 'KRW', forexLabel: 'PHP per 1 KRW', gdpValue: 2.2, forexValue: 23.8,
    seasonalityScore: 0.88, yoyRatio: 1.07, spikeIndicator: true,
    economyInsight: 'GDP is growing at a moderate 2.2% and the Won is holding strong against the Peso — Korean visitors currently have roughly 15–20% more purchasing power in Cebu than a year ago. They will upgrade rooms, book premium dive packages and spend generously on dining. Upsell now rather than discount.',
    seasonalityInsight: 'A strong recurring pattern is confirmed (YoY 1.07, seasonality 0.88). Korean travel peaks in the July–August school break and the December–January winter break. Your revenue window opens roughly six weeks ahead of each — start promotions early to reach the planners who book in advance.',
    gdpTrend: [{ year: 2021, value: 4.1 }, { year: 2022, value: 2.6 }, { year: 2023, value: 1.4 }, { year: 2024, value: 2.0 }, { year: 2025, value: 2.2 }],
    forexTrend: [23.1, 23.3, 23.2, 23.5, 23.4, 23.6, 23.7, 23.6, 23.8, 23.9, 23.8, 23.8].map((v, i) => ({ date: 'M' + (i + 1), value: v })),
    chartData: buildChartData({ base: 52, amp: 9, drift: 1.6, seasonBase: 64, seasonPhase: 0, forex: 23.8, forexAmp: 0.3, gdp: 2.2, spikeAt: 11, weekly: [76.4, 74.9, 73.1, 71.5, 70.2, 69.4, 68.7, 68.1, 67.6, 67.2, 66.8, 66.5] }),
  },
  {
    id: 'japan', rank: 2, name: 'Japan', city: 'Osaka', flag: 'JP', matchScore: 79,
    directive: 'Japanese demand is accelerating steadily into Golden Week. Japanese travelers research heavily before booking, so early visibility wins the sale — lead with bundled, all-inclusive pricing on Facebook and Instagram.',
    directFlight: true, flightHours: '2h 50m', distanceKm: 2186,
    nearestAirport: "KIX — Kansai Int'l", destinationAirport: "CEB — Mactan-Cebu Int'l",
    accessibilityScore: 8, flightFrequency: 8, avgFlightPrice: '₱7,500 – ₱12,000',
    airlines: [
      { name: 'Philippine Airlines', code: 'PR', frequency: '5x / week', direct: true },
      { name: 'Cebu Pacific', code: '5J', frequency: '3x / week', direct: true },
    ],
    peakMonths: ['Mar', 'Apr', 'May', 'Aug'],
    currency: 'JPY', forexLabel: 'PHP per 1 JPY', gdpValue: 1.4, forexValue: 2.1,
    seasonalityScore: 0.74, yoyRatio: 1.02, spikeIndicator: false,
    economyInsight: 'GDP growth is modest at 1.4% and the Yen has been recovering slowly. Japanese travelers are value-conscious rather than price-sensitive — they respond to bundles (flight + stay + tour) that show a clear total saving versus booking separately. Publish the total, not the nightly rate.',
    seasonalityInsight: 'Likely seasonal, still developing (YoY 1.02, seasonality 0.74). Golden Week in late April–early May is the single biggest surge, with a secondary O-bon peak in August. Campaigns should launch eight weeks ahead of each window.',
    gdpTrend: [{ year: 2021, value: 2.2 }, { year: 2022, value: 1.0 }, { year: 2023, value: 1.9 }, { year: 2024, value: 1.5 }, { year: 2025, value: 1.4 }],
    forexTrend: [2.02, 2.04, 2.03, 2.06, 2.05, 2.08, 2.07, 2.09, 2.10, 2.09, 2.11, 2.10].map((v, i) => ({ date: 'M' + (i + 1), value: v })),
    chartData: buildChartData({ base: 44, amp: 7, drift: 1.3, seasonBase: 58, seasonPhase: 2, forex: 2.1, forexAmp: 0.04, gdp: 1.4, spikeAt: null, weekly: [63.8, 65.2, 66.9, 68.4, 69.1, 69.8, 70.3, 70.1, 69.7, 69.2, 68.8, 68.3] }),
  },
  {
    id: 'usa', rank: 3, name: 'United States', city: 'Los Angeles', flag: 'US', matchScore: 64,
    directive: 'US demand is climbing toward the summer window but accessibility is the constraint — no direct route and 16h+ via Manila. Lead with experiences that justify the flight: freediving, whale sharks, heritage. Americans book 6–10 weeks out.',
    directFlight: false, flightHours: '16h+ (via MNL)', distanceKm: 11027,
    nearestAirport: "LAX — Los Angeles Int'l", destinationAirport: "MNL — Ninoy Aquino Int'l",
    accessibilityScore: 3, flightFrequency: 3, avgFlightPrice: '₱28,000 – ₱45,000',
    airlines: [{ name: 'Philippine Airlines (via Manila)', code: 'PR', frequency: '3x / week', direct: false }],
    peakMonths: ['Jun', 'Jul', 'Aug', 'Dec'],
    currency: 'USD', forexLabel: 'PHP per 1 USD', gdpValue: 2.5, forexValue: 57.6,
    seasonalityScore: 0.61, yoyRatio: null, spikeIndicator: false,
    economyInsight: 'The Dollar is the strongest of the three currencies against the Peso at roughly ₱57.60. US visitors carry the highest average daily budget of any tracked market, which offsets the long-haul cost. Target premium and adventure experiences to maximise yield per guest.',
    seasonalityInsight: 'Weak / emerging — under 59 weeks of history, so no YoY confirmation is possible yet and the score is capped conservatively at 0.61. The visible pattern points to the June–August summer break and the late-December holiday window.',
    gdpTrend: [{ year: 2021, value: 5.9 }, { year: 2022, value: 2.1 }, { year: 2023, value: 2.5 }, { year: 2024, value: 2.8 }, { year: 2025, value: 2.5 }],
    forexTrend: [56.2, 56.5, 56.8, 57.0, 56.9, 57.2, 57.4, 57.3, 57.5, 57.6, 57.5, 57.6].map((v, i) => ({ date: 'M' + (i + 1), value: v })),
    chartData: buildChartData({ base: 38, amp: 6, drift: 1.5, seasonBase: 52, seasonPhase: 4, forex: 57.6, forexAmp: 0.5, gdp: 2.5, spikeAt: null, weekly: [57.2, 58.9, 60.4, 62.1, 63.6, 64.8, 65.9, 66.7, 67.2, 67.5, 67.1, 66.6] }),
  },
];

/**
 * Per-category market affinity — mirrors the real (category, market) signal
 * grid Module 2 actually computes (see MACRO_TREND_MAPPING in
 * docs/module-2). `Accommodation & Staycation` intentionally reuses
 * MOCK_MARKETS' own matchScores (87/79/64) so the default demo profile's
 * numbers are unchanged; every other category is hand-authored to reflect
 * a plausible, distinct market lean rather than a flat re-use of one score.
 */
export const CATEGORY_MARKET_SCORES: Record<string, Record<string, number>> = {
  'Coastal & Island': { korea: 71, japan: 83, usa: 86 },
  'Adventure & Nature': { korea: 66, japan: 74, usa: 90 },
  'Cultural & Heritage': { korea: 68, japan: 89, usa: 57 },
  'Theme Parks / Entertainment': { korea: 84, japan: 80, usa: 55 },
  'Urban & City': { korea: 79, japan: 85, usa: 52 },
  'Culinary & Gastronomy': { korea: 88, japan: 82, usa: 60 },
  'Accommodation & Staycation': { korea: 87, japan: 79, usa: 64 },
};

/**
 * Re-ranks MOCK_MARKETS for one category's affinity scores. All other
 * per-market detail (directive, chart, insights, flight data) is reused
 * as-is — only the displayed score and rank are category-scoped, which is
 * the actual claim being made ("these markets matter most for THIS
 * category"), not a full re-authoring of every market's detail content.
 */
export function marketsForCategory(category: string): Market[] {
  const scores = CATEGORY_MARKET_SCORES[category] || {};
  return MOCK_MARKETS.map((m) => ({ ...m, matchScore: scores[m.id] ?? m.matchScore }))
    .sort((a, b) => b.matchScore - a.matchScore)
    .map((m, i) => ({ ...m, rank: i + 1 }));
}
