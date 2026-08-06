# CeView Prototype — Dashboard UI/UX Overhaul

**Date:** 2026-08-06
**Target file:** [`ui-ux-prototype.html`](../../../ui-ux-prototype.html) (`#screen-dashboard` section, its two overlay drawers, and only the shared CSS tokens/primitives Dashboard needs — no other screen's markup is touched)
**Supersedes:** [`2026-08-06-almanac-prototype-overhaul-design.md`](2026-08-06-almanac-prototype-overhaul-design.md) — discarded in full at the user's direction ("IGNORE OLD PLANS. FORMULATE NEW PLAN"). Nothing from that spec (Editorial Almanac aesthetic, dual-theme, full-app relayout) carries forward.
**Sources of truth used:** the developer's annotated screenshot review (`CeView Prototype Review.md`), `docs/module-1/MODULE1_SYSTEM_DOCUMENTATION.md`, `docs/module-2/MODULE2_SYSTEM_DOCUMENTATION.md`, and — critically — the **real production data model** in `ceview/constants.ts` and `ceview/types.ts` (the actual `Market`, `Notification`, `BUSINESS_CATEGORIES` shapes and mock values used by the shipped React app).

---

## 1. Overview

This is a **UI/UX-only overhaul of the Dashboard screen**, scoped narrowly at the user's explicit direction: *"ONLY UI OVERHAUL. THE PROCESS AND BACKEND MUST STILL BE THE SAME."* No backend, API contract, algorithm, or data table changes. This document proposes exactly one addition to the mock data shape (a `category` tag on notifications) and flags it explicitly as a prototype-only extension, not a claim about production.

### 1.1 Concept

A dense, tabular forecasting instrument — not a marketing dashboard. Every number that is real production data (match score, distance, flight frequency, forex rate) reads as tabular data, not as decoration. Gold is reserved exclusively for surge/urgency; nothing else uses it.

### 1.2 Governing decisions

| Decision | Choice |
|---|---|
| Scope | Dashboard screen only, right now. A full reusable design system (tokens, type scale, component primitives) is established on this screen with the explicit intent that later sessions reskin the rest of the app using the same tokens. |
| Aesthetic | Evolves the pitch deck's intended teal/"Deep Ocean" brand identity (defined in `constants.ts` as `TEAL`/`CYAN`, never actually adopted by the shipped UI, which defaulted to navy instead). Navy is retired. |
| Accent | Gold, reserved exclusively for surge/urgency signals. Never decorative, never a generic "AI" or informational color. |
| Typography | Single family (current Plus Jakarta Sans), disciplined via a real weight/size scale, `tabular-nums` on all data figures. No serif, no mono, no full editorial theme. |
| Density | Data-dense throughout — tight ledger rows for the market list, tabular alignment, no card-shadow-per-row. Left panel and drawer get a bit more room (narrative/detail zones) but still tighter than today. |
| Icons/imagery | No emoji anywhere (flags don't render on Windows/Chrome — a real bug, not just style). Replaced by a ruled 2-letter country-code badge (`KR`/`JP`/`US`), used consistently. |
| Left panel | Notifications restyled to be **category-first** (business category is the primary visual identity of each row), not country-first as today. |
| Left↔right interaction | Clicking a left-panel notification does **not** open a drawer. It highlights the matching market row in the right panel (via the notification's real `marketId` field) and expands an inline "Market Analyzer" teaser within the clicked row. |
| Right panel | Restyled from a horizontal card scroller into a vertical dense ledger of the 3 real markets, with explicit clickable affordance. Clicking opens the drawer. |
| Drawer | Rebuilt to surface the *full* real `Market` record (directive, flight metrics + airline ledger, demand forecast chart with the documented 4wk/12wk toggle, and the two-tab Economic Insights Board), not the current 3-field placeholder. |
| Secondary states | Loading skeleton, empty state, and the documented "AI Forecast Service Unavailable" banner are built and reachable via the existing dev jump-bar. |
| Mock data | Reuses real `MOCK_MARKETS` values verbatim from `ceview/constants.ts` for the right panel/drawer. Notifications extend the existing prototype's 3 hardcoded alert copy lines with real-field-shaped enrichment (`marketId`, `trend`, `isRead`, rich `details`) plus one proposed field (`category`). |

### 1.3 Constraints carried forward

Single self-contained HTML file, no build step, no framework, vanilla JS. Fonts/icons stay on their current CDN loads (Google Fonts if any are added, lucide unchanged). Mobile-first with a desktop delta. All state in-memory, resets on reload. Claude does not commit — the user commits when ready.

### 1.4 Honest divergence flag

Production `Notification` (`ceview/types.ts`) has no `category` field — notifications are keyed purely to `marketId`. The user explicitly confirmed the left panel should be category-based regardless. This spec adds a `category` field to the prototype's mock notification objects only, following the same convention Module 1's own documentation uses for flagging "design vs. implementation divergence" (see `MODULE1_SYSTEM_DOCUMENTATION.md` §"Implementation Note vs. PDF"). It is presented to developers as a proposed enhancement for review, not as existing behavior.

---

## 2. Design System

### 2.1 Color

| Token | Value | Role |
|---|---|---|
| `--brand-900` | `#063B47` | Sidebar/topbar dark surfaces |
| `--brand-700` | `#0B5A6B` | Hover/pressed states |
| `--brand` | `#0E7490` | Primary buttons, active nav, links, primary chart line, selected-row rule |
| `--brand-100` | `#E1F1F4` | Selected/highlighted row wash |
| `--brand-050` | `#F4FAFB` | Page background |
| `--surface-panel` | `#FFFFFF` | Cards, drawer, modal surfaces |
| `--text-primary` | `#0B2733` | Body text |
| `--text-muted` | `#5B7480` | Secondary text, labels, captions |
| `--border-subtle` | `#D3E3E6` | Hairline row dividers |
| `--border-strong` | `#9FB9BE` | Emphasized dividers, focus rings |
| `--signal` (gold) | `#E2960A` | Surge/urgency only |
| `--signal-soft` | `#FFF4DF` | Unread-dot wash, surge row background |
| `--positive` | `#157A56` | Positive trend, direct-flight indicator |
| `--critical` | `#B3261E` | Errors, no-direct-flight indicator |

Navy (`#0F2854` and family) is fully retired from the Dashboard screen — not reused as a neutral.

### 2.2 Typography

Plus Jakarta Sans throughout, via a disciplined scale:

| Token | Weight/Size (mobile → desktop) | Use |
|---|---|---|
| `display` | 700, 28px → 40px | Hero numerals (none on Dashboard v1 — reserved for future) |
| `h1` | 700, 22px → 26px | Screen title |
| `h2` | 600, 16px → 18px | Panel titles ("Market Signals", "Target Markets") |
| `body` | 400, 14px → 15px | Default copy |
| `body-em` | 600, 14px → 15px | Emphasis, headline text in rows |
| `label` | 600, 11px, `+0.04em` uppercase | Column heads, category badges, eyebrows |
| `figure` | 500, 14px → 15px, `font-variant-numeric: tabular-nums` | All data numerals — match score, distance, price, dates |
| `caption` | 400, 12px | Timestamps, footnotes |

### 2.3 Structure, spacing, radius

- **Spacing scale (4px base):** `4, 8, 12, 16, 24, 32, 48`.
- **Radius:** `4px` for buttons/inputs/badges, `6px` for panels/drawer/modal, `999px` only for the unread dot and avatar-style elements. Down from the current 8–16px scale.
- **Elevation:** flat + hairline border for ledger rows (no shadow); a single soft shadow reserved for the drawer/modal only, matching current overlay treatment.
- **Right-panel ledger row:** fixed-height row, hairline `--border-subtle` divider between rows, no divider on hover — instead the row gains a `--brand-100` background wash and a 3px `--brand` left rule.

### 2.4 Iconography

Lucide (already loaded via CDN, unchanged) at `stroke-width: 1.5`, sizes 14/16/20px. No emoji anywhere on Dashboard. Country identity uses a small ruled badge: 2-letter uppercase code, `--brand-900` text on `--brand-050` fill, 1px `--border-subtle` border, `4px` radius — used in left-panel rows, right-panel rows, and the drawer header.

### 2.5 Motion

Minimal and purposeful: 150ms ease for hover/row-highlight transitions, a single 200ms slide for drawer open/close (existing behavior, unchanged), a 900ms count-up on the drawer's headline match-score numeral. Respects `prefers-reduced-motion: reduce` — count-up and any transform-based reveal render at final state instantly when set.

---

## 3. Component Inventory

**Category badge** — small rectangular label, `label` type, `--brand` text on `--brand-100` fill, used as the primary heading element of each left-panel notification row.

**Notification row (left panel)** — category badge → headline (`body-em`) → timestamp (`caption`) stacked; unread rows get a gold dot + `--signal-soft` left edge. Click target is the full row; no per-row shadow.

**Market ledger row (right panel)** — single-line dense row: rank digit, country-code badge, market name + city (`body-em` + `caption`), direct-flight icon+label, match-score numeral + 40px horizontal gauge bar, optional surge badge, trailing chevron. Hover/active state = `--brand-100` wash + `--brand` left rule. Explicitly `cursor: pointer` with a visible affordance (chevron), addressing the reviewer's "doesn't look clickable" note.

**Surge badge** — small pill, `--signal` border/text, `--signal-soft` fill, reads "Surge now" (Korea, live) or "Surge in Nw" (Japan/USA, forecasted) depending on which `chartData` week first shows `spike === 1`.

**Match-score gauge** — 40×4px horizontal track (`--border-subtle`), filled to `matchScore`% in `--brand`.

**Ink-free chart** — thin polylines only: `--brand` solid = History, `--signal` dashed = Forecast, `--brand-100` fill = Seasonality area. Demand-zone background bands per the documented thresholds (Low 0–30 lightest, Moderate 31–70 mid, High-Peak 71–100 darkest, all in low-opacity `--brand`/`--signal` tints). Spike weeks marked with a small filled dot in `--critical`.

**Airline ledger (drawer)** — compact table: airline name, code, frequency, direct/connecting badge, duration, tier — hairline rows, tabular figures.

**Tabs (drawer's Economic Insights Board)** — two flat tabs, underline-style active indicator, `--brand`.

**Skeleton row** — pulsing `--border-subtle`-to-`--brand-050` gradient block matching each row's real dimensions, for both left and right panels.

**AI-down banner** — dismissible, `--signal-soft` background, `--signal`-toned icon, sits above both panels: *"AI Forecast Service Unavailable — showing your last successful forecast run."*

---

## 4. Screen Specification — Dashboard

### 4.1 Header band

Greeting line (kept: "Good afternoon" / "Here's what's happening today") plus a new compact profile/category context line beneath it: *"Sunset Dive Co. · Coastal & Island, Adventure & Nature"* — read-only, matching Module 2's documented "profile context pill." Nav sidebar's Dashboard badge count updates from the hardcoded `3` to the real unread-notification count (`1`, since 1 of the 3 mock notifications is unread).

### 4.2 Left panel — "Market Signals"

Three notification rows (see §5 for exact content), each category-badge-first. Clicking a row:

1. Does not open any drawer.
2. Finds the market in `MARKETS` whose `id` matches the notification's `marketId`.
3. Applies a highlight state (row background wash + left rule) to that market's row in the right panel, scrolling it into view if off-screen.
4. Expands an inline panel within the clicked notification row showing the "Market Analyzer" teaser: projected arrivals, arrival growth %, and top 1–2 interests, drawn from the notification's `details` payload.
5. Clicking the same row again (or a different row) collapses/replaces the teaser and clears the previous highlight.

### 4.3 Right panel — "Target Markets"

Vertical ledger, one row per real market (Korea rank 1, Japan rank 2, USA rank 3 — see §5.2 for full field values). Clicking a row opens the radar drawer populated with that market's full record — the drawer is no longer hardcoded to Korea.

### 4.4 Market Radar drawer

Rebuilt to show, top to bottom: header (country-code badge + market name + city + close), pinned "Target This Market" CTA (existing `targetThisMarket()`, unchanged), the AI directive text block, a flight-metrics block (distance, routing/via, flight hours, nearest/destination airport, frequency, average price) with the airline ledger beneath it, the Demand Forecast Chart with a working 4-week/12-week toggle (12-week extends the real 8-point `chartData` using the documented interpolation: past = `sin(offset) × 5`, future = `cos(offset) × 8`, clamped `[20, 100]`), and the two-tab Economic Insights Board (Purchasing Power: latest forex + GDP figures with insight paragraph and two mini trend lines built from `chartData`'s per-week `forex`/`gdp` columns, since the real markets have no separate `gdpTrend`/`forexTrend` arrays populated — matching the documented DB fallback behavior; Seasonal Patterns: 12-month grid highlighting the real `peakMonths`, insight paragraph, seasonality area chart from `chartData`).

### 4.5 Secondary states

Reachable from the existing dev jump-bar (colophon), each a distinct state of `#screen-dashboard`:

- **Loading:** three skeleton rows in each panel, header context line hidden.
- **Empty:** left panel shows "No notifications yet. Market trend data will appear here once your profile is analysed." Right panel still populated (it's a pure DB read per the docs, independent of the notification feed).
- **AI-down:** the dismissible amber banner appears above both panels; right-panel data still renders (it's the DB-backed market list, unaffected by AI service health per the docs) but the "Refresh"-style affordance (if present) would be disabled — no refresh button exists on Dashboard today so this is purely the banner.

### 4.6 Mobile delta

Single column: header → left panel (Market Signals) → right panel (Target Markets, ledger rows stay full-width but drop the airline-ledger-style density, keeping rank/name/flight/score). Drawer becomes a full-height bottom sheet as it already is today (`.drawer` behavior unchanged).

---

## 5. Mock Data

### 5.1 Business profile context

- Business: Sunset Dive Co. (existing persona, unchanged elsewhere in the prototype)
- Categories: `["Coastal & Island", "Adventure & Nature"]` — 2 of the real 7 `BUSINESS_CATEGORIES` from `ceview/constants.ts`

### 5.2 Markets (right panel + drawer) — reused verbatim from `ceview/constants.ts` `MOCK_MARKETS`

| Field | Korea | Japan | USA |
|---|---|---|---|
| `rank` | 1 | 2 | 3 |
| `name` / `city` | South Korea / Seoul | Japan / Osaka | United States / Los Angeles |
| `matchScore` | 91 | 83 | 71 |
| `directFlight` | true | true | false |
| `flightHours` | 3h 45m | 2h 50m | 16h+ (via MNL) |
| `distanceKm` | 2,640 | 1,980 | 11,027 |
| `nearestAirport` → `destinationAirport` | ICN → CEB | KIX → CEB | LAX → MNL |
| `accessibilityScore` | 9 | 8 | 3 |
| `flightFrequency` | 14/wk | 10/wk | 3/wk |
| `avgFlightPrice` | ₱8,200–14,500 | ₱7,500–12,000 | ₱28,000–45,000 |
| `airlines` | Korean Air, Cebu Pacific, AirAsia PH (3) | Philippine Airlines, Cebu Pacific, Peach Aviation (3) | Philippine Airlines via Manila (1) |
| `peakMonths` | Jul, Aug, Dec, Jan | Apr, May, Aug, Mar | Jun, Jul, Aug, Dec |
| Spike timing (from `chartData`) | **Live now** (Current week `spike:1`) | Forecasted, 2 weeks out (`Wk +2`) | Forecasted, 3 weeks out (`Wk +3`) |
| `directive` / `economyInsight` / `seasonalityInsight` | full text reused as-is | full text reused as-is | full text reused as-is |
| `chartData` (8 weeks: Wk-3…Wk+4) | reused as-is | reused as-is | reused as-is |

Full field text is copied verbatim from `ceview/constants.ts` lines 254–413 at implementation time — not retyped here to avoid transcription drift.

### 5.3 Notifications (left panel) — extends the prototype's existing 3 alert lines

| # | Category (proposed field) | Headline (existing prototype copy, reused) | `marketId` | `trend` | `isRead` | Timestamp |
|---|---|---|---|---|---|---|
| 1 | Adventure & Nature | "Korean diver searches up 34% this week" | `korea` | Reef Diving | false | 2 hours ago |
| 2 | Coastal & Island | "Golden Week prep window opens in 12 days" | `japan` | Golden Week | true | 2 days ago |
| 3 | Coastal & Island | "US interest steady ahead of long weekend" | `usa` | Long-haul Booking | true | Yesterday |

Each carries a `details` payload shaped exactly like the real `Notification.details` type (`projectedArrivals`, `arrivalGrowth`, `topInterests[]`, `segments[]`, `strategicInsights{trendAlignment, connectivity, economicValue}`, `keywordData[]`) with new Cebu-diving-specific content — reusing the real Korean-language keyword strings already present in the current prototype's drawer (`세부 다이빙`, `막탄 스노클링`) rather than inventing new ones.

---

## 6. What's Preserved

Existing behavior/signatures kept: `goApp`, `toggleSidebar`, `buildNav`, `renderIcons`, `openDrawer`, `closeDrawer`, `openModal`, `closeModal`, `showToast`, `targetThisMarket`, `scoreBand`. `openRadar`/`renderRadarDrawer` are rewritten to accept a market argument (today they're hardcoded to Korea regardless of which card was clicked — a real bug this overhaul also fixes) but keep their names and calling convention from other screens where referenced.

**New this overhaul:** the notification→market highlight handler, the inline Market Analyzer teaser renderer, the 4wk/12wk chart interpolation function, the Economic Insights tab switcher, and the three new dev-jump-bar-reachable states.

---

## 7. Verification

Manual, in-browser, at 375px / 768px / 1024px+:

1. Left-panel click never opens a drawer; it highlights the correct right-panel row (verify all 3 mappings) and expands/collapses the inline teaser correctly, including toggling between two different rows in sequence.
2. Right-panel click opens the drawer populated with that specific market's data (not hardcoded Korea) — verify for all 3 markets.
3. Drawer's 4wk/12wk toggle changes the chart's visible range; 12-week interpolated points are visually distinguishable as synthetic (e.g. lighter stroke) or at minimum don't visually break the line.
4. Economic Insights Board tabs switch content correctly; peak-months calendar highlights match each market's real `peakMonths`.
5. No emoji/flag characters remain anywhere on the Dashboard screen or its drawers.
6. Nav sidebar Dashboard badge shows `1`, matching the single unread notification.
7. Loading, empty, and AI-down states are each reachable from the dev jump-bar and render correctly.
8. No horizontal scroll at any tested width; no console errors.
9. Keyboard: notification rows, market rows, and drawer close/CTA are all reachable and operable via keyboard, focus visible.

---

## 8. Out of Scope

- No changes to Login, Onboarding, Content Studio, Calendar, Performance, or Settings screens.
- No changes to the real `ceview/` React frontend, backend, or any API contract.
- No real AI calls, persistence, or auth — all state is in-memory mock data, resets on reload.
- No dark/light theme system (not requested for this pass).
- The proposed `category` field on notifications is presentation-only in this prototype; wiring it into the real `Notification` type/backend is a separate decision for developers reviewing this prototype, not something this overhaul implements.
- Claude will not commit or push. The user commits.
