/**
 * Fixture data for Module 2 notifications (tbl_demand_alert) — ported
 * verbatim from ui-ux-prototype.html:1234-1267.
 *
 * Each alert is scoped to exactly one (category, market) pair — mirroring
 * how MarketDataIngestionService / TrendFetchSchedulerService actually
 * compute signals in Module 2 (21 combinations: 7 categories × 3 markets).
 * The Dashboard filters this list to the business's own `categories`, and
 * clicking an alert ranks markets for THAT alert's category specifically
 * (see CATEGORY_MARKET_SCORES / marketsForCategory in markets.ts) — there
 * is no single fixed "top 3 markets" independent of category.
 */
import type { Notification } from '../../types';

export const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: 'n1', date: 'Week of Aug 3, 2026', title: 'Demand Window Opening — South Korea',
    market: 'South Korea', marketId: 'korea', category: 'Accommodation & Staycation',
    trend: 'Healing / 힐링여행', isRead: false, alertLevel: 'WARNING',
    alertMessage: 'Predicted 4-week demand is 24% above the 7-day rolling baseline, and the 2σ spike is YoY-confirmed. Target within 4 weeks for maximum reach.',
  },
  {
    id: 'n2', date: 'Week of Jul 27, 2026', title: 'Rising Trend: Private Beachfront Escapes',
    market: 'Japan', marketId: 'japan', category: 'Coastal & Island',
    trend: 'Beachfront Luxury', isRead: false, alertLevel: 'INFO',
    alertMessage: 'Japanese search interest for セブ島 ホテル is accelerating — the 7-day rolling average has crossed above the 30-day baseline for three straight weeks.',
  },
  {
    id: 'n3', date: 'Week of Jul 20, 2026', title: 'Summer Planning Window — United States',
    market: 'United States', marketId: 'usa', category: 'Adventure & Nature',
    trend: 'Bucket-list Diving', isRead: true, alertLevel: 'INFO',
    alertMessage: 'US long-haul planners book 6–10 weeks ahead. Demand is rising steadily but seasonality remains unconfirmed at 0.61 — treat as an emerging signal, not a peak.',
  },
  {
    id: 'n4', date: 'Week of Jul 13, 2026', title: 'Forex Shift Favours Korean Visitors',
    market: 'South Korea', marketId: 'korea', category: 'Accommodation & Staycation',
    trend: 'Purchasing Power', isRead: true, alertLevel: 'INFO',
    alertMessage: 'PHP per KRW has moved to 23.80, the strongest level in the tracked 12-month window. Korean guests have materially more spending headroom this month.',
  },
  {
    id: 'n5', date: 'Week of Jul 6, 2026', title: 'New Interest: Cebu Heritage & Old Town Walks',
    market: 'Japan', marketId: 'japan', category: 'Cultural & Heritage',
    trend: 'Heritage Walking Tours', isRead: false, alertLevel: 'INFO',
    alertMessage: 'Japanese searches for "セブ 歴史 観光" (Cebu historical tourism) are up 19% over two weeks — tracking with the 非日常 (non-daily) framing Japanese travel content responds to.',
  },
  {
    id: 'n6', date: 'Jun 29, 2026', title: 'Emerging: Family Entertainment Bookings',
    market: 'South Korea', marketId: 'korea', category: 'Theme Parks / Entertainment',
    trend: 'Family Entertainment', isRead: true, alertLevel: 'INFO',
    alertMessage: 'Korean family-segment searches for entertainment-adjacent Cebu itineraries are climbing ahead of the school-break window — still below the 2σ surge threshold.',
  },
  {
    id: 'n7', date: 'Week of Jun 22, 2026', title: 'Steady Climb: Cebu City Weekend Breaks',
    market: 'Japan', marketId: 'japan', category: 'Urban & City',
    trend: 'Urban Weekend Breaks', isRead: true, alertLevel: 'INFO',
    alertMessage: 'Japanese interest in short Cebu City itineraries (2–3 nights) has held a steady upward slope for four consecutive weeks — a recurring, not spiking, pattern.',
  },
  {
    id: 'n8', date: 'Week of Jun 15, 2026', title: 'Rising: 세부 맛집 (Cebu Restaurant Guide) Searches',
    market: 'South Korea', marketId: 'korea', category: 'Culinary & Gastronomy',
    trend: 'Food Tourism', isRead: false, alertLevel: 'WARNING',
    alertMessage: 'Korean food-tourism search volume broke above μ + 2σ this week, and last year showed the same calendar-window pattern (YoY 1.14) — a confirmed seasonal surge, not a one-off.',
  },
];
