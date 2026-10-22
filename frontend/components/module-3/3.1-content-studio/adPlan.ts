/**
 * Turns "I want 5,000 people in Korea to see this" into a filled-in ad plan and
 * a step-by-step Ads Manager walkthrough (CVW-43).
 *
 * Research: docs/module-3/MSME_AD_SUPPORT_RESEARCH.md. CeView cannot create the
 * ad itself yet — that needs write access to the operator's ad account, which
 * Meta and TikTok grant only after app review — so the plan does the thinking
 * and the operator does the clicking, copying each value in.
 *
 * Pure functions, no I/O: the drawer gathers the inputs, this decides.
 */
import type { AdCostRates, AttributionLink } from '../../../types';

export type AdGoal = 'reach' | 'traffic' | 'messages';
export type AdPlatform = 'meta' | 'tiktok';

export interface AdPlanInput {
  goal: AdGoal;
  platform: AdPlatform;
  /** People to reach, visits, or conversations — depending on the goal. */
  target: number;
  marketId: string;
  marketName: string;
  /** The surge window's opening, from the alert. Null for alerts without one. */
  windowOpenDate: string | null;
  caption: string;
  /** Data URL of the staged media, used only to tell an image from a video. */
  mediaDataUrl: string | null;
  link: AttributionLink | null;
  code: string | null;
  rates: AdCostRates | null;
  today?: Date;
}

export interface AdPlanField {
  label: string;
  value: string;
  /** Offer a copy button — for values the operator pastes into Ads Manager. */
  copy?: boolean;
}

export interface AdGuideStep {
  title: string;
  detail: string;
  fields: AdPlanField[];
  /** External page to open for this step. */
  href?: string;
  /** In-app route to open for this step. */
  route?: string;
}

export interface AdBudget {
  total: number;
  daily: number;
  /** What the estimate rests on, said in the operator's terms. */
  basis: string;
  /** Reach estimates are a floor: people usually see an ad more than once. */
  atLeast: boolean;
}

export interface AdPlan {
  available: boolean;
  /** Why this goal/platform pair cannot be planned, when it can't. */
  unavailableReason?: string;
  objective: string;
  startDate: string;
  endDate: string;
  days: number;
  budget: AdBudget | null;
  /** Shown when there is no estimate, explaining why. */
  budgetNote?: string;
  warnings: string[];
  steps: AdGuideStep[];
}

/** Matches AttributionWindow.WINDOW_DAYS on the backend. */
export const CAMPAIGN_DAYS = 14;
/** TikTok's ad text field takes about 100 characters. */
export const TIKTOK_AD_TEXT_LIMIT = 100;

export const GOAL_LABEL: Record<AdGoal, { title: string; unit: string; hint: string }> = {
  reach: { title: 'Get seen', unit: 'people', hint: 'Show the post to as many people in the market as the budget allows.' },
  traffic: { title: 'Get booking-page visits', unit: 'visits', hint: 'Send people to your booking page through CeView’s tracked link.' },
  messages: { title: 'Get messages', unit: 'conversations', hint: 'Open a Messenger chat with you — best if you take bookings by message.' },
};

export const PLATFORM_LABEL: Record<AdPlatform, string> = {
  meta: 'Facebook & Instagram',
  tiktok: 'TikTok',
};

const COUNTRY: Record<string, string> = { korea: 'South Korea', japan: 'Japan', usa: 'United States' };
const LANGUAGE: Record<string, string> = { korea: 'Korean', japan: 'Japanese', usa: 'English (All)' };

/** Objective names as they appear in each Ads Manager's campaign set-up. */
const OBJECTIVE: Record<AdPlatform, Partial<Record<AdGoal, string>>> = {
  meta: { reach: 'Awareness', traffic: 'Traffic', messages: 'Engagement' },
  tiktok: { reach: 'Reach', traffic: 'Traffic' },
};

const ADS_MANAGER: Record<AdPlatform, string> = {
  meta: 'https://adsmanager.facebook.com/',
  tiktok: 'https://ads.tiktok.com/',
};

const peso = (n: number) => `₱${n.toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;
/**
 * YYYY-MM-DD in the operator's time zone. toISOString() is UTC, which turns a
 * window opening at midnight in Manila (16:00 UTC the day before) into the
 * wrong date.
 */
const isoDate = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);
/** Round budgets up to a tidy figure — nobody types ₱1,337 into Ads Manager. */
const roundUp = (n: number, step: number) => Math.ceil(n / step) * step;

/**
 * The campaign runs across the surge window. A window that has already opened
 * starts today; one with no date starts today and runs the standard length.
 */
export function campaignDates(windowOpenDate: string | null, today: Date = new Date()) {
  const open = windowOpenDate ? new Date(windowOpenDate) : null;
  const windowEnd = open ? addDays(open, CAMPAIGN_DAYS) : addDays(today, CAMPAIGN_DAYS);
  const start = open && open > today ? open : today;
  // A window that has already closed still gets a full run from today.
  const end = windowEnd > start ? windowEnd : addDays(start, CAMPAIGN_DAYS);
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000));
  return { startDate: isoDate(start), endDate: isoDate(end), days };
}

/**
 * Budget from the operator's own past ads only. No history means no estimate:
 * an invented benchmark would look authoritative and be wrong for Cebu.
 */
export function estimateBudget(goal: AdGoal, target: number, rates: AdCostRates | null, days: number): AdBudget | null {
  if (!rates || target <= 0) return null;
  const weeks = `${rates.periods} week${rates.periods === 1 ? '' : 's'}`;
  if (goal === 'reach' && rates.costPerThousandImpressions) {
    const total = roundUp((target * rates.costPerThousandImpressions) / 1000, 50);
    return {
      total,
      daily: roundUp(total / days, 10),
      basis: `Your past ads cost ${peso(rates.costPerThousandImpressions)} per 1,000 views (last ${weeks}).`,
      atLeast: true,
    };
  }
  if (goal === 'traffic' && rates.costPerClick) {
    const total = roundUp(target * rates.costPerClick, 50);
    return {
      total,
      daily: roundUp(total / days, 10),
      basis: `Your past ads cost ${peso(rates.costPerClick)} per click (last ${weeks}).`,
      atLeast: false,
    };
  }
  return null;
}

/** TikTok's ad text is short: keep the opening and always the code. */
export function shortAdText(caption: string, code: string | null, limit = TIKTOK_AD_TEXT_LIMIT): string {
  const firstLine = caption.split('\n').map((l) => l.trim()).find(Boolean) ?? '';
  const suffix = code ? ` Code ${code}` : '';
  const room = limit - suffix.length;
  const head = firstLine.length <= room ? firstLine : `${firstLine.slice(0, Math.max(0, room - 1)).trimEnd()}…`;
  return `${head}${suffix}`.trim();
}

export function buildAdPlan(input: AdPlanInput): AdPlan {
  const { goal, platform, target, link, code, rates } = input;
  const { startDate, endDate, days } = campaignDates(input.windowOpenDate, input.today);
  const objective = OBJECTIVE[platform][goal] ?? '';
  const base = { objective, startDate, endDate, days, budget: null, warnings: [] as string[], steps: [] };

  if (!objective) {
    return {
      ...base,
      available: false,
      unavailableReason: 'This guide covers message ads on Facebook & Instagram only. On TikTok, choose "Get booking-page visits" and send people to CeView’s booking form instead.',
    };
  }
  if (goal === 'traffic' && !link) {
    return {
      ...base,
      available: false,
      unavailableReason: 'Visit ads need a link. This campaign has no tracked link yet — it is created with the surge alert.',
    };
  }

  const budget = estimateBudget(goal, target, rates, days);
  const budgetNote = budget
    ? undefined
    : goal === 'messages'
      ? 'CeView has no past message-ad results to estimate from. Start with a daily budget you are comfortable with; Ads Manager shows its own estimate as you type.'
      : 'No past ad spend to estimate from yet. Start with a daily budget you are comfortable with; Ads Manager shows its own estimate as you type.';

  const warnings: string[] = [];
  const isVideo = input.mediaDataUrl?.startsWith('data:video') ?? false;
  if (platform === 'tiktok' && input.mediaDataUrl && !isVideo) {
    warnings.push('TikTok ads in the TikTok feed need a video. Your staged media is an image — record a short clip, or run this on Facebook & Instagram.');
  }
  const adText = platform === 'tiktok' ? shortAdText(input.caption, code) : input.caption;
  if (platform === 'tiktok' && input.caption.length > TIKTOK_AD_TEXT_LIMIT) {
    warnings.push(`TikTok ad text is limited to about ${TIKTOK_AD_TEXT_LIMIT} characters, so the plan uses a shortened version that keeps your code.`);
  }
  if (!input.caption.trim()) {
    warnings.push('No caption chosen yet. Pick one in the Post composer so the ad text is filled in.');
  }

  const country = COUNTRY[input.marketId] ?? input.marketName;
  const language = LANGUAGE[input.marketId] ?? 'Any';
  const campaignName = `CeView ${code ?? input.marketName} ${startDate}`;
  const budgetFields: AdPlanField[] = budget
    ? [
        { label: 'Daily budget', value: String(budget.daily), copy: true },
        { label: 'Estimated total', value: `${budget.atLeast ? 'at least ' : 'about '}${peso(budget.total)} over ${days} days` },
      ]
    : [];
  const schedule: AdPlanField[] = [
    { label: 'Start date', value: startDate, copy: true },
    { label: 'End date', value: endDate, copy: true },
  ];
  const audience: AdPlanField[] = [
    { label: 'Location', value: country, copy: true },
    { label: 'Language', value: language, copy: true },
    { label: 'Age', value: '18–65+ (narrow it only if your guests are a specific age)' },
  ];
  const connectStep: AdGuideStep = {
    title: 'Let CeView read the results',
    detail: 'Connect the same ad account in Settings → Platforms. CeView then pulls views, clicks and spend into the Performance screen, and the tracked link and code show which bookings the ad brought.',
    fields: [],
    route: '/settings/platforms',
  };

  const steps: AdGuideStep[] = platform === 'meta'
    ? [
        {
          title: 'Open Meta Ads Manager',
          detail: 'Sign in, pick your business’s ad account, and click “+ Create”. Add a payment method first if Meta asks for one.',
          fields: [],
          href: ADS_MANAGER.meta,
        },
        {
          title: 'Choose the campaign objective',
          detail: goal === 'messages'
            ? 'Pick Engagement. On the ad set, set the conversion location to Messaging apps and tick Messenger.'
            : goal === 'reach'
              ? 'Pick Awareness. On the ad set, keep the performance goal on reaching the most people.'
              : 'Pick Traffic. On the ad set, keep the performance goal on link clicks.',
          fields: [{ label: 'Objective', value: objective }],
        },
        { title: 'Name the campaign', detail: 'Include the code so you can match results later.', fields: [{ label: 'Campaign name', value: campaignName, copy: true }] },
        {
          title: 'Set the budget and dates (ad set)',
          detail: 'Choose a daily budget and run it across the surge window.',
          fields: [...budgetFields, ...schedule],
        },
        { title: 'Choose who sees it (ad set)', detail: 'Leave Advantage+ audience suggestions on; set these as the controls.', fields: audience },
        { title: 'Placements', detail: 'Keep Advantage+ placements so the ad can run on both Facebook and Instagram.', fields: [{ label: 'Placements', value: 'Advantage+ placements' }] },
        {
          title: 'Build the ad',
          detail: 'Choose your Facebook Page (and Instagram account), upload the same photo or video you staged in Content Studio, and paste the text.',
          fields: [{ label: 'Primary text', value: adText, copy: true }],
        },
        ...(link && goal !== 'messages'
          ? [{
              title: 'Add the tracked link',
              detail: 'Set the destination to Website. Paste the link, then paste the parameters into “URL parameters” so CeView can tell which ad a visit came from.',
              fields: [
                { label: 'Website URL', value: link.urls.linkUrl, copy: true },
                { label: 'URL parameters', value: link.urls.metaAdUrl.split('?')[1] ?? '', copy: true },
              ],
            }]
          : []),
        {
          title: 'Publish',
          detail: 'Click Publish. Meta reviews new ads before they run — most are reviewed within a day — and notifies you if anything needs changing.',
          fields: [],
        },
        connectStep,
      ]
    : [
        {
          title: 'Open TikTok Ads Manager',
          detail: 'Sign in, pick your advertiser account, and create a new campaign. Add a payment method first if TikTok asks for one.',
          fields: [],
          href: ADS_MANAGER.tiktok,
        },
        { title: 'Choose the advertising objective', detail: `Pick ${objective}.`, fields: [{ label: 'Objective', value: objective }] },
        { title: 'Name the campaign', detail: 'Include the code so you can match results later.', fields: [{ label: 'Campaign name', value: campaignName, copy: true }] },
        {
          title: 'Set up the ad group',
          detail: 'Placement: TikTok. Then set the audience, a daily budget, and run it across the surge window.',
          fields: [{ label: 'Placement', value: 'TikTok' }, ...audience, ...budgetFields, ...schedule],
        },
        {
          title: 'Build the ad',
          detail: 'Upload your video and paste the ad text.',
          fields: [{ label: 'Ad text', value: adText, copy: true }],
        },
        ...(link
          ? [{
              title: 'Add the tracked link',
              detail: 'Paste this as the destination URL. It carries TikTok’s ad IDs so CeView can tell which ad a visit came from.',
              fields: [{ label: 'Destination URL', value: link.urls.tiktokAdUrl, copy: true }],
            }]
          : []),
        {
          title: 'Submit',
          detail: 'Submit the ad. TikTok reviews new ads before they run — most are reviewed within a day.',
          fields: [],
        },
        connectStep,
      ];

  return { ...base, available: true, budget, budgetNote, warnings, steps };
}
