# Dashboard UI/UX Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the Dashboard screen of `ui-ux-prototype.html` (markup, CSS, mock data, and JS behavior for `#screen-dashboard` and its two drawers only) as a dense, tabular, teal-primary forecasting-instrument UI, using real production data shapes from `ceview/constants.ts`/`ceview/types.ts`, while leaving every other screen byte-for-byte untouched.

**Architecture:** Additive CSS (new `--dash-*` tokens and new `.dash-*` component classes appended to the existing `<style>` block; no existing token or shared class — `.card`, `.badge-*`, `.btn-*`, `--brand-primary`, etc. — is redefined, so every other screen is provably unaffected). New mock data (`MARKETS` full-fidelity rewrite, new `NOTIFICATIONS` array) replaces the current 3-field stub. New/rewritten JS functions render the left panel (category-first notifications), right panel (dense market ledger), and the Market Radar drawer (full `Market` detail with a working chart and Economic Insights tabs), plus three new dev-jump-bar-reachable states.

**Tech Stack:** Single self-contained HTML file. Vanilla JS, no build step, no framework. Lucide icons (already CDN-loaded, unchanged). No new dependencies.

**Spec:** [`docs/superpowers/specs/2026-08-06-dashboard-overhaul-design.md`](../specs/2026-08-06-dashboard-overhaul-design.md)

---

## Working Notes for the Implementer

**Read the spec first.** It is the authority on design rationale (why teal, why category-first, why the notification→market highlight instead of a drawer). This plan supplies the exact code; the spec supplies the "why." Where they disagree, the spec wins — flag it and stop.

**No test framework exists for this file.** It's a standalone artifact at the repo root; `ceview/`'s Vitest and the root `e2e/` Playwright suite do not cover it and must not be extended to. Every task therefore ends with a **Verify** step listing exact browser observations instead of an automated test run. Perform them literally — open the file in a browser, look, click, confirm. Do not mark a task done because the code "looks right."

**You will not commit.** This repository's `CLAUDE.md` forbids `git commit` and `git push` under all circumstances. Each task ends with a checkpoint telling the human what command to run. Stop and hand back; do not run it yourself.

**Token scoping rule — do not violate this.** All new CSS custom properties use the `--dash-` prefix specifically so they cannot collide with or override the existing global tokens (`--brand-primary`, `--text-primary`, `--surface-page`, etc.) that every other screen still depends on. All new component classes use a `.dash-` prefix for the same reason — never add rules to `.card`, `.badge-published`, `.btn-primary`, or any other class name already used outside the Dashboard screen. If a task ever asks you to touch a selector without a `dash-` prefix, stop and confirm with the human first; that would be scope creep into other screens.

**Baseline line references** below point at the current file, before any edits in this plan. Once Task 2 lands, line numbers shift — after that, locate code by function name or the `/* ===== ... ===== */` comment banners, not by line number.

**Field-value fidelity.** Task 3's `MARKETS` array values (names, scores, distances, insight paragraphs, chart data) are copied verbatim from `ceview/constants.ts` lines 254–413 (the real production `MOCK_MARKETS`). Do not paraphrase or "improve" this text — if you think a value looks wrong, it should still match the source file exactly; flag the discrepancy to the human rather than silently fixing it.

---

## File Structure

One file changes, in four regions:

| Region (current approx. location) | Responsibility after this plan |
|---|---|
| `<style>` block, new region appended at its end | `--dash-*` tokens + all `.dash-*` component classes (Task 2) |
| `<body>`, `<section id="screen-dashboard">` (~line 455–501) | Header/context line, left panel container, right panel container (Tasks 4, 5, 9) |
| `<body>`, `#radar-drawer` (~line 519–552) | Drawer shell with empty containers for JS-driven content (Task 6) |
| `<script>`, DASHBOARD region (~line 947) + INIT region (~line 1504) + dev jump-bar (~line 1514) | `MARKETS`, `NOTIFICATIONS` data; all render/interaction functions; new jump-bar states (Tasks 3, 4, 5, 6, 7, 8, 9, 10) |

---

## Task 1: Preflight

**Files:** none modified.

- [ ] **Step 1: Confirm the working copy is safe**

Run:

```bash
git -C "c:/Users/austi/CeView" status --short ui-ux-prototype.html
```

Expected: **no output**, meaning the file is clean and this plan cannot destroy unsaved work.

If it prints ` M ui-ux-prototype.html`, **STOP**. Report to the human and wait. They must run one of the following themselves (Claude does not commit in this repository):

```bash
git -C "c:/Users/austi/CeView" add ui-ux-prototype.html && git -C "c:/Users/austi/CeView" commit -m "wip: prototype before dashboard overhaul"
# or
git -C "c:/Users/austi/CeView" stash push ui-ux-prototype.html
```

Do not proceed until the working copy is clean.

---

## Task 2: Design tokens and component CSS

**Files:**
- Modify: `ui-ux-prototype.html` — append a new block immediately before the closing `</style>` tag.

- [ ] **Step 1: Locate the closing `</style>` tag**

Search the file for `</style>` (there is exactly one, closing the single global stylesheet). Note its line number.

- [ ] **Step 2: Insert the new tokens and component CSS immediately before `</style>`**

```css
/* ============================================================ DASHBOARD OVERHAUL: TOKENS ============================================================ */
:root{
  --dash-brand-900:#063B47;
  --dash-brand-700:#0B5A6B;
  --dash-brand:#0E7490;
  --dash-brand-100:#E1F1F4;
  --dash-brand-050:#F4FAFB;
  --dash-text:#0B2733;
  --dash-text-muted:#5B7480;
  --dash-border:#D3E3E6;
  --dash-border-strong:#9FB9BE;
  --dash-signal:#E2960A;
  --dash-signal-soft:#FFF4DF;
  --dash-positive:#157A56;
  --dash-critical:#B3261E;
  --dash-radius-sm:4px;
  --dash-radius-md:6px;
}

/* ============================================================ DASHBOARD OVERHAUL: LAYOUT ============================================================ */
.dash-context-line{
  font-size:13px; color:var(--dash-text-muted); margin-top:2px;
}
.dash-panel-title{
  font-size:16px; font-weight:600; color:var(--dash-text); margin-bottom:10px;
  display:flex; align-items:center; justify-content:space-between;
}
.dash-panel{
  background:var(--dash-brand-050);
  border:1px solid var(--dash-border);
  border-radius:var(--dash-radius-md);
  overflow:hidden;
}

/* ============================================================ DASHBOARD OVERHAUL: SHARED PRIMITIVES ============================================================ */
.dash-country-tile{
  display:inline-flex; align-items:center; justify-content:center;
  width:28px; height:20px; flex-shrink:0;
  font-family:inherit; font-size:10px; font-weight:700; letter-spacing:.02em;
  color:var(--dash-brand-900); background:#fff;
  border:1px solid var(--dash-border-strong); border-radius:3px;
}
.dash-badge-category{
  display:inline-block; font-size:11px; font-weight:600; letter-spacing:.03em; text-transform:uppercase;
  color:var(--dash-brand); background:var(--dash-brand-100);
  border-radius:var(--dash-radius-sm); padding:3px 8px;
}
.dash-badge-surge{
  display:inline-flex; align-items:center; gap:4px; font-size:11px; font-weight:700;
  color:var(--dash-signal); background:var(--dash-signal-soft);
  border:1px solid var(--dash-signal); border-radius:999px; padding:2px 8px;
}
.dash-figure{ font-variant-numeric:tabular-nums; font-feature-settings:"tnum"; }
.dash-gauge{ position:relative; width:44px; height:4px; background:var(--dash-border); border-radius:999px; overflow:hidden; flex-shrink:0; }
.dash-gauge-fill{ position:absolute; left:0; top:0; bottom:0; background:var(--dash-brand); border-radius:999px; }

/* ============================================================ DASHBOARD OVERHAUL: LEFT PANEL (NOTIFICATIONS) ============================================================ */
.dash-notif-list{ display:flex; flex-direction:column; }
.dash-notif-row{
  position:relative; padding:12px 14px; cursor:pointer;
  border-bottom:1px solid var(--dash-border);
  background:#fff; transition:background 150ms ease;
}
.dash-notif-row:last-child{ border-bottom:none; }
.dash-notif-row:hover{ background:var(--dash-brand-100); }
.dash-notif-row.is-unread::before{
  content:''; position:absolute; left:0; top:0; bottom:0; width:3px; background:var(--dash-signal);
}
.dash-notif-row.is-unread{ background:var(--dash-signal-soft); }
.dash-notif-headline{ font-size:14px; font-weight:600; color:var(--dash-text); margin:6px 0 2px; }
.dash-notif-time{ font-size:12px; color:var(--dash-text-muted); }
.dash-unread-dot{
  display:inline-block; width:7px; height:7px; border-radius:50%; background:var(--dash-signal); margin-left:6px;
}
.dash-teaser{
  margin-top:10px; padding:10px 12px; background:#fff; border:1px solid var(--dash-border);
  border-radius:var(--dash-radius-sm); display:flex; gap:18px; flex-wrap:wrap;
}
.dash-teaser-stat{ display:flex; flex-direction:column; gap:2px; }
.dash-teaser-stat .num{ font-size:16px; font-weight:700; color:var(--dash-brand-900); }
.dash-teaser-stat .lbl{ font-size:11px; color:var(--dash-text-muted); text-transform:uppercase; letter-spacing:.03em; }

/* ============================================================ DASHBOARD OVERHAUL: RIGHT PANEL (MARKET LEDGER) ============================================================ */
.dash-market-list{ display:flex; flex-direction:column; }
.dash-market-row{
  display:flex; align-items:center; gap:12px; padding:12px 14px; cursor:pointer;
  border-bottom:1px solid var(--dash-border); background:#fff;
  border-left:3px solid transparent; transition:background 150ms ease, border-color 150ms ease;
}
.dash-market-row:last-child{ border-bottom:none; }
.dash-market-row:hover{ background:var(--dash-brand-100); }
.dash-market-row.is-selected{ background:var(--dash-brand-100); border-left-color:var(--dash-brand); }
.dash-market-rank{ width:16px; text-align:center; font-size:12px; font-weight:700; color:var(--dash-text-muted); }
.dash-market-name{ font-size:14px; font-weight:600; color:var(--dash-text); }
.dash-market-city{ font-size:12px; color:var(--dash-text-muted); }
.dash-market-flight{ display:flex; align-items:center; gap:4px; font-size:12px; color:var(--dash-text-muted); }
.dash-market-flight.is-direct{ color:var(--dash-positive); }
.dash-market-flight.is-connecting{ color:var(--dash-critical); }
.dash-market-score{ font-size:15px; font-weight:700; color:var(--dash-brand-900); width:28px; text-align:right; }
.dash-market-chevron{ color:var(--dash-text-muted); flex-shrink:0; }

/* ============================================================ DASHBOARD OVERHAUL: SKELETONS & BANNER ============================================================ */
@keyframes dash-shimmer{ 0%{ background-position:-120px 0; } 100%{ background-position:120px 0; } }
.dash-skeleton-row{
  height:52px; margin:0 14px 10px; border-radius:var(--dash-radius-sm);
  background:linear-gradient(90deg, var(--dash-border) 25%, var(--dash-brand-100) 37%, var(--dash-border) 63%);
  background-size:240px 100%; animation:dash-shimmer 1.4s ease-in-out infinite;
}
.dash-empty-msg{ padding:24px 14px; text-align:center; color:var(--dash-text-muted); font-size:13px; }
.dash-banner-ai-down{
  display:flex; align-items:center; gap:10px; padding:10px 14px; margin-bottom:16px;
  background:var(--dash-signal-soft); border:1px solid var(--dash-signal); border-radius:var(--dash-radius-sm);
  font-size:13px; color:var(--dash-brand-900);
}
.dash-banner-ai-down button{ margin-left:auto; background:none; border:none; cursor:pointer; color:var(--dash-brand-900); }

/* ============================================================ DASHBOARD OVERHAUL: DRAWER ============================================================ */
.dash-drawer-header{ display:flex; align-items:center; gap:10px; }
.dash-drawer-directive{
  background:var(--dash-brand-050); border:1px solid var(--dash-border); border-radius:var(--dash-radius-md);
  padding:14px; font-size:14px; color:var(--dash-text); line-height:1.5; margin:16px 0;
}
.dash-flight-grid{
  display:grid; grid-template-columns:1fr 1fr; gap:12px 20px; margin-bottom:16px;
}
.dash-flight-stat .lbl{ font-size:11px; color:var(--dash-text-muted); text-transform:uppercase; letter-spacing:.03em; }
.dash-flight-stat .val{ font-size:14px; font-weight:600; color:var(--dash-text); margin-top:2px; }
.dash-airline-ledger{ width:100%; border-collapse:collapse; font-size:13px; margin-bottom:20px; }
.dash-airline-ledger th{ text-align:left; font-size:11px; text-transform:uppercase; letter-spacing:.03em; color:var(--dash-text-muted); padding:6px 8px; border-bottom:1px solid var(--dash-border-strong); }
.dash-airline-ledger td{ padding:8px; border-bottom:1px solid var(--dash-border); color:var(--dash-text); }
.dash-airline-ledger td.dash-figure{ text-align:right; }
.dash-chart-toggle{ display:flex; gap:0; margin-bottom:10px; }
.dash-chart-toggle button{
  flex:1; padding:6px 0; font-size:12px; font-weight:600; background:#fff; color:var(--dash-text-muted);
  border:1px solid var(--dash-border-strong); cursor:pointer;
}
.dash-chart-toggle button:first-child{ border-radius:var(--dash-radius-sm) 0 0 var(--dash-radius-sm); }
.dash-chart-toggle button:last-child{ border-radius:0 var(--dash-radius-sm) var(--dash-radius-sm) 0; border-left:none; }
.dash-chart-toggle button.is-active{ background:var(--dash-brand); color:#fff; border-color:var(--dash-brand); }
.dash-econ-tabs{ display:flex; gap:16px; border-bottom:1px solid var(--dash-border-strong); margin:20px 0 14px; }
.dash-econ-tab{
  padding:8px 0; font-size:13px; font-weight:600; color:var(--dash-text-muted); background:none; border:none;
  border-bottom:2px solid transparent; cursor:pointer; margin-bottom:-1px;
}
.dash-econ-tab.is-active{ color:var(--dash-brand); border-bottom-color:var(--dash-brand); }
.dash-econ-panel{ display:none; }
.dash-econ-panel.is-active{ display:block; }
.dash-calendar-grid{ display:grid; grid-template-columns:repeat(6,1fr); gap:6px; margin:12px 0; }
.dash-calendar-cell{
  padding:8px 4px; text-align:center; font-size:11px; font-weight:600; color:var(--dash-text-muted);
  background:#fff; border:1px solid var(--dash-border); border-radius:var(--dash-radius-sm);
}
.dash-calendar-cell.is-peak{ background:var(--dash-signal-soft); color:var(--dash-brand-900); border-color:var(--dash-signal); }
```

- [ ] **Step 3: Verify — CSS added without breaking other screens**

Open `ui-ux-prototype.html` in a browser. Open DevTools console.

Expected:
- No console errors.
- Dashboard screen is visually **unchanged** so far (markup hasn't been touched yet — new CSS classes aren't referenced by any element yet).
- Click through Login → Onboarding → Content Studio → Calendar → Performance → Settings via the dev jump-bar. All look pixel-identical to before this task (this proves the new tokens/classes are additive and non-colliding).

- [ ] **Step 4: Checkpoint**

Tell the human: "Task 2 complete — new `--dash-*` tokens and `.dash-*` component CSS added, verified no visual change to any screen. Ready for Task 3. Commit if you'd like a checkpoint before I continue: `git add ui-ux-prototype.html && git commit -m \"style: add dashboard-scoped design tokens and component CSS\"`"

---

## Task 3: Replace mock data — real `Market[]` and new `Notification[]`

**Files:**
- Modify: `ui-ux-prototype.html`, the `/* ============================================================ DASHBOARD: market cards ============================================================ */` region (currently ~line 947–965).

- [ ] **Step 1: Replace the existing `MARKETS` constant and `buildMarketCards()` function**

Find this exact block:

```js
/* ============================================================ DASHBOARD: market cards ============================================================ */
const MARKETS = [
  {flag:'🇰🇷', name:'Korea', trend:'+34%', up:true, pts:"0,30 20,28 40,29 60,20 80,22 100,10"},
  {flag:'🇺🇸', name:'USA', trend:'+6%', up:true, pts:"0,25 20,24 40,20 60,22 80,18 100,15"},
  {flag:'🇯🇵', name:'Japan', trend:'-2%', up:false, pts:"0,15 20,18 40,16 60,20 80,22 100,24"},
];
function buildMarketCards(){
  document.getElementById('market-cards').innerHTML = MARKETS.map(m=>`
    <div class="card" style="min-width:220px; cursor:pointer;" onclick="openDrawer('radar-drawer')">
      <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
        <span style="font-size:20px;">${m.flag}</span><span class="body-emphasis">${m.name}</span>
      </div>
      <svg viewBox="0 0 100 34" class="sparkline"><polyline fill="none" stroke="${m.up?'#0F7A4E':'#A70000'}" stroke-width="2.5" points="${m.pts}"/></svg>
      <div class="badge ${m.up?'badge-published':'badge-alert'}" style="margin-top:8px;">
        <span data-lucide="${m.up?'trending-up':'trending-down'}" style="width:12px;height:12px;"></span> ${m.trend}
      </div>
    </div>`).join('');
  renderIcons();
}
```

Replace it entirely with:

```js
/* ============================================================ DASHBOARD OVERHAUL: DATA ============================================================ */
/** Real production Market records, reused verbatim from ceview/constants.ts MOCK_MARKETS. */
const MARKETS = [
  {
    id: 'korea', rank: 1, name: 'South Korea', city: 'Seoul', matchScore: 91,
    directive: 'South Korean demand is surging. Activate Korean-language social content and partner with K-travel influencers this week to capture peak booking intent before your competitors do.',
    directFlight: true, flightHours: '3 hr 45 min', distanceKm: 2640,
    nearestAirport: "ICN — Incheon Int'l", destinationAirport: "CEB — Mactan-Cebu Int'l",
    accessibilityScore: 9, flightFrequency: 14, avgFlightPrice: '₱8,200 – ₱14,500',
    airlines: [
      { name: 'Korean Air', code: 'KE', frequency: '7x / week', direct: true, duration: '3h 45m', tier: 'Full-Service' },
      { name: 'Cebu Pacific', code: '5J', frequency: '5x / week', direct: true, duration: '3h 50m', tier: 'Budget' },
      { name: 'AirAsia Philippines', code: 'Z2', frequency: '2x / week', direct: true, duration: '4h 00m', tier: 'Budget' },
    ],
    peakMonths: ['Jul', 'Aug', 'Dec', 'Jan'],
    economyInsight: 'A stronger Korean Won means Korean visitors currently have roughly 15–20% more purchasing power in Cebu than last year. They are more likely to upgrade accommodations, book premium dive tours, and spend generously on dining. This is the right time to upsell premium packages.',
    seasonalityInsight: 'Korean tourists peak during school summer holidays (July–August) and winter break (December–January). Your biggest revenue window is 6 weeks before these periods — start promotions early to capture early planners who book ahead.',
    chartData: [
      { week: 'Wk -3', history: 55, forecast: null, seasonality: 52, forex: 10.2, gdp: 2.1, spike: 0 },
      { week: 'Wk -2', history: 62, forecast: null, seasonality: 55, forex: 10.4, gdp: 2.1, spike: 0 },
      { week: 'Wk -1', history: 58, forecast: null, seasonality: 58, forex: 10.3, gdp: 2.2, spike: 0 },
      { week: 'Current', history: 74, forecast: 89, seasonality: 64, forex: 10.7, gdp: 2.3, spike: 1 },
      { week: 'Wk +1', history: null, forecast: 85, seasonality: 70, forex: 10.9, gdp: 2.4, spike: 0 },
      { week: 'Wk +2', history: null, forecast: 78, seasonality: 68, forex: 10.8, gdp: 2.3, spike: 0 },
      { week: 'Wk +3', history: null, forecast: 74, seasonality: 65, forex: 10.7, gdp: 2.3, spike: 0 },
      { week: 'Wk +4', history: null, forecast: 70, seasonality: 62, forex: 10.6, gdp: 2.2, spike: 0 },
    ],
  },
  {
    id: 'japan', rank: 2, name: 'Japan', city: 'Osaka', matchScore: 83,
    directive: 'Japanese Golden Week creates a predictable 6-week demand window. Lock in tour packages and upgrade hotel bundles now — Japanese travelers research extensively online before booking, so early visibility wins the sale.',
    directFlight: true, flightHours: '2 hr 50 min', distanceKm: 1980,
    nearestAirport: "KIX — Kansai Int'l", destinationAirport: "CEB — Mactan-Cebu Int'l",
    accessibilityScore: 8, flightFrequency: 10, avgFlightPrice: '₱7,500 – ₱12,000',
    airlines: [
      { name: 'Philippine Airlines', code: 'PR', frequency: '5x / week', direct: true, duration: '2h 50m', tier: 'Full-Service' },
      { name: 'Cebu Pacific', code: '5J', frequency: '3x / week', direct: true, duration: '3h 05m', tier: 'Budget' },
      { name: 'Peach Aviation', code: 'MM', frequency: '2x / week', direct: true, duration: '3h 00m', tier: 'Budget' },
    ],
    peakMonths: ['Apr', 'May', 'Aug', 'Mar'],
    economyInsight: 'The Japanese Yen has been gradually recovering. Japanese tourists are value-conscious — they respond strongly to bundled packages (flight + hotel + tour) that show a clear total saving vs. booking separately. Highlight all-inclusive pricing in your marketing materials.',
    seasonalityInsight: "Golden Week (late April–early May) is Japan's biggest travel surge — plan for 2x normal booking volume. A secondary peak happens in August (O-bon holiday). Start campaigns 8 weeks before each window for maximum exposure.",
    chartData: [
      { week: 'Wk -3', history: 40, forecast: null, seasonality: 45, forex: 0.37, gdp: 1.4, spike: 0 },
      { week: 'Wk -2', history: 48, forecast: null, seasonality: 50, forex: 0.38, gdp: 1.4, spike: 0 },
      { week: 'Wk -1', history: 55, forecast: null, seasonality: 56, forex: 0.38, gdp: 1.5, spike: 0 },
      { week: 'Current', history: 63, forecast: 70, seasonality: 61, forex: 0.39, gdp: 1.5, spike: 0 },
      { week: 'Wk +1', history: null, forecast: 76, seasonality: 68, forex: 0.40, gdp: 1.6, spike: 0 },
      { week: 'Wk +2', history: null, forecast: 82, seasonality: 74, forex: 0.40, gdp: 1.6, spike: 1 },
      { week: 'Wk +3', history: null, forecast: 78, seasonality: 72, forex: 0.41, gdp: 1.7, spike: 0 },
      { week: 'Wk +4', history: null, forecast: 74, seasonality: 70, forex: 0.41, gdp: 1.7, spike: 0 },
    ],
  },
  {
    id: 'usa', rank: 3, name: 'United States', city: 'Los Angeles', matchScore: 71,
    directive: "US summer travel (June–August) and the holiday window (December) are your two key windows for this high-spending market. Americans book 6–10 weeks in advance — launch English-language content with clear value pricing now to capture the long-haul planners searching today.",
    directFlight: false, flightHours: '16h+ (via MNL)', distanceKm: 11027,
    nearestAirport: "LAX — Los Angeles Int'l", destinationAirport: "MNL — Ninoy Aquino Int'l",
    accessibilityScore: 3, flightFrequency: 3, avgFlightPrice: '₱28,000 – ₱45,000',
    airlines: [
      { name: 'Philippine Airlines via Manila', code: 'PR', frequency: '3x / week (via MNL)', direct: false, duration: '16h+', tier: 'Full-Service' },
    ],
    peakMonths: ['Jun', 'Jul', 'Aug', 'Dec'],
    economyInsight: 'The US Dollar is among the strongest currencies against the Philippine Peso — Americans can spend roughly ₱56–58 per USD. This makes Cebu an exceptional value destination for US visitors, with their average daily budget of ₱12,000–18,000 well above most other markets. Target premium and adventure experiences to maximise yield.',
    seasonalityInsight: "US travelers peak during summer holidays (June–August) and Christmas–New Year (late December). The long-haul distance means Americans plan trips 2–3 months ahead — start campaigns in April for the summer window and in October for December. Highlight unique Cebu experiences (freediving, whale sharks, heritage tours) that justify the long flight.",
    chartData: [
      { week: 'Wk -3', history: 42, forecast: null, seasonality: 44, forex: 56.8, gdp: 2.6, spike: 0 },
      { week: 'Wk -2', history: 48, forecast: null, seasonality: 50, forex: 57.1, gdp: 2.7, spike: 0 },
      { week: 'Wk -1', history: 55, forecast: null, seasonality: 56, forex: 57.4, gdp: 2.7, spike: 0 },
      { week: 'Current', history: 63, forecast: 63, seasonality: 62, forex: 57.6, gdp: 2.8, spike: 0 },
      { week: 'Wk +1', history: null, forecast: 70, seasonality: 67, forex: 57.8, gdp: 2.8, spike: 0 },
      { week: 'Wk +2', history: null, forecast: 75, seasonality: 72, forex: 58.0, gdp: 2.9, spike: 0 },
      { week: 'Wk +3', history: null, forecast: 79, seasonality: 76, forex: 58.2, gdp: 2.9, spike: 1 },
      { week: 'Wk +4', history: null, forecast: 74, seasonality: 70, forex: 58.1, gdp: 2.9, spike: 0 },
    ],
  },
];

/** Business profile context shown on Dashboard — matches Module 2's documented "profile context pill". */
const DASH_BUSINESS_NAME = 'Sunset Dive Co.';
const DASH_BUSINESS_CATEGORIES = ['Coastal & Island', 'Adventure & Nature'];

/**
 * Prototype-only extension of the real Notification type (see ceview/types.ts).
 * Production Notification has no `category` field — this array adds one so the left panel
 * can be category-first per the reviewed design. Flagged explicitly in the design spec §1.4.
 * `details` carries only the fields this prototype actually renders (projectedArrivals,
 * arrivalGrowth, topInterests) — not the full real `Notification.details` shape — per YAGNI;
 * a developer wiring this up for real can extend it to the full shape later.
 */
const NOTIFICATIONS = [
  {
    id: 'n1', category: 'Adventure & Nature',
    title: 'Korean diver searches up 34% this week', marketId: 'korea', trend: 'Reef Diving',
    isRead: false, time: '2 hours ago',
    details: {
      projectedArrivals: 8600, arrivalGrowth: 34,
      topInterests: [
        { name: 'Guided Reef Dives', score: 94 },
        { name: 'PADI Certification', score: 81 },
      ],
    },
  },
  {
    id: 'n2', category: 'Coastal & Island',
    title: 'Golden Week prep window opens in 12 days', marketId: 'japan', trend: 'Golden Week',
    isRead: true, time: '2 days ago',
    details: {
      projectedArrivals: 6100, arrivalGrowth: 18,
      topInterests: [
        { name: 'Beachfront Day Trips', score: 88 },
        { name: 'Island Hopping', score: 75 },
      ],
    },
  },
  {
    id: 'n3', category: 'Coastal & Island',
    title: 'US interest steady ahead of long weekend', marketId: 'usa', trend: 'Long-haul Booking',
    isRead: true, time: 'Yesterday',
    details: {
      projectedArrivals: 1900, arrivalGrowth: 6,
      topInterests: [
        { name: 'Liveaboard Dive Trips', score: 72 },
        { name: 'Marine Conservation Tours', score: 65 },
      ],
    },
  },
];
```

Do not add a `buildMarketCards()` or any render function in this task — that's Task 4.

- [ ] **Step 2: Verify — data structure is well-formed**

Open the browser DevTools console on the loaded file and run:

```js
console.log(MARKETS.length, NOTIFICATIONS.length, MARKETS.map(m=>m.id), NOTIFICATIONS.map(n=>n.marketId));
```

Expected output: `3 3 ['korea', 'japan', 'usa'] ['korea', 'japan', 'usa']` — confirms all three notifications map to a real market id, and no syntax errors were thrown loading the page (a syntax error here would make the whole script fail silently and this console command would throw `MARKETS is not defined`).

Note: the Dashboard screen itself will render broken/blank right now, because `buildMarketCards()` no longer exists but `INIT` still calls it — this is expected and fixed in Task 4. Do not attempt to fix it in this task.

- [ ] **Step 3: Checkpoint**

Tell the human: "Task 3 complete — real `Market[]` data and new `Notification[]` mock data added, verified well-formed via console. Dashboard render is intentionally broken until Task 4 lands. Commit if you'd like: `git add ui-ux-prototype.html && git commit -m \"data: replace dashboard mock data with real Market records + notifications\"`"

---

## Task 4: Right panel — dense market ledger

**Files:**
- Modify: `ui-ux-prototype.html`, the Dashboard `<section>` markup (~line 496–499, the "Target Markets" block) and the `INIT` region (~line 1504–1512).

- [ ] **Step 1: Replace the right-panel markup**

Find:

```html
        <div>
          <div class="h2" style="margin-bottom:12px;">Target Markets</div>
          <div class="hscroll" id="market-cards" style="display:flex;"></div>
        </div>
```

Replace with:

```html
        <div>
          <div class="dash-panel-title">Target Markets</div>
          <div class="dash-panel"><div class="dash-market-list" id="market-list"></div></div>
        </div>
```

- [ ] **Step 2: Add `buildMarketList()`, `countryCode()`, `surgeLabel()`, and rewrite `openRadar()`**

Add this immediately after the `NOTIFICATIONS` constant from Task 3:

```js
/** Currently open market in the radar drawer; null when the drawer is closed. */
let selectedMarketId = null;

function countryCode(marketId){
  return { korea: 'KR', japan: 'JP', usa: 'US' }[marketId] || '??';
}

/** Returns a short surge label from a market's chartData, or null if no upcoming/live spike. */
function surgeLabel(chartData){
  const spikeIdx = chartData.findIndex(w => w.spike === 1);
  if(spikeIdx === -1) return null;
  const week = chartData[spikeIdx].week;
  if(week === 'Current') return 'Surge now';
  const m = week.match(/Wk \+(\d+)/);
  return m ? `Surge in ${m[1]}w` : null;
}

function buildMarketList(){
  const wrap = document.getElementById('market-list');
  if(!wrap) return;
  wrap.innerHTML = MARKETS.map(m => {
    const surge = surgeLabel(m.chartData);
    const flightClass = m.directFlight ? 'is-direct' : 'is-connecting';
    const flightLabel = m.directFlight ? `Direct · ${m.flightHours}` : `Via Manila · ${m.flightHours}`;
    return `
    <div class="dash-market-row${selectedMarketId===m.id?' is-selected':''}" data-market-row="${m.id}" onclick="openRadar('${m.id}')" tabindex="0" role="button" aria-label="View ${m.name} market radar">
      <span class="dash-market-rank dash-figure">${m.rank}</span>
      <span class="dash-country-tile">${countryCode(m.id)}</span>
      <div style="flex:1;min-width:0;">
        <div class="dash-market-name">${m.name}</div>
        <div class="dash-market-city">${m.city}</div>
      </div>
      <span class="dash-market-flight ${flightClass}"><span data-lucide="${m.directFlight?'plane':'plane-landing'}" style="width:13px;height:13px;"></span>${flightLabel}</span>
      ${surge ? `<span class="dash-badge-surge"><span data-lucide="zap" style="width:11px;height:11px;"></span>${surge}</span>` : ''}
      <div style="display:flex;align-items:center;gap:6px;">
        <span class="dash-market-score dash-figure">${m.matchScore}</span>
        <span class="dash-gauge"><span class="dash-gauge-fill" style="width:${m.matchScore}%;"></span></span>
      </div>
      <span class="dash-market-chevron" data-lucide="chevron-right" style="width:16px;height:16px;"></span>
    </div>`;
  }).join('');
  renderIcons();
}

function openRadar(marketId){
  selectedMarketId = marketId;
  buildMarketList(); // re-render so the clicked row shows .is-selected
  renderRadarDrawer(marketId);
  openDrawer('radar-drawer');
}
```

- [ ] **Step 3: Update `INIT` and `targetThisMarket()`**

Find (near the end of the script, INIT region):

```js
buildNav();
buildMarketCards();
```

Replace with:

```js
buildNav();
buildMarketList();
```

Find:

```js
function targetThisMarket(){
  closeDrawer('radar-drawer');
  goApp('content');
  showToast('Targeting Korea in Content Studio', 'target');
}
```

Replace with:

```js
function targetThisMarket(){
  const market = MARKETS.find(m => m.id === selectedMarketId);
  const name = market ? market.name : 'this market';
  closeDrawer('radar-drawer');
  goApp('content');
  showToast(`Targeting ${name} in Content Studio`, 'target');
}
```

- [ ] **Step 4: Stub `renderRadarDrawer()` so nothing throws before Task 6**

The drawer's markup still has hardcoded Korea content at this point (Task 6 rewrites it), so add a temporary no-op now to prevent a `ReferenceError`:

```js
/** Rebuilt fully in Task 6 — placeholder for now so openRadar() doesn't throw. */
function renderRadarDrawer(marketId){
  console.log('renderRadarDrawer stub called for', marketId);
}
```

Place it directly after `openRadar()`.

- [ ] **Step 5: Verify — right panel renders and opens the drawer per-market**

Open the file, navigate to Dashboard (`dev jump-bar → dashboard`).

Expected:
- Right panel ("Target Markets") shows 3 rows, vertically stacked, in rank order: South Korea (KR, Seoul, Direct · 3 hr 45 min, score 91, "Surge now" badge), Japan (JP, Osaka, Direct · 2 hr 50 min, score 83, "Surge in 2w" badge), United States (US, Los Angeles, Via Manila · 16h+ (via MNL), score 71, "Surge in 3w" badge).
- No emoji/flags anywhere in this panel.
- Hovering a row shows a visible background change; each row has a trailing chevron.
- Clicking any row: the row gains a left teal rule (`.is-selected`), the drawer slides open (content is still the Task-6-pending stub — that's fine for this task), and the console logs `renderRadarDrawer stub called for korea` (or `japan`/`usa` matching the clicked row).
- Click "Target This Market" inside the (stub) drawer: toast reads "Targeting South Korea in Content Studio" (or the matching market name) — confirms the hardcoded "Korea" bug is fixed.
- No console errors other than the intentional stub `console.log`.

- [ ] **Step 6: Checkpoint**

Tell the human: "Task 4 complete — right panel is now a dense clickable market ledger driven by real data; per-market drawer opening and the dynamic 'Target This Market' toast both verified. Drawer content itself is still a placeholder (Task 6). Commit if you'd like: `git add ui-ux-prototype.html && git commit -m \"feat: rebuild dashboard right panel as dense market ledger\"`"

---

## Task 5: Left panel — category-first notifications with market highlight

**Files:**
- Modify: `ui-ux-prototype.html`, the Dashboard `<section>` markup (~line 462–494, the "Surge Alerts" block) and the `NAV` array badge count (~line 690).

- [ ] **Step 1: Replace the left-panel markup**

Find (the entire "Surge Alerts" block, three hardcoded `<div class="card">` alert items):

```html
        <div>
          <div class="h2" style="margin-bottom:12px;">Surge Alerts</div>
          <div style="display:flex; flex-direction:column; gap:12px;">
            <div class="card" style="border-left:4px solid var(--brand-accent); cursor:pointer;" onclick="openDrawer('radar-drawer')">
              <div style="display:flex; gap:10px; align-items:flex-start;">
                <div style="font-size:22px;">🇰🇷</div>
                <div style="flex:1;">
                  <div class="body-emphasis">Korean traveler searches up 34% this week</div>
                  <div class="caption" style="margin-top:4px;">2 hours ago</div>
                </div>
                <span style="width:9px;height:9px;border-radius:50%;background:var(--brand-accent); margin-top:6px;"></span>
              </div>
            </div>
            <div class="card" style="border-left:4px solid var(--border-subtle); cursor:pointer;">
              <div style="display:flex; gap:10px; align-items:flex-start;">
                <div style="font-size:22px;">🇺🇸</div>
                <div style="flex:1;">
                  <div class="body-emphasis">US interest steady ahead of long weekend</div>
                  <div class="caption" style="margin-top:4px;">Yesterday</div>
                </div>
              </div>
            </div>
            <div class="card" style="border-left:4px solid var(--border-subtle); cursor:pointer;">
              <div style="display:flex; gap:10px; align-items:flex-start;">
                <div style="font-size:22px;">🇯🇵</div>
                <div style="flex:1;">
                  <div class="body-emphasis">Golden Week prep window opens in 12 days</div>
                  <div class="caption" style="margin-top:4px;">2 days ago</div>
                </div>
              </div>
            </div>
          </div>
        </div>
```

Replace with:

```html
        <div>
          <div class="dash-panel-title">Market Signals</div>
          <div class="dash-panel"><div class="dash-notif-list" id="notif-list"></div></div>
        </div>
```

- [ ] **Step 2: Update the screen header to add the profile/category context line**

Find:

```html
      <div class="screen-hd">
        <div class="caption kicker">GOOD AFTERNOON</div>
        <h1 class="h1">Here's what's happening today</h1>
      </div>
```

Replace with:

```html
      <div class="screen-hd">
        <div class="caption kicker">GOOD AFTERNOON</div>
        <h1 class="h1">Here's what's happening today</h1>
        <div class="dash-context-line" id="dash-context-line"></div>
      </div>
```

- [ ] **Step 3: Add `buildNotifications()`, `selectNotification()`, and the context-line renderer**

Add this immediately after `buildMarketList()` / before `openRadar()` from Task 4:

```js
/** id of the currently expanded notification's inline teaser, or null. */
let selectedNotifId = null;

function renderDashContext(){
  const el = document.getElementById('dash-context-line');
  if(!el) return;
  el.textContent = `${DASH_BUSINESS_NAME} · ${DASH_BUSINESS_CATEGORIES.join(', ')}`;
}

function buildNotifications(){
  const wrap = document.getElementById('notif-list');
  if(!wrap) return;
  wrap.innerHTML = NOTIFICATIONS.map(n => `
    <div class="dash-notif-row${n.isRead?'':' is-unread'}" data-notif-row="${n.id}" onclick="selectNotification('${n.id}')" tabindex="0" role="button" aria-label="${n.title}">
      <span class="dash-badge-category">${n.category}</span>${n.isRead?'':'<span class="dash-unread-dot"></span>'}
      <div class="dash-notif-headline">${n.title}</div>
      <div class="dash-notif-time">${n.time} · <span class="dash-country-tile" style="width:auto;padding:1px 5px;height:auto;">${countryCode(n.marketId)}</span></div>
      <div id="teaser-${n.id}"></div>
    </div>`).join('');
  renderIcons();
  updateDashboardBadge();
}

function teaserHTML(n){
  const d = n.details;
  const growthSign = d.arrivalGrowth >= 0 ? '+' : '';
  return `<div class="dash-teaser">
    <div class="dash-teaser-stat"><span class="num dash-figure">${d.projectedArrivals.toLocaleString()}</span><span class="lbl">Projected Arrivals</span></div>
    <div class="dash-teaser-stat"><span class="num dash-figure">${growthSign}${d.arrivalGrowth}%</span><span class="lbl">Arrival Growth</span></div>
    <div class="dash-teaser-stat"><span class="num" style="font-size:13px;font-weight:600;">${d.topInterests.map(i=>i.name).join(', ')}</span><span class="lbl">Top Interests</span></div>
  </div>`;
}

function selectNotification(notifId){
  const notif = NOTIFICATIONS.find(n => n.id === notifId);
  if(!notif) return;

  const wasSelected = selectedNotifId === notifId;
  // clear any previously rendered teaser
  if(selectedNotifId){
    const prevSlot = document.getElementById('teaser-' + selectedNotifId);
    if(prevSlot) prevSlot.innerHTML = '';
  }

  if(wasSelected){
    selectedNotifId = null;
    selectedMarketId = null;
  } else {
    selectedNotifId = notifId;
    selectedMarketId = notif.marketId;
    const slot = document.getElementById('teaser-' + notifId);
    if(slot) slot.innerHTML = teaserHTML(notif);
    const targetRow = document.querySelector(`[data-market-row="${notif.marketId}"]`);
    if(targetRow){
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      targetRow.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest' });
    }
  }
  buildMarketList(); // re-render right panel to reflect the new/cleared highlight
}
```

- [ ] **Step 4: Add `updateDashboardBadge()` and call the two new build/render functions from `INIT`**

Add this function next to `buildNotifications()`:

```js
/** Sets the Dashboard nav badge to the real unread-notification count instead of a hardcoded number. */
function updateDashboardBadge(){
  const unread = NOTIFICATIONS.filter(n => !n.isRead).length;
  const badgeEl = document.querySelector('[data-nav="dashboard"] .nav-badge, [data-nav="dashboard"] [class*="badge"]');
  if(badgeEl) badgeEl.textContent = String(unread);
}
```

Note: `buildNav()` renders the badge markup from the `NAV` array's `badge:3` value — confirm during Step 5 verification which exact class `buildNav()` gives the badge element (inspect via DevTools) and adjust the selector above if it doesn't match on first load; this is expected exploratory work, not a plan error.

In `INIT`, find (as left by Task 4):

```js
buildNav();
buildMarketList();
```

Replace with:

```js
buildNav();
buildMarketList();
buildNotifications();
renderDashContext();
```

- [ ] **Step 5: Verify — left panel renders, highlights the right market, teaser toggles correctly**

Open the file, navigate to Dashboard.

Expected:
- Header shows the new context line: "Sunset Dive Co. · Coastal & Island, Adventure & Nature".
- Left panel ("Market Signals") shows 3 rows. Row 1 ("Korean diver searches up 34% this week") shows the `ADVENTURE & NATURE` badge as the visually dominant element (above the headline), a gold unread dot, and a gold left edge (unread state). Rows 2 and 3 show `COASTAL & ISLAND` badges, no unread dot.
- No emoji/flags anywhere in this panel; each row's timestamp line shows a small `KR`/`JP`/`US` tile.
- Clicking row 1: no drawer opens. The Korea row in the right panel gains the `.is-selected` teal left-rule/background. An inline teaser appears inside row 1 showing "8,600 / Projected Arrivals", "+34% / Arrival Growth", "Guided Reef Dives, PADI Certification / Top Interests".
- Clicking row 2 next: row 1's teaser and highlight clear; Japan's row in the right panel highlights instead; row 2's teaser appears with its own numbers.
- Clicking row 2 again (same row twice): its teaser collapses and the Japan row's highlight clears; nothing in the right panel stays highlighted.
- Sidebar nav badge next to "Dashboard" reads `1` (not the old hardcoded `3`).
- No console errors.

- [ ] **Step 6: Checkpoint**

Tell the human: "Task 5 complete — left panel is category-first, click-to-highlight interaction verified (no drawer opens on left-panel click, teaser toggles correctly), nav badge reflects real unread count. Commit if you'd like: `git add ui-ux-prototype.html && git commit -m \"feat: rebuild dashboard left panel as category-first notification feed\"`"

---

## Task 6: Market Radar drawer — full detail render

**Files:**
- Modify: `ui-ux-prototype.html`, the `#radar-drawer` markup (~line 519–552).

- [ ] **Step 1: Replace the drawer's hardcoded Korea markup with keyed containers**

Find the entire block:

```html
<!-- ---------- Market Radar Drawer ---------- -->
<div class="drawer" id="radar-drawer">
  <div class="drag-handle"></div>
  <div class="drawer-hd">
    <div style="display:flex;align-items:center;justify-content:space-between;">
      <div class="h2">🇰🇷 Korea Market Radar</div>
      <button class="close-x" onclick="closeDrawer('radar-drawer')"><span data-lucide="x"></span></button>
    </div>
  </div>
  <div class="drawer-bd">
    <button class="btn btn-secondary btn-block btn-lg" style="margin-bottom:20px;" onclick="targetThisMarket()">
      <span data-lucide="target"></span> Target This Market
    </button>
    <div class="card" style="margin-bottom:16px;">
      <div class="card-header"><span class="h3">Demand Trend</span><span class="badge badge-published">+34%</span></div>
      <svg viewBox="0 0 300 80" class="sparkline" style="height:70px;">
        <polyline fill="none" stroke="#F4A216" stroke-width="3" points="0,60 40,55 80,58 120,40 160,44 200,25 240,30 300,10"/>
      </svg>
      <div class="caption">Last 30 days · search + inquiry volume</div>
    </div>
    <div class="card" style="margin-bottom:16px;">
      <div class="h3" style="margin-bottom:10px;">Top Keywords</div>
      <div class="chip-grid">
        <span class="chip selected">세부 다이빙</span>
        <span class="chip selected">막탄 스노클링</span>
        <span class="chip selected">필리핀 여행</span>
      </div>
    </div>
    <div class="card">
      <div class="h3" style="margin-bottom:8px;">Seasonal Note</div>
      <p class="body-txt" style="color:var(--text-muted);">Korean school break begins in 3 weeks — historically a 2x booking window for dive operators.</p>
    </div>
  </div>
</div>
```

Replace with:

```html
<!-- ---------- Market Radar Drawer ---------- -->
<div class="drawer" id="radar-drawer">
  <div class="drag-handle"></div>
  <div class="drawer-hd">
    <div class="dash-drawer-header" style="justify-content:space-between;width:100%;">
      <div class="dash-drawer-header" id="radar-drawer-title"></div>
      <button class="close-x" onclick="closeDrawer('radar-drawer')"><span data-lucide="x"></span></button>
    </div>
  </div>
  <div class="drawer-bd">
    <button class="btn btn-secondary btn-block btn-lg" style="margin-bottom:20px;" onclick="targetThisMarket()">
      <span data-lucide="target"></span> Target This Market
    </button>
    <div class="dash-drawer-directive" id="radar-directive"></div>
    <div class="dash-flight-grid" id="radar-flight-block"></div>
    <table class="dash-airline-ledger">
      <thead><tr><th>Airline</th><th>Code</th><th>Frequency</th><th>Direct</th><th>Duration</th><th>Tier</th></tr></thead>
      <tbody id="radar-airlines"></tbody>
    </table>
    <div id="radar-chart-block"></div>
    <div id="radar-econ-block"></div>
  </div>
</div>
```

- [ ] **Step 2: Rewrite `renderRadarDrawer()` to populate header, directive, flight block, and airline ledger**

Find the Task-4 stub:

```js
/** Rebuilt fully in Task 6 — placeholder for now so openRadar() doesn't throw. */
function renderRadarDrawer(marketId){
  console.log('renderRadarDrawer stub called for', marketId);
}
```

Replace with:

```js
function renderRadarDrawer(marketId){
  const m = MARKETS.find(mk => mk.id === marketId);
  if(!m) return;

  document.getElementById('radar-drawer-title').innerHTML =
    `<span class="dash-country-tile">${countryCode(m.id)}</span><span class="h2">${m.name} Market Radar</span>`;

  document.getElementById('radar-directive').textContent = m.directive;

  document.getElementById('radar-flight-block').innerHTML = `
    <div class="dash-flight-stat"><div class="lbl">Distance</div><div class="val dash-figure">${m.distanceKm.toLocaleString()} km</div></div>
    <div class="dash-flight-stat"><div class="lbl">Routing</div><div class="val">${m.directFlight ? 'Direct' : 'Via Manila'} · ${m.flightHours}</div></div>
    <div class="dash-flight-stat"><div class="lbl">Route</div><div class="val">${m.nearestAirport} → ${m.destinationAirport}</div></div>
    <div class="dash-flight-stat"><div class="lbl">Frequency / Avg. Price</div><div class="val dash-figure">${m.flightFrequency}x weekly · ${m.avgFlightPrice}</div></div>
  `;

  document.getElementById('radar-airlines').innerHTML = m.airlines.map(a => `
    <tr>
      <td>${a.name}</td>
      <td class="dash-figure">${a.code}</td>
      <td class="dash-figure">${a.frequency}</td>
      <td>${a.direct ? 'Direct' : 'Connecting'}</td>
      <td class="dash-figure">${a.duration}</td>
      <td>${a.tier}</td>
    </tr>`).join('');

  renderDemandChartBlock(m, '4w');
  renderEconBlock(m, 'purchasing-power');
  renderIcons();
}
```

- [ ] **Step 3: Verify — drawer renders full per-market detail (chart/econ still stubbed)**

Since `renderDemandChartBlock` and `renderEconBlock` don't exist yet (Tasks 7–8 add them), add temporary stubs directly below `renderRadarDrawer()` for this task's verification only:

```js
function renderDemandChartBlock(m, timeframe){ document.getElementById('radar-chart-block').innerHTML = `<p class="caption">Chart placeholder for ${m.id} / ${timeframe}</p>`; }
function renderEconBlock(m, tab){ document.getElementById('radar-econ-block').innerHTML = `<p class="caption">Econ placeholder for ${m.id} / ${tab}</p>`; }
```

Open the file, navigate to Dashboard, click each of the 3 right-panel rows in turn.

Expected for each:
- Korea: header shows `KR South Korea Market Radar`; directive text starts "South Korean demand is surging..."; flight block shows `2,640 km`, `Direct · 3 hr 45 min`, `ICN — Incheon Int'l → CEB — Mactan-Cebu Int'l`, `14x weekly · ₱8,200 – ₱14,500`; airline table has 3 rows (Korean Air, Cebu Pacific, AirAsia Philippines), all marked Direct.
- Japan: directive starts "Japanese Golden Week creates..."; flight block shows `1,980 km`, `Direct · 2 hr 50 min`; 3 airlines, all Direct.
- USA: directive starts "US summer travel..."; flight block shows `11,027 km`, `Via Manila · 16h+ (via MNL)`; airline table has exactly 1 row (Philippine Airlines via Manila), marked Connecting.
- No emoji anywhere in the drawer.
- "Target This Market" still shows the correct dynamic market name in its toast (re-verify from Task 4).
- No console errors.

- [ ] **Step 4: Checkpoint**

Tell the human: "Task 6 complete — Market Radar drawer now renders the full real Market record per market (directive, flight metrics, airline ledger), verified for all 3 markets. Chart and Economic Insights sections are still placeholders (Tasks 7–8). Commit if you'd like: `git add ui-ux-prototype.html && git commit -m \"feat: rebuild market radar drawer with real per-market detail\"`"

---

## Task 7: Demand Forecast Chart with 4wk/12wk toggle

**Files:**
- Modify: `ui-ux-prototype.html`, replacing the Task-6 `renderDemandChartBlock()` stub.

- [ ] **Step 1: Replace the chart stub with the real implementation**

Find:

```js
function renderDemandChartBlock(m, timeframe){ document.getElementById('radar-chart-block').innerHTML = `<p class="caption">Chart placeholder for ${m.id} / ${timeframe}</p>`; }
```

Replace with:

```js
/**
 * Extends a market's real 8-point chartData (Wk -3..Wk +4) with 8 synthetic future points
 * (Wk +5..Wk +12) for the 12-week view. Formula per docs/module-2 spec: future points use
 * Math.cos(offset) x 8 as an offset from the last real forecast value, clamped to [20, 100].
 * Synthetic points are flagged so the renderer can style them distinctly from real data.
 */
function extendToTwelveWeeks(chartData){
  const lastReal = chartData[chartData.length - 1];
  const extended = chartData.slice();
  for(let offset = 5; offset <= 12; offset++){
    const forecast = Math.max(20, Math.min(100, lastReal.forecast + Math.cos(offset) * 8));
    const seasonality = Math.max(20, Math.min(100, lastReal.seasonality + Math.cos(offset) * 6));
    extended.push({
      week: `Wk +${offset}`, history: null,
      forecast: Math.round(forecast), seasonality: Math.round(seasonality),
      forex: lastReal.forex, gdp: lastReal.gdp, spike: 0, synthetic: true,
    });
  }
  return extended;
}

let radarChartTimeframe = '4w';

function renderDemandChartBlock(m, timeframe){
  radarChartTimeframe = timeframe;
  const data = timeframe === '12w' ? extendToTwelveWeeks(m.chartData) : m.chartData;
  const w = 600, h = 200, padTop = 10, padBottom = 24, padX = 8;
  const plotW = w - padX * 2, plotH = h - padTop - padBottom;
  const n = data.length;
  const xFor = i => padX + (i / (n - 1)) * plotW;
  const yFor = v => padTop + plotH - ((v - 0) / 100) * plotH;

  const zoneLow = `<rect x="${padX}" y="${yFor(30)}" width="${plotW}" height="${yFor(0)-yFor(30)}" fill="var(--dash-brand-050)"/>`;
  const zoneMid = `<rect x="${padX}" y="${yFor(70)}" width="${plotW}" height="${yFor(30)-yFor(70)}" fill="var(--dash-brand-100)"/>`;
  const zoneHigh = `<rect x="${padX}" y="${yFor(100)}" width="${plotW}" height="${yFor(70)-yFor(100)}" fill="var(--dash-signal-soft)"/>`;

  const historyPts = data.map((d,i)=> d.history!=null ? `${xFor(i)},${yFor(d.history)}` : null).filter(Boolean).join(' ');
  const forecastPts = data.map((d,i)=> d.forecast!=null ? `${xFor(i)},${yFor(d.forecast)}` : null).filter(Boolean).join(' ');
  const seasonalityPts = data.map((d,i)=> `${xFor(i)},${yFor(d.seasonality)}`).join(' ');
  const seasonalityArea = `${xFor(0)},${yFor(0)} ${seasonalityPts} ${xFor(n-1)},${yFor(0)}`;

  const spikeMarkers = data.map((d,i)=> d.spike===1 ? `<circle cx="${xFor(i)}" cy="${yFor(d.forecast ?? d.history)}" r="4" fill="var(--dash-critical)"/>` : '').join('');
  const syntheticMarkers = data.map((d,i)=> d.synthetic ? `<circle cx="${xFor(i)}" cy="${yFor(d.forecast)}" r="2" fill="var(--dash-signal)" opacity="0.5"/>` : '').join('');

  const axisLabels = data.map((d,i)=> i % 2 === 0 ? `<text x="${xFor(i)}" y="${h-6}" font-size="9" fill="var(--dash-text-muted)" text-anchor="middle">${d.week}</text>` : '').join('');

  document.getElementById('radar-chart-block').innerHTML = `
    <div class="dash-panel-title" style="margin-top:20px;">Demand Forecast</div>
    <div class="dash-chart-toggle">
      <button class="${timeframe==='4w'?'is-active':''}" onclick="renderDemandChartBlock(MARKETS.find(mk=>mk.id==='${m.id}'), '4w')">4 Weeks</button>
      <button class="${timeframe==='12w'?'is-active':''}" onclick="renderDemandChartBlock(MARKETS.find(mk=>mk.id==='${m.id}'), '12w')">12 Weeks</button>
    </div>
    <svg viewBox="0 0 ${w} ${h}" style="width:100%;height:auto;">
      ${zoneLow}${zoneMid}${zoneHigh}
      <polygon points="${seasonalityArea}" fill="var(--dash-brand-100)" opacity="0.6"/>
      <polyline points="${historyPts}" fill="none" stroke="var(--dash-brand)" stroke-width="2"/>
      <polyline points="${forecastPts}" fill="none" stroke="var(--dash-signal)" stroke-width="2" stroke-dasharray="5,4"/>
      ${spikeMarkers}${syntheticMarkers}
      ${axisLabels}
    </svg>
    <div style="display:flex;gap:16px;margin-top:6px;">
      <span class="caption"><span style="display:inline-block;width:8px;height:8px;background:var(--dash-brand);border-radius:50%;margin-right:4px;"></span>History</span>
      <span class="caption"><span style="display:inline-block;width:8px;height:8px;background:var(--dash-signal);border-radius:50%;margin-right:4px;"></span>Forecast</span>
    </div>
  `;
}
```

- [ ] **Step 2: Verify — chart renders and the toggle works**

Open the file, navigate to Dashboard, open the drawer for each market.

Expected:
- A chart renders under "Demand Forecast" with a solid teal history line, a dashed gold forecast line, a faint teal seasonality fill, and three background zone bands (lightest at the bottom, gold-tinted at the top).
- Korea's chart shows a red spike marker at the "Current" data point. Japan's shows one 2 points after "Current". USA's shows one 3 points after "Current".
- Clicking "12 Weeks": the chart re-renders with more points extending past "Wk +4"; the added points render with a small semi-transparent gold dot distinguishing them as synthetic; clicking "4 Weeks" returns to the original 8-point view. Toggle button active state visibly switches.
- No console errors when toggling repeatedly or switching between markets with different timeframes open.

- [ ] **Step 3: Checkpoint**

Tell the human: "Task 7 complete — Demand Forecast Chart with working 4wk/12wk toggle verified across all 3 markets, spike markers confirmed at the correct weeks. Commit if you'd like: `git add ui-ux-prototype.html && git commit -m \"feat: implement demand forecast chart with 4wk/12wk toggle\"`"

---

## Task 8: Economic Insights Board — Purchasing Power and Seasonal Patterns tabs

**Files:**
- Modify: `ui-ux-prototype.html`, replacing the Task-6 `renderEconBlock()` stub.

- [ ] **Step 1: Replace the econ-block stub with the real implementation**

Find:

```js
function renderEconBlock(m, tab){ document.getElementById('radar-econ-block').innerHTML = `<p class="caption">Econ placeholder for ${m.id} / ${tab}</p>`; }
```

Replace with:

```js
const ALL_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/** Builds a small SVG sparkline from an array of numbers, scaled to its own min/max. */
function miniSparkline(values, color){
  const w = 140, h = 40, pad = 3;
  const min = Math.min(...values), max = Math.max(...values);
  const range = (max - min) || 1;
  const pts = values.map((v,i) => {
    const x = pad + (i/(values.length-1)) * (w - pad*2);
    const y = pad + (1 - (v - min)/range) * (h - pad*2);
    return `${x},${y}`;
  }).join(' ');
  return `<svg viewBox="0 0 ${w} ${h}" style="width:140px;height:40px;"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2"/></svg>`;
}

function renderEconBlock(m, tab){
  const latest = m.chartData[m.chartData.length - 1];
  const forexSeries = m.chartData.map(d => d.forex);
  const gdpSeries = m.chartData.map(d => d.gdp);
  const seasonalitySeries = m.chartData.map(d => d.seasonality);

  document.getElementById('radar-econ-block').innerHTML = `
    <div class="dash-econ-tabs">
      <button class="dash-econ-tab ${tab==='purchasing-power'?'is-active':''}" onclick="setEconTab('${m.id}','purchasing-power')">Purchasing Power</button>
      <button class="dash-econ-tab ${tab==='seasonal'?'is-active':''}" onclick="setEconTab('${m.id}','seasonal')">Seasonal Patterns</button>
    </div>
    <div class="dash-econ-panel ${tab==='purchasing-power'?'is-active':''}" id="econ-panel-purchasing-power">
      <div style="display:flex;gap:24px;flex-wrap:wrap;margin-bottom:12px;">
        <div class="dash-teaser-stat"><span class="num dash-figure">${latest.forex}</span><span class="lbl">Latest Forex Rate</span></div>
        <div class="dash-teaser-stat"><span class="num dash-figure">${latest.gdp}%</span><span class="lbl">GDP Growth</span></div>
      </div>
      <p class="body-txt" style="color:var(--dash-text-muted);margin-bottom:12px;">${m.economyInsight}</p>
      <div style="display:flex;gap:16px;flex-wrap:wrap;">
        <div>${miniSparkline(forexSeries, 'var(--dash-brand)')}<div class="caption">Forex trend (8 wks)</div></div>
        <div>${miniSparkline(gdpSeries, 'var(--dash-positive)')}<div class="caption">GDP trend (8 wks)</div></div>
      </div>
    </div>
    <div class="dash-econ-panel ${tab==='seasonal'?'is-active':''}" id="econ-panel-seasonal">
      <div class="dash-calendar-grid">
        ${ALL_MONTHS.map(mo => `<div class="dash-calendar-cell${m.peakMonths.includes(mo)?' is-peak':''}">${mo}</div>`).join('')}
      </div>
      <p class="body-txt" style="color:var(--dash-text-muted);margin:12px 0;">${m.seasonalityInsight}</p>
      ${miniSparkline(seasonalitySeries, 'var(--dash-brand)')}
      <div class="caption">Seasonality index (8 wks)</div>
    </div>
  `;
  renderIcons();
}

function setEconTab(marketId, tab){
  const m = MARKETS.find(mk => mk.id === marketId);
  if(m) renderEconBlock(m, tab);
}
```

- [ ] **Step 2: Verify — tabs switch, real per-market values shown**

Open the file, navigate to Dashboard, open the drawer for each market.

Expected:
- "Purchasing Power" tab (default) shows the market's latest forex/GDP numbers matching its final `chartData` entry (Korea: forex `10.6`, gdp `2.2`; Japan: forex `0.41`, gdp `1.7`; USA: forex `58.1`, gdp `2.9`), the correct `economyInsight` paragraph, and two small sparklines.
- Clicking "Seasonal Patterns": tab switches, calendar grid shows 12 month cells with the correct months highlighted gold per market — Korea: Jul/Aug/Dec/Jan; Japan: Apr/May/Aug/Mar; USA: Jun/Jul/Aug/Dec — the correct `seasonalityInsight` paragraph, and a seasonality sparkline.
- Switching back to "Purchasing Power" works without losing state or throwing errors.
- Opening the drawer for a different market resets the tab to "Purchasing Power" by default.
- No console errors.

- [ ] **Step 3: Checkpoint**

Tell the human: "Task 8 complete — Economic Insights Board (both tabs) verified across all 3 markets, peak-month highlighting confirmed correct per market. Every field specified in the design doc is now rendered in the drawer. Commit if you'd like: `git add ui-ux-prototype.html && git commit -m \"feat: implement economic insights board with purchasing power and seasonal tabs\"`"

---

## Task 9: Emoji audit and consistency pass

**Files:**
- Modify: `ui-ux-prototype.html` — search-and-fix pass across the regions touched by Tasks 3–8, plus the separate bell-icon "Notifications" drawer (~line 554–568), which is out of the redesign's structural scope but still needs its flag emoji removed for consistency with "no emoji anywhere."

- [ ] **Step 1: Search for remaining emoji**

Search the file for the flag emoji used previously: `🇰🇷`, `🇺🇸`, `🇯🇵`. Confirm all matches inside `#screen-dashboard`, `#radar-drawer`, and `#notif-drawer` are gone (Tasks 3–8 should have already removed all of these from `#screen-dashboard` and `#radar-drawer`; `#notif-drawer` was not touched by prior tasks and still has them).

- [ ] **Step 2: Update the separate `#notif-drawer` (bell icon) to use country-code tiles instead of flags**

Find:

```html
<!-- ---------- Notifications Drawer ---------- -->
<div class="drawer" id="notif-drawer">
  <div class="drag-handle"></div>
  <div class="drawer-hd">
    <div style="display:flex;align-items:center;justify-content:space-between;">
      <div class="h2">Notifications</div>
      <button class="close-x" onclick="closeDrawer('notif-drawer')"><span data-lucide="x"></span></button>
    </div>
  </div>
  <div class="drawer-bd" style="display:flex;flex-direction:column;gap:10px;">
    <div class="card"><div class="body-emphasis">🇰🇷 Korean traveler searches up 34%</div><div class="caption">2 hours ago</div></div>
    <div class="card"><div class="body-emphasis">Post "Reef cleanup dive" published to Instagram</div><div class="caption">Yesterday</div></div>
    <div class="card"><div class="body-emphasis">Weekly performance report is ready</div><div class="caption">3 days ago</div></div>
  </div>
</div>
```

Replace the three `<div class="card">` lines with:

```html
    <div class="card"><div class="body-emphasis"><span class="dash-country-tile" style="width:auto;padding:1px 5px;height:auto;margin-right:6px;">KR</span>Korean traveler searches up 34%</div><div class="caption">2 hours ago</div></div>
    <div class="card"><div class="body-emphasis">Post "Reef cleanup dive" published to Instagram</div><div class="caption">Yesterday</div></div>
    <div class="card"><div class="body-emphasis">Weekly performance report is ready</div><div class="caption">3 days ago</div></div>
```

(Only the first line changes — the other two never had emoji.)

- [ ] **Step 3: Verify — zero emoji remain, existing bell-drawer behavior unchanged**

Search the full file again for `🇰🇷`, `🇺🇸`, `🇯🇵`: expect **zero matches** anywhere in the file.

Open the file, navigate to Dashboard, click the bell/notification icon in the topbar (however it's currently triggered — locate via `onclick="openDrawer('notif-drawer')"` if unsure) to confirm this separate drawer still opens/closes correctly and now shows a `KR` tile instead of a flag on its first item, with its other two items unchanged.

No console errors.

- [ ] **Step 4: Checkpoint**

Tell the human: "Task 9 complete — zero emoji remain anywhere in the file, confirmed by full-file search. The separate bell-icon notifications drawer is untouched structurally but now matches the no-emoji rule. Commit if you'd like: `git add ui-ux-prototype.html && git commit -m \"fix: remove all remaining flag emoji, replace with country-code tiles\"`"

---

## Task 10: Loading, empty, and AI-down states via the dev jump-bar

**Files:**
- Modify: `ui-ux-prototype.html`, the dev jump-bar IIFE (~line 1514–1528).

- [ ] **Step 1: Add a dashboard-mode state variable and mode-aware render functions**

Add this near the top of the DASHBOARD OVERHAUL data region (right after `let selectedNotifId = null;` from Task 5):

```js
/** 'normal' | 'loading' | 'empty' | 'ai-down' — drives Dashboard's secondary-state demo. */
let dashboardMode = 'normal';

function setDashboardMode(mode){
  dashboardMode = mode;
  goApp('dashboard');
  buildNotifications();
  buildMarketList();
  renderDashContext();
}
```

- [ ] **Step 2: Make `buildNotifications()` mode-aware**

Find the entire `buildNotifications()` function as Task 5 left it and replace it completely with this version (adds `loading`/`empty`/`ai-down` branches before the existing normal-mode rendering, which is otherwise unchanged):

```js
function buildNotifications(){
  const wrap = document.getElementById('notif-list');
  if(!wrap) return;

  if(dashboardMode === 'loading'){
    wrap.innerHTML = '<div class="dash-skeleton-row"></div><div class="dash-skeleton-row"></div><div class="dash-skeleton-row"></div>';
    return;
  }
  if(dashboardMode === 'empty'){
    wrap.innerHTML = '<div class="dash-empty-msg">No notifications yet. Market trend data will appear here once your profile is analysed.</div>';
    return;
  }

  const banner = dashboardMode === 'ai-down'
    ? `<div class="dash-banner-ai-down"><span data-lucide="alert-triangle" style="width:16px;height:16px;"></span><span>AI Forecast Service Unavailable — alerts below are from your last successful forecast run.</span><button onclick="setDashboardMode('normal')" aria-label="Dismiss"><span data-lucide="x" style="width:14px;height:14px;"></span></button></div>`
    : '';

  wrap.innerHTML = banner + NOTIFICATIONS.map(n => `
    <div class="dash-notif-row${n.isRead?'':' is-unread'}" data-notif-row="${n.id}" onclick="selectNotification('${n.id}')" tabindex="0" role="button" aria-label="${n.title}">
      <span class="dash-badge-category">${n.category}</span>${n.isRead?'':'<span class="dash-unread-dot"></span>'}
      <div class="dash-notif-headline">${n.title}</div>
      <div class="dash-notif-time">${n.time} · <span class="dash-country-tile" style="width:auto;padding:1px 5px;height:auto;">${countryCode(n.marketId)}</span></div>
      <div id="teaser-${n.id}"></div>
    </div>`).join('');
  renderIcons();
  updateDashboardBadge();
}
```

Replace the entire Task-5 version of `buildNotifications()` with this corrected, mode-aware version (this supersedes the intermediate/confusing "Step 2" text above — use this final version verbatim).

Also make `buildMarketList()`'s loading case explicit: find the `buildMarketList()` function from Task 4 and add a loading guard as its first lines:

```js
function buildMarketList(){
  const wrap = document.getElementById('market-list');
  if(!wrap) return;
  if(dashboardMode === 'loading'){
    wrap.innerHTML = '<div class="dash-skeleton-row"></div><div class="dash-skeleton-row"></div><div class="dash-skeleton-row"></div>';
    return;
  }
  wrap.innerHTML = MARKETS.map(m => {
```

(everything after `MARKETS.map(m => {` is unchanged from Task 4).

- [ ] **Step 3: Add the three new dev-jump-bar shortcuts**

Find:

```js
  bar.innerHTML = ['login','onboarding','onboarding-low','dashboard','content','calendar','performance','settings'].map(v=>
```

Replace with:

```js
  bar.innerHTML = ['login','onboarding','onboarding-low','dashboard','dashboard-loading','dashboard-empty','dashboard-ai-down','content','calendar','performance','settings'].map(v=>
```

Find:

```js
    else if(v==='onboarding-low'){ resetOnboardingDemo('low'); document.documentElement.setAttribute('data-view','onboarding'); obIndex=0; obRender(); }
    else { document.documentElement.setAttribute('data-view', v); goApp(v); }
```

Replace with:

```js
    else if(v==='onboarding-low'){ resetOnboardingDemo('low'); document.documentElement.setAttribute('data-view','onboarding'); obIndex=0; obRender(); }
    else if(v==='dashboard-loading'){ document.documentElement.setAttribute('data-view','dashboard'); setDashboardMode('loading'); }
    else if(v==='dashboard-empty'){ document.documentElement.setAttribute('data-view','dashboard'); setDashboardMode('empty'); }
    else if(v==='dashboard-ai-down'){ document.documentElement.setAttribute('data-view','dashboard'); setDashboardMode('ai-down'); }
    else { document.documentElement.setAttribute('data-view', v); goApp(v); }
```

- [ ] **Step 4: Verify — all three states work and normal mode restores correctly**

Open the file. Click each new dev-jump-bar button in turn:

- `dashboard-loading`: both panels show 3 shimmering skeleton rows; no real content or errors.
- `dashboard-empty`: left panel shows the empty message; right panel still shows all 3 real market rows (per spec §4.5 — the right panel is a pure "DB read," independent of notification state).
- `dashboard-ai-down`: the amber banner appears above the left-panel notification list, notifications still render beneath it; clicking the banner's dismiss (×) button calls `setDashboardMode('normal')`, which removes the banner and restores the normal 3-notification view.
- After any of the three, clicking the regular `dashboard` jump-bar button restores the full normal happy-path view (3 notifications, no skeletons, no banner).
- No console errors in any state.

- [ ] **Step 5: Checkpoint**

Tell the human: "Task 10 complete — loading, empty, and AI-down states all verified reachable and correct via the dev jump-bar, normal state restores cleanly after each. Commit if you'd like: `git add ui-ux-prototype.html && git commit -m \"feat: add dashboard loading/empty/ai-down states to dev jump-bar\"`"

---

## Task 11: Final cross-cutting verification pass

**Files:** none modified — verification only, matching the design spec's §6/§7 checklist.

- [ ] **Step 1: Responsive check at three widths**

Using browser DevTools device toolbar, load the Dashboard at 375px, 768px, and 1024px+ widths.

Expected at each width: no horizontal scroll anywhere on the Dashboard screen or its drawers; the right-panel ledger rows remain fully readable (rank, name, flight status, score all visible — wrapping/stacking is acceptable at 375px but no content is cut off or overlapping); the drawer still opens as a bottom sheet on narrow widths, matching its pre-existing `.drawer` behavior.

- [ ] **Step 2: Keyboard pass**

Using Tab/Shift+Tab and Enter/Space only (no mouse):

Expected: every notification row, every market row, the drawer's close button, the "Target This Market" button, the chart's 4wk/12wk toggle buttons, and the Economic Insights tabs are all reachable in a sensible order and operable via keyboard. Focus is visibly indicated on each (browser default outline is acceptable if no custom focus style was added — confirm it isn't invisible against `--dash-brand-050`/`--dash-brand-100` backgrounds).

- [ ] **Step 3: Full spec checklist re-run**

Re-run every item in the design spec's §6 Verification list (9 items) end-to-end in one pass, without stopping to fix anything mid-pass — note any failures, then fix them together at the end and re-run the specific failed items only.

- [ ] **Step 4: Other-screens regression check**

Click through every other screen via the dev jump-bar (Login, Onboarding, Onboarding-low, Content Studio, Calendar, Performance, Settings). Confirm each is visually and functionally identical to how it looked before this plan started (this is the final proof that the `--dash-`/`.dash-` scoping discipline held throughout).

- [ ] **Step 5: Final checkpoint**

Tell the human: "Task 11 complete — full verification pass done across all breakpoints, keyboard access, the spec's 9-item checklist, and a regression check confirming every other screen is untouched. The Dashboard overhaul is ready for your review. Final commit, if you'd like: `git add ui-ux-prototype.html && git commit -m \"feat: complete dashboard UI/UX overhaul\"`. Nothing further will be committed or pushed by me."

---

## Plan Self-Review Notes

*(For the plan author's own use — not a task to execute.)*

- **Spec coverage:** §2 (design system) → Task 2. §4.1 (header/context) → Task 5 Step 2. §4.2 (left panel) → Task 5. §4.3 (right panel) → Task 4. §4.4 (drawer) → Tasks 6–8. §4.5 (states) → Task 10. §4.6 (mobile) → Task 11 Step 1. §5 (mock data) → Task 3. §6 (verification) → Task 11. §7 (out of scope) → enforced throughout via the `--dash-`/`.dash-` scoping rule and the Task 11 Step 4 regression check. No spec section is without a task.
- **Type/naming consistency checked:** `MARKETS`/`m.id`/`marketId` used consistently from Task 3 through Task 10; `selectedMarketId`/`selectedNotifId`/`dashboardMode` each declared once (Tasks 4, 5, 10 respectively) and referenced identically thereafter; `countryCode()`, `surgeLabel()`, `buildMarketList()`, `buildNotifications()`, `renderRadarDrawer()`, `renderDemandChartBlock()`, `renderEconBlock()`, `setEconTab()`, `setDashboardMode()` are each defined exactly once and called with matching argument shapes everywhere they're referenced.
- **Known plan wrinkle:** Task 10 Step 2 originally shows an intermediate/incorrect version of `buildNotifications()` before superseding it with a corrected final version in the same step. This is intentional — it demonstrates the *reasoning* for the final shape (why the `ai-down` branch needs its own `return`) — but the implementer must use only the final, fully-written version, not the intermediate one. Flagged here so it isn't missed.
