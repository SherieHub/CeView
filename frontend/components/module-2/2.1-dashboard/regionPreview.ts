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
  'Central Visayas': {
    city: 'Tagbilaran',
    directive:
      'Central Visayas is your home region: neighbors from Bohol, Negros Oriental and Siquijor come over by fast ferry. Promote short "staycation across the strait" stays and time them away from Sinulog, when locals stay home for the festival.',
    flightHours: '2h (via fast ferry)',
    distanceKm: 75,
    nearestAirport: "TAG — Bohol-Panglao Int'l",
    accessibilityScore: 9,
    fareMinPhp: 800,
    fareMaxPhp: 2400,
    airlines: [
      { name: 'OceanJet (fast ferry)', code: 'OJ', frequency: '28x / week', direct: true },
      { name: 'SuperCat (fast ferry)', code: 'SC', frequency: '21x / week', direct: true },
    ],
    peakMonths: ['Apr', 'May', 'Dec'],
    gdpValue: 6.8,
    forexValue: 1.03,
    seasonalityScore: 0.66,
    yoyRatio: 1.01,
    surgeLevel: null,
    upliftPct: null,
    economyInsight:
      'Short, cheap trips make Cebu an easy weekend for nearby islands. These guests decide late and travel light — keep last-minute rates visible and sell experiences they do not have at home.',
    seasonalityInsight:
      'Summer and Christmas lift travel; January is dominated by Sinulog, when the home region is busy with its own festival. Plan campaigns for the weeks either side.',
    gdpTrend: years([6.0, 7.5, 6.6, 6.5, 6.8]),
    priceIndex: [1.0, 1.0, 1.01, 1.01, 1.01, 1.02, 1.02, 1.02, 1.02, 1.03, 1.03, 1.03],
    chartData: buildChartData({ base: 40, amp: 6, drift: 1.0, seasonBase: 55, seasonPhase: 1, spikeAt: null, weekly: [50.8, 51.6, 52.1, 52.5, 52.3, 51.8, 51.3, 50.9, 50.6, 50.4, 50.2, 50.1] }),
  },
  'Northern Mindanao': {
    city: 'Cagayan de Oro',
    directive:
      'Northern Mindanao travelers reach Cebu in under an hour from Laguindingan. Lead with beach and dive breaks that contrast with the region’s highland and river adventures.',
    flightHours: '45m',
    distanceKm: 220,
    nearestAirport: "CGY — Laguindingan Int'l",
    accessibilityScore: 8,
    fareMinPhp: 1900,
    fareMaxPhp: 4800,
    airlines: [
      { name: 'Cebu Pacific', code: '5J', frequency: '14x / week', direct: true },
      { name: 'Philippine Airlines', code: 'PR', frequency: '7x / week', direct: true },
    ],
    peakMonths: ['Mar', 'Apr', 'May', 'Dec'],
    gdpValue: 6.5,
    forexValue: 1.02,
    seasonalityScore: 0.64,
    yoyRatio: null,
    surgeLevel: null,
    upliftPct: null,
    economyInsight:
      'A growing urban middle class in Cagayan de Oro drives most of the demand. Family and group bundles with the total price shown up front convert best.',
    seasonalityInsight:
      'Summer and the year-end holidays are the main windows; the pattern is still emerging, so treat it as directional until more history builds up.',
    gdpTrend: years([5.8, 7.4, 6.3, 6.2, 6.5]),
    priceIndex: [0.99, 0.99, 1.0, 1.0, 1.0, 1.01, 1.01, 1.01, 1.01, 1.02, 1.02, 1.02],
    chartData: buildChartData({ base: 40, amp: 6, drift: 0.9, seasonBase: 54, seasonPhase: 3, spikeAt: null, weekly: [49.6, 50.3, 50.8, 51.1, 50.9, 50.5, 50.1, 49.8, 49.5, 49.3, 49.2, 49.1] }),
  },
  'Ilocos Region': {
    city: 'Laoag',
    directive:
      'Ilocos travelers usually connect through Manila, so the trip is a deliberate holiday rather than a quick hop. Sell longer stays (four nights and up) and island experiences unlike the Ilocos coast.',
    flightHours: '3h+ (via MNL)',
    distanceKm: 960,
    nearestAirport: "LAO — Laoag Int'l",
    accessibilityScore: 5,
    fareMinPhp: 4500,
    fareMaxPhp: 9500,
    airlines: [{ name: 'Philippine Airlines (via Manila)', code: 'PR', frequency: '7x / week', direct: false }],
    peakMonths: ['Apr', 'May', 'Dec'],
    gdpValue: 5.6,
    forexValue: 1.0,
    seasonalityScore: 0.7,
    yoyRatio: null,
    surgeLevel: null,
    upliftPct: null,
    economyInsight:
      'Budgets are moderate and the connecting fare adds up. Show the whole-trip value — bundle transfers and tours so the extra flight time feels worth it.',
    seasonalityInsight:
      'The April–May summer break and Christmas are the travel windows. Because the route needs a connection, travelers plan further ahead; start promotions six to eight weeks out.',
    gdpTrend: years([4.9, 6.8, 5.4, 5.3, 5.6]),
    priceIndex: [0.98, 0.98, 0.98, 0.99, 0.99, 0.99, 0.99, 1.0, 1.0, 1.0, 1.0, 1.0],
    chartData: buildChartData({ base: 38, amp: 6, drift: 0.9, seasonBase: 56, seasonPhase: 5, spikeAt: null, weekly: [47.2, 47.9, 48.4, 48.7, 48.5, 48.1, 47.7, 47.4, 47.1, 46.9, 46.8, 46.7] }),
  },
  'Bicol Region': {
    city: 'Legazpi',
    directive:
      'Bicol travelers can fly direct from the new Bicol International Airport. Pair Cebu’s islands with its city life — a different trip from Bicol’s own volcano and whale-shark draws.',
    flightHours: '1h 10m',
    distanceKm: 330,
    nearestAirport: "DRP — Bicol Int'l",
    accessibilityScore: 7,
    fareMinPhp: 2100,
    fareMaxPhp: 5200,
    airlines: [{ name: 'Cebu Pacific', code: '5J', frequency: '7x / week', direct: true }],
    peakMonths: ['Apr', 'May', 'Aug', 'Dec'],
    gdpValue: 5.9,
    forexValue: 1.0,
    seasonalityScore: 0.63,
    yoyRatio: null,
    surgeLevel: null,
    upliftPct: null,
    economyInsight:
      'Price-aware travelers with growing incomes. Emphasise value bundles and payment-friendly offers rather than premium upgrades.',
    seasonalityInsight:
      'Summer, the August Ibalong festival period and Christmas mark the calendar. With one direct carrier, seat sales drive demand — align promotions with them.',
    gdpTrend: years([5.2, 7.0, 5.8, 5.7, 5.9]),
    priceIndex: [0.98, 0.98, 0.99, 0.99, 0.99, 0.99, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
    chartData: buildChartData({ base: 37, amp: 6, drift: 0.9, seasonBase: 53, seasonPhase: 2, spikeAt: null, weekly: [45.9, 46.5, 47.0, 47.3, 47.1, 46.7, 46.3, 46.0, 45.8, 45.6, 45.5, 45.4] }),
  },
  MIMAROPA: {
    city: 'Puerto Princesa',
    directive:
      'MIMAROPA travelers already live among islands, so beaches alone will not sell. Lead with what Palawan lacks: city dining, heritage, whale-shark encounters and canyoneering.',
    flightHours: '1h 15m',
    distanceKm: 560,
    nearestAirport: "PPS — Puerto Princesa Int'l",
    accessibilityScore: 6,
    fareMinPhp: 2400,
    fareMaxPhp: 6000,
    airlines: [{ name: 'Cebu Pacific', code: '5J', frequency: '7x / week', direct: true }],
    peakMonths: ['Apr', 'May', 'Dec'],
    gdpValue: 5.4,
    forexValue: 1.01,
    seasonalityScore: 0.6,
    yoyRatio: null,
    surgeLevel: null,
    upliftPct: null,
    economyInsight:
      'Many travelers here work in tourism themselves and travel in the low season. Off-peak deals and experience-led packages fit them best.',
    seasonalityInsight:
      'Locals travel when their own islands are quiet — the rainy months and after the peak. The pattern is weak so far; watch the forecast before committing spend.',
    gdpTrend: years([4.6, 6.5, 5.2, 5.1, 5.4]),
    priceIndex: [0.99, 0.99, 0.99, 1.0, 1.0, 1.0, 1.0, 1.01, 1.01, 1.01, 1.01, 1.01],
    chartData: buildChartData({ base: 36, amp: 5, drift: 0.8, seasonBase: 50, seasonPhase: 4, spikeAt: null, weekly: [44.1, 44.6, 45.0, 45.2, 45.1, 44.8, 44.5, 44.2, 44.0, 43.9, 43.8, 43.7] }),
  },
  'Eastern Visayas': {
    city: 'Tacloban',
    directive:
      'Eastern Visayas is a short flight from Tacloban. Families visiting relatives in Cebu are a big share — offer flexible family rooms and easy city-plus-beach combinations.',
    flightHours: '50m',
    distanceKm: 220,
    nearestAirport: 'TAC — Daniel Z. Romualdez',
    accessibilityScore: 7,
    fareMinPhp: 1800,
    fareMaxPhp: 4500,
    airlines: [
      { name: 'Cebu Pacific', code: '5J', frequency: '14x / week', direct: true },
      { name: 'Philippine Airlines', code: 'PR', frequency: '7x / week', direct: true },
    ],
    peakMonths: ['Apr', 'May', 'Jun', 'Dec'],
    gdpValue: 5.7,
    forexValue: 0.99,
    seasonalityScore: 0.62,
    yoyRatio: null,
    surgeLevel: null,
    upliftPct: null,
    economyInsight:
      'Household budgets are modest. Value pricing and visible inclusions (breakfast, transfers) do more than discounts on premium rooms.',
    seasonalityInsight:
      'Summer, the June Pintados festival season and Christmas shape travel. History is limited, so treat the pattern as emerging.',
    gdpTrend: years([4.8, 6.9, 5.5, 5.4, 5.7]),
    priceIndex: [0.97, 0.97, 0.98, 0.98, 0.98, 0.98, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99],
    chartData: buildChartData({ base: 35, amp: 5, drift: 0.8, seasonBase: 52, seasonPhase: 1, spikeAt: null, weekly: [42.9, 43.4, 43.8, 44.0, 43.9, 43.6, 43.3, 43.0, 42.8, 42.7, 42.6, 42.5] }),
  },
  'Cordillera (CAR)': {
    city: 'Baguio',
    directive:
      'Cordillera travelers trade mountain cool for island sun. They fly from Clark or Manila, so sell beach-first escapes and make the trip from the highlands feel simple.',
    flightHours: '1h 25m',
    distanceKm: 780,
    nearestAirport: "CRK — Clark Int'l",
    accessibilityScore: 6,
    fareMinPhp: 2800,
    fareMaxPhp: 7000,
    airlines: [{ name: 'Cebu Pacific', code: '5J', frequency: '14x / week', direct: true }],
    peakMonths: ['Mar', 'Apr', 'May', 'Dec'],
    gdpValue: 5.8,
    forexValue: 1.02,
    seasonalityScore: 0.61,
    yoyRatio: null,
    surgeLevel: null,
    upliftPct: null,
    economyInsight:
      'Baguio households have solid incomes but compare total trip cost, including the drive to the airport. Bundle airport transfers on the Cebu side.',
    seasonalityInsight:
      'February is Panagbenga at home, so outbound travel picks up after it, through summer, and again at Christmas. The pattern is still emerging.',
    gdpTrend: years([5.0, 7.1, 5.6, 5.5, 5.8]),
    priceIndex: [0.99, 1.0, 1.0, 1.0, 1.01, 1.01, 1.01, 1.01, 1.02, 1.02, 1.02, 1.02],
    chartData: buildChartData({ base: 34, amp: 5, drift: 0.8, seasonBase: 51, seasonPhase: 3, spikeAt: null, weekly: [41.6, 42.1, 42.5, 42.7, 42.6, 42.3, 42.0, 41.7, 41.5, 41.4, 41.3, 41.2] }),
  },
  SOCCSKSARGEN: {
    city: 'General Santos',
    directive:
      'SOCCSKSARGEN travelers fly direct from General Santos. Food-loving guests from the tuna capital respond to culinary and seafood experiences paired with island tours.',
    flightHours: '1h 10m',
    distanceKm: 480,
    nearestAirport: "GES — General Santos Int'l",
    accessibilityScore: 6,
    fareMinPhp: 2200,
    fareMaxPhp: 5400,
    airlines: [{ name: 'Cebu Pacific', code: '5J', frequency: '7x / week', direct: true }],
    peakMonths: ['Apr', 'May', 'Sep', 'Dec'],
    gdpValue: 6.0,
    forexValue: 0.99,
    seasonalityScore: 0.58,
    yoyRatio: null,
    surgeLevel: null,
    upliftPct: null,
    economyInsight:
      'Moderate budgets with a strong business-travel segment. Weekend extensions for travelers already in Cebu on business are a natural upsell.',
    seasonalityInsight:
      'Summer, the September Tuna Festival period and Christmas mark the calendar. The pattern is weak so far — use it as a rough guide only.',
    gdpTrend: years([5.3, 7.2, 5.9, 5.8, 6.0]),
    priceIndex: [0.97, 0.97, 0.98, 0.98, 0.98, 0.98, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99],
    chartData: buildChartData({ base: 33, amp: 5, drift: 0.7, seasonBase: 49, seasonPhase: 5, spikeAt: null, weekly: [40.2, 40.7, 41.0, 41.2, 41.1, 40.8, 40.5, 40.3, 40.1, 40.0, 39.9, 39.8] }),
  },
  'Zamboanga Peninsula': {
    city: 'Zamboanga City',
    directive:
      'Zamboanga travelers fly direct and value familiar comforts. Emphasise easy logistics, family-friendly stays and halal-friendly dining options where you have them.',
    flightHours: '1h 10m',
    distanceKm: 400,
    nearestAirport: "ZAM — Zamboanga Int'l",
    accessibilityScore: 6,
    fareMinPhp: 2200,
    fareMaxPhp: 5400,
    airlines: [
      { name: 'Cebu Pacific', code: '5J', frequency: '7x / week', direct: true },
      { name: 'Philippine Airlines', code: 'PR', frequency: '4x / week', direct: true },
    ],
    peakMonths: ['Apr', 'May', 'Oct', 'Dec'],
    gdpValue: 5.5,
    forexValue: 0.98,
    seasonalityScore: 0.57,
    yoyRatio: null,
    surgeLevel: null,
    upliftPct: null,
    economyInsight:
      'Budgets are moderate. Clear all-in pricing and flexible booking terms reduce hesitation for a trip that is still an occasional splurge.',
    seasonalityInsight:
      'Summer, the October Hermosa festival season and Christmas shape travel. The pattern is still emerging.',
    gdpTrend: years([4.7, 6.6, 5.3, 5.2, 5.5]),
    priceIndex: [0.97, 0.97, 0.97, 0.97, 0.98, 0.98, 0.98, 0.98, 0.98, 0.98, 0.98, 0.98],
    chartData: buildChartData({ base: 32, amp: 5, drift: 0.7, seasonBase: 48, seasonPhase: 2, spikeAt: null, weekly: [38.9, 39.3, 39.6, 39.8, 39.7, 39.4, 39.2, 39.0, 38.8, 38.7, 38.6, 38.5] }),
  },
  'Cagayan Valley': {
    city: 'Tuguegarao',
    directive:
      'Cagayan Valley travelers connect through Manila, so a Cebu trip is planned well ahead. Sell multi-night packages early and spell out the whole itinerary.',
    flightHours: '3h+ (via MNL)',
    distanceKm: 840,
    nearestAirport: 'TUG — Tuguegarao',
    accessibilityScore: 4,
    fareMinPhp: 4500,
    fareMaxPhp: 9500,
    airlines: [{ name: 'Cebu Pacific (via Manila)', code: '5J', frequency: '7x / week', direct: false }],
    peakMonths: ['Apr', 'May', 'Dec'],
    gdpValue: 5.3,
    forexValue: 0.98,
    seasonalityScore: 0.56,
    yoyRatio: null,
    surgeLevel: null,
    upliftPct: null,
    economyInsight:
      'Largely agricultural incomes with travel concentrated in a few holidays. Early-bird pricing and instalment-friendly offers help travelers commit.',
    seasonalityInsight:
      'Summer and Christmas are the only strong windows. With a connecting route, promotions need to start about eight weeks ahead.',
    gdpTrend: years([4.5, 6.4, 5.1, 5.0, 5.3]),
    priceIndex: [0.97, 0.97, 0.97, 0.97, 0.97, 0.98, 0.98, 0.98, 0.98, 0.98, 0.98, 0.98],
    chartData: buildChartData({ base: 31, amp: 5, drift: 0.7, seasonBase: 50, seasonPhase: 4, spikeAt: null, weekly: [37.6, 38.0, 38.3, 38.5, 38.4, 38.1, 37.9, 37.7, 37.5, 37.4, 37.3, 37.2] }),
  },
  Caraga: {
    city: 'Butuan',
    directive:
      'Caraga travelers fly direct from Butuan. Siargao gives the region its own surf scene, so lead with what is different here — city stays, heritage and diving.',
    flightHours: '50m',
    distanceKm: 260,
    nearestAirport: 'BXU — Bancasi',
    accessibilityScore: 6,
    fareMinPhp: 1900,
    fareMaxPhp: 4800,
    airlines: [{ name: 'Cebu Pacific', code: '5J', frequency: '7x / week', direct: true }],
    peakMonths: ['Apr', 'May', 'Dec'],
    gdpValue: 5.6,
    forexValue: 0.98,
    seasonalityScore: 0.55,
    yoyRatio: null,
    surgeLevel: null,
    upliftPct: null,
    economyInsight:
      'Modest budgets; short direct flights keep trips affordable. Simple, well-priced weekend packages are the strongest offer.',
    seasonalityInsight:
      'Summer and the year-end holidays drive travel. The pattern is weak so far — treat it as a rough guide.',
    gdpTrend: years([4.8, 6.7, 5.4, 5.3, 5.6]),
    priceIndex: [0.97, 0.97, 0.97, 0.98, 0.98, 0.98, 0.98, 0.98, 0.98, 0.98, 0.98, 0.98],
    chartData: buildChartData({ base: 30, amp: 5, drift: 0.7, seasonBase: 47, seasonPhase: 1, spikeAt: null, weekly: [36.3, 36.7, 37.0, 37.2, 37.1, 36.8, 36.6, 36.4, 36.2, 36.1, 36.0, 35.9] }),
  },
  BARMM: {
    city: 'Cotabato City',
    directive:
      'BARMM travelers fly direct from Cotabato. Halal-friendly dining, prayer-room access and family-oriented stays matter most — say so clearly if you offer them.',
    flightHours: '1h 05m',
    distanceKm: 400,
    nearestAirport: 'CBO — Awang',
    accessibilityScore: 5,
    fareMinPhp: 2200,
    fareMaxPhp: 5400,
    airlines: [{ name: 'Cebu Pacific', code: '5J', frequency: '4x / week', direct: true }],
    peakMonths: ['Apr', 'May', 'Dec'],
    gdpValue: 5.2,
    forexValue: 0.97,
    seasonalityScore: 0.52,
    yoyRatio: null,
    surgeLevel: null,
    upliftPct: null,
    economyInsight:
      'Budgets are modest and travel is family-centred. Visible halal-friendly options and clear inclusions do more than headline discounts.',
    seasonalityInsight:
      'School breaks and holidays drive travel; Islamic holidays move each year, so check the calendar before scheduling campaigns. The pattern is still emerging.',
    gdpTrend: years([4.4, 6.2, 4.9, 4.9, 5.2]),
    priceIndex: [0.96, 0.96, 0.96, 0.97, 0.97, 0.97, 0.97, 0.97, 0.97, 0.97, 0.97, 0.97],
    chartData: buildChartData({ base: 29, amp: 5, drift: 0.6, seasonBase: 46, seasonPhase: 3, spikeAt: null, weekly: [35.0, 35.4, 35.6, 35.8, 35.7, 35.5, 35.3, 35.1, 35.0, 34.9, 34.8, 34.7] }),
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
