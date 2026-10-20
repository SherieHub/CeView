/**
 * Content campaigns — FRONTEND-ONLY planning model.
 *
 * There is no campaign API, persistence, scheduler or campaign-generation
 * service yet. A campaign here lives in React state for the current session
 * only: it is lost on refresh, never sent to the backend, and nothing
 * publishes or schedules from it. The UI says so wherever it matters.
 *
 * What IS real: the recommendations in `strategy` are computed by
 * campaignRecommendations.ts from data CeView already serves (the category's market
 * ranking and forecasts, the business profile, published-post metrics), and
 * captions come from the existing caption generator. Each recommendation
 * carries the evidence it rests on, so the UI never claims more than that.
 *
 * INTEGRATION BOUNDARY: when a campaign API exists, `useCampaignDrafts`
 * is the one place to swap — replace its in-memory list with fetch/mutate
 * calls and keep the same shape (or map to it).
 */
import { useCallback, useState } from 'react';
import type { AuditState, StudioPlatformId } from '../contentStudioTypes';

export type CampaignObjective = 'awareness' | 'experience' | 'inquiries' | 'offer' | 'product' | 'website';

export const OBJECTIVES: { id: CampaignObjective; label: string }[] = [
  { id: 'awareness', label: 'Increase brand awareness' },
  { id: 'experience', label: 'Promote a tourism experience' },
  { id: 'inquiries', label: 'Encourage inquiries' },
  { id: 'offer', label: 'Promote an existing offer' },
  { id: 'product', label: 'Increase interest in a product or service' },
  { id: 'website', label: 'Encourage website visits' },
];

export function objectiveLabel(id: CampaignObjective): string {
  return OBJECTIVES.find((o) => o.id === id)?.label ?? id;
}

/**
 * What a recommendation rests on. Explanatory labels, not confidence scores:
 * CeView has no calibrated basis for a percentage.
 */
export type EvidenceKind = 'demand' | 'performance' | 'general' | 'limited' | 'owner';

export const EVIDENCE_LABELS: Record<EvidenceKind, string> = {
  demand: 'Demand-informed',
  performance: 'Performance-informed',
  general: 'General recommendation',
  limited: 'Limited data',
  owner: 'Your choice',
};

export interface Recommendation<T> {
  value: T;
  /** One or two plain sentences, shown by default. */
  why: string;
  evidence: EvidenceKind;
  /** Supporting figures and limitations, behind "View details". */
  details: string[];
}

/** How the recommended market's opportunity was classified — see campaignRecommendations.classifyMarket. */
export type MarketOpportunity = 'surge' | 'emerging' | 'seasonal' | 'ranked';

export const OPPORTUNITY_LABELS: Record<MarketOpportunity, string> = {
  surge: 'Active surge',
  emerging: 'Emerging opportunity',
  seasonal: 'Seasonal opportunity',
  ranked: 'Top-ranked market',
};

export interface CampaignStrategy {
  market: Recommendation<{ id: string; name: string; opportunity: MarketOpportunity }>;
  platforms: Recommendation<StudioPlatformId[]>;
  objective: Recommendation<CampaignObjective>;
  focus: Recommendation<string[]>;
  timing: Recommendation<{ startDate: string; endDate: string; postsPerWeek: number }>;
}

/** Optional overrides from "Have something specific in mind?". */
export interface CampaignPreferences {
  weeks: number | null;
  focus: string;
  offer: string;
  marketId: string;
  platforms: StudioPlatformId[];
  notes: string;
}

export const EMPTY_PREFERENCES: CampaignPreferences = {
  weeks: null,
  focus: '',
  offer: '',
  marketId: '',
  platforms: [],
  notes: '',
};

/**
 * A post's place in the plan. 'suggested' is CeView's proposal, 'accepted'
 * the owner's go-ahead for the plan, 'approved' the owner's sign-off on the
 * prepared post. None of these mean scheduled or published — neither exists.
 */
export type PlannedPostStatus = 'suggested' | 'accepted' | 'skipped' | 'approved';

export type CaptionOrigin = 'generated' | 'edited' | 'none';

export interface PlannedPost {
  id: string;
  /** ISO date (yyyy-mm-dd) the owner intends to publish on. */
  date: string;
  platform: StudioPlatformId;
  /** Short title of the post. */
  topic: string;
  /** Its role in the campaign ("Introduce", "Encourage action"…). */
  purpose: string;
  direction: string;
  caption: string;
  /** English reading aid for a non-English caption. Cleared when the caption text changes. */
  captionEn?: string | null;
  captionOrigin: CaptionOrigin;
  visual: string;
  cta: string;
  /** Why this post is in the plan. */
  why: string;
  status: PlannedPostStatus;
  /** Authentic media the owner attached while preparing the post. */
  mediaDataUrl: string | null;
  audit: AuditState;
}

/** Where the owner is in the guided flow. */
export type CampaignStage = 'strategy' | 'plan' | 'prepare' | 'done';

export interface CampaignDraft {
  id: string;
  name: string;
  objective: CampaignObjective;
  marketId: string;
  marketName: string;
  category: string;
  platforms: StudioPlatformId[];
  startDate: string;
  endDate: string;
  postsPerWeek: number;
  /** Products or services from the business profile this campaign features. */
  focus: string[];
  /** An offer the owner confirmed themselves — never inferred. */
  offer: string;
  description: string;
  /** CeView's recommendation as generated; null for a hand-built campaign. */
  strategy: CampaignStrategy | null;
  stage: CampaignStage;
  posts: PlannedPost[];
  /** The strategy the posts were planned from (planBasis()), to spot a stale plan. */
  planBasis?: string;
}

/** The strategy fields a content plan depends on. */
export function planBasis(c: CampaignDraft): string {
  return [c.marketId, [...c.platforms].sort().join('+'), c.startDate, c.endDate, c.postsPerWeek, c.objective, c.focus.join('+')].join('|');
}

export const IDLE_AUDIT: AuditState = { status: 'idle', step: 0, result: null };

let seq = 0;
export function newId(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq}`;
}

export function emptyCampaign(category: string, today = isoToday()): CampaignDraft {
  return {
    id: newId('cmp'),
    name: '',
    objective: 'experience',
    marketId: '',
    marketName: '',
    category,
    platforms: [],
    startDate: today,
    endDate: today,
    postsPerWeek: 2,
    focus: [],
    offer: '',
    description: '',
    strategy: null,
    stage: 'plan',
    posts: [],
  };
}

export function blankPost(c: Pick<CampaignDraft, 'startDate' | 'platforms'>, status: PlannedPostStatus = 'accepted'): PlannedPost {
  return {
    id: newId('post'),
    date: c.startDate,
    platform: c.platforms[0] ?? 'instagram',
    topic: '',
    purpose: 'Custom post',
    direction: '',
    caption: '',
    captionOrigin: 'none',
    visual: '',
    cta: '',
    why: 'Added by you.',
    status,
    mediaDataUrl: null,
    audit: IDLE_AUDIT,
  };
}

/** CeView's businesses are in Cebu, so plans are dated in Philippine time. */
export const PLAN_TIME_ZONE = 'Asia/Manila';

export function isoToday(now = new Date()): string {
  // en-CA formats as yyyy-mm-dd.
  return new Intl.DateTimeFormat('en-CA', { timeZone: PLAN_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86_400_000);
}

export function formatDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatShortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function dateRange(c: Pick<CampaignDraft, 'startDate' | 'endDate'>): string {
  return `${formatDate(c.startDate)} – ${formatDate(c.endDate)}`;
}

export function durationLabel(c: Pick<CampaignDraft, 'startDate' | 'endDate'>): string {
  const days = daysBetween(c.startDate, c.endDate) + 1;
  const weeks = Math.round(days / 7);
  return weeks >= 1 && days % 7 === 0 ? `${weeks} week${weeks === 1 ? '' : 's'}` : `${days} day${days === 1 ? '' : 's'}`;
}

export function sortedPosts(posts: PlannedPost[]): PlannedPost[] {
  return [...posts].sort((a, b) => a.date.localeCompare(b.date));
}

/** The posts still in the campaign — everything the owner has not skipped. */
export function activePosts(posts: PlannedPost[]): PlannedPost[] {
  return posts.filter((p) => p.status !== 'skipped');
}

/**
 * Where a post stands in preparation, derived from what is actually there —
 * never stored, so it cannot drift from the caption, media and audit it reads.
 */
export type PrepState = 'skipped' | 'needs-caption' | 'needs-media' | 'needs-audit' | 'audit-failed' | 'ready' | 'approved';

export function prepState(p: PlannedPost): PrepState {
  if (p.status === 'skipped') return 'skipped';
  if (!p.caption.trim()) return 'needs-caption';
  if (!p.mediaDataUrl) return 'needs-media';
  if (p.audit.status === 'complete' && p.audit.result?.status === 'Pass') return p.status === 'approved' ? 'approved' : 'ready';
  if (p.audit.result?.status === 'Fail') return 'audit-failed';
  return 'needs-audit';
}

export const PREP_LABELS: Record<PrepState, string> = {
  skipped: 'Skipped',
  'needs-caption': 'Needs a caption',
  'needs-media': 'Needs media',
  'needs-audit': 'Ready for audit',
  'audit-failed': 'Changes needed',
  ready: 'Ready to approve',
  approved: 'Approved',
};

/**
 * The calendar's states. Scheduled and Published are listed so the owner can
 * see they are distinct — and that nothing here has reached them.
 */
export type CalendarState = 'planned' | 'prepared' | 'approved';

export function calendarState(p: PlannedPost): CalendarState {
  const s = prepState(p);
  if (s === 'approved') return 'approved';
  if (s === 'needs-caption' || s === 'needs-media') return 'planned';
  return 'prepared';
}

export const CALENDAR_LABELS: Record<CalendarState, string> = {
  planned: 'Planned',
  prepared: 'Prepared',
  approved: 'Approved',
};

/** An audit and sign-off apply only to the exact content that was reviewed. */
export function reconcilePost(previous: PlannedPost, next: PlannedPost): PlannedPost {
  // A translation describes one exact caption. If the text moved and no new English
  // came with it, the old English now describes words that are gone.
  if (previous.caption !== next.caption && previous.captionEn === next.captionEn) {
    next = { ...next, captionEn: null };
  }
  const changed = (['caption', 'mediaDataUrl', 'platform', 'visual'] as const)
    .some((key) => previous[key] !== next[key]);
  if (!changed) return next;
  return { ...next, audit: IDLE_AUDIT, status: next.status === 'approved' ? 'accepted' : next.status };
}

/** In-memory campaign list for this session. See the integration note above. */
export function useCampaignDrafts() {
  const [campaigns, setCampaigns] = useState<CampaignDraft[]>([]);

  const upsert = useCallback((campaign: CampaignDraft) => {
    setCampaigns((list) => {
      const i = list.findIndex((c) => c.id === campaign.id);
      if (i < 0) return [campaign, ...list];
      const next = [...list];
      next[i] = { ...campaign, posts: campaign.posts.map((post) => {
        const previous = list[i].posts.find((p) => p.id === post.id);
        return previous ? reconcilePost(previous, post) : post;
      }) };
      return next;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setCampaigns((list) => list.filter((c) => c.id !== id));
  }, []);

  const patchPost = useCallback((campaignId: string, postId: string, patch: Partial<PlannedPost>) => {
    setCampaigns((list) =>
      list.map((c) =>
        c.id !== campaignId ? c : { ...c, posts: c.posts.map((p) => (p.id === postId ? reconcilePost(p, { ...p, ...patch }) : p)) },
      ),
    );
  }, []);

  return { campaigns, upsert, remove, patchPost };
}
