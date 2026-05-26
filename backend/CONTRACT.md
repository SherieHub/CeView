# Frontend → Backend Contract

This pass scaffolds the Spring Boot + FastAPI backend specified by the CeView SDD.
All endpoints exist; behavior is wired to FastAPI stubs that return data shaped
exactly like the frontend's existing types in `ceview/types.ts` and `ceview/constants.ts`.
The frontend can be pointed at `http://localhost:8080` and continue to work.

## Endpoints

| Method | Path | Frontend trigger | Returns |
|---|---|---|---|
| POST | `/api/v1/auth/register` | (future signup) | `{ operatorId, token }` |
| POST | `/api/v1/auth/login` | (future login) | `{ operatorId, token }` |
| POST | `/api/v1/classification/analyze` | UniquenessCalibrationForm "Analyze" | `{ categories: CategoryAllocation[] }` |
| POST | `/api/v1/classification/uniqueness` | UniquenessCalibrationForm "Compute" | `DetailedCalibrationResultDTO` |
| GET  | `/api/v1/business-profile?operatorId=` | BusinessProfile load | `BusinessProfileDto` (matches `ProfileData`) |
| PUT  | `/api/v1/business-profile?operatorId=` | BusinessProfile save | `BusinessProfileDto` |
| POST | `/api/v1/business-profile/keywords` | BusinessProfile "Recalibrate" | `string[]` (replaces `generateOptimizedKeywords`) |
| GET  | `/api/v1/notifications` | HomeView | `{ notifications: Notification[] }` |
| GET  | `/api/v1/forecasting/markets` | MarketRadarView | `{ markets: Market[] }` |
| POST | `/api/v1/forecasting/analyze/{profileId}` | "Analyze Markets" | `{ markets: Market[] }` |
| POST | `/api/v1/content/generate` | ContentStudioView load | full `MOCK` shape (market, framework, captions, compliance) |
| POST | `/api/v1/creative-direction/generate/{profileId}` | VisualDirectionBoard | `{ shotListRecommendations, visualRecommendations, lightingSuggestions, moodboardReferences }` |
| POST | `/api/v1/compliance/evaluate-json` | Smart Optimization Audit (JSON) | `{ score, aligned[], gaps[], ... }` |
| POST | `/api/v1/compliance/evaluate` | Smart Optimization Audit (multipart) | same shape, accepts media upload |
| GET  | `/api/v1/analytics/metrics?start=&end=` | EngagementMetricsBoard | `{ metrics, funnel }` |
| POST | `/api/v1/analytics/manual` | DataIngestionForm submit | `{ metrics, funnel }` (computed) |
| GET  | `/api/v1/analytics/pes/{campaignId}` | PESComputationBoard | `{ overallScore, label, breakdown }` |
| POST | `/api/v1/analytics/report` | AIActionPlanReport "Generate" | `{ executiveSummary, lowestMetric, lowestMetricMeaning, recommendations, otherAreasImprove, weakestStage, secondaryLeaks }` |
| GET  | `/api/v1/analytics/report/{id}/pdf` | "Download PDF" | application/pdf stream |

## Notes

- **Auth is open in scaffolding**: `SecurityConfig` permits everything under `/api/v1/**` so the existing frontend (which has no login flow yet) can hit endpoints. Lock this down once the React side has an auth screen.
- **Notifications and markets are envelope-wrapped** (`{ notifications: [...] }`, `{ markets: [...] }`) — the frontend currently reads bare arrays from constants, so when `geminiService.ts` is swapped over, unwrap one level.
- **PES is computed Spring-side** (no AI call) — pure formula per SDD §4.2.
- **Metrics are computed Spring-side** — SDD §4.1 specifies the math, no model needed.
- **Real ML models are stubbed** — `app/services/ml_stubs.py` returns deterministic, input-hashed mocks so dev is offline-capable.
- **Gemini is opt-in** — set `ENABLE_GEMINI=true` + `GEMINI_API_KEY=…` in `.env` to activate live calls. Without it, prompts return the same hand-crafted mocks that match the frontend's existing strings.
