
export enum MarketId {
  KOREA = 'korea',
  JAPAN = 'japan',
  AUSTRALIA = 'australia',
  USA = 'usa',
  GLOBAL = 'global',
}

export interface ChartDataPoint {
  week: string;
  history: number | null;
  forecast: number | null;
  seasonality: number;
  forex: number;
  gdp: number;
  spike: number;
}

export interface GdpTrendPoint {
  year: number;
  value: number;
}

export interface ForexTrendPoint {
  date: string;
  value: number;
}

export interface Airline {
  name: string;
  code: string;
  frequency: string;
  direct: boolean;
  duration: string;
  tier: string;
}

export interface Market {
  id: string;
  rank: number;
  name: string;
  city: string;
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
  economyInsight: string;
  seasonalityInsight: string;
  chartData: ChartDataPoint[];
  gdpTrend?: GdpTrendPoint[];
  forexTrend?: ForexTrendPoint[];
}

export interface SellingPoint {
  point: string;
  description: string;
}

export interface AnalysisResult {
  sellingPoints: SellingPoint[];
  suggestedMarket: MarketId;
  marketReasoning: string;
  risingTrend: string; // e.g., "Healing Travel"
}

export interface GeneratedContent {
  caption: string;
  hashtags: string[];
  suggestedTime: string; // e.g., "Tuesday 6:00 PM KST"
  translation?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  type: 'peak' | 'micro-season' | 'opportunity' | 'trend' | 'post';
  market: MarketId;
}

export interface KeywordTrend {
  keyword: string;
  volume: number; // 0-100 Google Trends Index
  growth: number; // Percentage growth
  market: string;
}

export interface ContentStrategy {
  platformRecommendation: string;
  generatedCaptions: {
    platform: 'Instagram' | 'Facebook' | 'TikTok';
    text: string;
    hashtags: string[];
  }[];
  visualDirections: {
    platform: 'Instagram' | 'Facebook' | 'TikTok';
    direction: string;
  }[];
}

export interface Notification {
  id: string;
  date: string;
  title: string;
  market: string;
  /** Canonical market id (matches Market.id). Populated by backend NotificationDto. */
  marketId: string;
  trend: string;
  isRead: boolean;
  /** Optional rich payload for a future "Market Analyzer" modal. */
  details?: {
    projectedArrivals: number;
    arrivalGrowth: number;
    topInterests: { name: string; score: number }[];
    segments: string[];
    strategicInsights: {
      trendAlignment: string;
      connectivity: string;
      economicValue: string;
    };
    keywordData: KeywordTrend[];
    contentStrategy: ContentStrategy;
  }
}

export interface BusinessProfileData {
  name: string;
  category: string;
  description: string;
  coverPhoto: string | null;
  generatedKeywords: string[];
}

// New Types for Performance Reports
export interface PostPerformance {
  id: string;
  date: string;
  platform: 'Instagram' | 'Facebook' | 'TikTok';
  contentSnippet: string;
  likes: number;
  comments: number;
  shares: number;
  reach: number;
  engagementRate: number; // percentage (0-100)
}

export interface PerformanceAnalysis {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
}

export interface PerformanceReport {
  id: string;
  weekLabel: string; // e.g., "Week of May 15, 2025"
  dateRange: string;
  title: string;
  isRead: boolean;
  summaryStats: {
    totalReach: number;
    avgEngagement: number;
    topPlatform: string;
  };
  data: PostPerformance[];
}

// ── Module 3 — Content Studio ───────────────────────────────────────────────

export type ContentPlatformId = 'instagram' | 'tiktok' | 'facebook';

export interface MarketHeader {
  country: string;
  city: string;
  flag?: string;
}

/**
 * AI reasoning metadata for a single caption variation — returned by the
 * LangGraph caption agent (Submodule 3.1) alongside the caption text.
 * Surfaced in the UI as a collapsible "AI Reasoning" section.
 */
export interface CaptionMetadata {
  /** The "What" — business attributes, services, UVP, destination signals */
  core_business_context: string;
  /** The "Who" — cultural signals, native-language elements, regional expectations */
  market_cultural_localization: string;
  /** The "Why" — psychological vectors activated (escapism, FOMO, healing, etc.) */
  psychological_elements: string;
  /** The "How" — tone, voice, pacing, emoji density, atmosphere */
  creative_tone_atmosphere: string;
  /** The Constraints — char limit, hook window, link policy, hashtag count */
  algorithmic_platform_architecture: string;
}

export interface PlatformContent {
  options: string[];
  /**
   * Demographic-archetype labels parallel to `options[]`.
   * Always 3 entries for Instagram / TikTok / Facebook:
   *   [0] "Witty, Trend-Conscious & High-Energy"  (Gen Z)
   *   [1] "Formal, Educational & Value-Driven"    (Mature Planners)
   *   [2] "Storytelling, Immersive & Emotional"   (Aspirational)
   * Absent on legacy/fallback payloads that pre-date this field.
   */
  optionNames?: string[];
  /**
   * AI reasoning metadata parallel to `options[]`.
   * When present, each entry documents the 5 generative decisions behind
   * the corresponding caption (core_business_context, market_cultural_localization,
   * psychological_elements, creative_tone_atmosphere, algorithmic_platform_architecture).
   */
  optionMetadata?: CaptionMetadata[];
  guide: string[];
}

/**
 * Single caption variation entry — shape returned by the LangGraph caption
 * agent (Submodule 3.1) and stored in `final_captions` state (6-field schema).
 */
export interface CaptionVariation {
  /** The "What" — business attributes, services, UVP, destination signals that drove this caption */
  core_business_context: string;
  /** The "Who" — cultural signals, native-language elements, regional expectations applied */
  market_cultural_localization: string;
  /** The "Why" — psychological vectors activated (escapism, FOMO, healing, etc.) and how */
  psychological_elements: string;
  /** The "How" — tone, voice, pacing, emoji density, atmosphere */
  creative_tone_atmosphere: string;
  /** The Constraints — char limit, hook window, link policy, hashtag count for this platform */
  algorithmic_platform_architecture: string;
  /** Full caption text */
  caption: string;
}

export interface CaptionsByPlatform {
  instagram: PlatformContent;
  tiktok: PlatformContent;
  facebook: PlatformContent;
  naver: PlatformContent;
}

/** Origin of an AI response — Gemini for real, fallback for hardcoded demo. */
export type ResponseSource = 'gemini' | 'fallback';

/** Mirrors backend ContentDtos.ContentResponseDto. */
export interface ContentResponseDTO {
  market: MarketHeader;
  framework: string;
  captions: CaptionsByPlatform;
  source?: ResponseSource;
}

/** Mirrors backend ComplianceDtos.ComplianceResultDto (FR3.25). */
export interface ComplianceResultDTO {
  score: number;
  aligned: string[];
  gaps: string[];
  source?: ResponseSource;
  // FR3.25 sub-scores (present when /evaluate-full pipeline ran)
  casScore?: number;
  vasScore?: number;
  hcsScore?: number;
  omcsScore?: number;
  // FR3.25.4 threshold label + FR3.26 explainability
  interpretation?: string;
  mismatches?: string[];
}

/**
 * OMCS agent audit result (Submodule 3.3) — mirrors backend
 * ComplianceDtos.OmcsAuditResultDto / FastAPI OmcsAnalysisResponse.
 * Produced by the LangGraph omcs_agent: the chosen caption + image are scored
 * against the Submodule 3.2 visual-guide recommendations.
 */
export interface OmcsAuditResultDTO {
  /** Profile semantic alignment score (0-100). */
  profileSemanticScore: number;
  /** Per-criterion rubric: { scores: {...}, total }. */
  rubricEvaluationData: {
    scores?: Record<string, number>;
    total?: number;
    [k: string]: unknown;
  };
  /** Rubric total — image vs recommendations (0-100). */
  recommendationsPictureScore: number;
  /** Caption/image consistency rationale. */
  consistencyExplanation: string;
  /** Caption/image consistency score (0-100). */
  pubmatConsistencyScore: number;
  /** OMCS = (0.35×profile)+(0.45×rubric)+(0.20×consistency). */
  omcsScore: number;
  /** "Pass" | "Fail". */
  status: string;
  /** Diagnostic feedback (root-cause + actionable fixes when failing). */
  feedback: string;
}

/** Mirrors backend CreativeDirectionDtos.CreativeDirectionDto. */
export interface CreativeDirectionDTO {
  visualGuide: string[];
  shots: { label: string; description: string; lighting: string }[];
  moodboard: { palette: string; references: string[] };
}

// ── Module 4 — Campaign Analytics ───────────────────────────────────────────

/** Single KPI metric card — mirrors AnalyticsDtos.MetricCard. */
export interface MetricCard {
  value: number;
  unit: string;
  trend: number;
  isPositive: boolean;
}

/** Five-KPI block — mirrors AnalyticsDtos.Metrics. */
export interface Metrics {
  ctr: MetricCard;
  cpc: MetricCard;
  roas: MetricCard;
  convRate: MetricCard;
  cac: MetricCard;
}

/** Single funnel stage — mirrors AnalyticsDtos.FunnelStage. */
export interface FunnelStage {
  stage: string;
  value: number;
  dropoff: string | null;
}

/** Full metrics + funnel response — mirrors AnalyticsDtos.MetricsResponse. */
export interface MetricsResponse {
  metrics: Metrics;
  funnel: FunnelStage[];
}

/** PES breakdown item — mirrors AnalyticsDtos.PesBreakdownItem. */
export interface PesBreakdownItem {
  metric: string;
  weight: string;
  contribution: number;
}

/** Full PES response — mirrors AnalyticsDtos.PesResponse. */
export interface PesResponse {
  overallScore: number;
  label: string;
  breakdown: PesBreakdownItem[];
}

/**
 * One evaluated funnel transition — mirrors AnalyticsDtos.FunnelDiagnostic.
 * Ranked by business impact: "Weakest" → "Moderate" → "Alright".
 */
export interface FunnelDiagnostic {
  stage: string;
  rank: 'Weakest' | 'Moderate' | 'Alright';
  dropRate: string;
  insight: string;
}

/**
 * Urgency-labeled recommendation paired 1-to-1 with a FunnelDiagnostic.
 * Mirrors AnalyticsDtos.RankedRecommendation.
 */
export interface RankedRecommendation {
  stage: string;
  urgency: 'Most Urgent' | 'Urgent' | 'Not Very Urgent';
  title: string;
  action: string;
}

/**
 * Full prescriptive report — mirrors AnalyticsDtos.PrescriptiveReport.
 * All three funnel stages are always evaluated and paired with recommendations.
 */
export interface PrescriptiveReport {
  executiveSummary: string;
  funnelDiagnostics: FunnelDiagnostic[];
  recommendations: RankedRecommendation[];
  recommendedPlatform: string;
}

/** Combined response for POST /manual — mirrors AnalyticsDtos.ManualIngestResponse. */
export interface ManualIngestResponse {
  metrics: Metrics;
  funnel: FunnelStage[];
  pes: PesResponse;
}

/** One week's campaign snapshot — mirrors AnalyticsDtos.CampaignSnapshot. */
export interface CampaignSnapshot {
  periodStart: string | null;
  periodEnd: string | null;
  pesScore: number;
  pesLabel: string;
  ctr: number | null;
  cpc: number | null;
  roas: number | null;
  convRate: number | null;
  cac: number | null;
}

/** GET /history response — chronologically ordered snapshots for the trend chart. */
export interface CampaignHistoryResponse {
  snapshots: CampaignSnapshot[];
}