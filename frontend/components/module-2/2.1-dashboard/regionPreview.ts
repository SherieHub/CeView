/**
 * Design-preview data for the Philippine regions' radar drawer, in the same
 * Market shape the international drawer reads, so both render through the
 * same components (RadarDrawerView).
 *
 * The API does not return regional forecasts yet. Routes, carriers and peak
 * seasons follow real domestic patterns; every figure (scores, fares,
 * frequencies, growth, index values, series) is illustrative. The drawer
 * says so up front, every forecast is flagged low-confidence (so the
 * "Unvalidated forecast" notice shows), and the engine reads as the
 * deterministic placeholder rather than a trained model.
 */
import { buildChartData } from '../../../services/fixtures/markets';
import type { Market } from '@/types';
import { SAMPLE_REGIONS } from './regionSamples';

type RegionDetail = Pick<
  Market,
  | 'city'
  | 'directive'
  | 'flightHours'
  | 'distanceKm'
  | 'nearestAirport'
  | 'accessibilityScore'
  | 'fareMinPhp'
  | 'fareMaxPhp'
  | 'airlines'
  | 'peakMonths'
  | 'gdpValue'
  | 'forexValue'
  | 'seasonalityScore'
  | 'yoyRatio'
  | 'surgeLevel'
  | 'upliftPct'
  | 'economyInsight'
  | 'seasonalityInsight'
  | 'gdpTrend'
  | 'chartData'
> & { priceIndex: number[] };

const years = (values: number[]) => values.map((value, i) => ({ year: 2021 + i, value }));

const DETAILS: Record<string, RegionDetail> = {
  CALABARZON: {
    city: 'Calamba',
    directive:
      'CALABARZON families are planning their next long-weekend escape. They fly out of Manila on short notice, so keep weekend packages bookable within two weeks of travel and lead with family rooms and day tours.',
    flightHours: '1h 20m',
    distanceKm: 540,
    nearestAirport: "MNL — Ninoy Aquino Int'l",
    accessibilityScore: 9,
    fareMinPhp: 2500,
    fareMaxPhp: 6500,
    airlines: [
      { name: 'Philippine Airlines', code: 'PR', frequency: '35x / week', direct: true },
      { name: 'Cebu Pacific', code: '5J', frequency: '42x / week', direct: true },
      { name: 'AirAsia Philippines', code: 'Z2', frequency: '14x / week', direct: true },
    ],
    peakMonths: ['Mar', 'Apr', 'May', 'Dec'],
    gdpValue: 6.1,
    forexValue: 1.04,
    seasonalityScore: 0.82,
    yoyRatio: 1.05,
    surgeLevel: 'WARNING',
    upliftPct: 18.6,
    economyInsight:
      'Regional output is growing steadily and household budgets are holding up. Travelers from the region compare total trip cost, so publish one bundled price (room + transfers + tour) rather than a nightly rate.',
    seasonalityInsight:
      'Holy Week and the April–May summer break are the main windows, with a smaller Christmas peak. Start promotions about four weeks ahead — domestic travelers book closer to departure than international ones.',
    gdpTrend: years([5.4, 6.8, 5.9, 6.0, 6.1]),
    priceIndex: [1.0, 1.01, 1.01, 1.02, 1.02, 1.02, 1.03, 1.03, 1.03, 1.04, 1.04, 1.04],
    chartData: buildChartData({ base: 50, amp: 8, drift: 1.4, seasonBase: 62, seasonPhase: 1, spikeAt: null, weekly: [70.2, 71.6, 72.4, 72.9, 72.1, 71.0, 69.8, 68.9, 68.1, 67.5, 67.0, 66.6] }),
  },
  'Metro Manila': {
    city: 'Manila',
    directive:
      'Metro Manila is the largest domestic source and books year-round. Target young professionals with quick three-day getaways and highlight how short the hop from Manila is.',
    flightHours: '1h 20m',
    distanceKm: 570,
    nearestAirport: "MNL — Ninoy Aquino Int'l",
    accessibilityScore: 10,
    fareMinPhp: 2500,
    fareMaxPhp: 6500,
    airlines: [
      { name: 'Philippine Airlines', code: 'PR', frequency: '35x / week', direct: true },
      { name: 'Cebu Pacific', code: '5J', frequency: '42x / week', direct: true },
      { name: 'AirAsia Philippines', code: 'Z2', frequency: '14x / week', direct: true },
    ],
    peakMonths: ['Apr', 'May', 'Dec', 'Jan'],
    gdpValue: 5.9,
    forexValue: 1.06,
    seasonalityScore: 0.71,
    yoyRatio: 1.03,
    surgeLevel: null,
    upliftPct: null,
    economyInsight:
      'The capital has the highest spending power of any domestic source. These travelers trade up for convenience — sell airport transfers, late checkout and curated experiences as add-ons.',
    seasonalityInsight:
      'Demand is steady through the year with lifts at the summer break and the Christmas–New Year holidays. Long weekends create short spikes worth a quick social push.',
    gdpTrend: years([5.6, 7.1, 5.6, 5.7, 5.9]),
    priceIndex: [1.02, 1.02, 1.03, 1.03, 1.04, 1.04, 1.04, 1.05, 1.05, 1.05, 1.06, 1.06],
    chartData: buildChartData({ base: 54, amp: 5, drift: 0.9, seasonBase: 58, seasonPhase: 3, spikeAt: null, weekly: [66.1, 66.8, 67.2, 67.5, 67.4, 67.0, 66.6, 66.2, 65.9, 65.7, 65.5, 65.4] }),
  },
  'Central Luzon': {
    city: 'San Fernando',
    directive:
      'Central Luzon travelers can now fly direct from Clark, which makes Cebu an easy weekend option. Promote Clark departures specifically and pair them with island-hopping and dive packages.',
    flightHours: '1h 25m',
    distanceKm: 640,
    nearestAirport: "CRK — Clark Int'l",
    accessibilityScore: 7,
    fareMinPhp: 2800,
    fareMaxPhp: 7000,
    airlines: [
      { name: 'Cebu Pacific', code: '5J', frequency: '14x / week', direct: true },
      { name: 'Philippine Airlines', code: 'PR', frequency: '7x / week', direct: true },
    ],
    peakMonths: ['Apr', 'May', 'Dec'],
    gdpValue: 6.6,
    forexValue: 1.03,
    seasonalityScore: 0.76,
    yoyRatio: null,
    surgeLevel: null,
    upliftPct: null,
    economyInsight:
      'Fast regional growth is widening the middle-income travel market. Value-for-money group and barkada packages perform best — show the per-person price.',
    seasonalityInsight:
      'Summer and Christmas are the clear peaks. There is not enough history yet to confirm the pattern year on year, so treat these windows as directional.',
    gdpTrend: years([5.9, 7.6, 6.4, 6.3, 6.6]),
    priceIndex: [0.99, 1.0, 1.0, 1.0, 1.01, 1.01, 1.02, 1.02, 1.02, 1.03, 1.03, 1.03],
    chartData: buildChartData({ base: 46, amp: 7, drift: 1.2, seasonBase: 60, seasonPhase: 5, spikeAt: null, weekly: [60.4, 61.5, 62.3, 62.8, 62.6, 62.0, 61.4, 60.9, 60.4, 60.1, 59.8, 59.6] }),
  },
  'Western Visayas': {
    city: 'Iloilo City',
    directive:
      'Western Visayas is a short hop away, so Cebu competes with Boracay and Guimaras for the same weekend. Stand out with experiences they cannot get at home: whale sharks, canyoneering, Cebu heritage.',
    flightHours: '50m',
    distanceKm: 190,
    nearestAirport: "ILO — Iloilo Int'l",
    accessibilityScore: 8,
    fareMinPhp: 1800,
    fareMaxPhp: 4500,
    airlines: [
      { name: 'Cebu Pacific', code: '5J', frequency: '14x / week', direct: true },
      { name: 'Cebgo', code: 'DG', frequency: '7x / week', direct: true },
    ],
    peakMonths: ['Jan', 'Apr', 'May', 'Oct'],
    gdpValue: 6.4,
    forexValue: 1.01,
    seasonalityScore: 0.79,
    yoyRatio: 1.04,
    surgeLevel: null,
    upliftPct: null,
    economyInsight:
      'Budgets are moderate, and the short flight keeps the total trip cost low. Lead with the experience, not a discount — the fare is already the easy part.',
    seasonalityInsight:
      'Festival months (Dinagyang in January, MassKara in October) shift local travel, with summer as the main outbound window. Avoid competing head-on with home festivals; target the weeks after.',
    gdpTrend: years([5.1, 7.3, 6.1, 6.2, 6.4]),
    priceIndex: [0.98, 0.98, 0.99, 0.99, 0.99, 1.0, 1.0, 1.0, 1.01, 1.01, 1.01, 1.01],
    chartData: buildChartData({ base: 44, amp: 6, drift: 1.0, seasonBase: 59, seasonPhase: 2, spikeAt: null, weekly: [55.2, 56.0, 56.6, 57.0, 56.8, 56.3, 55.9, 55.5, 55.2, 55.0, 54.8, 54.7] }),
  },
  'Davao Region': {
    city: 'Davao City',
    directive:
      'Davao travelers fly direct and often combine Cebu with business trips. Offer flexible midweek stays and city-plus-island combinations for travelers extending a work trip.',
    flightHours: '1h',
    distanceKm: 390,
    nearestAirport: "DVO — Francisco Bangoy Int'l",
    accessibilityScore: 8,
    fareMinPhp: 2200,
    fareMaxPhp: 5500,
    airlines: [
      { name: 'Philippine Airlines', code: 'PR', frequency: '14x / week', direct: true },
      { name: 'Cebu Pacific', code: '5J', frequency: '21x / week', direct: true },
    ],
    peakMonths: ['Mar', 'Apr', 'Aug', 'Dec'],
    gdpValue: 7.0,
    forexValue: 1.02,
    seasonalityScore: 0.68,
    yoyRatio: null,
    surgeLevel: null,
    upliftPct: null,
    economyInsight:
      'One of the fastest-growing regional economies, with a rising business-travel base. Bleisure offers (work-friendly rooms, weekend extensions) fit this market well.',
    seasonalityInsight:
      'Summer, the Kadayawan festival in August and Christmas shape the calendar. The pattern is still emerging, so watch the forecast before committing big campaign spend.',
    gdpTrend: years([6.4, 8.3, 7.0, 6.8, 7.0]),
    priceIndex: [0.99, 0.99, 1.0, 1.0, 1.0, 1.01, 1.01, 1.01, 1.02, 1.02, 1.02, 1.02],
    chartData: buildChartData({ base: 42, amp: 6, drift: 1.1, seasonBase: 56, seasonPhase: 4, spikeAt: null, weekly: [54.0, 54.9, 55.6, 56.0, 55.8, 55.3, 54.8, 54.4, 54.1, 53.9, 53.7, 53.6] }),
  },
};

const slug = (name: string) => 'ph-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

/** One Market per sample region, in rank order. */
export const REGION_MARKETS: Market[] = SAMPLE_REGIONS.map((region, index) => {
  const d = DETAILS[region.name];
  const { priceIndex, ...rest } = d;
  return {
    ...rest,
    id: slug(region.name),
    rank: index + 1,
    name: region.name,
    matchScore: region.score,
    directFlight: d.airlines.some((a) => a.direct),
    destinationAirport: "CEB — Mactan-Cebu Int'l",
    flightFrequency: d.airlines.reduce((sum, a) => sum + parseInt(a.frequency, 10), 0),
    fareSource: 'preview_reference',
    fareAsOf: null,
    peakMonthsSource: 'reference',
    currency: 'PHP',
    forexLabel: 'Regional price index',
    spikeIndicator: false,
    windowOpenDate: null,
    scorer: null,
    gdpSource: 'preview',
    forexSource: 'preview',
    macroAsOf: null,
    forecastConfidence: 0.5,
    lowConfidence: true,
    forecastSource: 'stub',
    forexTrend: priceIndex.map((value, i) => ({ date: 'M' + (i + 1), value })),
    dataAsOf: null,
    dataStale: false,
    dataStaleCause: null,
  };
});

export function regionMarketByName(name: string | null): Market | null {
  return REGION_MARKETS.find((m) => m.name === name) ?? null;
}
