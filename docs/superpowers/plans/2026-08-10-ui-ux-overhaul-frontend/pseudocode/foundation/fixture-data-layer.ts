// ---- services/fixtures/markets.ts ---- (representative; notifications/content/omcs/campaign/
// posts/members follow the same "typed interface + exported MOCK_* constant" shape)
interface ChartDataPoint { week, history, forecast, seasonality, forex, gdp, spike: 0|1 }
function buildChartData(o): ChartDataPoint[]
interface Market { id, rank, name, city, ...+20 more fields incl. chartData }
const MOCK_MARKETS: Market[]           // korea, japan, usa
const CATEGORY_MARKET_SCORES: Record<string, Record<string, number>>
function marketsForCategory(category): Market[]   // re-ranks MOCK_MARKETS via CATEGORY_MARKET_SCORES

// ---- types.ts ----
interface AuthUser { id, email, businessName }
interface AuthTokens { accessToken, refreshToken? }
interface BusinessProfile { businessProfileId, businessName, categories, coreServices,
  description, uvp, imagePreview, uniquenessScore, slogan, industry, vibes, website, logo, socials }
type PlatformId: 'instagram' | 'tiktok' | 'facebook' | 'naver'
interface PlatformConnection { platform, connected, handle, connectedAt }
type PostStatus: 'draft' | 'scheduled' | 'published'
interface SocialPost { id, platform, status, caption, scheduledFor, publishedAt, marketId }
interface PostMetric { postId, impressions, engagements, clicks, engagementRate }
interface WorkspaceMember { id, name, email, role, invitedAt, status }
  // models a future real-backend shape — NOT what apiClient.workspace.members() returns today
  // (that's fixtures/members.ts's WorkspaceMemberFixture)

// ---- services/apiClient.ts ----
imports: loadTokens, all MOCK_*/helper exports from fixtures/*, WorkspaceMemberFixture type,
         PlatformConnection + PostMetric types from '../types'

const USE_FIXTURES ← import.meta.env.VITE_USE_FIXTURES === 'true'
const BASE_URL ← import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'

function delay(value, ms=250): Promise    // resolves value after ms
function request(path, init?): Promise
  attach Bearer token from loadTokens() if present
  throw on non-2xx; return undefined on 204; else parse JSON

const apiClient:
  markets.list() → USE_FIXTURES ? delay(MOCK_MARKETS) : request('/api/markets')
  markets.chartData(marketId) → USE_FIXTURES ? delay(market's chartData) : request(`/api/markets/${id}/chart`)
  markets.categoryScores() → USE_FIXTURES ? delay(CATEGORY_MARKET_SCORES) : request(...)
  markets.forCategory(category) → USE_FIXTURES ? delay(marketsForCategory(category)) : request(...)
  notifications.list() → USE_FIXTURES ? delay(MOCK_NOTIFICATIONS) : request('/api/notifications')
  content.list() → USE_FIXTURES ? delay(MOCK_CONTENT) : request('/api/content')
  omcs.rubric() → USE_FIXTURES ? delay(OMCS_RUBRIC_LABELS) : request(...)
  omcs.evaluate() → USE_FIXTURES ? delay(MOCK_OMCS) : request(..., POST)
  campaign.defaultInput/history/report() → USE_FIXTURES ? delay(fixture) : request(...)
  posts.list() → USE_FIXTURES ? delay(MOCK_POSTS) : request('/api/posts')
  posts.metrics(postId) → USE_FIXTURES ? delay(lookup in MOCK_POST_METRICS) : request(...)
  connections.list/connect/disconnect() → USE_FIXTURES ? delay(...) : request(...)
  workspace.members() → USE_FIXTURES ? delay(MOCK_MEMBERS) : request<WorkspaceMemberFixture[]>(...)
    // returns WorkspaceMemberFixture[], NOT types.ts's WorkspaceMember
  workspace.invite(email) → USE_FIXTURES ? delay({ok:true}) : request(..., POST)
  auth.login(email,pw) → always request(...) — no fixture branch
  auth.register(email,pw) → same shape as login
