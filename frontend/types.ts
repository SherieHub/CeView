/**
 * Shared domain types for the frontend/ rebuild. Grows as each screen card
 * lands (per docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/).
 * This file currently covers only what the Foundation cards need: auth,
 * business profile, and the Fixture Data Layer's new shapes.
 */

export interface AuthUser {
  id: string;
  // Nullable because Google sign-in's response body carries no email — it
  // lives inside the JWT instead (see apiClient.auth.google). Read sites must
  // handle the absent case rather than assuming a string.
  email: string | null;
  businessName: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  /**
   * Whether the operator still needs to go through the one-time "complete
   * your profile" step (missing contactNumber — always true for password
   * signups since /register requires it, sometimes false for a freshly
   * provisioned Google sign-in). See services/auth.tsx's profileCompleted.
   */
  profileCompleted: boolean;
}

export interface BusinessProfile {
  businessProfileId: string | null;
  businessName: string;
  categories: string[];
  coreServices: string[];
  description: string;
  uvp: string;
  imagePreview: string | null;
  uniquenessScore: number | null;
  /** Onboarding — Step 2 Brand Identity fields (card 5, 02-module-1.md). */
  slogan: string;
  industry: string;
  vibes: string[];
  website: string;
  logo: string | null;
  socials: Record<string, string>;
}

/**
 * The real backend's shape (com.ceview.module1.businessinput.dto.BusinessProfileDto,
 * GET/PUT /api/business-profile) — a strict subset of BusinessProfile. The
 * onboarding-only fields (slogan/industry/vibes/website/logo/socials) don't
 * exist in the backend schema yet (see docs/module-1/backend/schema-delta.md),
 * so ProfileProvider merges a fetched BusinessProfileDto over EMPTY_PROFILE
 * rather than assuming the backend returns those fields.
 */
export type BusinessProfileDto = Pick<
  BusinessProfile,
  'businessProfileId' | 'businessName' | 'categories' | 'coreServices' | 'description' | 'uvp' | 'imagePreview' | 'uniquenessScore'
>;

/** One category and its share of the classification — POST /api/classification/analyze. */
export interface CategoryAllocation {
  name: string;
  percentage: number;
}

/**
 * Uniqueness scoring result — POST /api/classification/uniqueness.
 * Scores are 0–100. Note the score field is `overallScore`, not `uniquenessScore`.
 */
export interface UniquenessResult {
  overallScore: number;
  semanticsScore: number;
  categoryScore: number;
  descriptionFeedback: string;
  categoryFeedback: string;
}

export type PlatformId = 'instagram' | 'tiktok' | 'facebook' | 'naver';

export interface PlatformConnection {
  platform: PlatformId;
  connected: boolean;
  handle: string | null;
  connectedAt: string | null;
}

/**
 * Future real-backend member shape — not what apiClient.workspace.members() returns today.
 * The fixture-backed path returns services/fixtures/members.ts's WorkspaceMemberFixture
 * (role: 'Owner'|'Editor'|'Viewer', initials, no id/status) instead; apiClient.ts is typed
 * against that fixture shape directly. Reconcile the two once a real endpoint exists.
 */
export interface WorkspaceMember {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'editor' | 'viewer';
  invitedAt: string;
  status: 'active' | 'invited';
}

export type PostStatus = 'draft' | 'scheduled' | 'published';

export interface SocialPost {
  id: string;
  platform: PlatformId;
  status: PostStatus;
  caption: string;
  scheduledFor: string | null;
  publishedAt: string | null;
  marketId: string | null;
}

export interface PostMetric {
  postId: string;
  impressions: number;
  engagements: number;
  clicks: number;
  engagementRate: number;
}

// ─── Module 2 — Market Radar ──────────────────────────────────────────────

export interface ChartDataPoint {
  week: string;
  history: number | null;
  forecast: number | null;
  seasonality: number;
  forex: number;
  gdp: number;
  spike: 0 | 1;
}

export interface Airline {
  name: string;
  code: string;
  frequency: string;
  direct: boolean;
  /** Present on backend AirlineDto; absent from older fixtures. */
  duration?: string;
  /** Present on backend AirlineDto; absent from older fixtures. */
  tier?: string;
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
  /**
   * Year-over-year arrivals ratio. Computed at ingestion and now persisted
   * (V20 added tbl_forecast_result.yoy_ratio / tbl_market_score.yoy_ratio;
   * ForecastingService populates them). Still nullable: rows written before
   * V20 have no value, so the Seasonal Patterns tab keeps its explicit
   * "not available" state for those.
   */
  yoyRatio: number | null;
  spikeIndicator: boolean;
  economyInsight: string;
  seasonalityInsight: string;
  gdpTrend: { year: number; value: number }[];
  forexTrend: { date: string; value: number }[];
  chartData: ChartDataPoint[];
}

export interface DemandAlert {
  id: string;
  date: string;
  title: string;
  market: string;
  marketId: string;
  category: string;
  trend: string;
  isRead: boolean;
  /**
   * tbl_demand_alert.alert_level. The live backend emits WARNING and CRITICAL
   * (seed data: 3 WARNING, 2 CRITICAL, no INFO); INFO comes from the
   * category-rank notification path. Anything above INFO counts as a surge —
   * see isSurge() below, and never compare against 'WARNING' directly or
   * CRITICAL alerts silently drop out of the surge count.
   */
  alertLevel: 'INFO' | 'WARNING' | 'CRITICAL';
  alertMessage: string;
}

// ─── Module 4 — Campaign Analytics ────────────────────────────────────────

export interface CampaignInput {
  impressions: number;
  clicks: number;
  adSpend: number;
  revenue: number;
  conversions: number;
  bookings: number;
  newCustomers: number;
}

export interface CampaignHistoryEntry {
  periodStart: string;
  periodEnd: string;
  pesScore: number;
  pesLabel: string;
  ctr: number;
  cpc: number;
  roas: number;
  convRate: number;
  cac: number;
}

/**
 * The `POST /api/analytics/manual` response's `pes` object (see
 * PESComputationService / ARCHITECTURE_SPEC.md §4.2) — the server-authoritative
 * score/label the board displays as of Task 17. `weight` is a display string
 * ("35.0%") the server formats itself; there is no `normalized` component, so
 * PesGauge's per-metric breakdown bars stay client-derived (see PesGauge.tsx).
 */
export interface PesBreakdownItem {
  metric: string;
  weight: string;
  contribution: number;
}

export interface ManualIngestPes {
  overallScore: number;
  label: string;
  breakdown: PesBreakdownItem[];
}

/**
 * `POST /api/analytics/manual`'s full response. Only `pes` is consumed by the
 * frontend today (Task 17) — `metrics`/`funnel` are computed client-side from
 * the same input via campaignMetrics.ts, so they're intentionally left
 * untyped/unused here rather than modeled speculatively.
 */
export interface ManualIngestResponse {
  pes?: ManualIngestPes;
}

export interface FunnelDiagnostic {
  stage: string;
  rank: string;
  dropRate: string;
  insight: string;
}

export interface Recommendation {
  stage: string;
  urgency: string;
  title: string;
  action: string;
}

export interface PrescriptiveReport {
  executiveSummary: string;
  recommendedPlatform: string;
  funnelDiagnostics: FunnelDiagnostic[];
  recommendations: Recommendation[];
}

// ─── Module 3 — Content Studio ────────────────────────────────────────────

export interface CaptionMetadata {
  core_business_context: string;
  market_cultural_localization: string;
  psychological_elements: string;
  creative_tone_atmosphere: string;
  algorithmic_platform_architecture: string;
}

export interface PlatformCaptions {
  optionNames: string[];
  options: string[];
  optionMetadata: CaptionMetadata[];
  guide: string[];
}

/**
 * Where generated content came from. "fallback" means fastapi-sbert served a
 * deterministic mock because GROQ_API_KEY is unset — the content looks real but
 * is not. Screens MUST surface this (see 05-module-3.md Task 25).
 */
export type ContentSource = 'groq' | 'gemini' | 'fallback' | 'template';

export interface ContentResponse {
  market: { country: string; city: string; flag: string };
  framework: string;
  source: ContentSource;
  /**
   * Deviates from the plan's `Record<string, PlatformCaptions>` — the fixture's
   * real shape (ui-ux-prototype.html:1093–1391 / CaptionsByPlatform) is a fixed
   * four-platform object, not an open string-keyed map. Kept as-is to avoid
   * silently widening/losing the per-platform keys.
   */
  captions: {
    instagram: PlatformCaptions;
    tiktok: PlatformCaptions;
    facebook: PlatformCaptions;
    naver: PlatformCaptions;
  };
}

export interface OmcsAuditResult {
  profileSemanticScore: number;
  /**
   * Deviates from the plan's `Record<string, number>` — the fixture's real
   * shape (ui-ux-prototype.html:1396–1426 / OmcsAuditResultDTO) nests the
   * rubric scores under `scores`/`total` rather than being a flat map. The
   * fixture-local `keyof typeof OMCS_RUBRIC_LABELS` key constraint is widened
   * to `string` here so this type doesn't depend back on services/fixtures/omcs.ts.
   */
  rubricEvaluationData: {
    scores: Record<string, number>;
    total: number;
  };
  recommendationsPictureScore: number;
  pubmatConsistencyScore: number;
  consistencyExplanation: string;
  omcsScore: number;
  status: 'Pass' | 'Fail';
  feedback: string;
}

/**
 * One shot in the creative direction's shot list.
 *
 * `label`, `description` and `lighting` are what
 * POST /api/creative-direction/generate actually returns today.
 *
 * The rest are OPTIONAL because the FastAPI service does not emit them yet:
 * the drawer renders the structured directives when they are present and falls
 * back to the narrative `description` when they are not, so a live response
 * still renders correctly. Emitting them from the service is a backend
 * follow-up — see backend/CONTRACT.md.
 */
export interface CreativeDirectionShot {
  label: string;
  description: string;
  lighting: string;
  /** Uppercase eyebrow — the kind of shot ("Hero", "Threshold"). */
  shotType?: string;
  /** What is in frame ("Sardine run, mid-shoal"). */
  subject?: string;
  /** Where the camera is. */
  placement?: string;
  /** What it does from there. */
  action?: string;
  /** Why the shot exists — which caption or platform it serves. */
  context?: string;
}

/**
 * Module 3 creative direction — CampaignBriefDrawer's data.
 *
 * Deviates from the plan's assumed `{shotListRecommendations, visualRecommendations,
 * lightingSuggestions, moodboardReferences}` shape — the live
 * POST /api/creative-direction/generate response was verified (Tasks 22-24) to
 * actually return this nested shape instead. Kept as observed rather than the
 * plan's guess.
 */
export interface CreativeDirection {
  visualGuide: string[];
  shots: CreativeDirectionShot[];
  moodboard: {
    palette: string;
    references: string[];
  };
}

/**
 * Not part of Task 1's enumerated fixture list, but the contract test's
 * "no type import from a fixture module" rule is unconditional, and
 * services/apiClient.ts imports this type — so it moves here too, following
 * the same import/re-export pattern as the other fixtures.
 */
export interface WorkspaceMemberFixture {
  name: string;
  email: string;
  role: 'Owner' | 'Editor' | 'Viewer';
  initials: string;
}

export interface PublishedPost {
  id: string;
  date: string;
  platform: PlatformId;
  caption: string;
  status: 'published' | 'draft';
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  engagementRate: number;
  series: number[];
}

/**
 * True when a demand alert represents an active surge. Centralised because the
 * dashboard reads it in three places (feed filter, surge count, surge markets)
 * and each previously compared `alertLevel === 'WARNING'` directly — which
 * silently excluded CRITICAL, the most urgent level the backend emits.
 */
export function isSurge(alert: Pick<DemandAlert, 'alertLevel'>): boolean {
  return alert.alertLevel === 'WARNING' || alert.alertLevel === 'CRITICAL';
}
