# CeView — UI/UX Design Spec

## 1. Overview & Goals

CeView is a marketing intelligence and content platform for Cebu-based MSMEs (small tourism-adjacent businesses — dive shops, cafés, tour operators, craft shops). It watches inbound-tourism demand signals from specific international markets (Korea, USA, Japan, and others), tells an owner when a surge is coming, and helps them produce and publish social content timed to that surge — then reports back on how it performed.

The person using CeView is a busy business owner, not a marketer. They are checking this app between customers, often on a phone. The design must earn trust fast (the numbers need to look credible, not decorative), reduce a wall of marketing jargon into a few clear decisions ("post this, to this market, now"), and never make the owner feel like they need a marketing degree to use it.

**Product principles:**
- **Signal over noise.** Every screen leads with the one number or alert that matters most; supporting detail is progressively disclosed, not dumped.
- **One-handed, on-the-go.** Primary flows (check an alert, approve a post, glance at performance) must work thumb-only on a phone screen.
- **Confidence through clarity.** Predictive/AI-generated content (surge forecasts, captions, visual guides) is always visibly labeled as AI-assisted and always human-approved before it goes anywhere public.
- **Warm but credible.** Visual tone borrows from the brand's coastal-Philippines identity (navy + gold, like a passport stamp or a maritime signal flag) without tipping into either "generic SaaS dashboard" or "tourist brochure."

**Platform constraints:** React 19 + TypeScript SPA, Tailwind utility classes, Plus Jakarta Sans typeface, mobile-first responsive design scaling up to a desktop dashboard layout, brand palette as defined in §3.1.

---

## 2. Information Architecture

Once a business has completed Onboarding, the app is organized around five persistent sections, reachable from a sidebar (desktop) / bottom-tab-plus-drawer (mobile):

```
┌─────────────────────────────────────────────┐
│  Onboarding (first-run gate, one-time)       │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│                 App Shell                    │
│  ┌───────────┬───────────────────────────┐  │
│  │  Sidebar  │                           │  │
│  │           │                           │  │
│  │ Dashboard │      Active Screen        │  │
│  │ Content   │                           │  │
│  │  Studio   │                           │  │
│  │ Calendar  │                           │  │
│  │Performance│                           │  │
│  │ Settings  │                           │  │
│  │           │                           │  │
│  └───────────┴───────────────────────────┘  │
└─────────────────────────────────────────────┘
```

- **Dashboard** — home base. Surge alerts + top target markets. Entry point into everything else.
- **Content Studio** — where AI-assisted posts get drafted, reviewed, and published.
- **Calendar** — when things have gone out (and are scheduled to).
- **Performance** — how published content did.
- **Settings** — business profile, connected platforms, team.

A business profile (name, industry, description, etc.) and a "uniqueness score" (how distinct this business's positioning is vs. competitors) are collected once during Onboarding and are editable afterward from Settings — they are not their own nav destinations, because an owner doesn't visit them day-to-day.

**Cross-screen bridge:** the Dashboard's Market Radar drawer includes a "Target this Market" action that hands off directly into Content Studio with that market pre-selected — this is the app's single most important flow (see §4.3) and should feel like one continuous motion, not two separate screens.

---

## 3. Design System

### 3.1 Color

The palette is a coastal-navy-and-gold identity: navy for structure and trust, gold for attention and warmth, a warm off-white (not stark white) for breathing room.

| Token | Hex | Role |
|---|---|---|
| `brand-primary` | `#0F2854` (Navy) | Sidebar, headers, primary buttons, primary text on light surfaces requiring emphasis |
| `brand-primary-hover` | `#183C7B` (Light Navy) | Hover/pressed state for navy elements |
| `brand-accent` | `#F4A216` (Gold) | Highlights, active-state indicators, secondary CTAs, badges for "new"/"surge" |
| `brand-accent-strong` | `#D48E15` (Dark Gold) | Hover/pressed state for gold elements |
| `brand-accent-soft` | `#FFB941` (Light Gold) | Icon fills, subtle accents, chart highlight series |
| `surface-page` | `#FDFBF7` (Cream) | App background — reduces eye strain vs. pure white |
| `surface-panel` | `#FFFFFF` (White) | Cards, modals, drawers, elevated surfaces |
| `surface-sand` | `#F5E5D1` (Beige) | Secondary panel background for visual separation (e.g. onboarding side panel) |
| `text-primary` | `#0A2342` | Body copy, headings — a deep navy, never pure black |
| `text-muted` | `#64748B` | Secondary text, captions, axis labels, placeholder text |
| `state-critical` | `#A70000` (Red) | Errors, destructive actions, critical/negative-trend alerts |
| `state-critical-alt` | `#ED3F27` (Red-Orange) | Secondary warning tone, e.g. urgent-but-not-destructive banners |
| `state-warning-bg` | `#FFF5DF` (Gold Light) | Warning banner backgrounds (paired with `state-critical-alt` or `brand-accent-strong` text) |
| `state-success-bg` | `#E6F4EE` (Green Light) | Success banners, positive-trend chips |
| `border-subtle` | `#C7D3E2` (Light Grey) | Card borders, dividers, input borders |
| `border-strong` | `#98A7B9` (Navy Light) | Focus rings, active input borders |

**Usage rules:**
- Navy is structural — sidebar, headers, primary buttons, primary CTAs. It is never used for large blocks of body copy background (too heavy at scale).
- Gold is a highlight color, used sparingly: active nav indicator, "surge" badges, star ratings, chart accent series, secondary buttons. It is never used for body text (fails contrast on light surfaces) and never used for more than ~10% of a screen's visual weight.
- Cream (`surface-page`) is the default canvas everywhere; white (`surface-panel`) is reserved for anything that should read as "raised" — cards, modals, drawers.
- Positive/negative trend indicators use `state-success-bg`/green text and `state-critical`/red text respectively, never gold or navy — trend color must be unambiguous at a glance.

### 3.2 Typography

Single typeface: **Plus Jakarta Sans** (weights 400, 500, 600, 700, 800).

| Token | Size / Line-height (mobile) | Size / Line-height (desktop) | Weight | Use |
|---|---|---|---|---|
| `display` | 28px / 34px | 40px / 48px | 800 | Onboarding hero headlines only |
| `h1` | 22px / 28px | 30px / 38px | 700 | Screen titles |
| `h2` | 18px / 24px | 22px / 30px | 700 | Section headers, card titles |
| `h3` | 16px / 22px | 18px / 26px | 600 | Sub-section headers |
| `body` | 14px / 20px | 15px / 22px | 400 | Default copy |
| `body-emphasis` | 14px / 20px | 15px / 22px | 600 | Emphasized inline text, list labels |
| `caption` | 12px / 16px | 12px / 16px | 500 | Metadata, timestamps, axis labels |
| `cta-label` | 12px / 16px | 13px / 18px | 800, uppercase, +0.04em tracking | Button labels |

### 3.3 Spacing, Radius, Elevation, Breakpoints

- **Spacing scale** (4px base): `4, 8, 12, 16, 24, 32, 48, 64`. Default inter-element gap is `16`; card internal padding is `16` (mobile) / `24` (desktop); section gaps are `32`.
- **Radius scale**: `sm=8px` (inputs, chips), `md=12px` (cards), `lg=16px` (modals, drawers), `full` (pills, avatars, badges).
- **Elevation**: three levels — `flat` (no shadow, default page content), `raised` (`0 1px 3px rgba(15,40,84,0.08)` — cards), `overlay` (`0 8px 24px rgba(15,40,84,0.16)` — modals, drawers, dropdowns). Shadows are always navy-tinted, never pure black, to stay warm.
- **Breakpoints** (mobile-first): `base` (0–639px, single column, bottom tab bar), `sm` (640px+, wider single column), `md` (768px+, two-column where relevant, sidebar becomes available as collapsible drawer), `lg` (1024px+, full persistent sidebar + multi-column dashboard), `xl` (1280px+, max content width `1440px` centered).

### 3.4 Iconography

`lucide-react`, stroke-based, 1.5px stroke weight. Standard sizes: `16px` (inline with text/labels), `20px` (nav items, buttons), `24px` (empty states, feature callouts). Icons inherit current text color unless used as a standalone brand mark (surge alerts use `brand-accent`, critical alerts use `state-critical`).

### 3.5 Component Inventory

Each component is specified with its states so it can be built once and reused everywhere, rather than redrawn per screen.

**Button**
- Variants: `primary` (navy fill, white text), `secondary` (gold fill, navy text), `ghost` (transparent, navy text/border), `destructive` (red text/border, red fill on hover).
- States: default, hover, pressed, disabled (40% opacity, no pointer events), loading (spinner replaces label, button stays same width).
- Sizing: `sm` (32px height, for inline/table actions), `md` (44px height, default — meets mobile tap-target minimum), `lg` (52px height, for primary onboarding/publish CTAs).

**Card**
- White surface, `md` radius, `raised` elevation, `16`/`24`px padding. Optional header row (title + trailing action/icon). Used as the atomic container for alerts, metric tiles, board-view content cards, settings sections.

**Input / Select / Textarea**
- White fill, `border-subtle` 1px border, `sm` radius, `44px` min height. Focus state: `border-strong` border + subtle navy focus ring. Error state: red border + caption-sized red helper text below. Label sits above the field (never placeholder-as-label).

**Toggle (switch)**
- Pill-shaped, off = grey track, on = navy track with gold thumb-ring accent. Used for Visibility/Comments/Paid-content config in Content Studio.

**Badge / Chip**
- `full` radius, `caption` text, colored by semantic meaning: gold-soft background for "AI-generated," green-soft for "Published," navy-soft for "Draft," red-soft for "Alert"/"Critical."

**Gauge / Progress**
- Circular gauge (used for Uniqueness Score, Compliance Score, PES score): navy track background, gold progress arc, centered numeric value in `h2` weight. Linear progress bar variant for simpler percent-complete contexts (e.g. onboarding step progress).

**Modal**
- Centered on desktop (max-width `560px`), full-screen sheet on mobile. `overlay` elevation, `lg` radius, scrim `rgba(15,40,84,0.4)` behind.

**Drawer**
- Slides from the right on desktop (fixed width `420px`), full-height. Slides up as a bottom sheet on mobile (max-height 85vh, drag handle at top). Used for Market Radar detail and Analytics detail.

**Toast / Banner**
- Inline banner variant (dismissible, left-accent-bar in semantic color, used for page-level errors, with success/warning/info variants) and a floating toast variant (bottom-center on mobile, bottom-right on desktop, auto-dismiss 4s) for confirmation messages ("Post published," "Changes saved").

**Navigation**
- Desktop: persistent left sidebar (`240px` expanded / `72px` collapsed, icon + label, navy background, gold left-border indicator on active item).
- Mobile: bottom tab bar (5 icons, labels on active only) for the five main sections, plus a top bar with business name/avatar and notification bell. Settings may live behind a "More" icon if five items feel cramped at narrow widths — final call left to prototyping.
- Both: a small unread-count badge (gold circle, white numeral) on the Dashboard nav item when unread surge alerts exist.

---

## 4. Screen-by-Screen Specs

Every screen below is described mobile-first; desktop behavior is noted as a delta, not a separate design.

### 4.1 Auth — Login & Register

**Purpose:** authenticate quickly; this is a chore screen, not a delight screen — get the owner into the app.

- **Layout (mobile):** single column, centered, logo + business tagline at top, form below, `surface-sand` background to differentiate from the app proper.
- **Fields (Login):** email, password, "Sign in with Google" button (primary), "Continue with email" secondary path. Forgot-password link below.
- **Fields (Register):** email, password, confirm password, or Google sign-up. No business info collected here — that's Onboarding's job.
- **States:** default; validating (inline field errors, red border + caption text); submitting (primary button shows loading state, disabled); auth error (banner above form, e.g. "Incorrect email or password"); network error (`ServerErrorBanner`-style dismissible banner).
- **Desktop delta:** form stays centered in a max `440px` card on top of a full-bleed navy or brand-photography background — the one screen allowed a strong navy field, since it's pre-app and sets first impression.
- **Session handling:** on successful sign-in (email/password or Google), the client receives a Firebase ID token. That token is exchanged with the backend for an app session: the client sends the Firebase ID token to the API, the backend verifies it against Firebase and issues the app's own short-lived session token, which the client then attaches to subsequent API calls. A returning user with a still-valid session skips Login entirely and lands on Dashboard (or Onboarding, if incomplete).

### 4.2 Onboarding

**Purpose:** collect what the AI needs to generate on-brand, on-market content. Required, sequential, cannot be skipped — but should feel like a short guided conversation, not a form dump.

- **Layout (mobile):** full-screen, one step per screen, top progress bar (linear progress component, §3.5), back arrow top-left, step title + short helper copy, form fields, primary CTA pinned to bottom ("Next" / "Finish").
- **Steps:**
  1. **Basic Info** — Business Name, Industry (select from list), Slogan (optional).
  2. **Brand Identity** — Vibe/Theme (visual chip-select: e.g. "Adventurous," "Relaxed," "Luxury," "Family-friendly" — multi-select up to 3), Core Services (tag input).
  3. **Structured Inputs** — Full Description (guided textarea with a visible prompt/example, character count) and Unique Value Proposition (shorter structured field, e.g. "What makes you different in one sentence?").
  4. **Assets & Links** — Social Profile handles (per platform, optional per field), Logo upload (optional, drag-and-drop or tap-to-upload, circular preview), Web URL (optional).
  5. **Uniqueness Score reveal** — a distinct celebratory step: circular gauge animates in showing the computed Uniqueness Score, one or two lines of AI-generated insight about what makes the business stand out, primary CTA "Go to Dashboard."
- **Validation:** required fields block "Next" (button disabled state) with inline helper text explaining what's missing; optional fields are visibly marked "(optional)."
- **Desktop delta:** two-column layout — left column (`surface-sand` background) shows step illustration/branding + progress list of all steps (so the user can see how many remain), right column holds the active form. Steps 1–4 are still strictly sequential (no jumping ahead), but completed steps in the left-column list are shown checked.

### 4.3 Dashboard

**Purpose:** the daily-glance screen — "is anything happening I should react to?"

- **Layout (mobile):** single column, stacked top-to-bottom:
  1. Greeting + business name header.
  2. **Surge Alerts** section — vertically stacked alert cards, most recent/urgent first. Each card: market flag/icon, headline (e.g. "Korean traveler searches up 34% this week"), timestamp, unread indicator (gold dot), tap to expand inline or open detail.
  3. **Target Markets** section — horizontally scrollable row of up to 3 locale cards (Korea, USA, Japan style), each showing locale name/flag + a one-line trend summary + small sparkline. Tapping a card opens the Market Radar drawer.
- **Market Radar Drawer** (bottom sheet on mobile, right-side drawer on desktop):
  - **Top:** "Target this Market" primary button (gold, prominent — this is the conversion action of the whole app) pinned above the scrollable content.
  - **Content:** market radar analytics — demand trend chart over time, top search/interest keywords for that market, seasonal notes (tie-in with Calendar), comparison vs. the business's other target markets.
  - Tapping "Target this Market" closes the drawer and navigates into Content Studio with that market pre-selected as campaign context (see §4.4).
- **Empty state:** if no surge alerts exist yet, show a calm empty-state illustration + copy like "No surges detected yet — we're watching your markets." (not an error state — absence of alerts is normal, not broken.)
- **Desktop delta:** true two-pane layout side-by-side (left pane Alerts ~40% width, right pane Target Markets ~60% width as a grid of cards rather than a horizontal scroll), drawer opens as an overlay on the right without navigating away from either pane.

### 4.4 Content Studio

**Purpose:** turn an AI-drafted idea into a published (or scheduled) post, with the owner firmly in control of what actually goes out.

- **Layout (mobile), top to bottom:**
  1. Context chip showing which market this draft is targeting (carried over from Dashboard, editable).
  2. **AI-Generated Caption** card — generated text in an editable textarea, "Regenerate" ghost button, clearly labeled "AI-generated — edit as needed" (gold "AI" badge).
  3. **AI-Generated Visual Guide** card — a short set of AI-suggested visual directions (mood, composition, colors, example reference) to guide what image/video the owner should use — this is guidance text/reference imagery, not an auto-generated final asset.
  4. **Pubmat Upload** zone — drag-and-drop / tap-to-upload dropzone for the owner's own image or video, with preview thumbnail and remove/replace action.
  5. **Platform Selection** — chip/tab multi-select: TikTok, Facebook, Instagram (icon + label per platform, selected state = navy fill).
  6. **Configuration Toggles** — Visibility (public/private), Comments (on/off), Paid Content/Boosted (on/off) — each a labeled Toggle component (§3.5) with a short one-line description of what it does.
  7. **Agreement Checkbox** — "I've reviewed this content and confirm it's accurate and ready to publish" — must be checked before Publish activates.
  8. **Publish Now** primary button (full-width, `lg` size) — disabled until agreement checkbox is checked and at least one platform is selected. Secondary "Save as Draft" ghost button beside/below it.
  9. **Board View** — below the composer (or as a separate tab on mobile to avoid an overlong scroll), a Kanban-style board with columns "Draft" / "Scheduled" / "Published," each post shown as a small Card with thumbnail, platform badges, and status Badge.
- **States:** AI generation loading (skeleton content in caption/visual-guide cards); upload in progress (progress bar on dropzone); publish submitting (button loading state); publish success (toast + card moves to "Published" column in Board View); publish failure (inline banner, content preserved, retry available).
- **Desktop delta:** two-column layout — left column is the composer (steps 1–7 above), right column is a live preview of how the post will look on the selected platform(s), tabbed if multiple platforms selected. Board View becomes a persistent section below, shown as a true multi-column Kanban rather than a mobile tab.

### 4.5 Calendar

**Purpose:** a visual read on posting cadence and timing, especially relative to market seasonality.

- **Layout (mobile):** month view by default (compact grid, dots on dates with published/scheduled content, dot color = platform or status), with a "List" toggle for a scrollable agenda view (better for small screens / many events).
- **Interaction:** tapping a date with content shows a bottom sheet listing that day's posts (thumbnail, platform, status) — tapping a post opens it (read-only if published, editable if still a draft/scheduled, routing into Content Studio).
- **Seasonal context:** notable market events/seasons (e.g. "Golden Week Prep (JP)") shown as subtle background highlight bands or small flag markers on relevant dates, tying back to Dashboard's market data — helps the owner see whether their posting cadence lines up with upcoming demand.
- **Empty state:** month with no content shows a calm prompt ("Nothing scheduled yet") with a CTA into Content Studio.
- **Desktop delta:** full month grid always visible (no list/grid toggle needed at that width), side panel on the right listing the currently-selected date's posts in detail without needing the bottom sheet.

### 4.6 Performance

**Purpose:** show whether published content is working, and let the owner drill into any single post's numbers.

- **Layout (mobile), top to bottom:**
  1. **Recent Performance** — a compact metrics row/carousel at the top: key scores and trend deltas (e.g. engagement rate, reach, a composite performance score) each as a small stat tile with a sparkline and up/down trend indicator (green/red per §3.1 rule).
  2. **Filter Tabs** — All / TikTok / Instagram / Facebook, horizontally scrollable pill tabs, sticky below the header when scrolling.
  3. **Previously Published Content list** — vertical list of Cards, each: thumbnail, caption excerpt, platform badge, publish date, headline metric (e.g. "2.4k engagements"). Tapping opens the Analytics Modal.
- **Analytics Modal:** full-screen sheet on mobile, centered modal on desktop. Shows the full metrics graph set for that single post (time-series engagement, breakdown by metric type), without navigating away from the Performance screen underneath (dismiss returns to the same scroll position).
- **Empty state:** no published content yet → prompt pointing to Content Studio.
- **Desktop delta:** Recent Performance renders as a proper multi-tile grid row (not a carousel) with larger charts; the published-content list becomes a table-like layout (thumbnail + columns) rather than stacked cards, still opening the same Analytics Modal on row click.

### 4.7 Settings

**Purpose:** the "occasionally visited" screen for maintaining account/business setup.

- **Layout (mobile):** simple vertical list of sections, each tappable into its own sub-screen (standard settings pattern):
  1. **Business Profile** — edit everything collected during Onboarding (Basic Info, Brand Identity, Structured Inputs, Assets & Links), same field components as Onboarding for consistency, saved via a persistent "Save Changes" bar that appears once a field is dirty.
  2. **Platforms** — list of TikTok/Facebook/Instagram with connect/disconnect state per platform (connected = green "Connected" badge + account handle shown + "Disconnect" ghost button; not connected = "Connect" primary button triggering that platform's OAuth flow).
  3. **Workspace** — list of current team members (avatar, name, email, role chip), "Invite Member" primary button opening a modal (email input + role select), pending invites shown in a distinct "Pending" state until accepted.
- **Desktop delta:** classic settings layout — a left-hand sub-nav list (Business Profile / Platforms / Workspace) with the selected section's content on the right, rather than mobile's drill-down navigation.

---

## 5. Technical Notes (Implementer Appendix)

This section is implementation-facing and intentionally references the current codebase directly — it exists to help whoever builds this map the design above onto what already exists in the repository.

**Screen → existing code mapping:**
- **Dashboard** → currently split across `components/module-2/2.1-home/HomeView.tsx` (alerts) and `components/module-2/2.2-market-radar/MarketRadarView.tsx` (radar drawer). Combine into the unified Dashboard layout in §4.3; the "Target this Market" → Content Studio handoff already exists as an `onNavigateToContent` callback pattern and should be preserved/formalized.
- **Content Studio** → `components/module-3/3.1-content-studio/ContentStudioView.tsx` already implements most of §4.4 (media dropzone, caption manager, compliance gauge, platform sync panels) — this is largely a visual/token pass plus adding the Board View section if not already present, rather than new build.
- **Calendar** → `old-components/CalendarView.tsx` is the only current implementation and lives outside the `module-N` structure; §4.5 should be newly built into a proper module folder using the design above, and `old-components/CalendarView.tsx` retired once replaced.
- **Performance** → `components/module-4/4.1-campaign-analytics/CampaignAnalyticsView.tsx` covers most of §4.6 (KPI cards, PES gauge, report) — rename/reframe as Performance, add the platform Filter Tabs and Analytics Modal if not already present.
- **Onboarding** → `components/module-1/1.1-business-input/BusinessProfile.tsx` and `components/module-1/1.2-uniqueness-scoring/UniquenessCalibrationView.tsx` contain the underlying data collection and score computation logic already — §4.2 wraps these into a proper sequential first-run wizard rather than standalone nav-accessible screens; the same field logic should be reused for the Settings → Business Profile edit screen (§4.7) rather than duplicated.
- **Settings** → no current implementation; net-new screen. A `Settings` icon already exists unused in `old-components/Sidebar.tsx`, suggesting this was previously planned.
- **Sidebar / navigation** → `layout/Sidebar.tsx` has the collapsible desktop pattern and mobile drawer already; update its item list to the five sections in §2, add the unread-alert badge, and add a bottom tab bar for mobile per §3.5 (currently mobile relies on the drawer only).

**Design tokens → code:**
- `ceview/constants.ts`'s `COLORS` object should be reduced to only the values used in §3.1 (Navy/Gold/Cream family + semantic state colors); the currently-unused Teal/Cyan/Green "ocean" set is dead code and can be removed.
- Tailwind is currently loaded via CDN script tag in `index.html` with no `tailwind.config.js`/`postcss.config.js` in the repo. To codify the tokens in §3.1–3.3 as real Tailwind theme values (colors, font sizes, spacing, radii), the project needs a proper installed Tailwind build (config file + PostCSS + build-time processing) rather than the CDN script. This is a prerequisite for cleanly implementing the design system, not an optional nice-to-have.
- The `index.html` also currently loads React via an `aistudiocdn.com` import map alongside the standard Vite/npm setup — a legacy artifact from an AI Studio export. This should be resolved to a single consistent build approach as part of the same cleanup pass.

**Auth / Firebase integration:**
- Current auth (`services/auth.tsx`, `services/authStorage.ts`, `services/apiClient.ts`) is a custom JWT flow directly against Spring Boot (email/password only, no Firebase). Implementing §4.1's session handling requires: (a) adding the Firebase client SDK for sign-in (Google OAuth + email/password), (b) a new Spring Boot endpoint that accepts a Firebase ID token, verifies it via the Firebase Admin SDK, and issues the app's existing session-token format in return, and (c) updating `authStorage.ts`/`apiClient.ts` only as needed to accommodate the new token-exchange step — the existing "store token, attach to requests, force-logout on 401" plumbing can otherwise be reused as-is.

**Explicitly out of scope for this spec:** no chart-implementation code (chart library choice, series config, exact chart components) is specified here — that belongs to implementation planning, and should draw on the existing `recharts` dependency and this project's dataviz guidance when built.

---

## 6. Open Assumptions & Out-of-Scope

Decisions made by default during this design pass, flagged here for visibility rather than left silent:

- **Workspace roles/permissions** are kept simple — invite and remove members only, no granular role-based permission model (e.g. no "editor vs. viewer" distinction specified). If the product needs finer-grained roles later, that's a separate design pass.
- **Platform OAuth flows** (Settings → Platforms connect/disconnect) are specified only at the UI level (button states, connected/disconnected representation); the actual OAuth handshake per platform (TikTok/Facebook/Instagram) is not designed here.
- **Notification delivery mechanism** for surge alerts (push notification, in-app only, email) is not specified — the Dashboard design assumes alerts simply exist and are readable in-app; delivery channel is a backend/product decision outside UI/UX scope.
- **AI Visual Guide** is specified as guidance/reference content (mood, composition direction) rather than a fully AI-generated final image — if the product intends full AI image generation instead, the Content Studio screen (§4.4) would need a revision pass.
- **Settings nav placement on mobile** (persistent 5th tab vs. behind a "More" menu) is left as a prototyping decision rather than fixed here, since it depends on how the tab bar feels at real device widths.
- Dollar-figure/quantitative thresholds for what counts as a "surge" are a backend/data-science concern and are not defined in this spec.
