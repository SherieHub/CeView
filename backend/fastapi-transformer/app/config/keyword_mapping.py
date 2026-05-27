"""Dual-layer keyword mapping for CeView Module 2 — Google Trends pipeline (FR2.2).

Two distinct dictionaries serve two distinct consumers:

────────────────────────────────────────────────────────────────────────────────
MACRO_TREND_MAPPING
    Nested dict: { CATEGORY_LABEL: { GEO_CODE: [kw1, kw2, ...] } }

    Purpose — pytrends query terms.  2–4 high-volume colloquial "umbrella"
    phrases per (category, market) pair.  Designed to:
      • Return non-zero Google Trends search-interest volume.
      • Represent broad market demand intent for an entire category, not just
        one activity (e.g. "세부 여행" captures the full Coastal & Island
        demand from Korean travellers, not just snorkeling).
      • Avoid English proxies for KR/JP geos — they return near-zero volume
        and bias the seasonal-shift signal.

    Keys MUST match CATEGORY_LABELS in fastapi-sbert/app/services/ml_classifier.py
    exactly.  Inner GEO keys are "KR" | "JP" | "US" (from MARKET_CONFIG below).

────────────────────────────────────────────────────────────────────────────────
EXHAUSTIVE_DIMENSION_MAPPING
    Three-level dict:
    { CATEGORY_LABEL: { DIMENSION: { ENGLISH_TERM: { "US": ..., "KR": ..., "JP": ... } } } }

    Purpose — pinpoint vocabulary alignment for Gemini / LangChain prompts
    (Module 3, FR3.5).  Covers EVERY keyword listed in Keywords.pdf under all
    7 categories × 3 dimensions (Places, Activities, Experiences).

    Each leaf value provides:
      "US" — English phrase used by US travellers on Google / Instagram
      "KR" — Hangul phrase (colloquial / high-search-volume where possible)
      "JP" — Kanji + Katakana phrase (colloquial / high-search-volume)

    Import pattern for prompts:
        from app.config.keyword_mapping import EXHAUSTIVE_DIMENSION_MAPPING
        # look up a specific term:
        # EXHAUSTIVE_DIMENSION_MAPPING["Coastal & Island"]["Activities"]["Diving"]["KR"]
        # → "세부 스쿠버 다이빙"

────────────────────────────────────────────────────────────────────────────────
MARKET_CONFIG
    { market_key: { geo, hl, tz } } — passed directly to pytrends TrendReq.
"""
from __future__ import annotations

# ─── Market initialisation parameters ────────────────────────────────────────

MARKET_CONFIG: dict[str, dict] = {
    "korea": {"geo": "KR", "hl": "ko",    "tz": 540},
    "japan": {"geo": "JP", "hl": "ja",    "tz": 540},
    "usa":   {"geo": "US", "hl": "en-US", "tz": 300},
}


# ─────────────────────────────────────────────────────────────────────────────
# MACRO_TREND_MAPPING
# 2–4 high-volume umbrella phrases per (category, geo) for pytrends queries.
# ─────────────────────────────────────────────────────────────────────────────

MACRO_TREND_MAPPING: dict[str, dict[str, list[str]]] = {

    # ── 01. Coastal & Island ─────────────────────────────────────────────────
    "Coastal & Island": {
        "US": [
            "Cebu beach",
            "island hopping Philippines",
            "snorkeling Cebu",
            "white sand beach Philippines",
        ],
        "KR": [
            "세부 여행",           # Cebu travel — highest-volume KR Cebu umbrella term
            "세부 스노클링",        # Cebu snorkeling
            "필리핀 해변",          # Philippines beach
            "세부 섬 투어",         # Cebu island tour / island hopping
        ],
        "JP": [
            "セブ島",               # Cebu Island — dominant bare-noun JP search term
            "セブ島 シュノーケリング", # Cebu snorkeling
            "フィリピン ビーチ",     # Philippines beach
            "セブ ダイビング",       # Cebu diving
        ],
    },

    # ── 02. Adventure & Nature ───────────────────────────────────────────────
    "Adventure & Nature": {
        "US": [
            "Cebu hiking",
            "waterfall Philippines",
            "cave adventure Cebu",
            "mountain trek Philippines",
        ],
        "KR": [
            "세부 액티비티",         # Cebu activities — umbrella adventure term
            "세부 폭포",             # Cebu waterfall (Kawasan Falls most searched)
            "필리핀 하이킹",          # Philippines hiking
            "세부 자연 투어",         # Cebu nature tour
        ],
        "JP": [
            "セブ島 アクティビティ",  # Cebu activities — top JP adventure umbrella
            "フィリピン 滝",          # Philippines waterfall (滝 = colloquial; 瀑布 = formal)
            "セブ ハイキング",         # Cebu hiking
            "ジップライン セブ",       # Cebu zipline — highest-searched JP adventure term
        ],
    },

    # ── 03. Cultural & Heritage ──────────────────────────────────────────────
    "Cultural & Heritage": {
        "US": [
            "Sinulog festival Philippines",
            "Magellan's Cross Cebu",
            "Cebu heritage tour",
            "Fort San Pedro Cebu",
        ],
        "KR": [
            "세부 문화 투어",         # Cebu cultural tour
            "세부 성당",              # Cebu cathedral (Basilica Minore del Sto. Niño)
            "세부 역사",              # Cebu history
            "필리핀 축제",            # Philippines festival (Sinulog etc.)
        ],
        "JP": [
            "セブ島 観光",            # Cebu sightseeing — catches most cultural intent
            "フィリピン 祭り",         # Philippines festival
            "セブ 歴史",              # Cebu history
            "マクタン島 史跡",         # Mactan Island historical site (Lapu-Lapu shrine)
        ],
    },

    # ── 04. Theme Parks / Entertainment ──────────────────────────────────────
    "Theme Parks / Entertainment": {
        "US": [
            "Cebu waterpark",
            "theme park Philippines",
            "amusement park Cebu",
            "entertainment Cebu city",
        ],
        "KR": [
            "세부 워터파크",           # Cebu waterpark
            "필리핀 놀이공원",          # Philippines amusement park
            "세부 엔터테인먼트",         # Cebu entertainment
            "세부 어트랙션",            # Cebu attractions
        ],
        "JP": [
            "セブ島 ウォーターパーク",   # Cebu waterpark
            "フィリピン 遊園地",         # Philippines amusement park
            "セブ 観光スポット",          # Cebu tourist spots / attractions
            "セブ アミューズメント",      # Cebu amusement
        ],
    },

    # ── 05. Urban & City ─────────────────────────────────────────────────────
    "Urban & City": {
        "US": [
            "Cebu city shopping",
            "IT Park Cebu",
            "rooftop bar Cebu",
            "casino Philippines",
        ],
        "KR": [
            "세부 쇼핑",              # Cebu shopping
            "세부 맛집",              # Cebu restaurant guide — extremely high-volume KR lifestyle term
            "세부 나이트라이프",        # Cebu nightlife
            "세부 카지노",             # Cebu casino
        ],
        "JP": [
            "セブ市 ショッピング",      # Cebu city shopping
            "セブ カフェ",             # Cebu cafes — highly searched JP lifestyle term
            "セブ ナイトライフ",         # Cebu nightlife
            "フィリピン カジノ",         # Philippines casino
        ],
    },

    # ── 06. Culinary & Gastronomy ─────────────────────────────────────────────
    "Culinary & Gastronomy": {
        "US": [
            "Cebu food tour",
            "lechon Cebu",
            "seafood Philippines",
            "Filipino street food",
        ],
        "KR": [
            "세부 맛집",              # Cebu restaurant guide — top food search KR term
            "필리핀 음식",             # Philippines food
            "세부 해산물",             # Cebu seafood
            "세부 레촌",               # Cebu lechon — direct KR transliteration
        ],
        "JP": [
            "セブ島 グルメ",            # Cebu gourmet — most-used JP food discovery search
            "フィリピン料理",            # Filipino cuisine
            "セブ シーフード",           # Cebu seafood
            "レチョン セブ",             # Lechon Cebu — transliteration used by JP travellers
        ],
    },

    # ── 07. Accommodation & Staycation ───────────────────────────────────────
    "Accommodation & Staycation": {
        "US": [
            "Cebu resort",
            "hotel Cebu Philippines",
            "beachfront accommodation Cebu",
            "staycation Cebu",
        ],
        "KR": [
            "호캉스 세부",             # 호텔+바캉스 — highest-volume KR staycation colloquial
            "세부 호텔",               # Cebu hotel
            "세부 리조트",             # Cebu resort
            "필리핀 숙소",             # Philippines accommodation
        ],
        "JP": [
            "セブ島 ホテル",            # Cebu hotel — dominant JP accommodation search
            "セブ リゾート",             # Cebu resort
            "フィリピン スパ",           # Philippines spa
            "セブ ラグジュアリーホテル",  # Cebu luxury hotel
        ],
    },
}


# ─────────────────────────────────────────────────────────────────────────────
# EXHAUSTIVE_DIMENSION_MAPPING
# 1-to-1 translation of EVERY keyword from Keywords.pdf (all 7 categories,
# all 3 dimensions) into EN / KR / JP.  Used by Gemini prompt injection.
#
# Structure:
#   { CATEGORY: { "Places" | "Activities" | "Experiences":
#       { ENGLISH_TERM: { "US": str, "KR": str, "JP": str } }
#   } }
# ─────────────────────────────────────────────────────────────────────────────

EXHAUSTIVE_DIMENSION_MAPPING: dict[str, dict[str, dict[str, dict[str, str]]]] = {

    # ════════════════════════════════════════════════════════════════════════
    # 01. Coastal & Island
    # ════════════════════════════════════════════════════════════════════════
    "Coastal & Island": {
        "Places": {
            "Beach": {
                "US": "Cebu beach",
                "KR": "세부 해변",
                "JP": "セブ島 ビーチ",
            },
            "Island": {
                "US": "Philippines island hopping",
                "KR": "필리핀 섬 여행",
                "JP": "フィリピン 島",
            },
            "Cove": {
                "US": "Cebu hidden cove",
                "KR": "세부 코브 해변",
                "JP": "セブ 入り江",
            },
            "Lagoon": {
                "US": "Philippines lagoon swimming",
                "KR": "필리핀 라군",
                "JP": "フィリピン ラグーン",
            },
            "Bay": {
                "US": "Cebu bay",
                "KR": "세부 만",
                "JP": "セブ 湾",
            },
        },
        "Activities": {
            "Snorkeling": {
                "US": "snorkeling Cebu Philippines",
                "KR": "세부 스노클링",
                "JP": "セブ シュノーケリング",
            },
            "Diving": {
                "US": "scuba diving Cebu",
                "KR": "세부 스쿠버 다이빙",
                "JP": "セブ スキューバダイビング",
            },
            "Surf": {
                "US": "surfing Philippines",
                "KR": "필리핀 서핑",
                "JP": "フィリピン サーフィン",
            },
        },
        "Experiences": {
            "Sunset": {
                "US": "Cebu sunset view",
                "KR": "세부 일몰 감상",
                "JP": "セブ 夕日 絶景",
            },
            "White Sand": {
                "US": "white sand beach Philippines",
                "KR": "필리핀 백사장 해변",
                "JP": "フィリピン 白砂ビーチ",
            },
        },
    },

    # ════════════════════════════════════════════════════════════════════════
    # 02. Adventure & Nature
    # ════════════════════════════════════════════════════════════════════════
    "Adventure & Nature": {
        "Places": {
            "Mountain": {
                "US": "mountain hiking Philippines",
                "KR": "필리핀 등산 산",
                "JP": "フィリピン 山 登山",
            },
            "Cave": {
                "US": "cave exploration Philippines",
                "KR": "필리핀 동굴 탐험",
                "JP": "フィリピン 洞窟 探検",
            },
            "River": {
                "US": "river kayaking Philippines",
                "KR": "필리핀 강 카약",
                "JP": "フィリピン 川 カヤック",
            },
            "Trail": {
                "US": "Cebu hiking trail",
                "KR": "세부 등산로 트레일",
                "JP": "セブ ハイキングコース",
            },
        },
        "Activities": {
            "Hiking": {
                "US": "Cebu hiking mountains",
                "KR": "세부 하이킹",
                "JP": "セブ ハイキング",
            },
            "Trek": {
                "US": "mountain trekking Philippines",
                "KR": "필리핀 트레킹",
                "JP": "フィリピン トレッキング",
            },
            "Camping": {
                "US": "camping Philippines outdoors",
                "KR": "필리핀 캠핑",
                "JP": "フィリピン キャンプ",
            },
        },
        "Experiences": {
            "Waterfall": {
                "US": "Kawasan Falls Cebu waterfall",
                "KR": "세부 폭포 카와산 폭포",
                "JP": "セブ 滝 カワサン",
            },
            "Cliff": {
                "US": "cliff diving Philippines",
                "KR": "필리핀 절벽 다이빙",
                "JP": "フィリピン 崖 ダイビング",
            },
            "Summit": {
                "US": "Philippines mountain summit trek",
                "KR": "필리핀 산 정상 등반",
                "JP": "フィリピン 山頂 登頂",
            },
        },
    },

    # ════════════════════════════════════════════════════════════════════════
    # 03. Cultural & Heritage
    # ════════════════════════════════════════════════════════════════════════
    "Cultural & Heritage": {
        "Places": {
            "Cathedral": {
                "US": "Cebu Basilica cathedral church",
                "KR": "세부 성당 바실리카",
                "JP": "セブ 大聖堂 バシリカ",
            },
            "Museum": {
                "US": "Cebu museum history culture",
                "KR": "세부 박물관 역사",
                "JP": "セブ 博物館 歴史",
            },
            "Plaza": {
                "US": "Cebu city plaza heritage",
                "KR": "세부 플라자 광장",
                "JP": "セブ 広場 プラザ",
            },
            "Shrine": {
                "US": "Lapu Lapu shrine Mactan Cebu",
                "KR": "세부 라푸라푸 사당",
                "JP": "セブ ラプラプ 神殿 史跡",
            },
            "Fort": {
                "US": "Fort San Pedro Cebu heritage",
                "KR": "세부 산 페드로 요새",
                "JP": "セブ サン・ペドロ要塞",
            },
        },
        "Activities": {
            "Festival": {
                "US": "Sinulog festival Cebu Philippines",
                "KR": "세부 시눌록 축제",
                "JP": "セブ シヌログ祭り",
            },
            "Fiesta": {
                "US": "Philippines local fiesta celebration",
                "KR": "필리핀 피에스타 지역 축제",
                "JP": "フィリピン フィエスタ 地域祭り",
            },
        },
        "Experiences": {
            "Art": {
                "US": "Cebu art scene gallery",
                "KR": "세부 아트 갤러리 미술",
                "JP": "セブ アートギャラリー",
            },
            "Heritage": {
                "US": "Cebu cultural heritage tour",
                "KR": "세부 문화유산 역사 투어",
                "JP": "セブ 文化遺産 歴史ツアー",
            },
            "Statue": {
                "US": "Magellan Cross Lapu Lapu statue Cebu",
                "KR": "세부 마젤란 십자가 라푸라푸 동상",
                "JP": "セブ マゼラン クロス 像",
            },
        },
    },

    # ════════════════════════════════════════════════════════════════════════
    # 04. Theme Parks / Entertainment
    # ════════════════════════════════════════════════════════════════════════
    "Theme Parks / Entertainment": {
        "Places": {
            "Waterpark": {
                "US": "Cebu waterpark resort water slides",
                "KR": "세부 워터파크 리조트",
                "JP": "セブ ウォーターパーク リゾート",
            },
            "Theme park": {
                "US": "Philippines theme park amusement",
                "KR": "필리핀 테마파크 놀이동산",
                "JP": "フィリピン テーマパーク 遊園地",
            },
            "Carnival": {
                "US": "Philippines carnival fair rides",
                "KR": "필리핀 카니발 놀이공원",
                "JP": "フィリピン カーニバル お祭り",
            },
            "Arcade": {
                "US": "Cebu arcade game center",
                "KR": "세부 오락실 게임센터",
                "JP": "セブ ゲームセンター アーケード",
            },
        },
        "Activities": {
            "Rides": {
                "US": "amusement park rides Philippines",
                "KR": "필리핀 놀이기구 어트랙션",
                "JP": "フィリピン 遊具 アトラクション",
            },
            "Rollercoaster": {
                "US": "rollercoaster theme park Philippines",
                "KR": "필리핀 롤러코스터 놀이기구",
                "JP": "フィリピン ジェットコースター",
            },
            "Slides": {
                "US": "water slides park Philippines",
                "KR": "필리핀 워터슬라이드 워터파크",
                "JP": "フィリピン ウォータースライダー",
            },
        },
        "Experiences": {
            "Ferris Wheel": {
                "US": "Ferris wheel Philippines amusement park",
                "KR": "필리핀 대관람차 놀이공원",
                "JP": "フィリピン 観覧車 遊園地",
            },
            "Amusement": {
                "US": "amusement park Philippines fun",
                "KR": "필리핀 놀이공원 어뮤즈먼트",
                "JP": "フィリピン アミューズメント 遊園地",
            },
            "Fireworks": {
                "US": "Philippines fireworks festival show",
                "KR": "필리핀 불꽃놀이 축제 쇼",
                "JP": "フィリピン 花火大会 ショー",
            },
        },
    },

    # ════════════════════════════════════════════════════════════════════════
    # 05. Urban & City
    # ════════════════════════════════════════════════════════════════════════
    "Urban & City": {
        "Places": {
            "Mall": {
                "US": "SM Seaside Cebu mall shopping",
                "KR": "세부 SM 쇼핑몰 상업시설",
                "JP": "セブ ショッピングモール SM",
            },
            "Tower": {
                "US": "Cebu IT Park tower skyline",
                "KR": "세부 타워 랜드마크 전망",
                "JP": "セブ タワー ランドマーク",
            },
            "Casino": {
                "US": "casino resort Cebu Philippines",
                "KR": "세부 카지노 리조트",
                "JP": "セブ カジノ リゾート",
            },
            "District": {
                "US": "IT Park Cebu business district lifestyle",
                "KR": "세부 IT 파크 비즈니스 지구",
                "JP": "セブ IT パーク ビジネス街",
            },
        },
        "Activities": {
            "Shopping": {
                "US": "Cebu city shopping centres",
                "KR": "세부 쇼핑 명소 백화점",
                "JP": "セブ ショッピングスポット",
            },
            "Concert": {
                "US": "live concert music event Philippines",
                "KR": "필리핀 라이브 콘서트 공연",
                "JP": "フィリピン ライブコンサート イベント",
            },
            "Karaoke": {
                "US": "karaoke bar Philippines nightlife",
                "KR": "세부 노래방 가라오케",
                "JP": "フィリピン カラオケバー",
            },
        },
        "Experiences": {
            "Cinema": {
                "US": "cinema movie theater Cebu",
                "KR": "세부 영화관 시네마",
                "JP": "セブ 映画館 シネマ",
            },
            "Rooftop": {
                "US": "rooftop bar sunset view Cebu",
                "KR": "세부 루프탑 바 야경 전망",
                "JP": "セブ ルーフトップバー 夜景",
            },
            "Skyline": {
                "US": "Cebu city skyline night view",
                "KR": "세부 시티 스카이라인 야경",
                "JP": "セブ 街並み スカイライン 夜景",
            },
            "Cafe": {
                "US": "best cafes Cebu Philippines",
                "KR": "세부 인기 카페 브런치",
                "JP": "セブ おすすめカフェ",
            },
        },
    },

    # ════════════════════════════════════════════════════════════════════════
    # 06. Culinary & Gastronomy
    # ════════════════════════════════════════════════════════════════════════
    "Culinary & Gastronomy": {
        "Places": {
            "Market": {
                "US": "Cebu Carbon market local produce",
                "KR": "세부 카본 재래시장 로컬 장터",
                "JP": "セブ カルボン市場 ローカル食材",
            },
            "Brewery": {
                "US": "craft beer brewery Cebu",
                "KR": "세부 크래프트 맥주 양조장",
                "JP": "セブ クラフトビール ブルワリー",
            },
            "Bakery": {
                "US": "local bakery pan de sal Cebu",
                "KR": "세부 현지 빵집 베이커리",
                "JP": "セブ ベーカリー パン屋",
            },
            "Eatery": {
                "US": "local eatery Filipino food Cebu",
                "KR": "세부 현지 맛집 식당",
                "JP": "セブ 地元 食堂 ローカルグルメ",
            },
            "Grill": {
                "US": "grill restaurant seafood Cebu",
                "KR": "세부 그릴 해산물 레스토랑",
                "JP": "セブ グリルレストラン シーフード",
            },
        },
        "Activities": {
            "Dining": {
                "US": "fine dining restaurant Cebu Philippines",
                "KR": "세부 레스토랑 파인다이닝",
                "JP": "セブ ダイニング レストラン グルメ",
            },
            "Buffet": {
                "US": "seafood buffet Philippines restaurant",
                "KR": "필리핀 해산물 뷔페 레스토랑",
                "JP": "フィリピン シーフードビュッフェ",
            },
        },
        "Experiences": {
            "Seafood": {
                "US": "fresh seafood Cebu Philippines restaurant",
                "KR": "세부 신선한 해산물 요리",
                "JP": "セブ 新鮮シーフード料理",
            },
            "Vegan": {
                "US": "vegan restaurants plant-based Cebu",
                "KR": "세부 비건 채식 식당",
                "JP": "セブ ヴィーガン料理 植物性",
            },
            "Street Food": {
                "US": "Filipino street food Cebu tour",
                "KR": "세부 필리핀 길거리 음식 투어",
                "JP": "セブ フィリピン ストリートフード",
            },
        },
    },

    # ════════════════════════════════════════════════════════════════════════
    # 07. Accommodation & Staycation
    # ════════════════════════════════════════════════════════════════════════
    "Accommodation & Staycation": {
        "Places": {
            "Hostel": {
                "US": "backpacker hostel budget Cebu Philippines",
                "KR": "세부 배낭여행 호스텔 저렴",
                "JP": "セブ バックパッカー ホステル 格安",
            },
            "Lodge": {
                "US": "mountain lodge Philippines nature stay",
                "KR": "필리핀 산장 롯지 자연 숙박",
                "JP": "フィリピン 山荘 ロッジ 自然",
            },
            "Cabin": {
                "US": "beach cabin cottage Philippines",
                "KR": "필리핀 캐빈 오두막 코티지",
                "JP": "フィリピン コテージ キャビン",
            },
            "Glamping": {
                "US": "glamping Philippines luxury camping",
                "KR": "필리핀 글램핑 럭셔리 캠핑",
                "JP": "フィリピン グランピング 豪華キャンプ",
            },
            "Campsite": {
                "US": "camping site Philippines outdoor",
                "KR": "필리핀 캠핑장 야영지",
                "JP": "フィリピン キャンプ場 アウトドア",
            },
            "Resort": {
                "US": "luxury beachfront resort Cebu Philippines",
                "KR": "세부 럭셔리 비치프런트 리조트",
                "JP": "セブ ラグジュアリーリゾート ビーチフロント",
            },
        },
        "Activities": {
            "Booking": {
                "US": "hotel booking reservation Cebu Philippines",
                "KR": "세부 호텔 온라인 예약",
                "JP": "セブ ホテル予約 オンライン",
            },
        },
        "Experiences": {
            "Boutique": {
                "US": "boutique hotel unique stay Cebu",
                "KR": "세부 부티크 호텔 독특한 숙소",
                "JP": "セブ ブティックホテル 個性的",
            },
            "Pool": {
                "US": "infinity pool resort Cebu Philippines",
                "KR": "세부 인피니티풀 수영장 리조트",
                "JP": "セブ インフィニティプール リゾート",
            },
            "Spa": {
                "US": "spa resort wellness treatment Cebu",
                "KR": "세부 스파 웰니스 마사지 리조트",
                "JP": "セブ スパ ウェルネスリゾート 癒し",
            },
        },
    },
}

# ─────────────────────────────────────────────────────────────────────────────
# CATEGORY_KEYWORDS
# 10 fixed English-language search terms per category used for cross-market
# volume aggregation.  These are the SAME keywords regardless of target market
# so that total_volume values are directly comparable across KR / JP / US.
#
# Sourced from the "US" column of EXHAUSTIVE_DIMENSION_MAPPING (Places +
# Activities + Experiences dimensions, 10 terms per category).
# ─────────────────────────────────────────────────────────────────────────────

CATEGORY_KEYWORDS: dict[str, list[str]] = {

    "Coastal & Island": [
        "Cebu beach",
        "Philippines island hopping",
        "snorkeling Cebu Philippines",
        "scuba diving Cebu",
        "surfing Philippines",
        "Cebu sunset view",
        "white sand beach Philippines",
        "Philippines lagoon swimming",
        "Cebu hidden cove",
        "Cebu island tour",
    ],

    "Adventure & Nature": [
        "mountain hiking Philippines",
        "cave exploration Philippines",
        "river kayaking Philippines",
        "Cebu hiking trail",
        "mountain trekking Philippines",
        "camping Philippines outdoors",
        "Kawasan Falls Cebu waterfall",
        "cliff diving Philippines",
        "Philippines mountain summit trek",
        "Cebu nature tour",
    ],

    "Cultural & Heritage": [
        "Cebu Basilica cathedral church",
        "Cebu museum history culture",
        "Cebu city plaza heritage",
        "Lapu Lapu shrine Mactan Cebu",
        "Fort San Pedro Cebu heritage",
        "Sinulog festival Cebu Philippines",
        "Philippines local fiesta celebration",
        "Cebu art scene gallery",
        "Cebu cultural heritage tour",
        "Magellan Cross Lapu Lapu statue Cebu",
    ],

    "Theme Parks / Entertainment": [
        "Cebu waterpark resort water slides",
        "Philippines theme park amusement",
        "Philippines carnival fair rides",
        "Cebu arcade game center",
        "amusement park rides Philippines",
        "rollercoaster theme park Philippines",
        "water slides park Philippines",
        "Ferris wheel Philippines amusement park",
        "amusement park Philippines fun",
        "Philippines fireworks festival show",
    ],

    "Urban & City": [
        "SM Seaside Cebu mall shopping",
        "Cebu IT Park tower skyline",
        "casino resort Cebu Philippines",
        "IT Park Cebu business district lifestyle",
        "Cebu city shopping centres",
        "live concert music event Philippines",
        "karaoke bar Philippines nightlife",
        "cinema movie theater Cebu",
        "rooftop bar sunset view Cebu",
        "best cafes Cebu Philippines",
    ],

    "Culinary & Gastronomy": [
        "Cebu Carbon market local produce",
        "craft beer brewery Cebu",
        "local bakery pan de sal Cebu",
        "local eatery Filipino food Cebu",
        "grill restaurant seafood Cebu",
        "fine dining restaurant Cebu Philippines",
        "seafood buffet Philippines restaurant",
        "fresh seafood Cebu Philippines restaurant",
        "vegan restaurants plant-based Cebu",
        "Filipino street food Cebu tour",
    ],

    "Accommodation & Staycation": [
        "backpacker hostel budget Cebu Philippines",
        "mountain lodge Philippines nature stay",
        "beach cabin cottage Philippines",
        "glamping Philippines luxury camping",
        "camping site Philippines outdoor",
        "luxury beachfront resort Cebu Philippines",
        "hotel booking reservation Cebu Philippines",
        "boutique hotel unique stay Cebu",
        "infinity pool resort Cebu Philippines",
        "spa resort wellness treatment Cebu",
    ],
}
