"""
Deterministic mock outputs for ML models that aren't trained yet.
Keyed by a hash of the input so the frontend sees stable values across reloads.
"""

from __future__ import annotations

import hashlib


def _seed(*parts: str) -> int:
    h = hashlib.md5("|".join(parts).encode()).digest()
    return int.from_bytes(h[:4], "big")


def classify_categories(description: str, core_services: list[str]) -> list[dict]:
    """SBERT classification stub — returns category-allocation percentages summing to 100."""
    seed = _seed(description, *core_services)
    # Reproducible pseudo-distribution tilted toward Accommodation / Culinary
    weights = [
        ("Coastal & Island", (seed % 30)),
        ("Adventure & Nature", (seed // 7) % 20),
        ("Cultural & Heritage", (seed // 13) % 15),
        ("Theme Parks / Entertainment", (seed // 17) % 10),
        ("Urban & City", (seed // 23) % 15),
        ("Culinary & Gastronomy", 20 + (seed // 29) % 20),
        ("Accommodation & Staycation", 30 + (seed // 31) % 30),
    ]
    total = sum(w for _, w in weights) or 1
    return [{"name": n, "percentage": round(w * 100 / total)} for n, w in weights]


def cosine_uniqueness(description: str, categories: list[str]) -> dict:
    seed = _seed(description, *categories)
    desc = 50 + (seed % 50)
    cat = 40 + ((seed // 11) % 50)
    overall = round((desc + cat) / 2)
    return {
        "descriptionScore": desc,
        "categoryScore": cat,
        "overallScore": overall,
        "descriptionReasoning": "Use more sensory, place-specific language to separate your copy from generic resort descriptions.",
        "categoryReasoning": "Align but diversify your category mix to stand out from nearby competitors.",
    }


def forecast_markets() -> list[dict]:
    """Three-market ranked list mirroring frontend MOCK_MARKETS in constants.ts."""
    return [
        {
            "id": "korea",
            "rank": 1,
            "name": "South Korea",
            "city": "Seoul",
            "matchScore": 91,
            "directive": "South Korean demand is surging. Activate Korean-language social content and partner with K-travel influencers this week to capture peak booking intent before your competitors do.",
            "directFlight": True,
            "flightHours": "3 hr 45 min",
            "distanceKm": 2640,
            "nearestAirport": "ICN — Incheon Int'l",
            "destinationAirport": "CEB — Mactan-Cebu Int'l",
            "accessibilityScore": 9,
            "flightFrequency": 14,
            "avgFlightPrice": "₱8,200 – ₱14,500",
            "airlines": [
                {"name": "Korean Air", "code": "KE", "frequency": "7x / week", "direct": True, "duration": "3h 45m", "tier": "Full-Service"},
                {"name": "Cebu Pacific", "code": "5J", "frequency": "5x / week", "direct": True, "duration": "3h 50m", "tier": "Budget"},
            ],
            "peakMonths": ["Jul", "Aug", "Dec", "Jan"],
            "economyInsight": "A stronger Korean Won means Korean visitors currently have ~15–20% more purchasing power in Cebu than last year.",
            "seasonalityInsight": "Korean tourists peak during school summer holidays (Jul–Aug) and winter break (Dec–Jan).",
            "chartData": _chart_data(55, [62, 58, 74, 89], [85, 78, 70], 10.2, 2.1, "korea"),
        },
        {
            "id": "japan",
            "rank": 2,
            "name": "Japan",
            "city": "Osaka",
            "matchScore": 83,
            "directive": "Japanese Golden Week creates a predictable 6-week demand window. Lock in tour packages now.",
            "directFlight": True,
            "flightHours": "2 hr 50 min",
            "distanceKm": 1980,
            "nearestAirport": "KIX — Kansai Int'l",
            "destinationAirport": "CEB — Mactan-Cebu Int'l",
            "accessibilityScore": 8,
            "flightFrequency": 10,
            "avgFlightPrice": "₱7,500 – ₱12,000",
            "airlines": [
                {"name": "Philippine Airlines", "code": "PR", "frequency": "5x / week", "direct": True, "duration": "2h 50m", "tier": "Full-Service"},
                {"name": "Cebu Pacific", "code": "5J", "frequency": "3x / week", "direct": True, "duration": "3h 05m", "tier": "Budget"},
            ],
            "peakMonths": ["Apr", "May", "Aug", "Mar"],
            "economyInsight": "The Japanese Yen has been gradually recovering. Highlight all-inclusive pricing.",
            "seasonalityInsight": "Golden Week (late April–early May) is Japan's biggest travel surge — plan for 2x normal booking volume.",
            "chartData": _chart_data(40, [48, 55, 63, 70], [76, 82, 74], 0.38, 1.5, "japan"),
        },
        {
            "id": "usa",
            "rank": 3,
            "name": "USA",
            "city": "Los Angeles",
            "matchScore": 76,
            "directive": "American summer break drives long-stay luxury bookings. Focus on dive certification packages.",
            "directFlight": False,
            "flightHours": "13 hr + layover",
            "distanceKm": 11200,
            "nearestAirport": "LAX — Los Angeles Int'l",
            "destinationAirport": "CEB — Mactan-Cebu Int'l",
            "accessibilityScore": 5,
            "flightFrequency": 7,
            "avgFlightPrice": "₱45,000 – ₱65,000",
            "airlines": [
                {"name": "Philippine Airlines via Manila", "code": "PR", "frequency": "Daily", "direct": False, "duration": "13h + 2h", "tier": "Full-Service"},
            ],
            "peakMonths": ["Jun", "Jul", "Aug", "Dec"],
            "economyInsight": "Strong USD against PHP — Americans are the highest-spending visitor segment.",
            "seasonalityInsight": "Summer break (Jun–Aug) and winter holidays (Dec) drive the bulk of US demand.",
            "chartData": _chart_data(30, [35, 40, 46, 52], [58, 64, 70], 56.0, 2.4, "usa"),
        },
    ]


def _chart_data(start: int, history: list[int], forecast: list[int], forex: float, gdp: float, market: str) -> list[dict]:
    weeks = ["Wk 1", "Wk 2", "Wk 3", "Wk 4", "Current", "Wk 6", "Wk 7", "Wk 12"]
    series = [start] + history + forecast
    out = []
    for i, wk in enumerate(weeks):
        is_current = wk == "Current"
        is_past = i < weeks.index("Current")
        out.append({
            "week": wk,
            "history": series[i] if (is_past or is_current) else None,
            "forecast": series[i] if (is_current or i > weeks.index("Current")) else None,
            "seasonality": series[i] - 4,
            "forex": forex + i * 0.02,
            "gdp": gdp + i * 0.05,
            "spike": 1 if (market == "japan" and wk == "Wk 7") or (market == "korea" and wk == "Current") else 0,
        })
    return out


def notifications() -> list[dict]:
    """Static notifications matching frontend MOCK_NOTIFICATIONS shape."""
    return [
        {
            "id": "3",
            "date": "Week of May 19, 2025",
            "title": "Rising Trend: Private Beachfront Escapes & Luxury Resorts",
            "market": "Japan",
            "trend": "Beachfront Luxury",
            "isRead": False,
            "details": {
                "projectedArrivals": 72000,
                "arrivalGrowth": 11.4,
                "topInterests": [
                    {"name": "Overwater Villas", "score": 98},
                    {"name": "Private Beach Access", "score": 91},
                    {"name": "Resort Butler Service", "score": 86},
                ],
                "segments": [
                    "Premium Japanese couples seeking extreme privacy",
                    "Luxury-focused solo travelers (Japanese 'Solo-Tabi')",
                ],
                "strategicInsights": {
                    "trendAlignment": "Searches for 'Private Cebu Resort' in Japanese have surged 48% this week.",
                    "connectivity": "Direct flights from Narita and Osaka report 90% premium-cabin occupancy.",
                    "economicValue": "Japanese travelers show a 40% higher booking rate for 'Villa-type' accommodations.",
                },
                "keywordData": [
                    {"keyword": "Cebu Private Resort", "volume": 98, "growth": 48, "market": "Japan"},
                    {"keyword": "Luxury Beachfront Cebu", "volume": 91, "growth": 32, "market": "Japan"},
                ],
                "contentStrategy": {
                    "platformRecommendation": "Instagram & Facebook",
                    "generatedCaptions": [],
                    "visualDirections": [],
                },
            },
        },
    ]
