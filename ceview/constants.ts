import { CalendarEvent, Market, Notification, KeywordTrend, PostPerformance, PerformanceReport } from './types';

// Palette from Pitch Deck Page 9 & User Image
export const COLORS = {
  TEAL: '#007892',    // Primary Brand (Deep Ocean)
  CYAN: '#62D2E0',    // Accents / Active (Shallow Water)
  GOLD: '#D6A539',    // Highlights / Attention (Sun/Sand)
  BEIGE: '#F5E5D1',   // Backgrounds / Panels (Sand)
  GREEN: '#506E53',   // Secondary / Nature (Foliage)
  WHITE: '#FFFFFF',
  OFF_WHITE: '#FDFBF7', // Very light beige for page backgrounds
  TEXT_DARK: '#1E293B',
  TEXT_LIGHT: '#64748B'
};

export const MOCK_CALENDAR_EVENTS: CalendarEvent[] = [
  { id: '1', title: 'Sinulog Festival', date: '2025-01-19', type: 'peak', market: Market.GLOBAL },
  { id: '2', title: 'Cherry Blossom Escape (KR)', date: '2025-03-15', type: 'micro-season', market: Market.KOREA },
  { id: '3', title: 'Golden Week Prep (JP)', date: '2025-04-20', type: 'opportunity', market: Market.JAPAN },
  { id: '4', title: 'Summer Dive Season', date: '2025-05-01', type: 'micro-season', market: Market.USA },
  { id: '5', title: 'Highland Adventures', date: '2025-06-10', type: 'micro-season', market: Market.KOREA },
];

export const BUSINESS_CATEGORIES = [
  "Beach Resort",
  "Urban Hotel",
  "Restaurant / Culinary",
  "Adventure Tour",
  "Cultural Heritage Site",
  "Wellness & Spa"
];

// Rich data for the "Market Analyzer" view embedded in notifications
export const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: '3',
    date: 'Week of May 19, 2025',
    title: 'Rising Trend: Private Beachfront Escapes & Luxury Resorts',
    market: 'Japan', 
    trend: 'Beachfront Luxury',
    isRead: false,
    details: {
      projectedArrivals: 72000,
      arrivalGrowth: 11.4,
      topInterests: [
        { name: "Overwater Villas", score: 98 },
        { name: "Private Beach Access", score: 91 },
        { name: "Resort Butler Service", score: 86 }
      ],
      segments: [
        "Premium Japanese couples seeking extreme privacy",
        "Luxury-focused solo travelers (Japanese 'Solo-Tabi')",
        "High-income families booking long-stay resort suites"
      ],
      strategicInsights: {
        trendAlignment: "Searches for 'Private Cebu Resort' in Japanese have surged 48% this week, trending on social media.",
        connectivity: "Direct flights from Narita and Osaka are reporting 90% seat occupancy for premium cabins.",
        economicValue: "Japanese travelers show a 40% higher booking rate for 'Villa-type' accommodations than other segments."
      },
      keywordData: [
        { keyword: "Cebu Private Resort", volume: 98, growth: 48, market: "Japan" },
        { keyword: "Luxury Beachfront Cebu", volume: 91, growth: 32, market: "Japan" },
        { keyword: "Exclusive Island Stay", volume: 82, growth: 18, market: "Global" }
      ],
      contentStrategy: {
        platformRecommendation: "Instagram & Facebook",
        generatedCaptions: [
          {
            platform: "Instagram",
            text: "Your own slice of paradise. 🏝️✨ Discover the ultimate seclusion in our beachfront villas. Wake up to the sound of waves and nothing else. The peak of luxury awaits. #CebuLuxury #JapanToCebu #BeachfrontResort #TravelInStyle",
            hashtags: ["#PrivateResort", "#LuxuryCebu", "#JapaneseTraveler", "#OverwaterVilla"]
          },
          {
            platform: "Facebook",
            text: "Escape the city and find tranquility in Cebu's most exclusive beachfront resort. Our private villas offer world-class service and unparalleled ocean views. Perfect for your next romantic getaway or quiet retreat.",
            hashtags: ["#CebuResort", "#LuxuryTravel", "#VisitCebu", "#BeachLife"]
          }
        ],
        visualDirections: [
          {
            platform: "Instagram",
            direction: "Aerial drone shot starting high above the ocean and moving slowly towards a private villa balcony. Soft, dreamy color grading."
          },
          {
            platform: "Facebook",
            direction: "A POV video walking through the lush resort gardens and opening a gate to a completely private white sand beach."
          }
        ]
      }
    }
  },
  {
    id: '1',
    date: 'Week of May 12, 2025',
    title: 'Surge in "Eco-Tourism" searches from Japan',
    market: 'Japan',
    trend: 'Eco-Tourism',
    isRead: true,
    details: {
      projectedArrivals: 98400,
      arrivalGrowth: 8.5,
      topInterests: [
        { name: "Sustainable Nature Retreats", score: 92 },
        { name: "Plastic-Free Stays", score: 84 },
        { name: "Marine Conservation", score: 78 }
      ],
      segments: [
        "Solo travelers seeking quiet nature immersion",
        "Eco-conscious couples looking for sustainable luxury",
        "Photography groups focused on marine biodiversity"
      ],
      strategicInsights: {
        trendAlignment: "Japanese search volume for 'Cebu Eco Resort' has doubled in the last 14 days.",
        connectivity: "Direct flights from Narita are adding 2 weekly frequencies starting next month.",
        economicValue: "High willingness to pay premium for certified sustainable accommodations."
      },
      keywordData: [
        { keyword: "Cebu Eco Resort", volume: 92, growth: 35, market: "Japan" },
        { keyword: "Sustainable Travel Philippines", volume: 84, growth: 22, market: "Japan" },
        { keyword: "Nature Quiet Stay", volume: 75, growth: 18, market: "Global" },
        { keyword: "Moalboal Turtle Watch", volume: 68, growth: 12, market: "Europe" },
        { keyword: "Organic Food Cebu", volume: 62, growth: 15, market: "Japan" }
      ],
      contentStrategy: {
        platformRecommendation: "Instagram & Blog (Note)",
        generatedCaptions: [
          {
            platform: "Instagram",
            text: "Escape the city noise. 🌿 Immerse yourself in the pure sounds of Cebu's nature. Our eco-villas offer a plastic-free sanctuary where luxury meets sustainability. #SustainableTravel #CebuNature #JapanToCebu",
            hashtags: ["#EcoLuxury", "#CebuTravel", "#PlasticFree", "#NatureRetreat"]
          },
          {
            platform: "Facebook",
            text: "Looking for a meaningful getaway? Experience Cebu's biodiversity with our guided conservation tours. Perfect for those who want to travel responsibly and connect with nature.",
            hashtags: ["#ResponsibleTourism", "#CebuConservation", "#FamilyTravel"]
          }
        ],
        visualDirections: [
          {
            platform: "Instagram",
            direction: "Use soft, natural lighting. Show a wide shot of the villa surrounded by greenery. Avoid clutter. Focus on 'Zen' aesthetics."
          },
          {
            platform: "Facebook",
            direction: "A short video clip showing a guest participating in a tree planting or turtle release activity. Emphasize community impact."
          }
        ]
      }
    }
  },
  {
    id: '2',
    date: 'Week of May 5, 2025',
    title: 'New Opportunity: "Wellness Tourism" (Healing)',
    market: 'South Korea',
    trend: 'Wellness Tourism',
    isRead: true,
    details: {
      projectedArrivals: 124500,
      arrivalGrowth: 12.5,
      topInterests: [
         { name: "Healing Travel", score: 98 },
         { name: "Eco-Resorts", score: 85 },
         { name: "Winter Golf", score: 76 }
      ],
      segments: [
        "Family units seeking educational cultural immersion for children",
        "Gen Z 'Newtro' (New Retro) seekers looking for aesthetic heritage photography",
        "English language students based in Cebu on weekend excursions",
        "Repeat visitors looking for alternatives to standard beach resorts"
      ],
      strategicInsights: {
        trendAlignment: "Search traffic for 'Cebu Healing Trip' has spiked 42%, aligning with 'Rustic/Nature' profiles.",
        connectivity: "5 daily direct flights from Incheon/Busan are operating at 85% load factor.",
        economicValue: "Highest Average Daily Spend ($140) among Asian markets with high affinity for dining."
      },
      keywordData: [
        { keyword: "Cebu Healing Trip", volume: 98, growth: 42, market: "South Korea" },
        { keyword: "Moalboal Free diving", volume: 85, growth: 35, market: "USA / Europe" },
        { keyword: "Mactan Luxury Resort", volume: 76, growth: 28, market: "Japan" },
        { keyword: "Kawasan Canyoneering", volume: 72, growth: 15, market: "Global" },
        { keyword: "Cebu Lechon Tour", volume: 64, growth: 22, market: "Singapore" },
      ],
      contentStrategy: {
        platformRecommendation: "Instagram & TikTok",
        generatedCaptions: [
          {
            platform: "Instagram",
            text: "Burned out? ☁️ Find your pause button in Cebu. Warm breeze, healing food, and time that moves slower. 🛌✨ You deserve this rest. #HealingTrip #Cebu #Wellness",
            hashtags: ["#HealingTravel", "#CebuResort", "#KoreanTraveler", "#RestAndRelax"]
          },
          {
            platform: "TikTok",
            text: "POV: You just woke up in paradise. 🌊 No alarms, just ocean sounds. This is your sign to book that healing trip. ✈️🇵🇭",
            hashtags: ["#TravelTok", "#Cebu", "#HealingVibes", "#Philippines"]
          }
        ],
        visualDirections: [
          {
            platform: "Instagram",
            direction: "Aesthetic 'Mood' shot. Focus on details: a book by the pool, a tropical drink, or a sunset view. Warm, golden hour filter."
          },
          {
            platform: "TikTok",
            direction: "Slow-motion POV walk-through of the room opening up to the balcony view. Use trending 'Chill/Lo-fi' audio."
          }
        ]
      }
    }
  }
];

export const PLACEHOLDER_IMAGE = "https://images.unsplash.com/photo-1590523277543-a94d2e4eb00b?q=80&w=3432&auto=format&fit=crop";

// Dashboard Data
export const MOCK_KEYWORD_DATA: KeywordTrend[] = [
  { keyword: "Cebu Private Resort", volume: 98, growth: 48, market: "Japan" },
  { keyword: "Cebu Healing Trip", volume: 92, growth: 42, market: "South Korea" },
  { keyword: "Moalboal Free diving", volume: 85, growth: 35, market: "USA / Europe" },
  { keyword: "Mactan Luxury Resort", volume: 76, growth: 28, market: "Japan" },
  { keyword: "Kawasan Canyoneering", volume: 72, growth: 15, market: "Global" },
];

export const TRAVELER_SEGMENTS = [
  "Privacy-seekers looking for secluded villas",
  "Luxury resort-goers focused on exclusivity",
  "Remote workers seeking 'Work-from-Beach' setups",
  "Eco-conscious couples looking for sustainable luxury"
];

// Mock Data for Performance Reports
export const MOCK_PERFORMANCE_REPORTS: PerformanceReport[] = [
  {
    id: 'rpt-beach-luxury',
    weekLabel: 'Week of May 19, 2025',
    dateRange: 'May 19 - May 25',
    title: 'Beachfront Luxury Campaign Analysis',
    isRead: false,
    summaryStats: {
      totalReach: 94200,
      avgEngagement: 11.2,
      topPlatform: 'Instagram'
    },
    data: [
      {
        id: 'p-beach-1',
        date: '2025-05-22',
        platform: 'Instagram',
        contentSnippet: 'Aerial view of the private overwater villas at golden hour.',
        likes: 2800,
        comments: 142,
        shares: 890,
        reach: 31000,
        engagementRate: 12.4
      },
      {
        id: 'p-beach-2',
        date: '2025-05-22',
        platform: 'Facebook',
        contentSnippet: 'POV video walk-through of the resort lobby to the private beach.',
        likes: 1500,
        comments: 210,
        shares: 520,
        reach: 22000,
        engagementRate: 10.1
      },
      {
        id: 'p-beach-3',
        date: '2025-05-20',
        platform: 'Instagram',
        contentSnippet: 'Close up of the infinity pool reflecting the ocean sky.',
        likes: 1100,
        comments: 48,
        shares: 120,
        reach: 14500,
        engagementRate: 8.8
      }
    ]
  },
  {
    id: 'rpt-eco',
    weekLabel: 'Week of May 12, 2025',
    dateRange: 'May 12 - May 18',
    title: 'Eco-Tourism Campaign Success',
    isRead: true,
    summaryStats: {
      totalReach: 72400,
      avgEngagement: 9.2,
      topPlatform: 'Instagram'
    },
    data: [
      {
        id: 'p-eco-1',
        date: '2025-05-15', 
        platform: 'Instagram',
        contentSnippet: 'Wide shot of eco-villa with "Plastic-Free Sanctuary" caption.',
        likes: 1540,
        comments: 92,
        shares: 510,
        reach: 18200,
        engagementRate: 11.7 
      },
      {
        id: 'p-eco-2',
        date: '2025-05-15', 
        platform: 'Facebook',
        contentSnippet: 'Video of tree planting activity emphasizing community impact.',
        likes: 890,
        comments: 145,
        shares: 230,
        reach: 12500,
        engagementRate: 10.1 
      }
    ]
  },
  {
    id: 'rpt-wellness',
    weekLabel: 'Week of May 5, 2025',
    dateRange: 'May 5 - May 11',
    title: 'Wellness Tourism Insights',
    isRead: true,
    summaryStats: {
      totalReach: 68100,
      avgEngagement: 8.4,
      topPlatform: 'TikTok'
    },
    data: [
      {
        id: 'p1',
        date: '2025-05-09', 
        platform: 'Instagram',
        contentSnippet: 'Visuals of "Healing" breakfast with ocean view. Focused on quiet luxury.',
        likes: 1240,
        comments: 85,
        shares: 420,
        reach: 15400,
        engagementRate: 11.2 
      },
      {
        id: 'p2',
        date: '2025-05-09', 
        platform: 'TikTok',
        contentSnippet: 'POV video walking into the water. "No thoughts, just vibes" style audio.',
        likes: 3500,
        comments: 120,
        shares: 890,
        reach: 45000,
        engagementRate: 10.0
      }
    ]
  }
];

export const MOCK_POST_PERFORMANCE: PostPerformance[] = MOCK_PERFORMANCE_REPORTS[0].data;