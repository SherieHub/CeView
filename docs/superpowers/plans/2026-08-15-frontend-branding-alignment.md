# Frontend Branding Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `frontend/` (styles, layout, components, App.tsx) into full compliance with the `tourism-app-branding` skill — palette, fonts, type scale, buttons, spacing, radius, elevation — without changing any component logic, props, state, API calls, routing, or business logic.

**Architecture:** The app currently runs a *different* design system end-to-end (navy `#0f2854` + gold `#f4a216`, Plus Jakarta Sans, transcribed from `ui-ux-prototype.html`). This is not a patch job; it is a token-layer replacement plus call-site migration. The work is sequenced additively: Phase 0 **adds** the branding tokens alongside the legacy ones so the app builds and renders at every phase boundary; Phases 1–6 migrate call sites; Phase 7 **removes** the legacy tokens and proves nothing references them. Every phase leaves the app green.

**Tech Stack:** React 19, TypeScript, Vite 6, Tailwind CSS v4 (`@theme` block in `frontend/styles/index.css`), Vitest 4 + Testing Library, lucide-react icons.

---

## ⚠️ Read This Before Starting

**1. Do not commit.** `.claude/CLAUDE.md` forbids `git commit` and `git push` in this repository under all circumstances. The writing-plans skill's standard "Step N: Commit" is therefore **replaced** throughout this plan by "Step N: Hand off for commit" — run the verification command and report to the user that the phase is ready for them to commit themselves.

**2. Styling only.** No step in this plan may change a component's props, state, hooks, event handlers, `useEffect` bodies, imports of services, router config, or any conditional that governs behavior. Permitted edits are: `className` strings, `style` attributes, CSS files, `<link>` tags in `index.html`, and adding purely presentational wrapper elements where explicitly called out. If a step seems to require a logic change, stop and escalate.

**3. Source of truth — two authorities, no overlap.** Confirmed by the user 2026-08-15:

> "You must follow the `ui-ux-prototype.html` in terms of the flow of the app, its logic, its details. But in terms of design and branding, follow the branding design skill to make the whole page nice and premium looking and clean."

| Concern | Authority |
|---|---|
| Flow, routing, state machines, validation gates, data shapes | `ui-ux-prototype.html` |
| Structure and detail — what elements exist on a screen, their order, which affordances are present | `ui-ux-prototype.html` |
| Color, typography, buttons, spacing, radius, elevation | `tourism-app-branding` skill |
| Motion, spacing rhythm, layout composition, polish | `frontend-design` skill, layered on top where it doesn't conflict (the branding skill's own Precedence section permits this) |

Practical consequence: where the prototype specifies a *detail* the React port dropped, restore it — but style it per the skill, never per the prototype's CSS. Where the prototype's CSS and the skill disagree, **the skill wins, always**. Two code comments currently assert the prototype as the *styling* source and are corrected in this plan ([`styles/index.css:2`](../../../frontend/styles/index.css) in Phase 0, [`index.tsx:6-7`](../../../frontend/index.tsx) in Phase 1). The ~25 other `ui-ux-prototype.html` references across `frontend/` cite flow, logic, and fixture data — those stay authoritative and are **not** touched.

`ui-ux-prototype.html` itself is **not modified** by this plan.

**4. Approved decisions** (confirmed by the user before this plan was written):
- **Token naming:** adopt the skill's exact variable names (`--color-mint-primary`, not a remapped `--color-gold`).
- **Type scale:** adopt the skill's Section 3 scale fully, mapped onto the existing helper classes; accept that the shell gets larger and do the spacing pass to match.
- **State/platform colors:** keep `critical`/`success`/`ig`/`tt`/`fb`/`nv` as a clearly-labeled non-brand functional group, retuned to harmonize with mint/coral.

---

## Deviation Audit

Every place current styling departs from the skill. The Phase column says where each is fixed.

### `frontend/index.html`

| Line | Current | Skill requires | Phase |
|---|---|---|---|
| 9–12 | Loads **Plus Jakarta Sans** + **JetBrains Mono** | **Poppins** (headings) + **Inter** (body) | 0 |
| 9–12 | JetBrains Mono is a *third* family | §2: "Never mix in a third font family" | 0 |

### `frontend/styles/index.css` — `@theme` tokens (lines 10–84)

| Token | Current | Skill | Phase |
|---|---|---|---|
| `--color-navy` | `#0f2854` | `--color-navy-primary: #1B3A5C` | 0 |
| — | *(absent)* | `--color-navy-dark: #16304D` | 0 |
| `--color-gold` `#f4a216`, `--color-gold-dark`, `--color-gold-light`, `--color-gold-wash`, `--color-yellow` | the gold family carries the primary-action role | Primary action is **mint** `#5FD6A6`; gold is not in the palette | 0, 7 |
| — | *(absent)* | `--color-mint-primary` / `-light` / `-pale` / `-pale-alt` | 0 |
| — | *(absent)* | `--color-coral-cta`, `--color-coral-cta-hover` | 0 |
| `--color-teal` | `#007892` | `--color-teal-accent: #3CBDB1` | 0 |
| `--color-sand` | `#f5e5d1` | `--color-sand: #FFB88C` | 0 |
| `--color-skyblue`, `--color-cyan`, `--color-blue`, `--color-navy-light`, `--color-foliage` | off-palette entirely | no equivalent — remove | 0, 7 |
| `--color-page` | `#fdfbf7` (warm cream) | `--color-off-white: #F7F9FA` | 0 |
| `--color-panel-sunk` | `#f7f4ee` (warm) | `--color-mint-pale: #E4F6EF` | 0 |
| `--color-ink` | `#0a2342` | `--color-text-heading: #1B3A5C` | 0 |
| `--color-muted` | `#64748b` | `--color-text-muted: #8A97A3` | 0 |
| `--color-ink-2`, `--color-grey` | no equivalent | remove | 0, 7 |
| — | *(absent)* | `--color-text-body: #5A6B7A`, `--color-text-inverse`, `--color-text-accent` | 0 |
| `--color-line` | `#e4ded2` (warm beige) | `--color-gray-light: #C9D6DE` | 0 |
| `--color-line-strong`, `--color-line-navy` | off-palette | fold into `--color-gray-light` / `--color-gray-text` | 0, 7 |
| `--radius-sm` | `10px` | `8px` (inputs, small tags) | 0 |
| `--radius-md` | `14px` | `16px` (cards) | 0 |
| — | *(absent)* | `--radius-pill: 24px` (**all** buttons) | 0 |
| `--shadow-1/2/3` | `rgba(15,40,84,…)` — wrong navy, wrong specs | `--shadow-card: 0 4px 20px rgba(27,58,92,.08)`, `--shadow-card-hover: 0 8px 28px rgba(27,58,92,.14)` | 0 |
| `--spacing-*` | numeric 4→64px, **no 80px** | `xs 8 / sm 16 / md 24 / lg 48 / xl 80` | 0 |
| `--font-sans` | Plus Jakarta Sans | split into `--font-heading` (Poppins) + `--font-body` (Inter) | 0 |
| `--font-mono` | JetBrains Mono | third family — remove (`.mono` has zero call sites) | 0, 7 |

### `frontend/styles/index.css` — base/reset (lines 89–173)

| Line | Current | Skill requires | Phase |
|---|---|---|---|
| 99 | `font-size: 14px` | 1rem / 16px base (§3) | 1 |
| 100 | `line-height: 1.55` | `1.6` for body copy | 1 |
| 96 | `background: var(--color-page)` (warm cream) | off-white / white | 1 |
| 104–111 | `h1–h4` get only `margin: 0` — **no** font-family or color rule | §3: `h1,h2,h3,h4 { font-family: var(--font-heading); color: var(--color-text-heading); }` | 1 |
| 104–111 | **no** `p` rule | §3: `p { color: var(--color-text-body); font-size: 1rem; line-height: 1.6; }` | 1 |
| 119–125 | `button` fully reset to `background: none; border: none` — **no** `.btn-primary` / `.btn-cta` / `.btn-outline` exist anywhere in the codebase | §4 mandates exactly three variants | 2 |
| 152 | `::selection` background `--color-gold` | off-palette | 1 |
| 156–160 | `:focus-visible` outline `--color-gold`, `border-radius: 4px` | off-palette; radius not a token | 1 |
| — | **no** `section { padding: var(--space-xl) var(--space-md) }` | §5 | 1 |

### `frontend/styles/index.css` — `@layer components` (lines 178–256)

| Class | Current | Skill | Phase |
|---|---|---|---|
| `.eyebrow` | 10.5px / **800** / uppercase / muted | no equivalent; weight exceeds the 600–700 heading cap. Nearest intent is §3 "Subhead / accent tagline" 1.125rem/500/`text-accent` | 1 |
| `.h-xl` | 30px / 800 | H1 light `2.5rem` / 700 / 1.2 | 1 |
| `.h-lg` | 22px / 800 | H2 `2rem` / 700 / 1.25 | 1 |
| `.h-md` | 17px / 700 | H3 `1.5rem` / 600 / 1.3 | 1 |
| `.h-sm` | 14px / 700 | H4 `1.125rem` / 600 / 1.4 | 1 |
| `.body-sm` | 13px / `--color-muted` | Body `1rem` / 400 / `text-body` / 1.6 | 1 |
| `.body-xs` | 12px / `--color-muted` | Meta `0.875rem` / 400 / `text-muted` / 1.5 | 1 |
| — | *(absent)* | `.subhead-accent`, `.text-meta` (§3 specifies both verbatim) | 1 |
| `.card` | radius 14px, `shadow-1`, **1px border**, **no padding**, **no hover** | radius **16px**, `--shadow-card`, **no border** ("soft shadow"), `padding: var(--space-md)`, `:hover` → `--shadow-card-hover` | 1 |
| `.empty-glyph` | `border-radius: 15px` (arbitrary literal) | `--radius-md` (§5: icon badges use radius-md) | 1 |
| `.empty-glyph` | `background: --color-panel-sunk`, `border: 1px solid --color-line`, `stroke: --color-muted` | §5/§6: mint or teal fill, white/navy iconography | 1 |
| `.empty h3` | 16px / 800 | H3 `1.5rem` / 600 | 1 |
| `.empty p` | 13px / muted | Body `1rem` / `text-body` | 1 |
| `.sb-sec` | referenced in `Sidebar.tsx:30` but **never defined** — dead class | — | 3 |

### `frontend/layout/`

| File:line | Current | Deviation | Phase |
|---|---|---|---|
| `AppShell.tsx:15` | `bg-page p-6` | warm-cream page background | 3 |
| `Sidebar.tsx:23` | `border-r border-line bg-panel` — **white** sidebar | §1: "Navbar / footer background → `--color-navy-primary`" | 3 |
| `Sidebar.tsx:24` | wordmark uses `.eyebrow` + `text-navy` | 10.5px/800 uppercase standing in for a brand mark; not the heading font | 3 |
| `Sidebar.tsx:30` | section labels `.sb-sec eyebrow` | `.eyebrow` deviation + dead `.sb-sec` | 3 |
| `Sidebar.tsx:45,56` | `rounded-md` (14px) nav rows, `hover:bg-panel-sunk` | wrong radius token, warm hover | 3 |
| `Sidebar.tsx:49,62` | nav labels `.h-sm` = 14px/**700** | §3 Nav link: body font, `0.9375rem`, weight **500** | 3 |
| `Sidebar.tsx:57` | active state `bg-gold-wash text-navy` | gold is off-palette | 3 |
| `Sidebar.tsx:64` | badge `rounded-full bg-critical px-1.5 text-[10px] font-bold` | §1: tags/badges use `--color-sand` or `--color-teal-accent`; arbitrary `text-[10px]` | 3 |
| `Sidebar.tsx:72` | `border-l border-line` | wrong border token | 3 |
| `Sidebar.tsx:78` | sub-tabs `.body-sm` (13px/muted) | Nav link `0.9375rem`/500 | 3 |
| `Sidebar.tsx:94` | "Sign out" = bare underlined `.body-xs text-muted` | a secondary action → `.btn-outline--inverse`; §1 links are mint | 3 |
| `Topbar.tsx:27` | `border-b border-line bg-panel` | wrong border token | 3 |
| `Topbar.tsx:33` | `<h1>` styled `.h-md` (17px/700) | an H1 rendering at H3 size; page title → H2 `2rem`/700 | 3 |
| `Topbar.tsx:34` | subtitle `.body-xs` (12px) | Meta `0.875rem` | 3 |
| `Topbar.tsx:28,37,40` | icon buttons have **no** styling — no radius, no hover, no hit area | §6: icon containers use `--radius-md` | 3 |
| `Topbar.tsx:37,40` | disabled = `opacity-50` | §1: disabled = `--color-gray-light` bg, `--color-gray-text` text | 3 |
| `RoutePlaceholder.tsx:20` | `<h2>` with `.h-lg` (22px/800) | H2 `2rem`/700 | 3 |
| `RoutePlaceholder.tsx:21` | `.body-sm` 13px | Body `1rem` | 3 |

### `frontend/components/shared/`

| File:line | Current | Deviation | Phase |
|---|---|---|---|
| `Modal.tsx:30` | **no scrim/backdrop rendered** | the prototype's `#scrim` was never ported, though `useOverlayStack.scrimVisible` was built and tested for it — restored as the shared `AppScrim` (N6), not per-overlay | 4 |
| `Modal.tsx:35` | `rounded-lg` (20px), `shadow-3` | surfaces are `--radius-md` 16px; `shadow-3` is off-scale | 4 |
| `Modal.tsx:37` | `<h2>` with `.h-md` | heading spec | 4 |
| `Modal.tsx:38` | close `rounded-full p-1 hover:bg-panel-sunk` | warm hover token | 4 |
| `Drawer.tsx:27` | `bg-panel shadow-3`, no scrim | off-scale elevation; backdrop covered by the shared `AppScrim` (N6) | 4 |
| `Drawer.tsx:27` | `transition-transform` with no duration/easing — `--ease-brand` exists but is never used | motion unspecified by the skill; frontend-design layer applies | 4 |
| `Drawer.tsx:31` | close button markup **duplicated** from `Modal.tsx:38` | candidate for a shared primitive — see New Components | 4 |
| `Toast.tsx:40` | `rounded-md` (14px), `bg-navy` `#0f2854` | wrong radius + wrong navy | 4 |
| `Toast.tsx:40` | `text-sm font-medium` — raw Tailwind default scale mixed into the design system | §3 sizes are token-driven | 4 |
| `Toast.tsx:42` | `text-cyan` (`#71eeff`) | off-palette; should be mint | 4 |

### `frontend/components/auth/LoginPage.tsx`

| Line | Current | Deviation | Phase |
|---|---|---|---|
| 34 | `bg-navy p-10 text-white` | hero bg should be `--color-navy-dark`; `p-10` (40px) is not a spacing token | 5 |
| 35 | `.eyebrow text-skyblue` | skyblue off-palette; this is a tagline → `.subhead-accent` (mint) | 5 |
| 37 | `h1 .h-xl` = 30px/800 | Hero H1 on dark: `2.75rem` / 700 / `text-inverse` / 1.15 | 5 |
| 38 | `.body-sm text-navy-muted` (13px) | Body `1rem`; `navy-muted` off-palette | 5 |
| 49 | stat numbers `.h-lg num text-gold` | gold off-palette → mint/teal on navy | 5 |
| 50 | `.body-xs text-navy-muted` (12px) | Meta `0.875rem` / `text-muted` | 5 |
| 58 | tabs `rounded-full bg-panel-sunk p-1` | warm sunk background | 5 |
| 61,70 | tab labels `.h-sm` = 14px/700 | Button label: body / `1rem` / 600 | 5 |
| **64,73** | **inline `style={{ background: …, boxShadow: … }}`** | Quick Start rule 1 — style belongs in a class, not inline | 5 |
| 81,91 | field labels `.body-xs` (12px) | Form label `0.875rem` / **600** / `text-heading` | 5 |
| 87,97 | inputs `rounded-md border border-line px-3 py-2` | inputs use `--radius-sm` **8px** (§5); wrong border token; no focus ring; inherits 14px vs `1rem` | 5 |
| 87,97 | no placeholder styling | §3 Placeholder: `1rem` / `--color-text-muted` | 5 |
| **104** | submit `rounded-full bg-gold py-2.5 font-bold text-navy disabled:opacity-60` | gold bg; `rounded-full` 999px vs pill **24px**; no `12px 32px` padding; disabled via opacity vs `gray-light`/`gray-text`; no hover transition → must become `.btn-primary` | 5 |
| 114 | Google button `rounded-full border border-line py-2.5 opacity-60` | → `.btn-outline`; same radius/disabled issues | 5 |
| 100 | error `.body-xs text-critical` | meta size + retuned critical | 5 |

### `frontend/App.tsx` and module stubs

`App.tsx` contains **no styling** — router configuration only. It is in scope but has zero deviations; no changes.

`components/module-1` … `module-4` and `components/settings` are all unimplemented placeholder stubs whose only styling is `.card`, `.empty`, `.h-lg`, `.body-sm` — all fixed centrally in Phase 1. Two exceptions need a per-file touch:

| File:line | Issue | Phase |
|---|---|---|
| `module-2/2.2-market-radar/MarketRadarDrawer.tsx:34` | `className="drawer …"` — `.drawer` is **never defined** in `index.css` (dead class) | 6 |
| `module-4/performance/PostAnalyticsModal.tsx:19` | `className="modal …"` — `.modal` is **never defined** (dead class) | 6 |

---

## New Components (flagged, not folded in)

Per the brief, these are **new** — none exists in any form today. Each is listed with the skill section that requires it. Reject any and the corresponding step drops out of the plan.

| # | New thing | Kind | Why | Phase |
|---|---|---|---|---|
| N1 | `.btn-primary`, `.btn-cta`, `.btn-outline`, `.btn-outline--inverse` | CSS component classes | §4 mandates exactly three variants. **Zero button variants exist today** — every button is ad-hoc utilities. | 2 |
| N2 | `.subhead-accent` | CSS class | §3 specifies it verbatim; nothing equivalent exists. | 1 |
| N3 | `.text-meta` | CSS class | §3 specifies it verbatim. | 1 |
| N4 | `.input` | CSS class | §5 requires `--radius-sm` inputs with `gray-light` borders and a focus state; `LoginPage` inlines ad-hoc utilities. | 2 |
| N5 | `.badge` | CSS class | §1: tags/badges use `sand` or `teal-accent`; `Sidebar`'s alert count is ad-hoc `bg-critical text-[10px]`. | 2 |
| N6 | `AppScrim.tsx` — one shared overlay scrim | **New component file** | The prototype has a single `#scrim` (`ui-ux-prototype.html:259-263, 1051`) at `z-index:80` beneath both overlays. `useOverlayStack` **already computes and exports `scrimVisible`** ([`useOverlayStack.tsx:53`](../../../frontend/components/shared/useOverlayStack.tsx)) and it is **already unit-tested** — but no component renders it. This restores a dropped prototype detail rather than inventing one; only the visual treatment comes from the skill. Presentational only — see the click-to-dismiss note in Task 12. | 4 |
| N7 | `--color-text-inverse-muted` token | New token | The skill defines `--color-text-inverse` for headings on dark but **no** muted body tone for dark backgrounds. `LoginPage` needs one (currently `navy-muted`). **Gap in the skill** — flag for a skill update. | 0 |
| N8 | `.icon-btn` | CSS class | `Topbar`'s three icon buttons and the duplicated `Modal`/`Drawer` close buttons all need §6's `--radius-md` container. Deduplicates four call sites. | 2 |
| N9 | `.h-hero` | CSS class | §3's "Hero H1 (on dark bg)" row (`2.75rem`/700/1.15) has no class. `LoginPage` was reusing `.h-xl`. | 1 |
| N10 | `.nav-link`, `.form-label` | CSS classes | §3 specifies both rows exactly (`0.9375rem`/500 and `0.875rem`/600); neither exists. | 1 |

**Not proposed:** a React `<Button>` component. The codebase styles exclusively with `className` strings and CSS component classes; a wrapper component would change component structure and prop flow, which the brief forbids.

---

## Documented Adaptations

The skill is written for a marketing/tourism site (heroes, destination cards, "Book Now"). CeView is an authenticated operator dashboard. Three rules cannot apply literally. Each is implemented as written below and annotated in `index.css` so the deviation is deliberate and visible.

1. **The sidebar carries the navbar role.** §1 assigns `--color-navy-primary` to "Navbar / footer background." In this shell the sidebar *is* the primary navigation, so it becomes navy with `text-inverse` labels and a mint active state. The topbar is a page-title header, not navigation, so it stays `--color-white` with a `--color-gray-light` bottom border.
2. **No alternating section bands.** §5's `white ↔ mint-pale` alternation with `--space-xl` (80px) padding is a landing-page rhythm. The dashboard content area uses `--color-off-white` with white cards; `--color-mint-pale` is reserved for callout bands inside screens. The `section { … }` rule is still added for any future marketing surface.
3. **`.eyebrow` survives, retuned.** Sidebar section labels ("Intelligence", "Create", "Measure") have no §3 equivalent. Rather than delete a needed affordance, `.eyebrow` is retuned to `0.875rem` / weight **600** (down from 800, respecting the heading weight cap) / `--color-text-muted`, and marked in the stylesheet as a dashboard-specific addition.

Two further adaptations are forced by Tailwind v4 mechanics:
- The skill names spacing `--space-md`; Tailwind v4 generates utilities only from the `--spacing-*` namespace. Both are defined — `--spacing-md` inside `@theme` (generating `p-md`, `gap-md`) and `--space-md: var(--spacing-md)` as a `:root` alias so the skill's literal names work in hand-written CSS.
- The existing numeric `--spacing-1…16` scale is **retained** so current utilities (`p-6`, `gap-4`) keep resolving. It is Tailwind's utility scale, not brand vocabulary.

---

## File Structure

**Modified:**
- `frontend/index.html` — font `<link>` tags (Phase 0)
- `frontend/styles/index.css` — the whole design system: tokens, base, typography, primitives (Phases 0, 1, 2, 7)
- `frontend/layout/AppShell.tsx`, `Sidebar.tsx`, `Topbar.tsx`, `RoutePlaceholder.tsx` (Phase 3)
- `frontend/components/shared/Modal.tsx`, `Drawer.tsx`, `Toast.tsx` (Phase 4)
- `frontend/components/shared/useOverlayStack.tsx` — **JSX return + import only**, to mount `AppScrim`; all state and handlers untouched (Phase 4)
- `frontend/index.tsx:6-7` — corrects the comment claiming the design system is "ported from ui-ux-prototype.html" (Phase 1)
- `frontend/components/auth/LoginPage.tsx` (Phase 5)
- `frontend/components/module-2/2.2-market-radar/MarketRadarDrawer.tsx`, `frontend/components/module-4/performance/PostAnalyticsModal.tsx` — dead-class removal only (Phase 6)

**Created:**
- `frontend/tests/integration/brand-tokens.test.ts` — asserts the stylesheet declares the skill's exact palette. This is the plan's regression net: it fails loudly if anyone reintroduces a gold/off-palette token. (Phase 0)
- `frontend/components/shared/AppScrim.tsx` — the shared overlay scrim (N6), restoring the prototype's `#scrim` against the already-built `scrimVisible` state. (Phase 4)

**Untouched:** `App.tsx` (no styling), `frontend/services/**`, `frontend/types.ts`, `frontend/layout/nav.ts`, all module/settings stubs except the two dead-class fixes, `ceview/` (legacy), `ui-ux-prototype.html` (the *source* of the old system — deliberately left as a historical artifact).

**Testing philosophy:** a visual restyle is not meaningfully covered by assertions, and class-name assertions on presentational markup are brittle. This plan uses TDD for the one thing that *is* a stable contract — the token set — and verifies everything else with typecheck, build, the existing suite, and a browser pass. Do **not** add assertions like `expect(button).toHaveClass('rounded-full')`.

---

## Phase 0: Fonts & Token Foundation

Adds every skill token **alongside** the legacy ones. Nothing is removed yet, so the app still builds and renders identically except for the font swap.

### Task 1: Token contract test

**Files:**
- Create: `frontend/tests/integration/brand-tokens.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
/**
 * Contract test for the tourism-app-branding skill's palette (SKILL.md §1, §2, §5).
 * Parses styles/index.css as text — no DOM, no Tailwind build — so it stays fast
 * and fails loudly if an off-palette token is reintroduced.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(here, '../../styles/index.css'), 'utf8');

const REQUIRED_COLORS: Record<string, string> = {
  '--color-navy-primary': '#1B3A5C',
  '--color-navy-dark': '#16304D',
  '--color-mint-primary': '#5FD6A6',
  '--color-mint-light': '#7FE0B8',
  '--color-mint-pale': '#E4F6EF',
  '--color-mint-pale-alt': '#EFFAF5',
  '--color-teal-accent': '#3CBDB1',
  '--color-coral-cta': '#FF8C69',
  '--color-coral-cta-hover': '#FF7550',
  '--color-sand': '#FFB88C',
  '--color-white': '#FFFFFF',
  '--color-off-white': '#F7F9FA',
  '--color-gray-text': '#6B7B8C',
  '--color-gray-light': '#C9D6DE',
  '--color-text-heading': '#1B3A5C',
  '--color-text-body': '#5A6B7A',
  '--color-text-inverse': '#FFFFFF',
  '--color-text-accent': '#5FD6A6',
  '--color-text-muted': '#8A97A3',
};

const REQUIRED_GEOMETRY: Record<string, string> = {
  '--radius-sm': '8px',
  '--radius-md': '16px',
  '--radius-pill': '24px',
  '--spacing-xs': '8px',
  '--spacing-sm': '16px',
  '--spacing-md': '24px',
  '--spacing-lg': '48px',
  '--spacing-xl': '80px',
};

function declaredValue(name: string): string | undefined {
  const match = css.match(new RegExp(`${name}\\s*:\\s*([^;]+);`));
  return match?.[1].trim();
}

describe('brand tokens', () => {
  it.each(Object.entries(REQUIRED_COLORS))('declares %s as %s', (name, hex) => {
    expect(declaredValue(name)?.toUpperCase()).toBe(hex.toUpperCase());
  });

  it.each(Object.entries(REQUIRED_GEOMETRY))('declares %s as %s', (name, value) => {
    expect(declaredValue(name)).toBe(value);
  });

  it('declares the two brand font families and no third', () => {
    expect(declaredValue('--font-heading')).toMatch(/Poppins/);
    expect(declaredValue('--font-body')).toMatch(/Inter/);
    expect(css).not.toMatch(/JetBrains Mono/);
    expect(css).not.toMatch(/Plus Jakarta Sans/);
  });

  it('declares the two card shadows', () => {
    expect(declaredValue('--shadow-card')).toBe('0 4px 20px rgba(27, 58, 92, 0.08)');
    expect(declaredValue('--shadow-card-hover')).toBe('0 8px 28px rgba(27, 58, 92, 0.14)');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run tests/integration/brand-tokens.test.ts`
Expected: FAIL — every color case fails with `expected undefined to be '#1B3A5C'`, and the font case fails because `JetBrains Mono` / `Plus Jakarta Sans` are still present.

### Task 2: Swap the font links

**Files:**
- Modify: `frontend/index.html:7-12`

- [ ] **Step 1: Replace the Google Fonts block**

Replace lines 7–12 with:

```html
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Poppins:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap"
      rel="stylesheet"
    />
```

Weights cover exactly what §2–§4 use: Poppins 500 (`.subhead-accent`), 600 (H3/H4), 700 (H1/H2); Inter 400 (body/meta/inputs), 500 (nav links), 600 (buttons/form labels), 700 (`.btn-cta`).

### Task 3: Replace the `@theme` token block

**Files:**
- Modify: `frontend/styles/index.css:1-84`

- [ ] **Step 1: Replace the header comment and `@theme` block**

Replace lines 1–84 in full with:

```css
/* ============================================================
   DESIGN TOKENS — tourism-app-branding skill, §1 (palette), §2
   (fonts), §5 (spacing/radius/elevation).
   Expressed as a Tailwind v4 @theme so every token is available both
   as a CSS custom property and as generated utilities
   (bg-mint-primary, rounded-pill, shadow-card, ...).

   LEGACY tokens from ui-ux-prototype.html are retained in the marked
   block below ONLY until the call-site migration finishes; Phase 7 of
   docs/superpowers/plans/2026-08-15-frontend-branding-alignment.md
   deletes them. Do not add new usages.
   ============================================================ */
@import "tailwindcss";

@theme {
  /* ---- Anchor / Structural ---- */
  --color-navy-primary: #1B3A5C;
  --color-navy-dark: #16304D;

  /* ---- Primary Accent (cool) ---- */
  --color-mint-primary: #5FD6A6;
  --color-mint-light: #7FE0B8;
  --color-mint-pale: #E4F6EF;
  --color-mint-pale-alt: #EFFAF5;

  /* ---- Travel Accent (warm) ---- */
  --color-teal-accent: #3CBDB1;
  --color-coral-cta: #FF8C69;
  --color-coral-cta-hover: #FF7550;
  --color-sand: #FFB88C;

  /* ---- Neutrals ---- */
  --color-white: #FFFFFF;
  --color-off-white: #F7F9FA;
  --color-gray-text: #6B7B8C;
  --color-gray-light: #C9D6DE;

  /* ---- Text ---- */
  --color-text-heading: #1B3A5C;
  --color-text-body: #5A6B7A;
  --color-text-inverse: #FFFFFF;
  --color-text-accent: #5FD6A6;
  --color-text-muted: #8A97A3;

  /* ADAPTATION (N7): the skill defines --color-text-inverse for headings on
     dark but no muted body tone for dark backgrounds. LoginPage's brand panel
     needs one. Derived from --color-gray-light, pulled toward navy. Flag for a
     tourism-app-branding update. */
  --color-text-inverse-muted: #A9BCCB;

  /* ---- Functional / non-brand ----
     The skill is silent on semantic state and platform colors. These are NOT
     brand tokens; they are retuned from the legacy palette to sit alongside
     mint/coral without clashing (approved decision, 2026-08-15). */
  --color-critical: #D64545;      /* was #a70000 — lifted to read beside coral */
  --color-critical-bg: #FDECEC;
  --color-success: #2FA37A;       /* was #0f7a4e — pulled toward mint's hue */
  --color-success-bg: #E4F6EF;

  --color-ig: #C13584;
  --color-tt: #010101;
  --color-fb: #1877F2;
  --color-nv: #03C75A;

  /* ---- Geometry (§5) ---- */
  --radius-sm: 8px;
  --radius-md: 16px;
  --radius-pill: 24px;
  --radius-full: 999px;

  --shadow-card: 0 4px 20px rgba(27, 58, 92, 0.08);
  --shadow-card-hover: 0 8px 28px rgba(27, 58, 92, 0.14);
  /* ADDED: §5 defines only the two card shadows; overlays need a heavier step. */
  --shadow-overlay: 0 18px 48px rgba(27, 58, 92, 0.22);

  /* Named brand spacing (§5). Tailwind v4 generates utilities only from the
     --spacing-* namespace, so the skill's --space-* names are aliased in
     :root below. */
  --spacing-xs: 8px;
  --spacing-sm: 16px;
  --spacing-md: 24px;
  --spacing-lg: 48px;
  --spacing-xl: 80px;

  /* Tailwind's numeric utility scale — retained so p-6/gap-4 keep resolving.
     Not brand vocabulary; prefer the named scale above in new code. */
  --spacing-1: 4px;
  --spacing-2: 8px;
  --spacing-3: 12px;
  --spacing-4: 16px;
  --spacing-5: 20px;
  --spacing-6: 24px;
  --spacing-8: 32px;
  --spacing-10: 40px;
  --spacing-12: 48px;
  --spacing-16: 64px;

  --sidebar-w: 248px;
  --ease-brand: cubic-bezier(0.22, 0.61, 0.36, 1);

  /* ---- Fonts (§2) ---- */
  --font-heading: 'Poppins', 'Montserrat', sans-serif;
  --font-body: 'Inter', 'Open Sans', sans-serif;
  --font-sans: 'Inter', 'Open Sans', sans-serif;

  /* ======= LEGACY — deleted in Phase 7. Do not add usages. ======= */
  --color-navy: #0f2854;
  --color-navy-light: #183c7b;
  --color-blue: #06388e;
  --color-skyblue: #7fbfff;
  --color-navy-muted: #98a7b9;
  --color-teal: #007892;
  --color-cyan: #71eeff;
  --color-gold: #f4a216;
  --color-gold-dark: #d48e15;
  --color-gold-light: #ffb941;
  --color-gold-wash: #fff5df;
  --color-yellow: #ffd664;
  --color-foliage: #506e53;
  --color-page: #fdfbf7;
  --color-panel: #ffffff;
  --color-panel-sunk: #f7f4ee;
  --color-ink: #0a2342;
  --color-ink-2: #1e293b;
  --color-muted: #64748b;
  --color-grey: #3c4247;
  --color-line: #e4ded2;
  --color-line-strong: #c7d3e2;
  --color-line-navy: #98a7b9;
  --shadow-1: 0 1px 2px rgba(15, 40, 84, 0.06), 0 1px 3px rgba(15, 40, 84, 0.08);
  --shadow-2: 0 4px 12px rgba(15, 40, 84, 0.08), 0 2px 4px rgba(15, 40, 84, 0.05);
  --shadow-3: 0 18px 48px rgba(10, 35, 66, 0.22);
  --radius-xs: 6px;
  --radius-lg: 20px;
  /* ======= END LEGACY ======= */
}

/* Skill-literal aliases (§5 names them --space-*), available to hand-written
   CSS. Tailwind utilities come from the --spacing-* namespace above. */
:root {
  --space-xs: var(--spacing-xs);
  --space-sm: var(--spacing-sm);
  --space-md: var(--spacing-md);
  --space-lg: var(--spacing-lg);
  --space-xl: var(--spacing-xl);
}
```

Note that `--font-mono` is gone, and `--radius-sm` / `--radius-md` now hold the skill's values (8px / 16px) rather than the legacy 10px / 14px — the legacy block deliberately does **not** re-declare them, because `rounded-sm` / `rounded-md` should move to the new values immediately.

- [ ] **Step 2: Run the token test to verify it passes**

Run: `cd frontend && npx vitest run tests/integration/brand-tokens.test.ts`
Expected: PASS — all cases green.

- [ ] **Step 3: Verify the app still builds**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: exit 0 for both. Confirm `.mono` had no consumers: `grep -rn "className=\"[^\"]*\bmono\b" --include=*.tsx .` → no output (only `.num` / `font-variant-numeric` is in use).

- [ ] **Step 4: Hand off for commit**

Report: "Phase 0 complete — fonts swapped to Poppins/Inter, skill palette added alongside legacy tokens, token contract test green. Ready for you to commit." Do **not** run `git commit`.

---

## Phase 1: Base Layer & Typography Scale

Rewrites the reset and `@layer components` to §3's scale. This phase carries the largest visual delta — every text size changes.

### Task 4: Base/reset rules

**Files:**
- Modify: `frontend/styles/index.css` — the RESET/BASE section (originally lines 86–173, shifted by Phase 0)

- [ ] **Step 1: Replace the base block**

Replace the entire `/* RESET / BASE */` section, from the `html, body` rule through the `.sr` rule, with:

```css
/* ============================================================
   RESET / BASE — tourism-app-branding §3
   ============================================================ */
html,
body {
  height: 100%;
}

body {
  font-family: var(--font-body);
  background: var(--color-off-white);
  color: var(--color-text-body);
  -webkit-font-smoothing: antialiased;
  font-size: 1rem;      /* §3: base 16px */
  line-height: 1.6;
  overflow-x: hidden;
}

h1,
h2,
h3,
h4 {
  margin: 0;
  font-family: var(--font-heading);
  color: var(--color-text-heading);
}

p,
figure {
  margin: 0;
}

p {
  color: var(--color-text-body);
  font-size: 1rem;
  line-height: 1.6;
}

ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

button {
  font: inherit;
  color: inherit;
  cursor: pointer;
  border: none;
  background: none;
}

input,
select,
textarea {
  font-family: var(--font-body);
  font-size: 1rem;
  color: var(--color-text-heading);
}

input::placeholder,
textarea::placeholder {
  color: var(--color-text-muted);
}

a {
  color: var(--color-mint-primary);
  text-decoration: none;
  transition: color 0.2s ease;
}

a:hover {
  color: var(--color-mint-light);
}

/* ADAPTATION: §5's alternating white/mint-pale section rhythm is a
   landing-page pattern. The rule is defined for future marketing surfaces;
   the authenticated dashboard shell does not use <section> for layout. */
section {
  padding: var(--space-xl) var(--space-md);
}

svg {
  display: block;
}

/* Grid/flex items default to min-width:auto, which lets wide content (long
   tab labels, textareas, tables) force the item past its track and overflow
   the page. Layout-wide safety net; opt back in with explicit width/flex
   rules where growth is wanted. */
.content * {
  min-width: 0;
}

::selection {
  background: var(--color-mint-primary);
  color: var(--color-navy-dark);
}

:focus-visible {
  outline: 2px solid var(--color-mint-primary);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}

.sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
```

The `.mono` class is dropped along with `--font-mono` (§2: no third family; zero call sites).

- [ ] **Step 2: Correct the stale design-system comment in `index.tsx`**

`frontend/index.tsx:6-7` still names the prototype as the source of the design system, which now contradicts the Source of Truth rule. Replace those two comment lines:

```tsx
// Design System — Tailwind v4 @theme tokens + base/typography layer per the
// tourism-app-branding skill (.claude/skills/tourism-app-branding/SKILL.md),
// which is the single source of truth for color, type, buttons and spacing.
// ui-ux-prototype.html remains authoritative for app flow and logic, not visuals.
// See styles/index.css for the full token list.
```

Comment-only change; the `import './styles/index.css';` line below it is untouched.

### Task 5: Typography helper classes

**Files:**
- Modify: `frontend/styles/index.css` — the `@layer components` block

- [ ] **Step 1: Replace the typography helpers**

Replace the `.eyebrow` through `.empty p` rules inside `@layer components` with:

```css
@layer components {
  /* ---- Headings (§3), mapped onto the existing helper names so call sites
     keep working. Weights respect the 600–700 cap. ---- */

  /* NEW (N9): §3 "Hero H1 (on dark bg)". LoginPage's brand panel had no
     correct class — it was reusing .h-xl at 30px/800. */
  .h-hero {
    font-family: var(--font-heading);
    font-size: 2.75rem;
    font-weight: 700;
    line-height: 1.15;
    color: var(--color-text-inverse);
  }
  .h-xl {
    font-family: var(--font-heading);
    font-size: 2.5rem;
    font-weight: 700;
    line-height: 1.2;
    color: var(--color-text-heading);
  }
  .h-lg {
    font-family: var(--font-heading);
    font-size: 2rem;
    font-weight: 700;
    line-height: 1.25;
    color: var(--color-text-heading);
  }
  .h-md {
    font-family: var(--font-heading);
    font-size: 1.5rem;
    font-weight: 600;
    line-height: 1.3;
    color: var(--color-text-heading);
  }
  .h-sm {
    font-family: var(--font-heading);
    font-size: 1.125rem;
    font-weight: 600;
    line-height: 1.4;
    color: var(--color-text-heading);
  }

  /* §3 verbatim (N2) */
  .subhead-accent {
    font-family: var(--font-heading);
    color: var(--color-text-accent);
    font-weight: 500;
    font-size: 1.125rem;
    line-height: 1.4;
  }

  /* §3 verbatim (N3) */
  .text-meta {
    font-family: var(--font-body);
    font-size: 0.875rem;
    font-weight: 400;
    line-height: 1.5;
    color: var(--color-text-muted);
  }

  /* .body-sm carries descriptive paragraph copy across the stubs -> §3 Body.
     .body-xs carries captions/meta -> §3 Small/meta, same spec as .text-meta. */
  .body-sm {
    font-family: var(--font-body);
    font-size: 1rem;
    font-weight: 400;
    line-height: 1.6;
    color: var(--color-text-body);
  }
  .body-xs {
    font-family: var(--font-body);
    font-size: 0.875rem;
    font-weight: 400;
    line-height: 1.5;
    color: var(--color-text-muted);
  }

  /* §3 Nav link (N10) */
  .nav-link {
    font-family: var(--font-body);
    font-size: 0.9375rem;
    font-weight: 500;
    line-height: 1;
  }

  /* §3 Form label (N10) */
  .form-label {
    font-family: var(--font-body);
    font-size: 0.875rem;
    font-weight: 600;
    line-height: 1.4;
    color: var(--color-text-heading);
  }

  /* ADAPTATION: sidebar section dividers have no §3 equivalent. Retuned from
     10.5px/800 to the meta size at the 600 weight cap. */
  .eyebrow {
    font-family: var(--font-heading);
    font-size: 0.875rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  .num {
    font-variant-numeric: tabular-nums;
  }

  /* §5 card: 16px radius, soft navy-tinted shadow, no border, space-md
     padding, hover elevation. */
  .card {
    background: var(--color-white);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-card);
    padding: var(--space-md);
    transition: box-shadow 0.2s ease;
  }
  .card:hover {
    box-shadow: var(--shadow-card-hover);
  }

  .empty {
    text-align: center;
    padding: var(--space-lg) var(--space-md);
  }
  /* §5/§6: icon badge — radius-md container, mint fill, navy iconography. */
  .empty-glyph {
    width: 52px;
    height: 52px;
    border-radius: var(--radius-md);
    background: var(--color-mint-pale);
    display: grid;
    place-items: center;
    margin: 0 auto var(--space-sm);
  }
  .empty-glyph svg {
    width: 23px;
    height: 23px;
    stroke: var(--color-navy-primary);
  }
  .empty h3 {
    font-family: var(--font-heading);
    font-size: 1.5rem;
    font-weight: 600;
    line-height: 1.3;
  }
  .empty p {
    font-size: 1rem;
    color: var(--color-text-body);
    line-height: 1.6;
    margin-top: var(--space-xs);
    max-width: 44ch;
    margin-inline: auto;
  }
}
```

`.card` gaining `padding` is the one change with layout consequence for the module stubs — they currently render an unpadded card. This is a correction, not a regression: §5 specifies `padding: var(--space-md)`.

- [ ] **Step 2: Verify build and existing suite**

Run: `cd frontend && npx tsc --noEmit && npm run build && npm test`
Expected: all three exit 0. `useOverlayStack.test.tsx` and `apiClient.fixtures.test.ts` assert behavior, not styling, so they are unaffected.

- [ ] **Step 3: Visual check**

Run: `cd frontend && npm run dev`, open `/login`, then sign in with a seeded account from `backend/spring-boot/src/main/resources/db/migration/SEED_CREDENTIALS.md` and open `/dashboard`.
Expected: Poppins headings, Inter body, everything noticeably larger. Layout will look loose and partly wrong — buttons are still gold, the sidebar is still white. That is correct for this phase; Phases 2–5 fix it.

- [ ] **Step 4: Hand off for commit**

---

## Phase 2: Button, Input, Badge & Icon-Button Primitives (all NEW)

Everything in this phase is **new** — none of these classes exists today. No component is edited here; the classes are only defined. Phases 3–5 adopt them.

### Task 6: Button variants (N1)

**Files:**
- Modify: `frontend/styles/index.css` — append inside `@layer components`

- [ ] **Step 1: Add the three §4 variants**

```css
@layer components {
  /* ============================================================
     BUTTONS — §4. Exactly three variants; do not invent a fourth.
     All pill-shaped (--radius-pill, 24px). No square buttons.
     ============================================================ */

  /* Brand actions: Explore, Search, Learn More, Sign Up */
  .btn-primary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-xs);
    background-color: var(--color-mint-primary);
    color: var(--color-navy-dark);
    font-family: var(--font-body);
    font-weight: 600;
    font-size: 1rem;
    line-height: 1;
    border: none;
    border-radius: var(--radius-pill);
    padding: 12px 32px;
    cursor: pointer;
    transition: background-color 0.2s ease;
  }
  .btn-primary:hover:not(:disabled) {
    background-color: var(--color-mint-light);
  }
  .btn-primary:disabled {
    background-color: var(--color-gray-light);
    color: var(--color-gray-text);
    cursor: not-allowed;
  }

  /* High-intent conversion: Book Now, Reserve, Checkout.
     §4: max one per view; always visually dominant over .btn-primary. */
  .btn-cta {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-xs);
    background-color: var(--color-coral-cta);
    color: var(--color-white);
    font-family: var(--font-body);
    font-weight: 700;
    font-size: 1rem;
    line-height: 1;
    border: none;
    border-radius: var(--radius-pill);
    padding: 14px 36px;
    cursor: pointer;
    transition: background-color 0.2s ease;
  }
  .btn-cta:hover:not(:disabled) {
    background-color: var(--color-coral-cta-hover);
  }
  .btn-cta:disabled {
    background-color: var(--color-gray-light);
    color: var(--color-gray-text);
    cursor: not-allowed;
  }

  /* Secondary actions, light or dark background */
  .btn-outline {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-xs);
    background-color: transparent;
    border: 1.5px solid currentColor;
    color: var(--color-navy-primary);
    font-family: var(--font-body);
    font-weight: 600;
    font-size: 1rem;
    line-height: 1;
    border-radius: var(--radius-pill);
    padding: 11px 30px;
    cursor: pointer;
    transition: color 0.2s ease, background-color 0.2s ease;
  }
  .btn-outline:hover:not(:disabled) {
    color: var(--color-mint-primary);
  }
  .btn-outline:disabled {
    border-color: var(--color-gray-light);
    color: var(--color-gray-text);
    cursor: not-allowed;
  }
  .btn-outline--inverse {
    color: var(--color-white);
  }
  .btn-outline--inverse:hover:not(:disabled) {
    color: var(--color-mint-primary);
  }
}
```

`display: inline-flex` + `gap` goes beyond the skill's literal CSS so buttons containing an icon plus a label align correctly; it does not alter any specified property.

### Task 7: Input, badge, icon-button (N4, N5, N8)

**Files:**
- Modify: `frontend/styles/index.css` — append inside `@layer components`

- [ ] **Step 1: Add the three primitives**

```css
@layer components {
  /* Form control — §5: inputs use --radius-sm; §3: 1rem / text-heading. (N4) */
  .input {
    width: 100%;
    font-family: var(--font-body);
    font-size: 1rem;
    font-weight: 400;
    line-height: 1.4;
    color: var(--color-text-heading);
    background: var(--color-white);
    border: 1px solid var(--color-gray-light);
    border-radius: var(--radius-sm);
    padding: 10px var(--space-sm);
    transition: border-color 0.2s ease;
  }
  .input::placeholder {
    color: var(--color-text-muted);
  }
  .input:hover:not(:disabled) {
    border-color: var(--color-teal-accent);
  }
  .input:disabled {
    background: var(--color-gray-light);
    color: var(--color-gray-text);
    cursor: not-allowed;
  }

  /* Tag/badge — §1: secondary badges use --color-sand or --color-teal-accent;
     §5: small tags use --radius-sm. (N5) */
  .badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 20px;
    font-family: var(--font-body);
    font-size: 0.875rem;
    font-weight: 600;
    line-height: 1;
    color: var(--color-navy-dark);
    background: var(--color-sand);
    border-radius: var(--radius-sm);
    padding: 3px var(--space-xs);
  }
  .badge--teal {
    background: var(--color-teal-accent);
    color: var(--color-white);
  }

  /* Icon-only control — §6: rounded (--radius-md) container. (N8) */
  .icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: var(--radius-md);
    color: var(--color-navy-primary);
    background: transparent;
    cursor: pointer;
    transition: background-color 0.2s ease, color 0.2s ease;
  }
  .icon-btn:hover:not(:disabled) {
    background: var(--color-mint-pale);
  }
  .icon-btn:disabled {
    color: var(--color-gray-text);
    cursor: not-allowed;
  }
}
```

No `.icon-btn--inverse` variant: the only two buttons on a dark surface are the Sidebar's settings-disclosure row and Sign out, and neither is icon-only. Add one when a real consumer appears.

- [ ] **Step 2: Verify build**

Run: `cd frontend && npm run build`
Expected: exit 0. No visual change yet — nothing consumes these classes.

- [ ] **Step 3: Hand off for commit**

---

## Phase 3: `frontend/layout/`

### Task 8: `AppShell.tsx`

**Files:**
- Modify: `frontend/layout/AppShell.tsx:15`

- [ ] **Step 1: Move the content area off the warm-cream page background**

Replace line 15:

```tsx
        <main className="content flex-1 overflow-y-auto bg-off-white p-md">
```

(was `bg-page p-6`; `p-md` = 24px = `--space-md`, the same visual value under a brand-named token.)

### Task 9: `Sidebar.tsx`

**Files:**
- Modify: `frontend/layout/Sidebar.tsx:23,24,30,45,49,56-57,62,64,72,78,92-95`

Only `className` strings change. `useState`, `useAuth`, `NAV`, `NavLink` targets, `onClick` handlers, and `aria-*` attributes are untouched.

- [ ] **Step 1: Navy sidebar surface (line 23)**

```tsx
    <nav className="flex h-full w-[var(--sidebar-w)] flex-col bg-navy-primary">
```

Per Documented Adaptation 1 — the sidebar is the navbar. The right border goes away: navy against off-white content needs no divider.

- [ ] **Step 2: Wordmark (line 24)**

```tsx
      <div className="h-sm px-md py-md text-text-inverse">CeView</div>
```

(was `eyebrow px-5 py-6 text-navy` — an uppercase 10.5px/800 eyebrow standing in for a brand mark, now on a navy surface.)

- [ ] **Step 3: Section labels (line 30)**

```tsx
              <li key={`section-${i}`} className="eyebrow px-2 pb-1 pt-4 text-text-inverse-muted first:pt-0">
```

Drops the dead `.sb-sec`; `.eyebrow` is the retuned adaptation class.

- [ ] **Step 4: Settings toggle row (line 45)**

```tsx
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-text-inverse hover:bg-white/10"
```

- [ ] **Step 5: Nav label spans (lines 49 and 62)**

Both occurrences of `<span className="h-sm flex-1">` become:

```tsx
                  <span className="nav-link flex-1">{entry.label}</span>
```

§3 Nav link is `0.9375rem` / 500 in the body font; `.h-sm` was 14px/700 in the heading font.

- [ ] **Step 6: Nav item and active state (lines 56–57)**

```tsx
                    `flex items-center gap-2 rounded-sm px-2 py-2 text-text-inverse hover:bg-white/10 ${
                      isActive ? 'bg-mint-primary text-navy-dark' : ''
                    }`
```

(was `rounded-md` 14px + `bg-gold-wash text-navy`. §1: cards on navy use white or a 10% white overlay — that's the hover; the active item takes the mint accent.)

- [ ] **Step 7: Alert badge (line 64)**

```tsx
                    <span className="badge">{entry.badge}</span>
```

(was `rounded-full bg-critical px-1.5 text-[10px] font-bold text-white`. §1: badges use sand/teal, not the critical state color. `.badge` is N5.)

- [ ] **Step 8: Sub-tab list border and links (lines 72, 78)**

Line 72:

```tsx
                <ul className="ml-6 border-l border-white/20 pl-2">
```

Line 78:

```tsx
                          `nav-link block rounded-sm px-2 py-1.5 text-text-inverse-muted hover:bg-white/10 ${isActive ? 'text-mint-primary' : ''}`
```

- [ ] **Step 9: Footer identity block (lines 92–95)**

```tsx
      <div className="border-t border-white/20 px-md py-sm">
        <div className="nav-link truncate text-text-inverse">{user?.businessName ?? user?.email ?? 'Signed in'}</div>
        <button type="button" onClick={logout} className="btn-outline btn-outline--inverse mt-xs w-full">
          Sign out
        </button>
      </div>
```

`onClick={logout}` is preserved exactly. The bare underlined text becomes the §4 outline variant (N1).

### Task 10: `Topbar.tsx`

**Files:**
- Modify: `frontend/layout/Topbar.tsx:27,28,33,34,37,40`

`useLocation`, `navIdFromPath`, `onToggleSidebar`, `disabled`, `aria-*`, and `title` attributes are untouched.

- [ ] **Step 1: Header surface (line 27)**

The larger §3 type scale no longer fits a fixed `h-16` alongside a meta line, so the header sizes to content:

```tsx
    <header className="flex h-auto items-center gap-4 border-b border-gray-light bg-white px-md py-sm">
```

- [ ] **Step 2: Burger button (line 28)**

```tsx
      <button type="button" onClick={onToggleSidebar} className="icon-btn md:hidden" aria-label="Toggle sidebar">
```

- [ ] **Step 3: Title and subtitle (lines 33–34)**

```tsx
        <h1 className="h-lg">{active?.title ?? 'CeView'}</h1>
        {active?.sub && <p className="text-meta">{active.sub}</p>}
```

`.h-lg` maps to §3 H2 `2rem`/700 — the page-title role. `.h-md` (17px) had an `<h1>` rendering smaller than an H3.

- [ ] **Step 4: Search and bell buttons (lines 37, 40)**

```tsx
      <button type="button" disabled aria-disabled className="icon-btn" title="Not wired yet">
        <Search size={18} />
      </button>
      <button type="button" disabled aria-disabled className="icon-btn" title="Not wired yet">
        <Bell size={18} />
      </button>
```

`opacity-50` is dropped — `.icon-btn:disabled` supplies §1's `--color-gray-text` treatment. `disabled` and `aria-disabled` are unchanged, so behavior is identical.

### Task 11: `RoutePlaceholder.tsx`

**Files:**
- Modify: `frontend/layout/RoutePlaceholder.tsx:19-21`

- [ ] **Step 1: Adopt the brand spacing token**

```tsx
    <div className="empty flex h-full flex-col items-center justify-center gap-xs text-center">
      <h2 className="h-lg">{title ?? nav?.title ?? 'Coming soon'}</h2>
      <p className="body-sm">{sub ?? nav?.sub ?? 'This screen has not been built yet.'}</p>
    </div>
```

`.h-lg` and `.body-sm` already resolve to the §3 sizes from Phase 1, so only `gap-1` → `gap-xs` changes here.

- [ ] **Step 2: Verify**

Run: `cd frontend && npx tsc --noEmit && npm run build && npm test`
Expected: all exit 0.

- [ ] **Step 3: Visual and behavior check**

Run: `cd frontend && npm run dev`, sign in, walk `/dashboard`, `/content`, `/calendar`, `/performance`, `/settings/profile`.
Expected: navy sidebar with a mint active item and a sand badge on Dashboard; white topbar; off-white content. Confirm every nav link still routes, the Settings disclosure still expands and collapses, and Sign out still logs you out — behavior must be unchanged.

- [ ] **Step 4: Hand off for commit**

---

## Phase 4: `frontend/components/shared/`

### Task 12: `AppScrim.tsx` — restore the shared overlay scrim (N6)

**Files:**
- Create: `frontend/components/shared/AppScrim.tsx`
- Modify: `frontend/components/shared/useOverlayStack.tsx:58` (JSX return only)

**Why this is a restoration, not an invention.** The prototype has exactly one scrim — `<div id="scrim">` at `ui-ux-prototype.html:1051`, styled at lines 259–263 as `position:fixed; inset:0; background:rgba(10,35,66,.42); z-index:80` with both `.modal` and `.drawer` at `z-index:90` above it. The React port built the entire state layer for it — `useOverlayStack` computes `scrimVisible: stack.length > 0` at line 53, and `useOverlayStack.test.tsx` asserts that value four times — but **no component ever rendered it**. Per the Source of Truth rule, the element is restored from the prototype and the *treatment* comes from the skill.

Note the opacity: the prototype uses 42%, and that is what this plan uses. §6's "70–80% opacity" prescribes a navy overlay **behind text on hero photography** for legibility — a different job from an overlay scrim, and there is no imagery in the app to apply it to. Only the navy itself is taken from the skill.

- [ ] **Step 1: Create the component**

```tsx
/**
 * Shared overlay scrim — restores the prototype's single `#scrim`
 * (ui-ux-prototype.html:259-263, 1051), which sits beneath every overlay and
 * fades in whenever the overlay stack is non-empty. Driven by the
 * already-existing `scrimVisible` from useOverlayStack.
 *
 * Visual treatment per tourism-app-branding §1 (--color-navy-dark); the 42%
 * opacity and the fade timing are the prototype's.
 */
import { useOverlayStack } from './useOverlayStack';

export default function AppScrim() {
  const { scrimVisible } = useOverlayStack();

  return (
    <div
      className="pointer-events-none fixed inset-0 z-20 bg-navy-dark/40 opacity-0 transition-opacity duration-[250ms] ease-[var(--ease-brand)] data-[visible=true]:opacity-100"
      data-visible={scrimVisible}
      aria-hidden="true"
    />
  );
}
```

`z-20` sits beneath the existing `Drawer` (`z-30`) and `Modal` (`z-40`), reproducing the prototype's 80-under-90 relationship without touching either component's z-index.

**Deliberately inert.** The prototype's scrim carries `onclick="dismissTop()"`. Click-to-dismiss is *behavior*, and this plan is styling-only, so `pointer-events-none` keeps the scrim non-interactive and dismissal continues to happen solely via the close button and Escape — exactly as today. Wiring the click handler is logged as a follow-up in Open Items; it belongs to a functional card, not this restyle.

- [ ] **Step 2: Mount it from the provider**

`OverlayStackProvider` currently returns only its context provider. Render the scrim as a sibling of `children`, matching the pattern `ToastProvider` already uses for its toast host ([`Toast.tsx:33-47`](../../../frontend/components/shared/Toast.tsx)). Replace line 58 of `useOverlayStack.tsx`:

```tsx
  return (
    <OverlayStackContext.Provider value={value}>
      {children}
      <AppScrim />
    </OverlayStackContext.Provider>
  );
```

and add the import at the top of the file:

```tsx
import AppScrim from './AppScrim';
```

This is the one edit in the plan that touches a file containing logic. **Only the JSX return and the import change** — `stack`, `push`, `pop`, `dismissTop`, the Escape listener, and the `useMemo` value are untouched. `App.tsx` stays unmodified because the provider mounts the scrim itself.

- [ ] **Step 3: Verify the overlay tests still pass**

Run: `cd frontend && npx vitest run components/shared/useOverlayStack.test.tsx`
Expected: PASS, unchanged. The suite uses `renderHook` against the provider; adding a presentational sibling does not affect it.

### Task 13: `Modal.tsx`

**Files:**
- Modify: `frontend/components/shared/Modal.tsx:29-41`

The `useOverlayStack` effect, the `open` guard, the `onClose` handler, and the `role` / `aria-modal` / `data-open` attributes are untouched. The modal does **not** get its own scrim — `AppScrim` from Task 12 covers it.

- [ ] **Step 1: Restyle the panel**

Replace lines 29–41 with:

```tsx
    <div
      className="fixed inset-0 z-40 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      data-open={isOpen('modal')}
    >
      <div className="w-full max-w-lg rounded-md bg-white p-md shadow-overlay">
        <div className="mb-sm flex items-center justify-between">
          {title && <h2 className="h-md">{title}</h2>}
          <button onClick={onClose} aria-label="Close" className="icon-btn">
            <X size={18} />
          </button>
        </div>
```

Changes: `rounded-lg` (20px) → `rounded-md` (16px, §5); `bg-panel` → `bg-white`; `shadow-3` → `shadow-overlay`; `p-6` / `mb-4` → `p-md` / `mb-sm`; close button → `.icon-btn` (N8).

The title keeps `.h-md`, which now resolves to §3 H3 `1.5rem`/600 — correct for a dialog title. The element stays an `<h2>`; that is not changed.

### Task 14: `Drawer.tsx`

**Files:**
- Modify: `frontend/components/shared/Drawer.tsx:26-35`

The `useOverlayStack` effect, the `open` / `onClose` props, `data-open`, and `aria-hidden` are untouched — including the fact that the drawer stays mounted and translates off-screen. The drawer does **not** get its own scrim — `AppScrim` from Task 12 covers it, so the element count and structure here are unchanged.

- [ ] **Step 1: Restyle**

Replace lines 26–35 with:

```tsx
    <div
      className="fixed inset-y-0 right-0 z-30 w-full max-w-md translate-x-full bg-white shadow-overlay transition-transform duration-300 ease-[var(--ease-brand)] data-[open=true]:translate-x-0"
      data-open={open}
      aria-hidden={!open}
    >
      <button onClick={onClose} aria-label="Close" className="icon-btn absolute right-sm top-sm">
        <X size={18} />
      </button>
      <div className="h-full overflow-y-auto p-md">{children}</div>
    </div>
```

Changes: `bg-panel` → `bg-white`; `shadow-3` → `shadow-overlay`; the bare `transition-transform` gains `duration-300` and the previously-unused `--ease-brand` easing (matching the prototype's `.25s var(--ease)` intent); close button → `.icon-btn`; `right-4 top-4` / `p-6` → `right-sm top-sm` / `p-md`.

### Task 15: `Toast.tsx`

**Files:**
- Modify: `frontend/components/shared/Toast.tsx:36-45`

The context, `showToast`, the `setTimeout` dismissal, and `useMemo` are untouched.

- [ ] **Step 1: Restyle the toast host and items**

Replace lines 36–45 with:

```tsx
      <div className="fixed bottom-md right-md z-50 flex flex-col gap-xs">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="flex items-center gap-xs rounded-md bg-navy-primary px-sm py-3 shadow-card transition-opacity"
          >
            <CheckCircle2 size={16} className="text-mint-primary" />
            <span className="body-sm text-text-inverse">{t.message}</span>
          </div>
        ))}
      </div>
```

Changes: `bg-navy` (`#0f2854`) → `bg-navy-primary`; `text-cyan` → `text-mint-primary` (§1 accent); raw-Tailwind `text-sm font-medium` → `.body-sm` from the design system; `shadow-2` → `shadow-card`; spacing on brand tokens. `rounded-md` now resolves to 16px (§5 card radius) — a toast is a card-like surface.

- [ ] **Step 2: Verify**

Run: `cd frontend && npx tsc --noEmit && npm run build && npm test`
Expected: all exit 0. `useOverlayStack.test.tsx` covers push/pop ordering and is style-agnostic — it must stay green, confirming the scrim additions did not disturb overlay behavior.

- [ ] **Step 3: Hand off for commit**

---

## Phase 5: `frontend/components/auth/`

### Task 16: `LoginPage.tsx` — brand panel

**Files:**
- Modify: `frontend/components/auth/LoginPage.tsx:34-54`

`useState`, `handleSubmit`, `useAuth`, and the stat-tile `.map` data are untouched.

- [ ] **Step 1: Restyle the navy brand panel**

Replace lines 34–54 with:

```tsx
      <div className="flex flex-col justify-between bg-navy-dark p-lg text-text-inverse">
        <div className="subhead-accent">CeView</div>
        <div>
          <h1 className="h-hero mb-sm">Know the surge before it lands.</h1>
          <p className="body-sm text-text-inverse-muted">
            Demand forecasting and market-localized content for Cebu's tourism businesses.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-sm">
          {[
            ['21', 'category × market signals'],
            ['3', 'tracked source markets'],
            ['24/7', 'surge monitoring'],
          ].map(([stat, label]) => (
            <div key={label}>
              <div className="h-lg num text-mint-primary">{stat}</div>
              <div className="text-meta text-text-inverse-muted">{label}</div>
            </div>
          ))}
        </div>
      </div>
```

Changes: `bg-navy` → `bg-navy-dark` (§1 hero); `p-10` (40px, untokenized) → `p-lg` (48px, `--space-lg`); `.eyebrow text-skyblue` → `.subhead-accent` (§3 tagline, mint); `.h-xl` → `.h-hero` (§3 Hero H1 `2.75rem`/700/1.15, N9); `text-navy-muted` → `text-text-inverse-muted` (N7); stat numerals `text-gold` → `text-mint-primary`; `.body-xs` → `.text-meta`.

### Task 17: `LoginPage.tsx` — form panel

**Files:**
- Modify: `frontend/components/auth/LoginPage.tsx:56-121`

`mode`, `setMode`, `email`, `password`, `error`, `submitting`, `onSubmit`, `onChange`, `required`, `type`, `disabled`, and `title` are all untouched.

- [ ] **Step 1: Remove the inline styles from the tab pair (lines 58–77)**

This is the Quick Start rule-1 violation. Replace lines 58–77 with:

```tsx
          <div className="mb-md flex gap-2 rounded-pill bg-mint-pale p-1">
            <button
              type="button"
              onClick={() => setMode('signin')}
              className="nav-link flex-1 rounded-pill py-2 text-navy-primary transition-colors data-[active=true]:bg-white data-[active=true]:shadow-card"
              data-active={mode === 'signin'}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setMode('signup')}
              className="nav-link flex-1 rounded-pill py-2 text-navy-primary transition-colors data-[active=true]:bg-white data-[active=true]:shadow-card"
              data-active={mode === 'signup'}
            >
              Create account
            </button>
          </div>
```

The `style={…}` props are gone; the existing `data-active` attribute — already present, already driven by `mode` — now carries the styling via `data-[active=true]:` variants. The `onClick` handlers and `data-active` values are byte-identical to before.

- [ ] **Step 2: Restyle the form fields (lines 79–99)**

```tsx
          <form onSubmit={handleSubmit} className="flex flex-col gap-sm">
            <label className="flex flex-col gap-1">
              <span className="form-label">Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="form-label">Password</span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
              />
            </label>
```

`.body-xs` labels → `.form-label` (§3: `0.875rem`/600/`text-heading`, N10); ad-hoc `rounded-md border border-line px-3 py-2` → `.input` (N4: `--radius-sm` 8px, `gray-light` border, `1rem` text, placeholder and hover handled).

- [ ] **Step 3: Restyle the error and submit (lines 100–108)**

```tsx
            {error && <p className="text-meta text-critical">{error}</p>}
            <button type="submit" disabled={submitting} className="btn-primary w-full">
              {mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          </form>
```

The gold pill becomes `.btn-primary` (N1). Sign-in is a brand action, not a booking action, so §4 says mint — coral stays reserved for conversion actions. `disabled={submitting}` is unchanged; `disabled:opacity-60` is dropped because `.btn-primary:disabled` supplies §1's `gray-light` / `gray-text` treatment.

- [ ] **Step 4: Restyle the Google button (lines 110–118)**

```tsx
          <button
            type="button"
            disabled
            aria-disabled
            className="btn-outline mt-sm w-full"
            title="Google OAuth not wired yet"
          >
            Continue with Google
          </button>
```

- [ ] **Step 5: Confirm no `.btn-cta` on this view**

§4: "Only one `.btn-cta` per view/section max," and mint/coral must never compete as equal CTAs. This view correctly has zero `.btn-cta` — there is no booking action on a login screen.

Run: `cd frontend && grep -c "btn-cta" components/auth/LoginPage.tsx`
Expected: `0`.

- [ ] **Step 6: Verify**

Run: `cd frontend && npx tsc --noEmit && npm run build && npm test`
Expected: all exit 0.

- [ ] **Step 7: Behavior check**

Run: `cd frontend && npm run dev`, open `/login`.
Expected, all unchanged from before the restyle: the Sign in / Create account tabs still toggle and the active tab is still visually distinguished; submitting bad credentials still shows the error line; the submit button still disables while in flight; the Google button is still inert.

- [ ] **Step 8: Hand off for commit**

---

## Phase 6: Module Stub Cleanup

The module and settings stubs inherit their styling entirely from `.card` / `.empty` / `.h-lg` / `.body-sm`, all corrected in Phase 1. Only two files need a touch — each references a CSS class that has never existed.

### Task 18: Remove dead classes

**Files:**
- Modify: `frontend/components/module-2/2.2-market-radar/MarketRadarDrawer.tsx:34`
- Modify: `frontend/components/module-4/performance/PostAnalyticsModal.tsx:19`

- [ ] **Step 1: Confirm both classes are undefined**

Run: `cd frontend && grep -nE "^\s*\.(drawer|modal|sb-sec)\b" styles/index.css`
Expected: no output — none of the three is defined anywhere.

- [ ] **Step 2: Drop `.drawer` from `MarketRadarDrawer.tsx:34`**

```tsx
    <div className="empty flex h-full flex-col items-center justify-center gap-xs text-center">
```

- [ ] **Step 3: Drop `.modal` from `PostAnalyticsModal.tsx:19`**

```tsx
    <div className="empty flex h-full flex-col items-center justify-center gap-xs text-center">
```

- [ ] **Step 4: Verify no other stub carries a phantom class**

Run: `cd frontend && grep -rnE "className=\"[^\"]*\b(drawer|modal|sb-sec)\b" components/`
Expected: no output.

- [ ] **Step 5: Verify**

Run: `cd frontend && npx tsc --noEmit && npm run build && npm test`
Expected: all exit 0.

- [ ] **Step 6: Hand off for commit**

---

## Phase 7: Retire the Legacy Palette

The safety net comes down. If any step below finds a surviving reference, fix that call site rather than keeping the token.

### Task 19: Prove nothing references legacy tokens, then delete them

**Files:**
- Modify: `frontend/styles/index.css` — delete the `LEGACY` block
- Modify: `frontend/tests/integration/brand-tokens.test.ts` — add the exclusion assertions

- [ ] **Step 1: Sweep for legacy utility usage**

Run:

```bash
cd frontend && grep -rnE "\b(bg|text|border|shadow|rounded|ring|fill|stroke|divide|outline|from|to|via)-(navy|navy-light|blue|skyblue|navy-muted|teal|cyan|gold|gold-dark|gold-light|gold-wash|yellow|foliage|page|panel|panel-sunk|ink|ink-2|muted|grey|line|line-strong|line-navy|1|2|3|xs|lg)\b" --include=*.tsx --include=*.ts --include=*.css .
```

Expected: no output. The survivors — `bg-navy-primary`, `bg-navy-dark`, `text-text-*`, `shadow-card`, `shadow-overlay`, `rounded-sm/md/pill/full`, `border-gray-light` — none match this pattern.

If anything matches, fix the call site before continuing.

- [ ] **Step 2: Sweep for legacy `var(--…)` usage**

Run:

```bash
cd frontend && grep -rnE "var\(--(color-(navy|navy-light|blue|skyblue|navy-muted|teal|cyan|gold|gold-dark|gold-light|gold-wash|yellow|foliage|page|panel|panel-sunk|ink|ink-2|muted|grey|line|line-strong|line-navy)|shadow-[123]|radius-(xs|lg)|font-(sans|mono))\)" --include=*.tsx --include=*.ts --include=*.css .
```

Expected: no output. (`--font-sans` stays *declared* in `@theme` so Tailwind's default sans resolves to Inter, but nothing should reference it directly.)

- [ ] **Step 3: Delete the legacy block**

Remove everything between `/* ======= LEGACY — deleted in Phase 7. Do not add usages. ======= */` and `/* ======= END LEGACY ======= */`, inclusive, and drop the sentence about legacy tokens from the file header comment.

- [ ] **Step 4: Add exclusion assertions to the token test**

Append to `frontend/tests/integration/brand-tokens.test.ts`:

```ts
const RETIRED_TOKENS = [
  '--color-navy:',
  '--color-navy-light:',
  '--color-blue:',
  '--color-skyblue:',
  '--color-navy-muted:',
  '--color-teal:',
  '--color-cyan:',
  '--color-gold:',
  '--color-gold-dark:',
  '--color-gold-light:',
  '--color-gold-wash:',
  '--color-yellow:',
  '--color-foliage:',
  '--color-page:',
  '--color-panel:',
  '--color-panel-sunk:',
  '--color-ink:',
  '--color-ink-2:',
  '--color-muted:',
  '--color-grey:',
  '--color-line:',
  '--color-line-strong:',
  '--color-line-navy:',
  '--shadow-1:',
  '--shadow-2:',
  '--shadow-3:',
  '--radius-xs:',
  '--radius-lg:',
  '--font-mono:',
];

describe('retired legacy palette', () => {
  it.each(RETIRED_TOKENS)('no longer declares %s', (token) => {
    expect(css).not.toContain(token);
  });
});
```

Note the trailing colons — they match declarations only, so `--color-navy:` does not false-positive on `--color-navy-primary:`.

- [ ] **Step 5: Run the full suite**

Run: `cd frontend && npx tsc --noEmit && npm run build && npm test`
Expected: all exit 0, including the new `retired legacy palette` block.

- [ ] **Step 6: Full visual regression pass**

Run: `cd frontend && npm run dev`. Walk every route: `/login` (both tabs), `/dashboard`, `/content`, `/calendar`, `/performance`, `/settings/profile`, `/settings/platforms`, `/settings/workspace`.

Checklist:
- No gold, sky blue, cyan, or warm-cream surface anywhere.
- Every button is pill-shaped (24px) — no square, no fully-round.
- Every card is 16px radius with the soft navy shadow and 24px padding, no border.
- Headings are Poppins; body, buttons, labels, and inputs are Inter.
- Sidebar is navy, active item mint, Dashboard badge sand.
- Behavior unchanged: tabs toggle, Settings disclosure expands, Sign out works, all nav routes.

- [ ] **Step 7: Hand off for commit**

---

## Verification Summary

| Check | Command | Gates |
|---|---|---|
| Token contract | `cd frontend && npx vitest run tests/integration/brand-tokens.test.ts` | Phases 0, 7 |
| Typecheck | `cd frontend && npx tsc --noEmit` | every phase |
| Build | `cd frontend && npm run build` | every phase |
| Test suite | `cd frontend && npm test` | Phases 1, 3–7 |
| Legacy sweep | the two `grep` commands in Task 19 | Phase 7 |
| Visual pass | `cd frontend && npm run dev` | Phases 1, 3, 5, 7 |

---

## Out of Scope

- `ceview/` — legacy frontend; `.claude/CLAUDE.md` says don't touch it.
- `ui-ux-prototype.html` — the *source* of the retired design system. Left as a historical artifact; it is not shipped.
- `frontend/dist/` — build output; regenerated by `npm run build`.
- Any change to what the module/settings stubs *render*. They stay stubs; only their inherited styling changes.
- Backend, e2e specs, and `docs/` beyond this plan file.
- **§6 photography rules are unexercised.** The frontend contains no `<img>`, `background-image`, or `backgroundImage` anywhere, so "warm natural travel photography" and the "navy overlay at 70–80% opacity behind text" rule have nothing to apply to. `--color-navy-dark/75` is nonetheless established by the Modal/Drawer scrims (Phase 4), so the overlay convention exists the moment the first hero image lands. Re-check §6 when imagery is introduced.

## Open Items to Raise After Execution

1. **Skill gap — dark-background body text.** §3 defines `--color-text-inverse` for headings on dark but no muted body tone. This plan adds `--color-text-inverse-muted: #A9BCCB` (N7). Propose folding it into `tourism-app-branding` §1.
2. **Skill gap — semantic state colors.** The skill defines no error/success/warning colors, so `--color-critical` / `--color-success` were retuned by judgment. Worth codifying.
3. **Skill gap — overlay elevation.** §5 defines only `--shadow-card` and `--shadow-card-hover`; modals and drawers need a heavier step, added here as `--shadow-overlay`.
4. **`.eyebrow` retained as a documented adaptation** (Documented Adaptations §3). If the skill later gains a dashboard-oriented label style, revisit.
5. **Topbar height changed** from fixed `h-16` to `h-auto py-sm` to fit the larger §3 type scale. Flagged because it is the one layout-dimension change in the plan.
6. **Scrim click-to-dismiss is deferred.** The prototype's `#scrim` carries `onclick="dismissTop()"` (`ui-ux-prototype.html:1051`). `AppScrim` renders `pointer-events-none` and inert because wiring that handler is a behavior change, out of scope for a styling-only pass. `dismissTop()` already exists in `useOverlayStack` and is tested, so this is a small follow-up card: drop `pointer-events-none` and add `onClick={dismissTop}`. Raise it as its own task — do not fold it into this plan.
7. **Declared-but-unconsumed by design, all kept deliberately:** `--color-mint-pale-alt` and `--color-coral-cta*` (no alternating section bands and no booking action exist yet) and `.btn-cta` / `.badge--teal` (§1 and §4 mandate the full palette and all three button variants, so they are defined and ready rather than invented ad-hoc later). `--color-gray-text` is consumed only through the `:disabled` rules in the button/input/icon primitives. Do not delete these as "dead code" in a later cleanup pass.
