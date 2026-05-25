
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

export type ContentPlatformId = 'instagram' | 'tiktok' | 'facebook' | 'naver';

export interface MarketHeader {
  country: string;
  city: string;
  flag?: string;
}

export interface PlatformContent {
  options: string[];
  guide: string[];
}

export interface CaptionsByPlatform {
  instagram: PlatformContent;
  tiktok: PlatformContent;
  facebook: PlatformContent;
  naver: PlatformContent;
}

/** Mirrors backend ContentDtos.ContentResponseDto. */
export interface ContentResponseDTO {
  market: MarketHeader;
  framework: string;
  captions: CaptionsByPlatform;
}

/** Mirrors backend ComplianceDtos.ComplianceResultDto. */
export interface ComplianceResultDTO {
  score: number;
  aligned: string[];
  gaps: string[];
}

/** Mirrors backend CreativeDirectionDtos.CreativeDirectionDto. */
export interface CreativeDirectionDTO {
  visualGuide: string[];
  shots: { label: string; description: string; lighting: string }[];
  moodboard: { palette: string; references: string[] };
}