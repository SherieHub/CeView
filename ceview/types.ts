

export enum Market {
  KOREA = 'South Korea',
  JAPAN = 'Japan',
  USA = 'USA',
  GLOBAL = 'Global'
}

export interface SellingPoint {
  point: string;
  description: string;
}

export interface AnalysisResult {
  sellingPoints: SellingPoint[];
  suggestedMarket: Market;
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
  market: string;
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
  trend: string;
  isRead: boolean;
  // Detailed data for the "Market Analyzer" view
  details: {
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