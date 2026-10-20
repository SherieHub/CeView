# Campaign planner implementation and integration boundary

Updated 2026-10-17.

## Existing system and current experience

Content Studio retains Quick Post, its caption generator and editor, media composer,
visual guidance, OMCS compliance audit, Content Library and platform connections.
Campaigns now offer generation entry, strategy review, editable content plan, and
post preparation, followed by Overview / Posts / Calendar / Results. Manual planning
remains available. The owner makes all approval decisions.

The new campaign components live in
`frontend/components/module-3/3.1-content-studio/campaigns/`. The view owns routing
between stages; `campaignRecommendations.ts` contains pure planning rules;
`useCampaignData.ts` reads existing APIs; `campaignTypes.ts` owns session drafts and
approval invalidation. `frontend/styles/studio.css` styles the planner using the
existing studio colors and typography with compact/mobile layouts.

## Data and recommendation limits

- Markets use `apiClient.markets.forCategory`: backend ranks, surge levels,
  forecast chart points, confidence flags, seasonal scores and peak months.
- Active surge uses the existing backend signal. Emerging opportunity uses an
  explicitly disclosed frontend heuristic (5% forecast-average rise over recent
  observations), not a validated alert. A measured spike alone does not imply growth.
- Platforms compare available published-post median engagement rates, requiring
  three posts per platform. Zero engagement ties do not select a winner; invalid
  metrics are excluded. Comparisons are account-level, not geographic evidence.
  Format, objective and recency matching remain future work; no such matching is claimed.
- Products/services come from Business Profile or owner preferences. Offers must
  be supplied by the owner. Posting cadence and exact dates are editable defaults,
  not claims about optimal publishing times. Dates use Asia/Manila.
- Captions and visual guides reuse `apiClient.content.generate`. The existing API
  accepts business and market context, not a complete per-post campaign brief.
  Captions therefore require owner review for topic/offer alignment. Once unique
  generated options run out, remaining slots stay blank until regeneration or editing.
- Missing profile details have setup links; market failures have retry/manual
  fallback; caption failures retain strategy and allow retry or a caption-free plan.
- Campaigns live only in component state. Refresh/navigation out of the studio
  loses them. Switching studio tabs preserves them. No campaign persistence,
  scheduling, publication or performance attribution is represented as successful.
- Post edits to caption, media, platform or visual guidance invalidate prior audits
  and approvals. Late responses from abandoned audit requests are ignored.

## Backend proposal — requires approval before implementation

No backend API, AI service, schema or forecasting formula was changed in this pass.

1. Add authenticated campaign CRUD and post CRUD under `/api/campaigns`, with every
   query scoped to the authenticated business operator. Store campaign strategy,
   source timestamps/evidence, posts, owner overrides and revision numbers. Add
   Flyway tables for campaigns/posts and durable media references.
2. Add campaign-specific generation orchestration accepting a confirmed strategy
   and per-post brief (topic, service, offer, CTA, restrictions). Reuse caption and
   compliance services without changing forecasting or OMCS formulas. Return
   structured per-post output and source evidence; reject unsupported business claims.
3. Bind audits and approvals to immutable content revisions. Reject stale approvals
   server-side and preserve owner decisions separately from publication status.
4. Link campaign posts to actual publisher/scheduler records and provider IDs.
   Set scheduled/published only from confirmed operations. Add campaign metrics only
   after those links exist; leave Results empty until then.
5. Introduce comparable, recent performance cohorts when available, with explicit
   sample-size and data-quality checks. Do not infer nationality from account totals.

These are proposed contracts, not implemented endpoints. Durable campaigns and
fully coordinated AI captions are the next integration milestone; scheduling and
performance learning depend on reliable publication attribution.
