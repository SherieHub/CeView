# Content Studio: Alert → Market Picker

**Date:** 2026-08-13
**File:** `ui-ux-prototype.html`
**Scope:** Content Studio **v1** (the `content` screen / `renderContent()` / `APP_STATE.content`) only. Content Studio (2) (`content2` / `renderContent2()`) is explicitly out of scope and must not change.

## Problem

Content Studio currently renders captions for a hardcoded market (`MOCK_CONTENT.market` — South Korea / Seoul) regardless of how the user arrived at the screen. Both the sidebar's direct "Content Studio" nav link and the dashboard's alert → market → "Target this market" path land on the same generated captions with no explicit confirmation of *which* surge alert or *which* target market the content is for. This is an unwarranted assumption: the user must explicitly choose a surge alert, then a target market, before any content is shown.

## Goal

Gate Content Studio behind a two-step picker — pick a surge alert, then pick a target market for that alert's category — before showing any generated captions. No entry point may skip this by inferring a market on the user's behalf.

## State changes

Extend `APP_STATE.content` (the v1 content state, returned by `C()`) with three new fields:

```js
content:{
  ...
  pickedAlertId: null,   // MOCK_NOTIFICATIONS id chosen in Step 1
  pickedMarketId: null,  // market id chosen in Step 2 (marketsForCategory(alert.category))
  pickerStep: 'alert',   // 'alert' | 'market' — only meaningful while pickedAlertId/pickedMarketId aren't both set
  ...
}
```

All existing fields (`platform`, `approved`, `approvedText`, `edits`, `staged`, `media`, `publishPlatforms`, `toggles`, `agreed`, `omcs`, `auditing`) are unchanged.

## Render branching

`renderContent()` gains a branch at the top:

- If `c.pickedAlertId && c.pickedMarketId` → render the existing captions/composer/audit UI (today's `renderContent()` body), with the page-head market chip and "Localized copy generated for…" text driven by the picked alert/market (see "Captions view" below) instead of `MOCK_CONTENT.market`.
- Else → render the picker, branching further on `c.pickerStep`.

## Step 1 — Pick a surge alert

- Data: `MOCK_NOTIFICATIONS.filter(n => APP_STATE.profile.categories.includes(n.category))` — identical filter to `renderDashboard()`'s `myAlerts`.
- Markup: reuse the existing `.alert-card` component/styling from the dashboard (`alert-top`, `alert-date`, surge chip, title, message, `.alert-meta` chips). Difference from the dashboard's version: clicking a card **advances to Step 2** rather than toggling an inline reveal — no "Selected" chip, no unread-dot mutation (`isRead` is not touched here; that stays a dashboard-only side effect).
- Page head: `Step 1 of 2 — Pick a surge alert`, subtitle explaining this determines which category's markets appear next.
- Empty state (`myAlerts.length === 0`): reuse the dashboard's "No surge alerts for your categories yet" empty-state card verbatim (same glyph, heading, body copy referencing `profile.categories`). No control exists to bypass into Step 2 or the generator from here.
- Handler: `csPickAlert(id)` → `c.pickedAlertId = id; c.pickerStep = 'market'; renderContent();`

## Step 2 — Pick a target market

- Data: `marketsForCategory(alert.category)` where `alert = MOCK_NOTIFICATIONS.find(n => n.id === c.pickedAlertId)` — identical to the dashboard's `marketsSection` logic.
- Markup: reuse the existing `.rank-card` component/styling (rank number, match score, bar, flight facts, surge-active chip) — but `onclick` calls the new picker handler instead of `openRadar(m.id)`.
- Page head: `Step 2 of 2 — Pick a target market for {alert.category}`, plus a `← Back to alerts` link.
- Handler (back): `csBackToAlertStep()` → `c.pickedAlertId = null; c.pickerStep = 'alert'; renderContent();`
- Handler (pick): `csPickMarket(id)` → `c.pickedMarketId = id; renderContent();` — this satisfies the render branch's `pickedAlertId && pickedMarketId` condition, so the very next render shows the captions view.

## Captions view (post-pick)

- Unchanged: caption text/options/metadata (`MOCK_CONTENT.captions`), visual direction guide, publish composer, compliance audit, content board.
- Changed: the page-head subtitle and market chip read from the picked market/alert instead of `MOCK_CONTENT.market`:
  - Resolve `pickedMarket = marketById(c.pickedMarketId)` (falls back to `MOCK_MARKETS[0]` per existing `marketById` behavior) and `pickedAlert = MOCK_NOTIFICATIONS.find(n => n.id === c.pickedAlertId)`.
  - Subtitle: `Localized copy generated for {pickedMarket.name} — {pickedAlert.category}.`
  - Market chip: keep the same `map-pin` chip style, text becomes `{pickedMarket.name} — {pickedMarket.city}` (matches the existing `country — city` shape; `pickedMarket` uses `name`/`city` fields like the dashboard's rank cards do, not `MOCK_CONTENT.market`'s `country`/`city` shape).
  - Caption body text itself is **not** re-derived per market — it stays `MOCK_CONTENT.captions` verbatim, per the agreed prototype-fidelity tradeoff (this is a fixed demo dataset; there is no per-market caption set to swap in).
- New control in the page head: `Change target market` button → `csChangeTarget()`: `c.pickedAlertId = null; c.pickedMarketId = null; c.pickerStep = 'alert'; renderContent();`. Existing staged caption/media/toggle/audit state in `c` is left untouched (not cleared) — it simply isn't shown again until the user re-completes the picker; this avoids silently discarding in-progress work on an accidental click.

## Entry points

- **Sidebar → Content Studio** (`goApp('content')`): no change to `goApp` itself. `renderContent()`'s branch handles both cases — picker on first visit this session, remembered captions view on subsequent visits (since `pickedAlertId`/`pickedMarketId` persist in `APP_STATE.content` across screen navigation within the session).
- **Dashboard → alert → market → "Target this market"** (`targetThisMarket(id)` at line ~2660): currently sets `APP_STATE.targetedMarketId`/`activeMarketId`, closes the drawer, and calls `goApp('content')` with a "content generated" toast. Change:
  - Before `goApp('content')`, reset the v1 content picker state: `APP_STATE.content.pickedAlertId = null; APP_STATE.content.pickedMarketId = null; APP_STATE.content.pickerStep = 'alert';` — so this path always lands on Step 1, never auto-generating captions from the market the user was just viewing in the radar drawer.
  - Toast copy changes from `'Targeting ' + marketById(id).name + ' — content generated'` to `'Opening Content Studio for ' + marketById(id).name`.
  - `APP_STATE.targetedMarketId`/`activeMarketId` assignments are unrelated to the v1 picker and are left as-is (they still drive other UI, e.g. the radar drawer itself).

## Dev jump bar

`DEV_LINKS` under `'Screens'`:
- `Content Studio` and `Content — audited` keep their current one-click behavior for QA convenience: both now also pre-set `APP_STATE.content.pickedAlertId = 'n1'; APP_STATE.content.pickedMarketId = 'korea';` before `goApp('content')`, so they land directly on the finished captions view exactly as they do today.
- Add a new entry, `Content Studio — picker`, that calls `seedCompletedProfile()` and `goApp('content')` **without** pre-setting picks, so the new Step 1/Step 2 flow is reachable on demand for review.

## Non-goals

- Content Studio (2) (`content2`) is not touched.
- No new mock data is added; caption text remains the single fixed `MOCK_CONTENT.captions` dataset regardless of which market is picked.
- No change to the dashboard's own alert/market UI (`renderDashboard`, `selectAlert`, `openRadar`) beyond the one-line reset added to `targetThisMarket`.
