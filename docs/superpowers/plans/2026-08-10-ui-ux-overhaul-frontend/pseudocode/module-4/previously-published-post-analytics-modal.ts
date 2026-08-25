// ---- components/module-4/4.1-campaign-analytics/PreviouslyPublished.tsx ----
imports: useState, usePosts from '../../../services/postStore', PlatformId type, PostAnalyticsModal

// M3-F0 owns the shared post store; this card is a read-only consumer. No dependency on
// Content Studio's feature cards — only on M3-F0 and M4-F.

type Filter: 'all' | PlatformId

function PreviouslyPublished():
  { posts } ← usePosts()
  state: filter ← 'all', openPostId ← null

  published ← posts filtered to status==='published' AND (filter==='all' OR platform matches)
    // drafts/scheduled posts never appear here and are not clickable

  render: filter tabs (All/TikTok/Instagram/Facebook) + published.map → row (onClick → setOpenPostId) +
          PostAnalyticsModal if openPostId set

// ---- components/module-4/4.1-campaign-analytics/PostAnalyticsModal.tsx ----
props: { postId, onClose }
post ← posts.find(id === postId)
truncatedCaption ← caption.length > 110 ? first 110 chars + '…' : caption

render: Modal — header (platform, date, truncatedCaption) + stat grid (reach, likes, comments,
        shares, engagement rate, platform) +
        (post.reach > 0 ? 7-day reach-accumulation area chart from post.series : "No data yet" empty state)
