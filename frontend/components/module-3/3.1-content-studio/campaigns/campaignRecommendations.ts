/**
 * The campaign recommendation layer — pure functions over data CeView already
 * serves. No model, no network: the views fetch, this decides, and every
 * decision carries the evidence it rests on (campaignTypes.Recommendation).
 *
 * Inputs and what each is used for:
 *  - Market[] for the business's category (GET /api/forecasting/markets) —
 *    the backend's composite rank, the validated surge level, the 12-week
 *    forecast in chartData, and the seasonality score and peak months.
 *  - PublishedPost[] — per-platform engagement rate, for the platform choice.
 *  - BusinessProfile — name, category, services, description, unique value.
 *  - ContentResponse (POST /api/content/generate) — the generated captions and
 *    per-platform visual guide that fill the content plan.
 *
 * It never invents a product, offer, metric or audience. Where data is thin
 * the recommendation says so (evidence 'limited') instead of guessing, and the
 * owner can override every value.
 *
 * Kept separate from the forecasting and caption services on purpose: nothing
 * here changes how a market is scored or a caption is written.
 */
import type { BusinessProfile, ContentResponse, Market, PublishedPost } from '@/types';
import { auditRecommendations } from '../auditRecommendations';
import { STUDIO_PLATFORMS } from '../contentStudioTypes';
import type { StudioPlatformId } from '../contentStudioTypes';
import {
  IDLE_AUDIT,
  PLAN_TIME_ZONE,
  addDays,
  daysBetween,
  formatDate,
  newId,
} from './campaignTypes';
import type {
  CampaignDraft,
  CampaignObjective,
  CampaignPreferences,
  CampaignStrategy,
  EvidenceKind,
  MarketOpportunity,
  PlannedPost,
  Recommendation,
} from './campaignTypes';

// ─── Thresholds — named so they are visible, tested and explained in the UI ──

/** A forecast must rise at least this much over recent weeks to count as emerging. */
export const EMERGING_MIN_RISE_PCT = 5;
/** ARCHITECTURE_SPEC seasonality bands: 0.70+ is Moderate or Strong. */
export const SEASONAL_MIN_SCORE = 0.7;
/** How far ahead a seasonal peak or forecast rise is worth planning for (12 weeks — the forecast horizon). */
export const PLANNING_HORIZON_DAYS = 84;
/** Fewer published posts than this on a platform is too small a sample to compare. */
export const MIN_POSTS_PER_PLATFORM = 3;
/** One platform must lead the next by this ratio of median engagement rate to be called the winner. */
export const PLATFORM_LEAD_RATIO = 1.15;
export const DEFAULT_POSTS_PER_WEEK = 2;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const FORECAST_CAVEAT = 'Forecasts measure search interest, not confirmed bookings or arrivals.';
const REGIONS_NOTE = 'Philippine regions aren’t included yet: CeView doesn’t have regional forecasts.';

// ─── Business profile readiness ─────────────────────────────────────────────

export interface ProfileReadiness {
  /** Fields generation cannot run without. */
  missing: string[];
  /** Gaps that make the plan less specific but do not block it. */
  limited: string[];
}

export function profileReadiness(profile: BusinessProfile): ProfileReadiness {
  const missing: string[] = [];
  if (!profile.businessName.trim()) missing.push('Business name');
  if (!profile.categories.length) missing.push('Tourism category');
  if (!profile.description.trim()) missing.push('Business description');
  const limited: string[] = [];
  if (!profile.coreServices.some((s) => s.trim())) limited.push('Products or services');
  if (!profile.uvp.trim()) limited.push('What makes you different');
  return { missing, limited };
}

// ─── Market ─────────────────────────────────────────────────────────────────

export interface ForecastDirection {
  recentAvg: number;
  forecastAvg: number;
  changePct: number;
  /** Start of the week the forecast peaks, when the API dates it. */
  peakWeek: string | null;
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const round1 = (n: number) => Math.round(n * 10) / 10;

/** Recent measured weeks against the forecast weeks that follow them. */
export function forecastDirection(m: Market): ForecastDirection | null {
  const history = m.chartData.filter((p) => p.history != null).map((p) => p.history as number);
  const future = m.chartData.filter((p) => p.history == null && p.forecast != null);
  const recent = history.slice(-4);
  if (recent.length < 2 || future.length < 2) return null;
  const recentAvg = mean(recent);
  const forecastAvg = mean(future.map((p) => p.forecast as number));
  if (recentAvg <= 0) return null;
  const peak = future.reduce((best, p) => ((p.forecast as number) > (best.forecast as number) ? p : best));
  return {
    recentAvg: round1(recentAvg),
    forecastAvg: round1(forecastAvg),
    changePct: round1(((forecastAvg - recentAvg) / recentAvg) * 100),
    peakWeek: peak.weekStartDate ? peak.weekStartDate.slice(0, 10) : null,
  };
}

/** The first day of the next peak month inside the planning horizon, or null. */
export function upcomingPeakMonth(m: Market, today: string): string | null {
  if (!m.peakMonths.length) return null;
  const [y, mo] = today.split('-').map(Number);
  for (let i = 0; i < 4; i += 1) {
    const month = (mo - 1 + i) % 12;
    const year = y + Math.floor((mo - 1 + i) / 12);
    if (!m.peakMonths.includes(MONTHS[month])) continue;
    const start = i === 0 ? today : `${year}-${String(month + 1).padStart(2, '0')}-01`;
    return daysBetween(today, start) <= PLANNING_HORIZON_DAYS ? start : null;
  }
  return null;
}

/**
 * Surge is the backend's validated demand-window threshold. Emerging and
 * seasonal are read from the backend's own forecast and seasonality output
 * with the thresholds above — never from a model's opinion.
 */
export function classifyMarket(m: Market, today: string): MarketOpportunity {
  if (m.surgeLevel) return 'surge';
  const dir = forecastDirection(m);
  if (!m.lowConfidence && dir && dir.changePct >= EMERGING_MIN_RISE_PCT) return 'emerging';
  if (m.seasonalityScore >= SEASONAL_MIN_SCORE && upcomingPeakMonth(m, today)) return 'seasonal';
  return 'ranked';
}

function tier(m: Market, today: string): number {
  const o = classifyMarket(m, today);
  if (o === 'surge') return m.surgeLevel === 'CRITICAL' ? 0 : 1;
  return { emerging: 2, seasonal: 3, ranked: 4 }[o];
}

function monthName(iso: string): string {
  return MONTH_NAMES[Number(iso.slice(5, 7)) - 1] ?? iso;
}

function marketDetails(m: Market, total: number, category: string, today: string): string[] {
  const details = [`Ranked #${m.rank} of ${total} markets for ${category} in CeView’s current forecast.`];
  if (m.surgeLevel) {
    details.push(
      `Surge level: ${m.surgeLevel === 'CRITICAL' ? 'critical' : 'warning'}${m.upliftPct != null ? `, ${round1(m.upliftPct)}% above its usual level` : ''}${m.windowOpenDate ? `, since ${formatDate(m.windowOpenDate.slice(0, 10))}` : ''}.`,
    );
  }
  const dir = forecastDirection(m);
  if (dir) {
    details.push(
      `Search interest: ${dir.recentAvg} over recent weeks, ${dir.forecastAvg} forecast for the weeks ahead (${dir.changePct >= 0 ? '+' : ''}${dir.changePct}%).`,
    );
    details.push(`Emerging opportunity is a planning heuristic: at least ${EMERGING_MIN_RISE_PCT}% forecast growth over recent weeks, not a validated surge alert.`);
  }
  if (m.spikeIndicator) details.push('A measured spike this week (more than two standard deviations above its 7-day average).');
  const peak = upcomingPeakMonth(m, today);
  details.push(
    `Peak months: ${m.peakMonths.join(', ') || 'none recorded'} (${m.peakMonthsSource === 'seasonal_history' ? 'from its seasonal history' : 'reference data'}); seasonality score ${m.seasonalityScore.toFixed(2)}${peak ? `, next peak from ${formatDate(peak)}` : ''}.`,
  );
  if (m.lowConfidence) details.push('Forecast confidence is low for this market — treat it as indicative.');
  if (m.dataStale) details.push('The newest data behind this market is more than two days old.');
  details.push(FORECAST_CAVEAT, REGIONS_NOTE);
  return details;
}

export function recommendMarket(
  markets: Market[],
  category: string,
  today: string,
  preferredId = '',
): Recommendation<{ id: string; name: string; opportunity: MarketOpportunity }> | null {
  if (!markets.length) return null;
  const preferred = preferredId ? markets.find((m) => m.id === preferredId) : undefined;
  const pick =
    preferred ??
    [...markets].sort(
      (a, b) =>
        tier(a, today) - tier(b, today) ||
        Number(a.lowConfidence) - Number(b.lowConfidence) ||
        a.rank - b.rank,
    )[0];
  const opportunity = classifyMarket(pick, today);
  const cat = category.toLowerCase();
  const peak = upcomingPeakMonth(pick, today);

  const why = preferred
    ? `You chose ${pick.name}.`
    : {
        surge: `Demand from ${pick.name} for ${cat} has crossed CeView’s surge threshold, so travelers there are searching now.`,
        emerging: `Interest from ${pick.name} in ${cat} is forecast to rise over the coming weeks — a good time to get content out ahead of it.`,
        seasonal: `${pick.name}’s travel season usually peaks in ${peak ? monthName(peak) : 'the coming months'}, and that’s coming up.`,
        ranked: `${pick.name} is the top-ranked market for ${cat} right now, though no surge or rise is forecast for it yet.`,
      }[opportunity];

  let evidence: EvidenceKind = opportunity === 'ranked' ? 'general' : 'demand';
  if (pick.lowConfidence) evidence = 'limited';
  if (preferred) evidence = 'owner';

  return {
    value: { id: pick.id, name: pick.name, opportunity },
    why,
    evidence,
    details: marketDetails(pick, markets.length, category, today),
  };
}

// ─── Platform ───────────────────────────────────────────────────────────────

export interface PlatformStat {
  platform: StudioPlatformId;
  posts: number;
  medianEngagementRate: number;
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const platformLabel = (id: StudioPlatformId) => STUDIO_PLATFORMS.find((p) => p.id === id)?.label ?? id;

/** Published posts with results, per platform. Drafts and zero-reach rows carry no evidence. */
export function platformStats(posts: PublishedPost[]): PlatformStat[] {
  const by = new Map<StudioPlatformId, number[]>();
  for (const p of posts) {
    if (p.status !== 'published' || !(p.reach > 0) || !Number.isFinite(p.engagementRate) || p.engagementRate < 0) continue;
    if (!STUDIO_PLATFORMS.some((s) => s.id === p.platform)) continue;
    const id = p.platform as StudioPlatformId;
    by.set(id, [...(by.get(id) ?? []), p.engagementRate]);
  }
  return [...by.entries()]
    .map(([platform, rates]) => ({ platform, posts: rates.length, medianEngagementRate: round1(median(rates)) }))
    .sort((a, b) => b.medianEngagementRate - a.medianEngagementRate);
}

export function recommendPlatforms(posts: PublishedPost[], preferred: StudioPlatformId[] = []): Recommendation<StudioPlatformId[]> {
  const stats = platformStats(posts);
  const statLines = stats.map(
    (s) => `${platformLabel(s.platform)}: ${s.posts} published post${s.posts === 1 ? '' : 's'}, median engagement rate ${s.medianEngagementRate}%.`,
  );
  const scope = 'This compares your account overall — CeView doesn’t have audience-nationality data, so it isn’t specific to one market.';
  const method = `Compared by engagement rate rather than raw reach, so a bigger following on one platform doesn’t skew it. A platform needs at least ${MIN_POSTS_PER_PLATFORM} published posts to count.`;

  if (preferred.length) {
    return { value: preferred, why: `You chose ${preferred.map(platformLabel).join(' and ')}.`, evidence: 'owner', details: statLines.length ? [...statLines, scope] : [] };
  }

  const eligible = stats.filter((s) => s.posts >= MIN_POSTS_PER_PLATFORM);
  if (eligible.length >= 2) {
    const [top, next] = eligible;
    if (top.medianEngagementRate > 0 && (next.medianEngagementRate === 0 || top.medianEngagementRate / next.medianEngagementRate >= PLATFORM_LEAD_RATIO)) {
      return {
        value: [top.platform],
        why: `Your ${platformLabel(top.platform)} posts get a higher typical engagement rate than your other platforms (${top.medianEngagementRate}% vs. ${next.medianEngagementRate}% on ${platformLabel(next.platform)}).`,
        evidence: 'performance',
        details: [...statLines, method, scope],
      };
    }
    return {
      value: [top.platform, next.platform],
      why: `Your posts perform about the same on ${platformLabel(top.platform)} and ${platformLabel(next.platform)}, so the plan uses both.`,
      evidence: 'performance',
      details: [...statLines, method, scope],
    };
  }

  const counted = stats.reduce((n, s) => n + s.posts, 0);
  return {
    value: ['instagram', 'facebook'],
    why: 'Instagram and Facebook both suit photo-led tourism content. CeView doesn’t have enough of your published posts yet to compare platforms.',
    evidence: 'limited',
    details: [
      counted
        ? `CeView found ${counted} published post${counted === 1 ? '' : 's'} with results — not enough to compare platforms fairly.`
        : 'CeView found no published posts with results yet.',
      ...statLines,
      method,
    ],
  };
}

// ─── Objective and focus ────────────────────────────────────────────────────

export function recommendObjective(
  opportunity: MarketOpportunity,
  marketName: string,
  offer: string,
): Recommendation<CampaignObjective> {
  if (offer.trim()) {
    return { value: 'offer', why: 'You told CeView about an offer, so the campaign builds toward it.', evidence: 'owner', details: [] };
  }
  const byOpportunity: Record<MarketOpportunity, Recommendation<CampaignObjective>> = {
    surge: { value: 'inquiries', why: `Travelers from ${marketName} are searching now, so the campaign asks them to get in touch.`, evidence: 'demand', details: [] },
    emerging: { value: 'awareness', why: 'Interest is building, so the campaign introduces your business before it peaks.', evidence: 'demand', details: [] },
    seasonal: { value: 'experience', why: 'Ahead of the season, the campaign shows travelers what they can experience with you.', evidence: 'demand', details: [] },
    ranked: { value: 'experience', why: 'With no surge forecast, the campaign keeps a steady focus on what guests experience with you.', evidence: 'general', details: [] },
  };
  return byOpportunity[opportunity];
}

export function recommendFocus(profile: BusinessProfile, category: string, preferred = ''): Recommendation<string[]> {
  if (preferred.trim()) {
    return { value: [preferred.trim()], why: `You asked to feature ${preferred.trim()}.`, evidence: 'owner', details: [] };
  }
  const services = profile.coreServices.map((s) => s.trim()).filter(Boolean);
  if (!services.length) {
    return {
      value: [],
      why: 'Your Business Profile doesn’t list products or services yet, so the plan features your business as a whole.',
      evidence: 'limited',
      details: ['Add your services to your Business Profile for a more specific plan.'],
    };
  }
  const words = category.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 3);
  const matches = (s: string) => words.some((w) => s.toLowerCase().includes(w));
  const ordered = [...services.filter(matches), ...services.filter((s) => !matches(s))];
  const pick = ordered.slice(0, 2);
  const fits = pick.some(matches);
  const list = pick.join(' and ');
  return {
    value: pick,
    why: `${list} ${pick.length === 1 ? 'is' : 'are'} listed in your Business Profile${fits ? ` and fit${pick.length === 1 ? 's' : ''} the ${category.toLowerCase()} demand this campaign targets` : ''}.`,
    evidence: 'general',
    details: [`Services on your profile: ${services.join(', ')}.`, 'CeView only features what your profile lists — no new amenities, packages, prices or discounts.'],
  };
}

// ─── Timing ─────────────────────────────────────────────────────────────────

const DEFAULT_WEEKS: Record<MarketOpportunity, number> = { surge: 2, emerging: 3, seasonal: 4, ranked: 3 };

export function recommendTiming(
  market: Market,
  opportunity: MarketOpportunity,
  today: string,
  preferredWeeks: number | null = null,
): Recommendation<{ startDate: string; endDate: string; postsPerWeek: number }> {
  const weeks = preferredWeeks ?? DEFAULT_WEEKS[opportunity];
  const tomorrow = addDays(today, 1);
  const later = (a: string, b: string) => (a > b ? a : b);
  let startDate = tomorrow;
  let why = `A ${weeks}-week campaign starting tomorrow, at a steady two posts a week.`;

  if (opportunity === 'surge') {
    why = `Starts tomorrow and runs ${weeks} weeks, while the demand window is open.`;
  } else if (opportunity === 'emerging') {
    const peak = forecastDirection(market)?.peakWeek ?? null;
    if (peak) {
      startDate = later(tomorrow, addDays(peak, -weeks * 7));
      why = `Runs ${weeks} weeks so your posts are out before interest peaks, around ${formatDate(peak)}.`;
    } else {
      why = `Starts tomorrow and runs ${weeks} weeks, so your posts are out while interest rises.`;
    }
  } else if (opportunity === 'seasonal') {
    const peak = upcomingPeakMonth(market, today);
    if (peak) {
      startDate = later(tomorrow, addDays(peak, -14));
      why = `Starts about two weeks before ${monthName(peak)}, so your content is live as the season begins.`;
    }
  }

  const endDate = addDays(startDate, weeks * 7 - 1);
  const details = [
    `${DEFAULT_POSTS_PER_WEEK} posts a week is a planning default, not an optimized schedule — change it to suit you.`,
    'CeView’s weekly forecasts don’t tell it the best day or hour to post, so post times are yours to choose.',
    `Dates are in Philippine time (${PLAN_TIME_ZONE}).`,
  ];
  if (preferredWeeks) details.unshift(`You asked for ${preferredWeeks} week${preferredWeeks === 1 ? '' : 's'}.`);
  return {
    value: { startDate, endDate, postsPerWeek: DEFAULT_POSTS_PER_WEEK },
    why,
    evidence: opportunity === 'ranked' ? 'general' : 'demand',
    details,
  };
}

// ─── Strategy ───────────────────────────────────────────────────────────────

export interface StrategyInput {
  profile: BusinessProfile;
  category: string;
  markets: Market[];
  posts: PublishedPost[];
  prefs: CampaignPreferences;
  today: string;
}

export function buildStrategy({ profile, category, markets, posts, prefs, today }: StrategyInput): CampaignStrategy | null {
  const market = recommendMarket(markets, category, today, prefs.marketId);
  if (!market) return null;
  const m = markets.find((x) => x.id === market.value.id) as Market;
  return {
    market,
    platforms: recommendPlatforms(posts, prefs.platforms),
    objective: recommendObjective(market.value.opportunity, market.value.name, prefs.offer),
    focus: recommendFocus(profile, category, prefs.focus),
    timing: recommendTiming(m, market.value.opportunity, today, prefs.weeks),
  };
}

export function campaignFromStrategy(strategy: CampaignStrategy, category: string, prefs: CampaignPreferences): CampaignDraft {
  const { market, platforms, objective, focus, timing } = strategy;
  return {
    id: newId('cmp'),
    name: `${market.value.name} · ${focus.value[0] ?? category}`,
    objective: objective.value,
    marketId: market.value.id,
    marketName: market.value.name,
    category,
    platforms: platforms.value,
    startDate: timing.value.startDate,
    endDate: timing.value.endDate,
    postsPerWeek: timing.value.postsPerWeek,
    focus: focus.value,
    offer: prefs.offer.trim(),
    description: prefs.notes.trim(),
    strategy,
    stage: 'strategy',
    posts: [],
  };
}

// ─── Content plan ───────────────────────────────────────────────────────────

type Beat = 'introduce' | 'highlight' | 'interest' | 'value' | 'action';

const BEAT_PURPOSE: Record<Beat, string> = {
  introduce: 'Introduce',
  highlight: 'Highlight an experience',
  interest: 'Build interest',
  value: 'Show your value',
  action: 'Encourage action',
};

/** Opens with an introduction, closes with a call to action, varies the middle. */
export function beatSequence(n: number): Beat[] {
  if (n <= 1) return ['introduce'];
  const middle: Beat[] = ['highlight', 'interest', 'value'];
  return ['introduce', ...Array.from({ length: n - 2 }, (_, i) => middle[i % middle.length]), 'action'];
}

export function plannedPostCount(c: Pick<CampaignDraft, 'startDate' | 'endDate' | 'postsPerWeek'>): number {
  const weeks = Math.max(1, Math.round((daysBetween(c.startDate, c.endDate) + 1) / 7));
  return Math.max(1, weeks * c.postsPerWeek);
}

export function spreadDates(start: string, end: string, n: number): string[] {
  const span = Math.max(0, daysBetween(start, end));
  if (n <= 1) return [start];
  return Array.from({ length: n }, (_, i) => addDays(start, Math.round((i * span) / (n - 1))));
}

/** The next generated caption for a platform that the plan isn't already using. */
export function unusedCaption(content: ContentResponse | null, platform: StudioPlatformId, used: Set<string>): string | null {
  const options = content?.captions[platform]?.options ?? [];
  return options.find((o) => o.trim() && !used.has(o)) ?? null;
}

function visualFallback(beat: Beat, item: string): string {
  return {
    introduce: 'A wide shot that shows where you are — the setting, the view, the way in.',
    highlight: `${item} in action, in natural light, with real guests or staff (with their permission).`,
    interest: 'Something that helps a visitor plan — your location, the route in, or the best time of day to come.',
    value: 'A detail that shows what makes you different — your team, your craft, or your setting.',
    action: 'A welcoming shot of your team or entrance.',
  }[beat];
}

export interface PlanInput {
  campaign: CampaignDraft;
  profile: BusinessProfile;
  content: ContentResponse | null;
}

export function buildPostPlan({ campaign: c, profile, content }: PlanInput): PlannedPost[] {
  const n = plannedPostCount(c);
  const beats = beatSequence(n);
  const dates = spreadDates(c.startDate, c.endDate, n);
  const platforms = c.platforms.length ? c.platforms : (['instagram'] as StudioPlatformId[]);
  const biz = profile.businessName.trim() || 'your business';
  const market = c.marketName || 'your target market';
  const items = c.focus.length ? c.focus : [biz];
  const used = new Set<string>();
  const guideIndex = new Map<StudioPlatformId, number>();
  let highlight = 0;

  return beats.map((beat, i) => {
    const platform = platforms[i % platforms.length];
    const item = beat === 'highlight' ? items[highlight++ % items.length] : items[0];
    const caption = unusedCaption(content, platform, used);
    if (caption) used.add(caption);

    const guide = content?.captions[platform]?.guide ?? [];
    const g = guideIndex.get(platform) ?? 0;
    guideIndex.set(platform, g + 1);
    const visual = guide.length ? guide[g % guide.length] : visualFallback(beat, item);

    const text = {
      introduce: {
        topic: `Meet ${biz}`,
        direction: `Introduce ${biz} to travelers from ${market}: where you are and what you offer.`,
        why: 'Opens the campaign, so new audiences know who you are before you ask them to act.',
        cta: 'Follow for more',
      },
      highlight: {
        topic: `Spotlight: ${item}`,
        direction: `Show ${item} up close — what a guest actually sees and does.`,
        why: c.focus.length ? `Gives travelers a concrete reason to choose you, built on ${item} from your profile.` : 'Gives travelers a concrete reason to choose you.',
        cta: 'Save this for your trip',
      },
      interest: {
        topic: `Planning a trip from ${market}`,
        direction: `Answer what a traveler from ${market} would want to know before visiting — when to come, what to expect, how to reach you.`,
        why: 'Builds consideration by making the trip feel easy to plan.',
        cta: 'Share with someone you’d travel with',
      },
      value: {
        topic: `Why ${biz}`,
        direction: profile.uvp.trim()
          ? `Explain what sets you apart, using what you told CeView: “${profile.uvp.trim()}”`
          : `Explain, in your own words, what sets ${biz} apart.`,
        why: profile.uvp.trim()
          ? 'Uses the difference you described in your Business Profile.'
          : 'Your profile doesn’t say what makes you different yet — this post is where you say it.',
        cta: 'Ask us anything',
      },
      action: {
        topic: c.offer ? `Your offer: ${c.offer}` : c.objective === 'website' ? 'Visit our website' : 'Plan your visit',
        direction: c.offer
          ? `Feature the offer you confirmed — ${c.offer} — and how to claim it.`
          : `Invite travelers from ${market} to get in touch and plan their visit.`,
        why: 'Closes the campaign with one clear next step.',
        cta: c.objective === 'website' && profile.website ? `Visit ${profile.website}` : 'Message us to plan your visit',
      },
    }[beat];

    return {
      id: newId('post'),
      date: dates[i],
      platform,
      topic: text.topic,
      purpose: BEAT_PURPOSE[beat],
      direction: text.direction,
      caption: caption ?? '',
      captionOrigin: caption ? 'generated' : 'none',
      visual,
      cta: text.cta,
      why: text.why,
      status: 'suggested',
      mediaDataUrl: null,
      audit: IDLE_AUDIT,
    };
  });
}

/**
 * What the audit judges a campaign post against — Quick Post's own
 * recommendations (auditRecommendations: the caption option's metadata when
 * the caption is a generated one, plus the platform's visual guide), with the
 * post's visual brief added to the guide.
 */
export function postAuditRecommendations(content: ContentResponse | null, post: PlannedPost): Record<string, unknown> | null {
  const options = content?.captions[post.platform]?.options ?? [];
  const index = options.indexOf(post.caption);
  const base = auditRecommendations(content, post.platform, index >= 0 ? index : null) ?? {};
  const guide = Array.isArray(base.visual_guide) ? (base.visual_guide as string[]) : [];
  const lines = [...new Set([post.visual, ...guide].filter((s) => s && s.trim()))];
  const merged = { ...base, ...(lines.length ? { visual_guide: lines } : {}) };
  return Object.keys(merged).length ? merged : null;
}
