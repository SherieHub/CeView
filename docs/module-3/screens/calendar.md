# Screen — Calendar

**Route:** `/calendar` · **Module:** 3 (publishing) · **Access:** authenticated.

**Prototype reference:** [`ui-ux-prototype.html:3644–3755`](../../../ui-ux-prototype.html#L3644)
(`renderCalendar`, `calShift`, `calendarDayClick`).

**Component:** `components/module-3/calendar/CalendarView.tsx` — **new**.
`ceview/old-components/CalendarView.tsx` is legacy and is **not** promoted, extended, or imported
into this screen; per `.claude/CLAUDE.md`, `old-components/` is left untouched unless a task
specifically calls for it.

## Purpose

Every published, scheduled, and drafted post on one timeline, so an operator can see posting
consistency during a demand-surge window at a glance.

## Layout

Page head (title, Month/List view toggle) → card with month navigation (prev/next + per-status counts
— published/scheduled/draft) → the active view (month grid or flat list) → a platform color legend.

## State

```
calMonth: number   // 0-indexed
calYear: number
calView: 'month' | 'list'
```

Reads from the shared post store (see [content-studio.md](content-studio.md)'s publishing section for
what populates it).

## Month view

7-column grid. Leading/trailing days from adjacent months render greyed and inert (no click handler —
they carry no `iso` date in this month's context). Today is ringed. Each day cell shows up to 3
platform-colored chips (caption excerpt, truncated) plus a "+N more" indicator if it has more. Days
with zero posts are not clickable.

## List view

Flat, reverse-chronological list of every post with its date, platform, caption, and status chip.

## Interaction

- Month navigation shifts month/year, wrapping December↔January correctly.
- Clicking a day with ≥1 post opens a modal listing that day's posts. Published posts show
  reach/likes/engagement rate inline; others show only the caption and status.

## API calls

| Call | When | Endpoint |
|---|---|---|
| list posts | screen mount | see [`backend/PublishingController.md`](../backend/PublishingController.md) — `GET /api/posts?from=&to=`, **specified, not yet implemented** |

## Backend requirement

See [`backend/PublishingController.md`](../backend/PublishingController.md) and
[`backend/schema-delta.md`](../backend/schema-delta.md) for `SocialPost` / `tbl_social_post`.
