/**
 * What a paid Meta ad must satisfy, as pure functions. The Publish window uses these to show a
 * mistake as it is made; the server enforces the same rules (AdPolicy.java) and stays the authority.
 */
import type { AdInterest, AdMinimumBudget, AdObjective, AdSpendLimits, PublishAd } from '../../../types';

export const MAX_AD_INTERESTS = 10;
/** Quick picks for how long an ad runs; any whole number of days of at least 1 is allowed. */
export const AD_DURATION_PRESETS = [14, 30, 90] as const;
const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const DEFAULT_DAYS = 14;

export const AD_OBJECTIVES: { value: AdObjective; label: string; hint: string }[] = [
  { value: 'OUTCOME_TRAFFIC', label: 'Traffic', hint: 'Sends people to your tracking link, so you can see enquiries and bookings.' },
  { value: 'OUTCOME_AWARENESS', label: 'Awareness', hint: 'Shows the ad to as many people in the market as the budget allows.' },
  { value: 'OUTCOME_ENGAGEMENT', label: 'Engagement', hint: 'Aims for likes, comments and shares on the ad.' },
];

/** The audience a forecast market implies: its country, and the language when it has one to limit to. */
export interface MarketAudience {
  country: string;
  countryName: string;
  language: string | null;
}

const AUDIENCES: Record<string, MarketAudience> = {
  korea: { country: 'KR', countryName: 'South Korea', language: 'Korean' },
  japan: { country: 'JP', countryName: 'Japan', language: 'Japanese' },
  usa: { country: 'US', countryName: 'United States', language: null },
};

export function marketAudience(market?: string | null): MarketAudience | null {
  return AUDIENCES[(market ?? '').trim().toLowerCase()] ?? null;
}

export function adEndTime(startIso: string, days: number): string {
  return new Date(Date.parse(startIso) + days * DAY_MS).toISOString();
}

/** Daily budget × days, in minor units; nothing when the day count is not a usable whole number. */
export function adTotalMinor(ad: Pick<PublishAd, 'dailyBudgetMinor' | 'durationDays'>): number {
  if (!Number.isInteger(ad.durationDays) || ad.durationDays < 1) return 0;
  return ad.dailyBudgetMinor * ad.durationDays;
}

/** The surge window's opening when it is still ahead, otherwise an hour from now. */
export function defaultAdStart(windowOpenDate: string | null | undefined, now = Date.now()): string {
  const soonest = now + HOUR_MS;
  const opens = windowOpenDate ? Date.parse(windowOpenDate) : Number.NaN;
  return new Date(Number.isFinite(opens) ? Math.max(opens, soonest) : soonest).toISOString();
}

function minorDigits(currency: string): number {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

/** Minor units → the currency's major units, e.g. centavos → pesos. */
export function minorFactor(currency: string | null | undefined): number {
  return 10 ** (currency ? minorDigits(currency) : 2);
}

export function formatMinor(minor: number, currency: string): string {
  const digits = minorDigits(currency);
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency, minimumFractionDigits: digits, maximumFractionDigits: digits })
      .format(minor / 10 ** digits);
  } catch {
    return `${currency} ${(minor / 10 ** digits).toFixed(digits)}`;
  }
}

export interface AdCheckContext {
  /** The connected Meta ad account's currency; null when there is no account. */
  currency: string | null;
  limits: AdSpendLimits | null;
  minimum: AdMinimumBudget | null;
  market?: string | null;
  now?: number;
}

/** Everything wrong with the ad as it stands; empty means it can be published. */
export function adProblems(ad: PublishAd, ctx: AdCheckContext): string[] {
  const now = ctx.now ?? Date.now();
  if (!ctx.currency) return ['Connect a Meta ad account in Settings before creating an ad.'];
  const limits = ctx.limits;
  if (!limits || !limits.configured || limits.maxDailyMinor == null || limits.maxTotalMinor == null) {
    return ['Set your ad spending limits in Settings before running a paid ad.'];
  }
  const currency = ctx.currency;
  const problems: string[] = [];
  if (!marketAudience(ctx.market)) problems.push('Choose a forecast market for this ad.');

  if (!Number.isInteger(ad.dailyBudgetMinor) || ad.dailyBudgetMinor < 1) {
    problems.push('Enter a daily budget above zero.');
  } else {
    const floor = ctx.minimum && ctx.minimum.currency.toUpperCase() === currency.toUpperCase() ? ctx.minimum.minDailyMinor : null;
    if (floor != null && ad.dailyBudgetMinor <= floor) {
      problems.push(`Daily budget must be more than ${formatMinor(floor, currency)}, Meta's minimum for this ad.`);
    }
    if (ad.dailyBudgetMinor > limits.maxDailyMinor) {
      problems.push(`Daily budget is above your daily limit of ${formatMinor(limits.maxDailyMinor, currency)}.`);
    }
  }

  if (!Number.isInteger(ad.durationDays) || ad.durationDays < 1) {
    problems.push('Enter a whole number of days for the ad to run (at least 1).');
  } else if (Number.isInteger(ad.dailyBudgetMinor) && ad.dailyBudgetMinor >= 1) {
    const remaining = Math.max(0, limits.maxTotalMinor - limits.committedMinor);
    const total = adTotalMinor(ad);
    if (total > remaining) {
      problems.push(
        `This ad would spend ${formatMinor(total, currency)} in total, above your total limit; `
        + `${formatMinor(remaining, currency)} is left of ${formatMinor(limits.maxTotalMinor, currency)} across your active ads.`,
      );
    }
  }

  if (!(Date.parse(ad.startTime) > now)) problems.push('The ad must start in the future.');
  if (ad.interests.length > MAX_AD_INTERESTS) problems.push(`Choose at most ${MAX_AD_INTERESTS} interests.`);
  if (new Set(ad.interests.map((i) => i.id)).size !== ad.interests.length) problems.push('Each interest can be chosen only once.');
  if (!ad.attributionLinkId) problems.push('Choose a campaign tracking link.');
  return problems;
}

const OBJECTIVE_VALUES = AD_OBJECTIVES.map((o) => o.value);

function asInterests(raw: unknown): AdInterest[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    const i = item as Partial<AdInterest> | null;
    return i && typeof i.id === 'string' && i.id && typeof i.name === 'string' && i.name ? [{ id: i.id, name: i.name }] : [];
  });
}

/**
 * An ad as saved in a draft, brought to today's shape. Drafts from before targeting existed hold an
 * end time and a country list instead of a duration and interests; those get a duration worked out
 * from the dates, no interests, and no audience widening.
 */
export function normalizeAd(raw: unknown): PublishAd | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const startTime = typeof r.startTime === 'string' ? r.startTime : '';
  let durationDays = DEFAULT_DAYS;
  if (typeof r.durationDays === 'number' && Number.isInteger(r.durationDays) && r.durationDays >= 1) {
    durationDays = r.durationDays;
  } else if (typeof r.endTime === 'string') {
    const span = Date.parse(r.endTime) - Date.parse(startTime);
    if (Number.isFinite(span) && span > 0) durationDays = Math.max(1, Math.ceil(span / DAY_MS));
  }
  return {
    objective: OBJECTIVE_VALUES.includes(r.objective as AdObjective) ? (r.objective as AdObjective) : 'OUTCOME_TRAFFIC',
    dailyBudgetMinor: typeof r.dailyBudgetMinor === 'number' ? r.dailyBudgetMinor : 0,
    startTime,
    durationDays,
    interests: asInterests(r.interests),
    advantageAudience: r.advantageAudience === true,
    attributionLinkId: typeof r.attributionLinkId === 'string' ? r.attributionLinkId : '',
    pinCampaign: r.pinCampaign === true,
  };
}
