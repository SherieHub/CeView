# Component — `PostAnalyticsModal`

**Used by:** [`screens/performance.md`](../performance.md)'s "Previously published" list, and
optionally [`docs/module-3/screens/calendar.md`](../../../module-3/screens/calendar.md)'s day-click
modal for published posts (the prototype's `openPostAnalytics` and `calendarDayClick` render
overlapping but not identical content — this component covers the fuller Performance version; the
Calendar modal shows a subset inline rather than opening this component, see calendar.md).

**Prototype reference:** [`ui-ux-prototype.html:3843–3874`](../../../../ui-ux-prototype.html#L3843)
(`openPostAnalytics`).

## Purpose

Single-post analytics detail, opened from a click on any published post row.

## Content

- Header: platform + date, caption excerpt (truncated ~110 chars).
- 2×3 stat grid: Reach, Likes, Comments, Shares, Engagement (%), Platform.
- 7-day reach-accumulation line chart (`miniLine`-equivalent — port to Recharts per the
  [Design System card](../../../superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/01-foundation.md#card--foundation-design-system),
  not the prototype's hand-rolled SVG helper).
- If the post has zero reach (not yet reported back), the chart area is replaced with a "No data yet"
  empty state — this is expected for freshly-published posts before the platform's insights API has
  reported anything back, not an error condition.

## Props (proposed)

```ts
interface PostAnalyticsModalProps {
  post: SocialPost;
  metrics: PostMetric | null;   // null → "no data yet" state
  onClose: () => void;
}
```

## Data source

See [`backend/post-metrics.md`](../../backend/post-metrics.md) for the `PostMetric` entity and
endpoint this component's `metrics` prop is sourced from.
