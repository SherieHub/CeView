# CeView Prototype — "Cebu Tourism Almanac" UI/UX Overhaul

**Date:** 2026-08-06
**Target file:** [`ui-ux-prototype.html`](../../../ui-ux-prototype.html) (rewritten in place)
**Supersedes visually:** [`2026-08-04-ui-ux-overhaul-design.md`](2026-08-04-ui-ux-overhaul-design.md) §3 (design system)
**Preserves functionally:** [`2026-08-05-prototype-refinement-design.md`](2026-08-05-prototype-refinement-design.md) (all behavior)

---

## 1. Overview

A total visual and compositional overhaul of the static prototype. The information architecture
(five app sections + login + onboarding) and every existing feature and interaction are preserved.
Everything else — tokens, typography, color, layout, component forms, texture, motion — is replaced.

### 1.1 Concept

**The Cebu Tourism Almanac** — a printed statistical annual that happens to be software.

Demand forecasts are presented as a *published record of fact*, not as dashboard widgets. The
governing metaphors are the broadsheet front page, the ruled ledger, and the press proof. Depth is
communicated by rules and ink weight rather than by drop shadows and rounded cards, which is the
single largest departure from the current file and the main defense against generic-SaaS drift.

### 1.2 Governing decisions

| Decision | Choice |
|---|---|
| Aesthetic | Editorial Almanac |
| Theme | Dual (ink + paper) with a real toggle; **ink is the default on load** |
| Purpose | Demo now, port to React later — token rigor underneath, spectacle on top |
| Structural scope | Re-skin **and** relayout every screen; IA unchanged |
| Typography | Libre Caslon Display + Karla + DM Mono |
| Color | Deep petrol ink + amber signal (teal lineage retained, pushed dark and desaturated) |
| Density | Zoned — dense ledger data, airy narrative |
| Texture / motion | Full press, with hand-authored reduced-motion equivalents |
| Navigation | Sidebar retained, restyled as a petrol spine |
| Dashboard | Front page (lead story above, dense index below) |
| Charts | Ink on ruled paper |
| Entry screens | Issue cover (login) → ruled spread (onboarding) |
| Platform previews | Realistic, framed as a press proof |
| Icons | Lucide, thinned and rationed |
| Mock data | Expanded and made Cebu-specific |
| Dev jump-bar | Kept, restyled as a colophon chip |

### 1.3 Constraints carried forward

Single self-contained HTML file at the repo root. No build step, no backend, no framework. Vanilla
JS view switching. Fonts and lucide loaded from CDN. Mobile-first with desktop deltas. All state is
in-memory and resets on reload.

### 1.4 Prerequisite

The working copy of `ui-ux-prototype.html` carries uncommitted changes (+740/−209 vs. HEAD) and this
overhaul overwrites the file. **The user must commit or stash that file before implementation
begins.** Claude does not commit in this repository.

---

## 2. Implementation Approach

**Rewrite the presentation layer; preserve the behavior layer.**

All CSS is replaced. Every `build*()` / `*HTML()` function is rewritten to emit new markup. The
following JavaScript is preserved in behavior (signatures may keep their names; internals change
only where markup demands it):

- View routing and shell: `goApp`, `toggleSidebar`, `buildNav`, `renderIcons`
- Auth: `setAuthTab`, `submitAuth`, `hide`
- Onboarding engine: `obIndex`, `OB_STEPS` (six steps), `obRender`, `obNext`, `obPrev`,
  `obUpdateNextState`, `obRenderSideList`, `obToggleCategory`, `obCategories`,
  `resetOnboardingDemo`, `obScoreState`, `LOW_SCORE_QUESTIONS`, `obLowScoreAdvance`,
  `obReturnToStructuredInputs`, `obConnectionRow`, `obToggleConnect`
- Shared state: `APP_STATE.connections`, `wordCount`, `updateWordCounter`
- Dashboard: `CATEGORIES`, `activeCategoryId`, `selectCategory`, `scoreBand`, `openRadar`,
  `renderRadarDrawer`, `targetThisMarket`
- Content Studio: `csSelectedPlatforms`, `csActiveTab`, `csTogglePlatform`, `csSetActiveTab`,
  `csCaptureFormState`, `csApplyFormState`, `csUpdateCaption`, `csUpdatePreview`, `regenCaption`,
  `checkPublishReady`, `publishPost`
- Calendar: `CALENDAR_POSTS`, `calViewMode`, `toggleCalView`, `calendarDayClick`,
  `openAnalyticsFor`
- Performance: `PERFORMANCE_POSTS`, `performanceFilterChips`, `filterPills`
- Settings: `openProfileModal`, `pfMarkDirty`, `pfSaveChanges`, `settingsPlatformRow`,
  `settingsToggleConnect`, `sendInvite`
- Overlays: `openModal`, `closeModal`, `openDrawer`, `closeDrawer`, `ensureScrimFor`,
  `removeScrimFor`, `showToast`

**New JavaScript introduced by this spec:** a theme controller (`setTheme`, `toggleTheme`, initial
`data-theme="ink"`), a dateline formatter for the masthead, and an `IntersectionObserver`-driven
reveal/draw-in trigger for charts and numerals.

Rejected alternatives: a from-scratch rewrite (re-earns already-fixed bugs — mobile horizontal
scroll, flag-emoji non-rendering on Windows, desktop CTA placement) and a token-swap-only pass
(cannot deliver the relayout the design requires).

---

## 3. Design System

### 3.1 Color

Two complete palettes on `html[data-theme="ink" | "paper"]`. Ink is the default. Every value is a
CSS custom property so the set maps 1:1 onto Tailwind theme tokens during a later React port.

**Ink theme (default)**

| Token | Value | Role |
|---|---|---|
| `--canvas` | `#0A1F23` | Page ground |
| `--plate` | `#0E2A2F` | Panels, ruled containers |
| `--plate-sunk` | `#081A1E` | Recessed wells, code/figure blocks |
| `--text` | `#EDE6D6` | Primary text (warm paper-white, never pure white) |
| `--text-muted` | `#8FA6A6` | Secondary text, labels, axis ticks |
| `--rule` | `rgba(237,230,214,0.14)` | Hairline rules, dividers, table lines |
| `--rule-strong` | `rgba(237,230,214,0.30)` | Section rules, active underscores |
| `--signal` | `#E9A93C` | Surge / urgency — the only hot color |
| `--signal-sunk` | `rgba(233,169,60,0.14)` | Signal wash behind lead blocks |
| `--critical` | `#D4574A` | Errors, destructive |
| `--positive` | `#5FA37D` | Positive trend |

**Paper theme**

| Token | Value | Role |
|---|---|---|
| `--canvas` | `#F2EDE1` | Warm paper ground |
| `--plate` | `#FAF7EF` | Panels |
| `--plate-sunk` | `#EBE4D4` | Recessed wells |
| `--text` | `#0B2429` | Deep petrol ink |
| `--text-muted` | `#5A7276` | Secondary |
| `--rule` | `rgba(11,36,41,0.16)` | Hairlines |
| `--rule-strong` | `rgba(11,36,41,0.34)` | Section rules |
| `--signal` | `#B8760F` | Surge (darkened for contrast on paper) |
| `--signal-sunk` | `rgba(184,118,15,0.12)` | Signal wash |
| `--critical` | `#9E2B1E` | Oxblood |
| `--positive` | `#2F6B4F` | Deep green |

**Usage rules**

- Amber is reserved **exclusively** for surge and urgency. A surge alert must be the hottest thing
  on any screen it appears on. It is never used for generic emphasis, nav, or decoration.
- Trend direction is always green/red, never amber or petrol — direction must be unambiguous.
- No gradients as surface fills. The only permitted gradients are the vignette washes behind the
  login cover and the lead-story signal wash.
- No colored drop shadows anywhere. Elevation is expressed by rule weight and plate contrast; the
  sole exception is the flat ink shadow permitted on overlays (§3.3).
- Both themes must satisfy WCAG AA for body text and UI labels. Amber-on-canvas is verified for
  large text and graphical objects only; small amber text is not permitted.

### 3.2 Typography

Loaded from Google Fonts in one request: `Libre Caslon Display` (400), `Libre Caslon Text`
(400, 400i, 700), `Karla` (400, 500, 600, 700), `DM Mono` (300, 400, 500).

| Token | Family | Mobile | Desktop | Use |
|---|---|---|---|---|
| `masthead` | Libre Caslon Display | 34/36 | 62/62 | Login cover wordmark, dashboard masthead |
| `lead` | Libre Caslon Display | 30/34 | 52/54 | Lead-story headline, onboarding step titles |
| `figure-xl` | Libre Caslon Display | 56/52 | 96/88 | Forecast numerals, uniqueness score |
| `h1` | Libre Caslon Text 700 | 22/28 | 28/34 | Screen titles |
| `h2` | Libre Caslon Text 700 | 17/24 | 20/28 | Section and plate titles |
| `deck` | Libre Caslon Text 400i | 15/23 | 17/26 | Standfirst / deck under a lead headline |
| `body` | Karla 400 | 14/21 | 15/23 | Default copy |
| `body-em` | Karla 600 | 14/21 | 15/23 | Emphasis, list labels |
| `label` | DM Mono 500 | 11/14 | 11/14 | Uppercase, `+0.12em` — eyebrows, column heads, badges |
| `figure` | DM Mono 400 | 15/20 | 16/22 | All tabular data, `font-variant-numeric: tabular-nums` |
| `foot` | DM Mono 300 | 10/14 | 10/14 | Source footnotes, timestamps, colophon |

**Rules:** every number that is data is set in DM Mono and right-aligned in tabular contexts.
Every editorial voice (headline, deck, screen title) is Caslon. Karla never sets a headline; Caslon
never sets a UI control label. Caslon Display is used at ≥30px only — it is a display cut and falls
apart small.

### 3.3 Structure, spacing, rules

- **Grid:** 12 columns, 24px gutters at ≥1024px, with optional visible hairline column rules in
  dense zones. 6 columns at 640–1023px, 4 at <640px.
- **Spacing scale (4px base):** `4, 8, 12, 16, 24, 32, 48, 64, 96`. Narrative zones use 48–96;
  ledger zones use 4–16.
- **Radius:** `0` for plates, tables, and rules; `2px` for inputs and buttons; `999px` only for
  avatars and the theme toggle knob. The current 8–16px radii are removed entirely.
- **Rules:** `1px` hairline (`--rule`) for table rows and dividers; `2px` (`--rule-strong`) for
  section boundaries and active nav underscores; `4px` double rule (two hairlines, 3px apart) for
  masthead and major section breaks — the recurring signature motif.
- **Elevation:** three levels, none using shadow. `flush` (no rule), `ruled` (hairline border),
  `plated` (`--plate` background + hairline border). Overlays (modal, drawer) are the only elements
  permitted a shadow, and it is a flat ink shadow with no blur spread beyond 24px.
- **Breakpoints:** unchanged — 640 / 768 / 1024 / 1280, max content width 1440px.

### 3.4 Texture

- **Grain:** an SVG `feTurbulence` overlay fixed to the viewport, `opacity: .30` on ink and `.42`
  on paper, `mix-blend-mode: multiply` on paper and `overlay` on ink.
- **Letterpress:** Caslon headlines at `lead` size and above receive a 1px inset text-shadow in
  `--canvas` to simulate ink bite. Disabled at `figure-xl` where it muddies the numeral.
- **Column rules:** dense zones draw vertical hairlines in the grid gutters via a repeating
  background, not extra DOM.
- **Registration marks:** small corner crop marks (pure CSS, 1px, 8px arms) on proof frames and the
  press stamp.

### 3.5 Component inventory

Each is built once and reused; states are specified so nothing is redrawn per screen.

**Plate** — ruled container replacing `.card`. Hairline border, `--plate` fill, zero radius,
optional `label`-set eyebrow in the top-left of the rule. Variants: `plate-flush` (rule only, no
fill), `plate-lead` (signal wash + 2px top rule in `--signal`).

**Ledger row / ledger table** — the dense data primitive. Hairline row rules only (no vertical
lines except in multi-column index blocks), DM Mono figures right-aligned, `label` column heads in
uppercase mono, hover raises the row to `--plate` with no movement. Zebra striping is not used.

**Button** — 2px radius, 1px rule, uppercase Karla 700 `+0.08em`. `primary` (ink fill on paper /
paper fill on ink, inverted text), `signal` (amber fill, canvas text — reserved for surge CTAs),
`ghost` (rule only), `destructive` (critical rule and text, fills on hover). Sizes 32 / 44 / 54px.
Hover shifts rule weight and background, never transform. Loading and disabled states retained.

**Input / select / textarea** — flush fill, hairline bottom rule only (no box), 44px min height,
Karla 400. Focus adds a 2px `--signal` bottom rule and a 1px full outline. Error swaps the rule to
`--critical` with a mono helper line beneath. Labels above the field in `label` mono, always.

**Ink badge** — outlined pill-less rectangle, 1px rule, `label` mono text, 2px radius. Semantic
variants: `ai` (rule `--signal`), `published` (`--positive`), `draft` (`--rule-strong`),
`scheduled` (`--text-muted`), `alert` (`--critical`).

**Ruled tabs** — no pills, no fills. Labels in `label` mono on a shared baseline rule; the active
tab carries a 2px `--text` underscore that slides on change.

**Proof frame** — the platform-preview container. Hairline frame, corner registration marks, a
mono caption bar beneath reading e.g. `PROOF · INSTAGRAM · 1080×1080`. Its contents deliberately
break the almanac style and render faithful platform mocks.

**Press stamp** — the uniqueness-score reveal. A ruled circular stamp rotated −8°, `label` mono
text arcing the edge, the score in `figure-xl` at center, struck onto the page with an ink-bite
animation.

**Hairline gauge** — circular, 1px track in `--rule`, 3px arc in `--signal` (or `--critical` on the
low-score path), centered `figure-xl` numeral in Caslon.

**Ink chart** — 1px petrol/paper polyline on a faint ruled baseline grid. No fills, no gradients,
no rounded caps, no dots except small 3px ink ticks at data points. Amber marks only the surge
threshold crossing. Axis labels in `foot` mono. Draws in left-to-right via `stroke-dasharray` when
scrolled into view.

**Modal / drawer / scrim / toast / banner** — geometry and behavior retained from the current file;
restyled to plates with rules, mono headers, and zero radius. Toast becomes a bottom-anchored ruled
strip with a mono label.

**Theme toggle** — a two-state ruled switch in the masthead labeled `INK` / `PAPER` in `foot` mono.

### 3.6 Iconography

Lucide is retained (CDN, matching the React app's `lucide-react`) with `stroke-width: 1.25` and
sizes reduced to 14 / 16 / 20px. Usage is cut to three places: sidebar nav, platform badges, and
empty states. Everywhere else, icons are replaced by hairline rules, Roman numerals, `label` mono
text, and typographic `↑ ↓` arrows for trend. Country markers keep the existing country-code tiles
(flag emoji do not render on Windows/Chrome) restyled as ruled mono squares.

### 3.7 Motion

All motion uses `--ease-press: cubic-bezier(.2,.7,.2,1)`.

| Effect | Where | Detail |
|---|---|---|
| Masthead reveal | Login | Rules draw outward from center, wordmark letterpresses in at 120ms stagger |
| Staggered load | Every screen | Plates rise 8px + fade, 60ms stagger, max 6 steps |
| Numeral roll-up | Forecast figures, scores, KPIs | Count from 0 over 900ms, mono tabular so width never shifts |
| Ink draw-in | All charts, gauges | `stroke-dashoffset` 0→full over 1.1s on intersection |
| Stamp strike | Onboarding step 5 (score reveal) | Scale 1.6→1 + rotate −14°→−8° over 260ms, then a 1px ink-bite settle |
| Underscore slide | Ruled tabs | 180ms transform on the active underscore |
| Row ink | Ledger hover | Background and rule-weight change only; no transform, no shift |

**Reduced motion.** Under `prefers-reduced-motion: reduce` every effect above has a hand-authored
static equivalent that still reads as designed: charts render fully drawn, numerals render at final
value, the stamp renders already struck at −8°, plates render at full opacity with no offset, and
the tab underscore jumps without transition. Nothing is left mid-animation or invisible.

---

## 4. Screen Specifications

Mobile-first; desktop noted as a delta.

### 4.1 Login — the issue cover

Full-bleed cover. The masthead wordmark `CeView` is set in Caslon Display at cover scale beneath a
double rule, with an issue line under it in `label` mono: `VOL. I · CEBU, PHILIPPINES ·
<today's date>`. The three value propositions render as a ruled contents list (Roman numeral,
hairline rule, title in Caslon Text, one-line deck in Karla). The sign-in form is deliberately
*not* the hero: it sits as a small inset plate at the lower right on desktop, and below the
contents list on mobile. The pull-quote from Sunset Dive Co. is set as a Caslon Text italic
standfirst above the fold on desktop.

Behavior unchanged: sign-in / register tabs, error banner, Google button, forgot-password link,
`submitAuth` routing into onboarding or dashboard.

**Desktop delta:** cover fills the viewport; form plate floats over the lower-right sixth.
**Mobile:** vertical stack, masthead → issue line → contents → form.

### 4.2 Onboarding — the ruled spread

Six steps (Basic Info, Brand Identity, Structured Inputs, Business Category, Uniqueness Score,
Assets & Links), matching the current `OB_STEPS` array.

Each step is a two-leaf spread separated by a hairline gutter rule. **Left leaf:** the step numeral
in `figure-xl` Caslon, the step title, framing copy, and the contents list of all six steps with
completed steps struck through and marked with a mono `✓`. **Right leaf:** the fields, using the
new flush/ruled input component. Progress is a hairline rule that fills across the top of the
spread rather than a rounded progress bar.

All existing behavior is preserved exactly: 50-word minimums with live mono word counters on
Description and UVP, free-text Vibe/Theme validation, the category multi-select grid (restyled as
ruled selectable cells with a mono tick), the platform connection rows, disabled-Next gating, and
both score paths.

**Step 5 — Uniqueness Score reveal.** The score is struck as a press stamp (§3.5) over the spread,
with the hairline gauge drawing in beneath it and a one-line AI insight set as a Caslon Text deck.
The low-score path (<60) retains its progressive one-question-at-a-time sequence, each question
presented as a numbered ruled entry with a "Skip for now" mono link, then re-strikes the stamp at
the improved score with the gauge redrawing.

**Desktop delta:** true two-leaf spread. **Mobile:** left-leaf content collapses to a compact
header band (numeral inline with title, contents list hidden behind the progress rule).

### 4.3 Dashboard — the front page

The defining screen. Three bands, top to bottom.

**Band 1 — Masthead.** Double rule, `CeView` wordmark in Caslon, live dateline and business
identity in `label` mono at right, theme toggle and notification bell at far right.

**Band 2 — The lead (airy).** The single hottest surge, at full editorial scale: a `lead`-size
Caslon headline generated from the market and delta (e.g. *"Korean divers, +34%"*), a Caslon Text
italic deck giving the window and the reason, an ink chart of the demand trend with the surge
threshold marked in amber, the forecast figure in `figure-xl` with its delta beneath in mono, and
the `signal` CTA ("Target this market") that hands off into Content Studio via the existing
`targetThisMarket`. Generous whitespace — this band owns the top two-thirds of the desktop viewport.

**Band 3 — The index (dense).** Below the fold, a multi-column ruled index with visible column
rules. Left column: business categories as a ledger (`CATEGORIES`, existing `selectCategory`
behavior, active row marked by a 2px amber left rule). Center/right: the remaining markets as a
ledger table — rank numeral, country-code tile, market name, demand score in mono, week delta with
a typographic arrow, inline 60px sparkline, flight-route status, last-updated in `foot` mono. Rows
open the Market Radar drawer via the existing `openRadar`.

Below the index, a mono footnote strip cites the mock data sources.

The current gradient "next-action band" is removed — its job is absorbed by the lead's CTA.

**Market Radar drawer:** restyled as a ruled column — market header, ink chart, keyword ledger,
seasonal notes as ruled entries, comparison table, "Target this Market" pinned as a `signal`
button above the scroll.

**Desktop delta:** lead runs 8 columns with the figure block in the remaining 4; index runs the
full 12 in three columns. **Mobile:** single column throughout; the index becomes a stacked ledger
with the sparkline and flight-status columns dropped.

### 4.4 Content Studio — the manuscript and the proof

Two columns on desktop: the composer as a ruled manuscript column at left, proofs at right.

**Composer (left):** market context as a mono eyebrow with an ink badge; the caption card with
ruled per-platform tabs (§3.5), an editable textarea in the flush/ruled style with an `AI` ink
badge and a mono character count, and a ghost "Regenerate" that only regenerates the active tab;
the Visual Guide's five aspects as a numbered ruled ledger (I–V, aspect name in Caslon Text,
definition in Karla, Apply tip indented in mono); the pubmat dropzone as a ruled well with corner
registration marks; platform selection as ruled selectable cells; the three configuration toggles
as ledger rows with mono labels and a ruled switch; the agreement checkbox as a ruled entry; and
the publish/save actions.

**Proofs (right):** one proof frame per selected platform, tab-switched, each rendering the
faithful platform mock specified in the prior refinement spec — Instagram 1:1 with caption below
and an icon row, TikTok 9:16 with overlaid bottom-left caption and music note, Facebook wide card
with caption above and a reaction bar. Each frame carries registration marks and a mono caption bar.
Empty state when no platform is selected, in both the caption card and the proof area.

**Board view:** below both columns, the Draft / Scheduled / Published kanban rendered as three ruled
ledger columns with mono column heads and hairline-separated entries rather than shadowed cards.

**Mobile:** composer first, proofs below as a single tabbed frame, board view last.

### 4.5 Calendar — the printed month

Month grid drawn as a true printed table: hairline cell rules, day numerals in mono, month name in
Caslon at masthead scale with a double rule beneath. Posts appear as small ruled ink marks in the
cell, colored by status. Seasonal market events render as tinted horizontal bands spanning the
relevant date range with a mono label, tying back to Dashboard market data.

List view (existing `toggleCalView`) becomes a dated agenda ledger: mono date group heads
(`AUG 7`), each post a ledger row with thumbnail, platform badge, status ink badge, and title.
Existing click behavior is preserved — published posts with mock data open the Analytics modal
pre-filled; drafts and scheduled posts show the Content Studio routing toast.

**Desktop delta:** month grid plus a right-hand ruled column listing the selected date's posts.
**Mobile:** grid stays compact; list view is the recommended default at <640px.

### 4.6 Performance — the ledger

**Top:** KPI figures as a ruled row of four cells — mono `label` head, `figure-xl` Caslon value,
delta with typographic arrow in green/red, and a hairline sparkline. Numerals roll up on load.

**Filters:** ruled tabs, driven by `APP_STATE.connections` exactly as today (All + one tab per
connected platform, reacting live to Settings changes).

**List:** a ledger table, not cards — thumbnail, caption excerpt in Caslon Text, platform ink
badge, publish date in mono, headline metric right-aligned in mono. Row click opens the Analytics
modal.

**Analytics modal:** ruled plate with a mono header, two figure cells, and the ink chart with
draw-in and a mono legend.

**Desktop delta:** four-across KPI row and a full ledger table. **Mobile:** KPI cells stack two-up;
the ledger drops the platform and date columns into a mono sub-line.

### 4.7 Settings — the index

A ruled index list with Roman-numeral sections: **I. Business Profile**, **II. Platforms**,
**III. Workspace**. Each section is a plate with a mono eyebrow and hairline-separated entries.

Business Profile opens the existing edit modal, restyled — flush/ruled fields, mono word counters
on Description and UVP, and the dirty-gated save bar as a ruled footer strip. Platforms render as
ledger rows with a connected state (green `CONNECTED` ink badge + handle) or a `Connect` button,
writing to `APP_STATE.connections`. Workspace lists members as ledger rows with role ink badges and
an "Invite Member" action opening the existing modal.

### 4.8 App shell

**Sidebar** (desktop ≥1024px): a `--plate-sunk` petrol spine, 240px expanded / 72px collapsed.
Sections are listed with Roman numerals in mono (`I DASHBOARD`, `II CONTENT STUDIO`, …) in
uppercase Karla. The active item is marked by a 2px `--signal` left rule and a shift to full
`--text` weight — no filled pill. Unread badge is a mono numeral in a ruled square. Brand block at
top uses the Caslon wordmark under a hairline rule; the collapse control sits under a rule at the
bottom.

**Masthead** (all widths): dateline and business identity in mono, theme toggle, notification bell.

**Bottom tabs** (mobile <1024px): retained; restyled as a ruled strip, active tab marked by a top
underscore and a mono label rather than a color-filled icon.

**Dev jump-bar:** retained, restyled as a small ruled colophon chip in the lower-left reading
`COLOPHON` with the view shortcuts as mono links, including the low-score onboarding shortcut.

---

## 5. Mock Data

The demo content is rewritten to be specific and believable — the almanac concept collapses if the
copy reads as placeholder.

- Business persona stays **Sunset Dive Co., Mactan**.
- Dive sites and locations use real Cebu references (Kontiki, Marigondon Cave, Nalusuan, Olango
  Channel, Moalboal, Malapascua).
- Markets expand beyond the current set with plausible demand scores, week deltas, direct-flight
  status, and seasonal notes (Korea, Japan, USA, Australia, Singapore, Taiwan, China).
- The masthead dateline renders the actual current date at load.
- Every data block carries a `foot`-mono source footnote (e.g. `SOURCE · CEVIEW DEMAND MODEL v2 ·
  SAMPLE DATA`), which both reinforces the almanac voice and makes the fictional nature explicit.
- Figures are internally consistent: a market's dashboard score, drawer chart, and any Content
  Studio reference to it must agree.

---

## 6. Verification

Manual, in-browser, at 375px / 768px / 1440px, in both themes:

1. All seven views reachable; no console errors; no horizontal scroll at any width.
2. Theme toggle flips every surface — no hardcoded colors survive in either theme.
3. Onboarding: both score paths complete; word counters gate Next; category multi-select and
   connection rows work.
4. Content Studio: platform chips drive both caption tabs and proof frames; empty states appear
   when no platform is selected; regenerate affects only the active tab.
5. Settings → Platforms connect/disconnect changes Performance filter tabs without reload.
6. Calendar: grid ↔ list toggle; mock published posts open pre-filled analytics.
7. `prefers-reduced-motion: reduce`: every screen renders complete and designed, nothing invisible
   or mid-animation.
8. Keyboard: all interactive elements reachable, focus visible against both canvases.

---

## 7. Out of Scope

- No changes to the real `ceview/` React frontend. This is prototype-only.
- No backend, persistence, OAuth, or real forecasting. All state resets on reload.
- No real photography — image areas remain ruled placeholder wells.
- No new runtime dependencies. Google Fonts and lucide remain the only CDN loads.
- No IA changes: the five app sections, six onboarding steps, and all existing flows are fixed.
- Claude will not commit or push. The user commits.
