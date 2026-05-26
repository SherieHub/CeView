import { CalendarEvent, Market, MarketId, Notification, KeywordTrend, PostPerformance, PerformanceReport } from './types';

// Palette from Pitch Deck Page 9 & User Image
export const COLORS = {
  TEAL: '#007892',    // Primary Brand (Deep Ocean)
  CYAN: '#71eeffff',    // Accents / Active (Shallow Water)
  BEIGE: '#F5E5D1',   // Backgrounds / Panels (Sand)
  GREEN: '#506E53',   // Secondary / Nature (Foliage)
  WHITE: '#FFFFFF',
  OFF_WHITE: '#FDFBF7', // Very light beige for page backgrounds
  TEXT_DARK: '#1E293B',
  TEXT_LIGHT: '#64748B',
  NAVY: '#0F2854',       // Primary Brand (Sidebar, Headers, Primary Buttons)
  LIGHTNAVY: '#183c7bff',
  BLUE: '#06388eff',
  SKYBLUE: '#7fbfffff',
  NAVY_LIGHT: '#98a7b9ff', // Subtle backgrounds / active states
  GOLD: '#F4A216',
  DARK_GOLD: '#d48e15ff',
  LIGHT_GOLD: '#ffb941ff',       // Highlights / Secondary Action / Warning icons
  LIGHT_YELLOW: '#ffd664ff',
  GOLD_LIGHT: '#fff5dfff', // Warning banner backgrounds
  RED: '#a70000ff',        // Critical Alerts / Negative Trends
  RED_ORANGE: '#ED3F27',
  CREAM: '#FDFBF7',      // Main App Background (reduces eye strain)
  TEXT_MAIN: '#0A2342',  // Deep navy for primary text (never use pure black)
  TEXT_MUTED: '#64748B',  // Slate gray for secondary text and axis labels
  GREY: '#3c4247ff',
  LIGHT_GREY: '#c7d3e2ff',
  GREEN_LIGHT: '#E6F4EE',
} as const;

export const MOCK_CALENDAR_EVENTS: CalendarEvent[] = [
  { id: '1', title: 'Sinulog Festival', date: '2025-01-19', type: 'peak', market: MarketId.GLOBAL },
  { id: '2', title: 'Cherry Blossom Escape (KR)', date: '2025-03-15', type: 'micro-season', market: MarketId.KOREA },
  { id: '3', title: 'Golden Week Prep (JP)', date: '2025-04-20', type: 'opportunity', market: MarketId.JAPAN },
  { id: '4', title: 'Summer Dive Season', date: '2025-05-01', type: 'micro-season', market: MarketId.USA },
  { id: '5', title: 'Highland Adventures', date: '2025-06-10', type: 'micro-season', market: MarketId.KOREA },
];

export const BUSINESS_CATEGORIES = [
  "Coastal & Island",
  "Adventure & Nature",
  "Cultural & Heritage",
  "Theme Parks / Entertainment",
  "Urban & City",
  "Culinary & Gastronomy",
  "Accommodation & Staycation"
];

// Rich data for the "Market Analyzer" view embedded in notifications
export const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: '3',
    date: 'Week of May 19, 2025',
    title: 'Rising Trend: Private Beachfront Escapes & Luxury Resorts',
    market: 'Japan',
    marketId: 'japan',
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
    marketId: 'japan',
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
    marketId: 'korea',
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


// --- MOCK MARKET DATA ---
export const MOCK_MARKETS: Market[] = [
  {
    id: 'korea',
    rank: 1,
    name: 'South Korea',
    city: 'Seoul',
    matchScore: 91,
    directive:
      'South Korean demand is surging. Activate Korean-language social content and partner with K-travel influencers this week to capture peak booking intent before your competitors do.',
    directFlight: true,
    flightHours: '3 hr 45 min',
    distanceKm: 2640,
    nearestAirport: "ICN — Incheon Int'l",
    destinationAirport: "CEB — Mactan-Cebu Int'l",
    accessibilityScore: 9,
    flightFrequency: 14,
    avgFlightPrice: '₱8,200 – ₱14,500',
    airlines: [
      {
        name: 'Korean Air',
        code: 'KE',
        frequency: '7x / week',
        direct: true,
        duration: '3h 45m',
        tier: 'Full-Service',
      },
      {
        name: 'Cebu Pacific',
        code: '5J',
        frequency: '5x / week',
        direct: true,
        duration: '3h 50m',
        tier: 'Budget',
      },
      {
        name: 'AirAsia Philippines',
        code: 'Z2',
        frequency: '2x / week',
        direct: true,
        duration: '4h 00m',
        tier: 'Budget',
      },
    ],
    peakMonths: ['Jul', 'Aug', 'Dec', 'Jan'],
    economyInsight:
      'A stronger Korean Won means Korean visitors currently have roughly 15–20% more purchasing power in Cebu than last year. They are more likely to upgrade accommodations, book premium dive tours, and spend generously on dining. This is the right time to upsell premium packages.',
    seasonalityInsight:
      'Korean tourists peak during school summer holidays (July–August) and winter break (December–January). Your biggest revenue window is 6 weeks before these periods — start promotions early to capture early planners who book ahead.',
    chartData: [
      { week: 'Wk -3', history: 55, forecast: null, seasonality: 52, forex: 10.2, gdp: 2.1, spike: 0 },
      { week: 'Wk -2', history: 62, forecast: null, seasonality: 55, forex: 10.4, gdp: 2.1, spike: 0 },
      { week: 'Wk -1', history: 58, forecast: null, seasonality: 58, forex: 10.3, gdp: 2.2, spike: 0 },
      { week: 'Current', history: 74, forecast: 89, seasonality: 64, forex: 10.7, gdp: 2.3, spike: 1 },
      { week: 'Wk +1', history: null, forecast: 85, seasonality: 70, forex: 10.9, gdp: 2.4, spike: 0 },
      { week: 'Wk +2', history: null, forecast: 78, seasonality: 68, forex: 10.8, gdp: 2.3, spike: 0 },
      { week: 'Wk +3', history: null, forecast: 74, seasonality: 65, forex: 10.7, gdp: 2.3, spike: 0 },
      { week: 'Wk +4', history: null, forecast: 70, seasonality: 62, forex: 10.6, gdp: 2.2, spike: 0 },
    ],
  },
  {
    id: 'japan',
    rank: 2,
    name: 'Japan',
    city: 'Osaka',
    matchScore: 83,
    directive:
      'Japanese Golden Week creates a predictable 6-week demand window. Lock in tour packages and upgrade hotel bundles now — Japanese travelers research extensively online before booking, so early visibility wins the sale.',
    directFlight: true,
    flightHours: '2 hr 50 min',
    distanceKm: 1980,
    nearestAirport: "KIX — Kansai Int'l",
    destinationAirport: "CEB — Mactan-Cebu Int'l",
    accessibilityScore: 8,
    flightFrequency: 10,
    avgFlightPrice: '₱7,500 – ₱12,000',
    airlines: [
      {
        name: 'Philippine Airlines',
        code: 'PR',
        frequency: '5x / week',
        direct: true,
        duration: '2h 50m',
        tier: 'Full-Service',
      },
      {
        name: 'Cebu Pacific',
        code: '5J',
        frequency: '3x / week',
        direct: true,
        duration: '3h 05m',
        tier: 'Budget',
      },
      {
        name: 'Peach Aviation',
        code: 'MM',
        frequency: '2x / week',
        direct: true,
        duration: '3h 00m',
        tier: 'Budget',
      },
    ],
    peakMonths: ['Apr', 'May', 'Aug', 'Mar'],
    economyInsight:
      'The Japanese Yen has been gradually recovering. Japanese tourists are value-conscious — they respond strongly to bundled packages (flight + hotel + tour) that show a clear total saving vs. booking separately. Highlight all-inclusive pricing in your marketing materials.',
    seasonalityInsight:
      "Golden Week (late April–early May) is Japan's biggest travel surge — plan for 2x normal booking volume. A secondary peak happens in August (O-bon holiday). Start campaigns 8 weeks before each window for maximum exposure.",
    chartData: [
      { week: 'Wk -3', history: 40, forecast: null, seasonality: 45, forex: 0.37, gdp: 1.4, spike: 0 },
      { week: 'Wk -2', history: 48, forecast: null, seasonality: 50, forex: 0.38, gdp: 1.4, spike: 0 },
      { week: 'Wk -1', history: 55, forecast: null, seasonality: 56, forex: 0.38, gdp: 1.5, spike: 0 },
      { week: 'Current', history: 63, forecast: 70, seasonality: 61, forex: 0.39, gdp: 1.5, spike: 0 },
      { week: 'Wk +1', history: null, forecast: 76, seasonality: 68, forex: 0.40, gdp: 1.6, spike: 0 },
      { week: 'Wk +2', history: null, forecast: 82, seasonality: 74, forex: 0.40, gdp: 1.6, spike: 1 },
      { week: 'Wk +3', history: null, forecast: 78, seasonality: 72, forex: 0.41, gdp: 1.7, spike: 0 },
      { week: 'Wk +4', history: null, forecast: 74, seasonality: 70, forex: 0.41, gdp: 1.7, spike: 0 },
    ],
  },
  {
    id: 'usa',
    rank: 3,
    name: 'United States',
    city: 'Los Angeles',
    matchScore: 71,
    directive:
      "US summer travel (June–August) and the holiday window (December) are your two key windows for this high-spending market. Americans book 6–10 weeks in advance — launch English-language content with clear value pricing now to capture the long-haul planners searching today.",
    directFlight: false,
    flightHours: '16h+ (via MNL)',
    distanceKm: 11027,
    nearestAirport: "LAX — Los Angeles Int'l",
    destinationAirport: "MNL — Ninoy Aquino Int'l",
    accessibilityScore: 3,
    flightFrequency: 3,
    avgFlightPrice: '₱28,000 – ₱45,000',
    airlines: [
      {
        name: 'Philippine Airlines via Manila',
        code: 'PR',
        frequency: '3x / week (via MNL)',
        direct: false,
        duration: '16h+',
        tier: 'Full-Service',
      },
    ],
    peakMonths: ['Jun', 'Jul', 'Aug', 'Dec'],
    economyInsight:
      'The US Dollar is among the strongest currencies against the Philippine Peso — Americans can spend roughly ₱56–58 per USD. This makes Cebu an exceptional value destination for US visitors, with their average daily budget of ₱12,000–18,000 well above most other markets. Target premium and adventure experiences to maximise yield.',
    seasonalityInsight:
      "US travelers peak during summer holidays (June–August) and Christmas–New Year (late December). The long-haul distance means Americans plan trips 2–3 months ahead — start campaigns in April for the summer window and in October for December. Highlight unique Cebu experiences (freediving, whale sharks, heritage tours) that justify the long flight.",
    chartData: [
      { week: 'Wk -3', history: 42, forecast: null, seasonality: 44, forex: 56.8, gdp: 2.6, spike: 0 },
      { week: 'Wk -2', history: 48, forecast: null, seasonality: 50, forex: 57.1, gdp: 2.7, spike: 0 },
      { week: 'Wk -1', history: 55, forecast: null, seasonality: 56, forex: 57.4, gdp: 2.7, spike: 0 },
      { week: 'Current', history: 63, forecast: 63, seasonality: 62, forex: 57.6, gdp: 2.8, spike: 0 },
      { week: 'Wk +1', history: null, forecast: 70, seasonality: 67, forex: 57.8, gdp: 2.8, spike: 0 },
      { week: 'Wk +2', history: null, forecast: 75, seasonality: 72, forex: 58.0, gdp: 2.9, spike: 0 },
      { week: 'Wk +3', history: null, forecast: 79, seasonality: 76, forex: 58.2, gdp: 2.9, spike: 1 },
      { week: 'Wk +4', history: null, forecast: 74, seasonality: 70, forex: 58.1, gdp: 2.9, spike: 0 },
    ],
  },
]


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