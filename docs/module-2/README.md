# Module 2 — Market Radar & Notifications

Reference index for every frontend and backend component in Module 2. Companion diagrams:

| File | Contents |
|---|---|
| [`sequence.mmd`](sequence.mmd) | End-to-end user-flow sequence across all three API interactions |
| [`class.mmd`](class.mmd) | Frontend interfaces + React components + backend Java records and their relationships |
| [`er.mmd`](er.mmd) | Database entity-relation diagram for all Module 2 tables |

---

## Frontend Components

| Layer | Component | File | Responsibility |
|---|---|---|---|
| **View** | `HomeView` | [`ceview/components/views/module-2/HomeView.tsx`](../../ceview/components/views/module-2/HomeView.tsx) | Loads notifications on mount; renders `TrendAlertCard` list; navigates into `MarketRadarView` on click; gold "Demo Data" badge when API is unreachable |
| **View** | `MarketRadarView` | [`ceview/components/views/module-2/MarketRadarView.tsx`](../../ceview/components/views/module-2/MarketRadarView.tsx) | Loads markets on mount with `profileId`; market-selector card grid; deep-dive dashboard (alert, directive, chart, insights); Refresh Forecast button → POST analyze; gold "Demo Data" badge |
| **Module** | `LiveAlertBanner` | [`ceview/components/modules/module-2/LiveAlertBanner.tsx`](../../ceview/components/modules/module-2/LiveAlertBanner.tsx) | Surge alert strip for the currently selected market |
| **Module** | `StrategicDirectivePanel` | [`ceview/components/modules/module-2/StrategicDirectivePanel.tsx`](../../ceview/components/modules/module-2/StrategicDirectivePanel.tsx) | AI directive text panel; "Create Content" CTA that calls `onNavigateToContent` to switch to Content Studio |
| **Module** | `DemandForecastChart` | [`ceview/components/modules/module-2/DemandForecastChart.tsx`](../../ceview/components/modules/module-2/DemandForecastChart.tsx) | Recharts ComposedChart — historical (bar) + forecast (line) demand, weighted by forex / GDP / seasonality / spike factors |
| **Module** | `EconomicInsightsBoard` | [`ceview/components/modules/module-2/EconomicInsightsBoard.tsx`](../../ceview/components/modules/module-2/EconomicInsightsBoard.tsx) | Airline carrier cards, peak months chips, economy insight text, seasonality insight text |
| **Composite** | `TrendAlertCard` | [`ceview/components/composites/module-2/TrendAlertCard.tsx`](../../ceview/components/composites/module-2/TrendAlertCard.tsx) | Single notification row in HomeView — date, market name, trend label, title; click opens MarketRadarView at the matching market |
| **Composite** | `MarketRankCard` | [`ceview/components/composites/module-2/MarketRankCard.tsx`](../../ceview/components/composites/module-2/MarketRankCard.tsx) | Market selector tile — rank badge, matchScore `ProgressBar`, city, direct-flight pill, selected state ring |
| **Composite** | `MetricHighlight` | [`ceview/components/composites/module-2/MetricHighlight.tsx`](../../ceview/components/composites/module-2/MetricHighlight.tsx) | Icon + label + value strip (used for "Distance to Cebu" and "Route Type") |
| **Base** | `ProgressBar` | [`ceview/components/base/module-2/ProgressBar.tsx`](../../ceview/components/base/module-2/ProgressBar.tsx) | Thin percentage fill bar used by `MarketRankCard` to visualise `matchScore` |
| **Base** | `SurgeBadge` | [`ceview/components/base/module-2/SurgeBadge.tsx`](../../ceview/components/base/module-2/SurgeBadge.tsx) | Coloured pill badge (e.g. "SURGE", "STABLE") |
| **Service** | `apiClient` | [`ceview/services/apiClient.ts`](../../ceview/services/apiClient.ts) | Module 2 methods: `listNotifications()`, `listMarkets(profileId?)`, `analyzeMarkets(profileId)` |
| **Service** | `identity` | [`ceview/services/identity.ts`](../../ceview/services/identity.ts) | Exports `OPERATOR_ID` (reads `VITE_OPERATOR_ID` env; defaults to seeded dev UUID) |
| **Types** | `Market`, `Notification`, etc. | [`ceview/types.ts`](../../ceview/types.ts) | `Market`, `Airline`, `ChartDataPoint`, `Notification` (with `marketId`, optional `details`), `MarketId` enum (`KOREA`, `JAPAN`, `AUSTRALIA`, `GLOBAL`) |

---

## Backend Components

| Layer | Component | File | Responsibility |
|---|---|---|---|
| **DTO** | `MarketDtos` | [`backend/.../module2/dto/MarketDtos.java`](../../backend/spring-boot/src/main/java/com/ceview/module2/dto/MarketDtos.java) | Java records: `ChartDataPointDto`, `AirlineDto`, `MarketDto`, `MarketsResponse` — field-for-field mirror of frontend `Market` type |
| **DTO** | `NotificationDtos` | [`backend/.../module2/dto/NotificationDtos.java`](../../backend/spring-boot/src/main/java/com/ceview/module2/dto/NotificationDtos.java) | Java records: `NotificationDto` (includes `marketId`), `DetailsDto`, `ContentStrategyDto`, `GeneratedCaptionDto`, `VisualDirectionDto`, `StrategicInsightsDto`, `TopInterestDto`, `KeywordTrendDto`, `NotificationsResponse` |
| **Controller** | `ForecastingController` | [`backend/.../module2/ForecastingController.java`](../../backend/spring-boot/src/main/java/com/ceview/module2/ForecastingController.java) | `GET /api/v1/forecasting/markets?profileId=…` → `MarketsResponse`; `POST /api/v1/forecasting/analyze/{profileId}` → `MarketsResponse`; uses `ObjectMapper.convertValue` so field mismatches surface as 5xx |
| **Controller** | `NotificationController` | [`backend/.../module2/NotificationController.java`](../../backend/spring-boot/src/main/java/com/ceview/module2/NotificationController.java) | `GET /api/v1/notifications` → `NotificationsResponse`; same strict deserialisation pattern |
| **Service** | `AIInferenceGatewayService` | [`backend/.../ai/AIInferenceGatewayService.java`](../../backend/spring-boot/src/main/java/com/ceview/ai/AIInferenceGatewayService.java) | `forecastMarkets(Map)`, `listNotifications()` — reactive WebClient bridge to FastAPI microservice |

### REST endpoint summary

| Method | Path | Controller method | Frontend caller |
|---|---|---|---|
| `GET` | `/api/v1/notifications` | `NotificationController.list` | `apiClient.listNotifications` — HomeView `useEffect` on mount |
| `GET` | `/api/v1/forecasting/markets?profileId=…` | `ForecastingController.markets` | `apiClient.listMarkets(profileId)` — MarketRadarView `useCallback` on mount |
| `POST` | `/api/v1/forecasting/analyze/{profileId}` | `ForecastingController.analyze` | `apiClient.analyzeMarkets(profileId)` — "Refresh Forecast" button handler |
