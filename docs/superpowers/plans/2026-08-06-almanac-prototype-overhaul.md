# Cebu Tourism Almanac — Prototype Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite `ui-ux-prototype.html` in place as *The Cebu Tourism Almanac* — an editorial, dual-theme, ruled-and-typeset interface — preserving every existing feature and interaction.

**Architecture:** Replace 100% of the CSS and rewrite every markup-emitting JS function. Preserve the behavior layer (view routing, `APP_STATE`, the onboarding step machine, overlay plumbing, per-platform caption state, calendar/performance mock records). Build bottom-up: tokens → typography → primitives → shell → charts → screens → polish. Every screen task consumes primitives defined in Tasks 2–7 and introduces no new one-off styling.

**Tech Stack:** Single self-contained HTML file. Vanilla JS, no build step, no framework. Google Fonts (Libre Caslon Display, Libre Caslon Text, Karla, DM Mono) and lucide, both via CDN. CSS custom properties on `html[data-theme]` for the dual palette.

**Spec:** [`docs/superpowers/specs/2026-08-06-almanac-prototype-overhaul-design.md`](../specs/2026-08-06-almanac-prototype-overhaul-design.md)

---

## Working Notes for the Implementer

**Read the spec first.** It is the authority on every token value, type size, component state, and screen composition. This plan sequences the work and supplies code; the spec supplies the design rationale. Where they disagree, the spec wins — and flag it.

**No test framework exists for this file.** The prototype is a standalone artifact at the repo root; `ceview/`'s Vitest and the root `e2e/` Playwright suite do not cover it and must not be extended to. Every task therefore ends with a **Verify** step listing exact browser observations. Perform them literally — open the file, look, confirm. Do not mark a task done on the basis that the code "looks right."

**You will not commit.** This repository's `CLAUDE.md` forbids `git commit` and `git push` under all circumstances. Checkpoints give the human the command to run. Stop and hand back; do not run it yourself.

**Preserve these functions' behavior.** You will rewrite the markup they emit. You must not change what they do:
`goApp`, `toggleSidebar`, `buildNav`, `renderIcons`, `setAuthTab`, `submitAuth`, `hide`, `obRender`, `obNext`, `obPrev`, `obUpdateNextState`, `obRenderSideList`, `obPanelHTML`, `obToggleCategory`, `resetOnboardingDemo`, `obLowScoreAdvance`, `obReturnToStructuredInputs`, `obConnectionRow`, `obToggleConnect`, `obGaugeHTML`, `obLowScorePanelHTML`, `wordCount`, `updateWordCounter`, `selectCategory`, `scoreBand`, `activeCategory`, `openRadar`, `renderRadarDrawer`, `targetThisMarket`, `csTogglePlatform`, `csSetActiveTab`, `csCaptureFormState`, `csApplyFormState`, `csUpdateCaption`, `csUpdatePreview`, `regenCaption`, `checkPublishReady`, `publishPost`, `calendarDayClick`, `openAnalyticsFor`, `toggleCalView`, `performanceFilterChips`, `filterPills`, `openProfileModal`, `pfMarkDirty`, `pfSaveChanges`, `settingsPlatformRow`, `settingsToggleConnect`, `sendInvite`, `openModal`, `closeModal`, `openDrawer`, `closeDrawer`, `ensureScrimFor`, `removeScrimFor`, `showToast`, `window.__jump`.

**Deleted deliberately:** `nextBandHTML` and its `.next-band` CSS (the front-page lead absorbs its role), `toggleChip`, and every legacy token/class in the current `<style>` block.

**Baseline line references** below point at the current file, before any edits. Once Task 2 lands, line numbers shift — navigate by the section comment banners (`/* ===== TOKENS ===== */` etc.), which you will preserve as the file's structural markers.

---

## File Structure

One file changes. Its internal structure after the overhaul:

| Region | Responsibility |
|---|---|
| `<head>` | Meta, favicon, Google Fonts link, lucide script, inline theme bootstrap |
| `<style>` § TOKENS | Both palettes, spacing/radius/rule/motion scales |
| `<style>` § BASE | Reset, canvas, grain overlay, selection, focus |
| `<style>` § TYPE | The 11 type tokens |
| `<style>` § PRIMITIVES | Plate, rule, button, field, ink badge, ruled tabs, ledger, proof frame, stamp, gauge |
| `<style>` § OVERLAYS | Modal, drawer, scrim, toast, banner |
| `<style>` § SHELL | Sidebar spine, masthead, bottom tabs, screen container |
| `<style>` § SCREENS | Per-screen layout rules only — no re-declared component styling |
| `<style>` § MOTION | Keyframes + `prefers-reduced-motion` parity block |
| `<style>` § COLOPHON | Dev jump-bar |
| `<body>` | Static markup: login, onboarding frame, app shell, drawers, modals, toast wrap |
| `<script>` § STATE | `APP_STATE`, theme controller, helpers |
| `<script>` § DATA | `NAV`, `OB_STEPS`, `BUSINESS_CATEGORIES`, `CATEGORIES`, `CS_*`, `CALENDAR_POSTS`, `PERFORMANCE_POSTS` |
| `<script>` § BUILDERS | One `build*()` per screen + their `*HTML()` helpers |
| `<script>` § BEHAVIOR | Interaction handlers, overlays, toasts |
| `<script>` § INIT | Boot sequence + colophon IIFE |

---

## Task 1: Preflight

**Files:** none modified.

- [ ] **Step 1: Confirm the working copy is safe**

Run:

```bash
git -C "c:/Users/austi/CeView" status --short ui-ux-prototype.html
```

Expected: **no output**, meaning the file is clean and this overhaul cannot destroy unsaved work.

If it prints ` M ui-ux-prototype.html`, **STOP**. The file has uncommitted changes and this plan overwrites it. Report to the human and wait. They must run one of:

```bash
git -C "c:/Users/austi/CeView" add ui-ux-prototype.html && git -C "c:/Users/austi/CeView" commit -m "wip: prototype before almanac overhaul"
# or
git -C "c:/Users/austi/CeView" stash push ui-ux-prototype.html
```

Do not proceed, and do not run these yourself.

- [ ] **Step 2: Record the behavior baseline**

Open `ui-ux-prototype.html` in a browser. Using the prototype jump-bar, visit all eight entries (`login`, `onboarding`, `onboarding-low`, `dashboard`, `content`, `calendar`, `performance`, `settings`). Note in your scratch notes, for later comparison:

- Onboarding reports "Step 1 of 6"
- Dashboard category rail has 4 entries; selecting "Tours & Excursions" swaps the market list to 3 markets led by Japan at 88
- Content Studio starts with TikTok + Facebook selected, TikTok tab active
- Performance filter chips read `All / Instagram / Facebook` (TikTok disconnected)
- Settings → Platforms → Connect TikTok makes a TikTok chip appear on Performance

These five facts are the regression checklist you will re-verify in Task 22.

---

## Task 2: Head, tokens, base layer, theme controller

**Files:** Modify `ui-ux-prototype.html` — `<html>` tag (line 2), `<head>` fonts link (line 16), `<style>` opening through the BUTTON banner (lines 18–91).

- [ ] **Step 1: Set the root attributes and swap the font link**

Replace line 2:

```html
<html lang="en" data-view="login" data-theme="ink">
```

Replace line 16 (the Fraunces/Plus Jakarta link) with:

```html
<link href="https://fonts.googleapis.com/css2?family=Libre+Caslon+Display&family=Libre+Caslon+Text:ital,wght@0,400;0,700;1,400&family=Karla:wght@400;500;600;700&family=DM+Mono:wght@300;400;500&display=swap" rel="stylesheet">
```

Update the `theme-color` meta (line 9) to `content="#0A1F23"`.

- [ ] **Step 2: Replace the token block**

Replace lines 19–46 (the `/* ============ TOKENS ============ */` comment through the closing `}` of `:root`) with:

```css
/* ============ TOKENS ============ */
/* Two complete palettes. Ink is the default; paper is the toggle target.
   Every screen-level value below resolves through these — no raw hex in any
   component rule, so the whole system re-themes from this block alone. */
:root{
  /* Scales are theme-independent. */
  --sp-1:4px; --sp-2:8px; --sp-3:12px; --sp-4:16px; --sp-6:24px;
  --sp-8:32px; --sp-12:48px; --sp-16:64px; --sp-24:96px;

  --r-flat:0; --r-tight:2px; --r-round:999px;

  --rule-w:1px; --rule-w-strong:2px;

  --ease-press:cubic-bezier(.2,.7,.2,1);
  --dur-fast:180ms; --dur-mid:400ms; --dur-slow:1100ms;

  --shell-w:240px; --shell-w-collapsed:72px; --content-max:1440px;
}

html[data-theme="ink"]{
  --canvas:#0A1F23;
  --plate:#0E2A2F;
  --plate-sunk:#081A1E;
  --text:#EDE6D6;
  --text-muted:#8FA6A6;
  --rule:rgba(237,230,214,0.14);
  --rule-strong:rgba(237,230,214,0.30);
  --signal:#E9A93C;
  --signal-sunk:rgba(233,169,60,0.14);
  --critical:#D4574A;
  --positive:#5FA37D;
  --grain-opacity:.30;
  --grain-blend:overlay;
  --invert-text:#0A1F23;   /* text that sits on a --text-colored fill */
}

html[data-theme="paper"]{
  --canvas:#F2EDE1;
  --plate:#FAF7EF;
  --plate-sunk:#EBE4D4;
  --text:#0B2429;
  --text-muted:#5A7276;
  --rule:rgba(11,36,41,0.16);
  --rule-strong:rgba(11,36,41,0.34);
  --signal:#B8760F;
  --signal-sunk:rgba(184,118,15,0.12);
  --critical:#9E2B1E;
  --positive:#2F6B4F;
  --grain-opacity:.42;
  --grain-blend:multiply;
  --invert-text:#F2EDE1;
}
```

- [ ] **Step 3: Replace the base layer**

Replace lines 48–71 (the reset through the `:focus-visible` rule) with:

```css
/* ============ BASE ============ */
*{box-sizing:border-box;}
html,body{margin:0;padding:0;}
body{
  font-family:'Karla',sans-serif;
  background:var(--canvas);
  color:var(--text);
  -webkit-font-smoothing:antialiased;
  overscroll-behavior:none;
  transition:background var(--dur-fast) linear, color var(--dur-fast) linear;
}
/* Press grain. Fixed to the viewport so it reads as paper stock rather than
   as a texture scrolling with the content. */
body::before{
  content:''; position:fixed; inset:0; z-index:0; pointer-events:none;
  opacity:var(--grain-opacity); mix-blend-mode:var(--grain-blend);
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='.32'/%3E%3C/svg%3E");
}
body > *{position:relative; z-index:1;}
h1,h2,h3,p{margin:0;}
button{font-family:inherit; cursor:pointer; color:inherit;}
input,select,textarea{font-family:inherit; color:inherit;}
a{color:inherit;}
::selection{background:var(--signal); color:var(--invert-text);}
:focus-visible{outline:var(--rule-w-strong) solid var(--signal); outline-offset:2px; border-radius:0;}

/* The recurring signature: a double rule. Two hairlines 3px apart. */
.rule-double{border-top:var(--rule-w) solid var(--rule-strong); box-shadow:0 3px 0 -2px var(--rule-strong);}
.rule-hair{border-top:var(--rule-w) solid var(--rule);}
```

- [ ] **Step 4: Add the theme controller**

In the `<script>` block, immediately after the `renderIcons` definition (current line 836), insert:

```js
/* ============================================================ THEME ============================================================ */
/** Ink is the default (set as data-theme on <html> in markup so there is no flash).
 *  Paper is the toggle target. No persistence — this is a prototype; reload resets. */
function setTheme(t){
  document.documentElement.setAttribute('data-theme', t);
  const lbl = document.getElementById('theme-toggle-label');
  if(lbl) lbl.textContent = t === 'ink' ? 'INK' : 'PAPER';
  const meta = document.querySelector('meta[name="theme-color"]');
  if(meta) meta.setAttribute('content', t === 'ink' ? '#0A1F23' : '#F2EDE1');
}
function toggleTheme(){
  setTheme(document.documentElement.getAttribute('data-theme') === 'ink' ? 'paper' : 'ink');
}
```

- [ ] **Step 5: Verify**

Open the file in a browser. Expected: the page renders on a dark petrol canvas with warm off-white text, visibly grained. Layout will be broken and unstyled in places — that is correct at this stage; only the canvas, text color, and grain are being confirmed. In the console, run `toggleTheme()`. Expected: the canvas flips to warm paper with dark petrol text, and the grain switches to multiply blend. Run it again — expected: back to ink. No console errors.

---

## Task 3: Typography layer

**Files:** Modify `ui-ux-prototype.html` — replace the type block (current lines 73–90).

- [ ] **Step 1: Replace the type scale**

```css
/* ============ TYPE ============ */
/* Caslon Display is a display cut — never used below 30px.
   Caslon Text carries editorial voice at reading sizes.
   Karla carries all UI chrome. DM Mono carries every figure and label. */
.t-masthead{font-family:'Libre Caslon Display',serif; font-size:34px; line-height:36px; letter-spacing:-.01em;}
.t-lead{font-family:'Libre Caslon Display',serif; font-size:30px; line-height:34px; letter-spacing:-.015em;}
.t-figure-xl{
  font-family:'Libre Caslon Display',serif; font-size:56px; line-height:52px;
  letter-spacing:-.03em; font-variant-numeric:tabular-nums;
}
.t-h1{font-family:'Libre Caslon Text',serif; font-weight:700; font-size:22px; line-height:28px;}
.t-h2{font-family:'Libre Caslon Text',serif; font-weight:700; font-size:17px; line-height:24px;}
.t-deck{font-family:'Libre Caslon Text',serif; font-style:italic; font-size:15px; line-height:23px; color:var(--text-muted);}
.t-body{font-family:'Karla',sans-serif; font-weight:400; font-size:14px; line-height:21px;}
.t-body-em{font-family:'Karla',sans-serif; font-weight:600; font-size:14px; line-height:21px;}
.t-label{
  font-family:'DM Mono',monospace; font-weight:500; font-size:11px; line-height:14px;
  text-transform:uppercase; letter-spacing:.12em; color:var(--text-muted);
}
.t-figure{font-family:'DM Mono',monospace; font-weight:400; font-size:15px; line-height:20px; font-variant-numeric:tabular-nums;}
.t-foot{font-family:'DM Mono',monospace; font-weight:300; font-size:10px; line-height:14px; letter-spacing:.06em; color:var(--text-muted);}

/* Letterpress ink-bite on editorial headlines. Omitted on t-figure-xl, where it
   muddies the numeral's counters at scale. */
.t-masthead, .t-lead{text-shadow:0 1px 0 var(--canvas);}

@media(min-width:1024px){
  .t-masthead{font-size:62px; line-height:62px;}
  .t-lead{font-size:52px; line-height:54px;}
  .t-figure-xl{font-size:96px; line-height:88px;}
  .t-h1{font-size:28px; line-height:34px;}
  .t-h2{font-size:20px; line-height:28px;}
  .t-deck{font-size:17px; line-height:26px;}
  .t-body,.t-body-em{font-size:15px; line-height:23px;}
  .t-figure{font-size:16px; line-height:22px;}
}
```

- [ ] **Step 2: Verify**

In the browser console, run:

```js
document.body.insertAdjacentHTML('afterbegin',
  '<div style="padding:40px"><div class="t-masthead">CeView</div><div class="t-lead">Korean divers, +34%</div><div class="t-figure-xl">92</div><div class="t-h1">Screen title</div><div class="t-deck">Standfirst italic</div><div class="t-body">Body copy in Karla.</div><div class="t-label">SECTION LABEL</div><div class="t-figure">12,480</div><div class="t-foot">SOURCE · SAMPLE</div></div>');
```

Expected: masthead and lead render in a high-contrast serif with visible thick/thin modulation; `92` renders very large in the same serif; body copy renders in a grotesque sans with a distinctive single-storey `a`-adjacent character; the label and figure render in monospace with the label letterspaced and uppercase. Confirm no font falls back to a system serif/sans — compare against the Google Fonts specimens if unsure. Reload to clear the injected markup.

- [ ] **Step 3: Checkpoint**

Report to the human: tokens and typography are in. Suggested command for them:

```bash
git -C "c:/Users/austi/CeView" add ui-ux-prototype.html docs/superpowers && git -C "c:/Users/austi/CeView" commit -m "feat(prototype): almanac tokens and type scale"
```

---

## Task 4: Core primitives

**Files:** Modify `ui-ux-prototype.html` — replace lines 92–194 wholesale. That range covers the BUTTON, CARD, SECTION HEADING, REVEAL/STAGGER, FORM, TOGGLE, CHIP/BADGE, and GAUGE blocks. The reveal/stagger keyframes deleted here are re-authored in Task 7's MOTION section — do not try to preserve them.

- [ ] **Step 1: Write the primitives block**

```css
/* ============ PRIMITIVES ============ */

/* ---- Plate: the ruled container that replaces .card. No shadow, no radius. ---- */
.plate{background:var(--plate); border:var(--rule-w) solid var(--rule); border-radius:var(--r-flat); padding:var(--sp-4);}
@media(min-width:1024px){.plate{padding:var(--sp-6);}}
.plate-flush{background:transparent; border:none; border-top:var(--rule-w) solid var(--rule); padding:var(--sp-4) 0;}
.plate-lead{background:var(--plate); border:var(--rule-w) solid var(--rule); border-top:var(--rule-w-strong) solid var(--signal); position:relative;}
.plate-lead::before{content:''; position:absolute; inset:0; background:var(--signal-sunk); pointer-events:none;}
.plate-lead > *{position:relative;}
.plate-hd{display:flex; align-items:baseline; justify-content:space-between; gap:var(--sp-3); margin-bottom:var(--sp-3); padding-bottom:var(--sp-2); border-bottom:var(--rule-w) solid var(--rule);}

/* ---- Section heading: label eyebrow above a ruled title ---- */
.sec{margin-bottom:var(--sp-4);}
.sec .sec-label{display:block; margin-bottom:var(--sp-2);}
.sec .sec-title{display:block;}

/* ---- Button ---- */
.btn{
  display:inline-flex; align-items:center; justify-content:center; gap:var(--sp-2);
  border-radius:var(--r-tight); border:var(--rule-w) solid transparent;
  padding:0 var(--sp-4); height:44px; white-space:nowrap;
  font-family:'Karla',sans-serif; font-weight:700; font-size:12px;
  text-transform:uppercase; letter-spacing:.08em;
  transition:background var(--dur-fast) var(--ease-press),
             border-color var(--dur-fast) var(--ease-press),
             color var(--dur-fast) var(--ease-press);
}
.btn svg{width:15px; height:15px; flex-shrink:0; stroke-width:1.25;}
.btn-sm{height:32px; padding:0 var(--sp-3); font-size:11px;}
.btn-lg{height:54px; padding:0 var(--sp-6); font-size:13px;}
.btn-primary{background:var(--text); color:var(--invert-text); border-color:var(--text);}
.btn-primary:hover{background:transparent; color:var(--text);}
.btn-signal{background:var(--signal); color:var(--invert-text); border-color:var(--signal);}
.btn-signal:hover{background:transparent; color:var(--signal);}
.btn-ghost{background:transparent; color:var(--text); border-color:var(--rule-strong);}
.btn-ghost:hover{border-color:var(--text); background:var(--plate);}
.btn-destructive{background:transparent; color:var(--critical); border-color:var(--critical);}
.btn-destructive:hover{background:var(--critical); color:var(--invert-text);}
.btn[disabled], .btn.is-disabled{opacity:.35; pointer-events:none;}
.btn-block{width:100%;}
.btn.is-loading{position:relative; color:transparent !important;}
.btn.is-loading::after{
  content:''; position:absolute; width:14px; height:14px;
  border:var(--rule-w-strong) solid currentColor; border-top-color:transparent;
  animation:spin .7s linear infinite;
}
.btn-primary.is-loading::after{border-color:var(--invert-text); border-top-color:transparent;}
@keyframes spin{to{transform:rotate(360deg);}}

/* ---- Field: flush fill, bottom rule only. Label always above, never a placeholder. ---- */
.field{display:flex; flex-direction:column; gap:var(--sp-2); margin-bottom:var(--sp-4);}
.field > label{font-family:'DM Mono',monospace; font-weight:500; font-size:11px; line-height:14px; text-transform:uppercase; letter-spacing:.12em; color:var(--text-muted);}
.field .opt{text-transform:none; letter-spacing:0; opacity:.7;}
.field input, .field select, .field textarea{
  min-height:44px; background:transparent; color:var(--text);
  border:none; border-bottom:var(--rule-w) solid var(--rule-strong);
  border-radius:var(--r-flat); padding:var(--sp-2) 0;
  font-family:'Karla',sans-serif; font-size:15px; outline:none;
  transition:border-color var(--dur-fast) var(--ease-press);
}
.field textarea{min-height:96px; resize:vertical; line-height:22px;}
.field input::placeholder, .field textarea::placeholder{color:var(--text-muted); opacity:.7;}
.field input:focus, .field select:focus, .field textarea:focus{border-bottom-width:var(--rule-w-strong); border-bottom-color:var(--signal);}
.field.has-error input, .field.has-error textarea{border-bottom-color:var(--critical);}
.field .err{font-family:'DM Mono',monospace; font-size:10px; letter-spacing:.06em; color:var(--critical); display:none;}
.field.has-error .err{display:block;}
.field .charcount{align-self:flex-end; font-family:'DM Mono',monospace; font-size:10px; letter-spacing:.06em; color:var(--text-muted);}

/* ---- Tag input (Core Services) ---- */
.tag-input{display:flex; flex-wrap:wrap; gap:var(--sp-2); border-bottom:var(--rule-w) solid var(--rule-strong); padding:var(--sp-2) 0; min-height:44px;}
.tag-input .tag{
  display:inline-flex; align-items:center; gap:var(--sp-2);
  border:var(--rule-w) solid var(--rule-strong); border-radius:var(--r-tight);
  padding:3px var(--sp-2); font-family:'DM Mono',monospace; font-size:11px; letter-spacing:.06em;
}
.tag-input input{border:none; outline:none; background:transparent; flex:1; min-width:110px; font-size:15px; color:var(--text);}

/* ---- Toggle: a ruled switch, square, no pill ---- */
.switch{
  position:relative; width:46px; height:24px; flex-shrink:0; padding:0;
  background:transparent; border:var(--rule-w) solid var(--rule-strong); border-radius:var(--r-tight);
  transition:border-color var(--dur-fast) var(--ease-press), background var(--dur-fast) var(--ease-press);
}
.switch::after{
  content:''; position:absolute; top:3px; left:3px; width:16px; height:16px;
  background:var(--text-muted); transition:transform var(--dur-fast) var(--ease-press), background var(--dur-fast) var(--ease-press);
}
.switch.on{border-color:var(--signal); background:var(--signal-sunk);}
.switch.on::after{transform:translateX(22px); background:var(--signal);}
.toggle-row{display:flex; align-items:center; justify-content:space-between; gap:var(--sp-4); padding:var(--sp-3) 0; border-bottom:var(--rule-w) solid var(--rule);}
.toggle-row:last-child{border-bottom:none;}
.toggle-row .lbl{display:flex; flex-direction:column; gap:2px;}

/* ---- Ink badge: outlined rectangle, mono label ---- */
.ibadge{
  display:inline-flex; align-items:center; gap:var(--sp-1);
  border:var(--rule-w) solid var(--rule-strong); border-radius:var(--r-tight);
  padding:2px var(--sp-2);
  font-family:'DM Mono',monospace; font-weight:500; font-size:10px;
  letter-spacing:.10em; text-transform:uppercase; color:var(--text-muted);
}
.ibadge svg{width:11px; height:11px; stroke-width:1.25;}
.ibadge-ai{border-color:var(--signal); color:var(--signal);}
.ibadge-published{border-color:var(--positive); color:var(--positive);}
.ibadge-draft{border-color:var(--rule-strong); color:var(--text-muted);}
.ibadge-scheduled{border-color:var(--text-muted); color:var(--text);}
.ibadge-alert{border-color:var(--critical); color:var(--critical);}

/* ---- Selectable cell: replaces .chip for multi-select surfaces ---- */
.cell{
  display:inline-flex; align-items:center; gap:var(--sp-2);
  border:var(--rule-w) solid var(--rule-strong); border-radius:var(--r-tight);
  padding:var(--sp-2) var(--sp-3); background:transparent; color:var(--text);
  font-family:'Karla',sans-serif; font-weight:600; font-size:13px; white-space:nowrap;
  transition:border-color var(--dur-fast) var(--ease-press), background var(--dur-fast) var(--ease-press);
}
.cell svg{width:14px; height:14px; stroke-width:1.25;}
.cell:hover{border-color:var(--text);}
.cell.selected{background:var(--text); color:var(--invert-text); border-color:var(--text);}
.cell-grid{display:flex; flex-wrap:wrap; gap:var(--sp-2);}

/* ---- Ruled tabs: shared baseline rule, sliding ink underscore ---- */
.rtabs{display:flex; gap:var(--sp-6); border-bottom:var(--rule-w) solid var(--rule); margin-bottom:var(--sp-4); overflow-x:auto;}
.rtab{
  background:none; border:none; padding:0 0 var(--sp-2); position:relative; white-space:nowrap;
  font-family:'DM Mono',monospace; font-weight:500; font-size:11px;
  letter-spacing:.12em; text-transform:uppercase; color:var(--text-muted);
  transition:color var(--dur-fast) var(--ease-press);
}
.rtab::after{
  content:''; position:absolute; left:0; right:0; bottom:-1px; height:var(--rule-w-strong);
  background:var(--text); transform:scaleX(0); transform-origin:left;
  transition:transform var(--dur-fast) var(--ease-press);
}
.rtab:hover{color:var(--text);}
.rtab.active{color:var(--text);}
.rtab.active::after{transform:scaleX(1);}

/* ---- Ledger: the dense data primitive ---- */
.ledger{width:100%; border-collapse:collapse;}
.ledger th{
  text-align:left; padding:0 var(--sp-3) var(--sp-2) 0; border-bottom:var(--rule-w) solid var(--rule-strong);
  font-family:'DM Mono',monospace; font-weight:500; font-size:10px;
  letter-spacing:.12em; text-transform:uppercase; color:var(--text-muted);
}
.ledger td{padding:var(--sp-3) var(--sp-3) var(--sp-3) 0; border-bottom:var(--rule-w) solid var(--rule); vertical-align:middle;}
.ledger .num{font-family:'DM Mono',monospace; font-variant-numeric:tabular-nums; text-align:right;}
.ledger th.num{text-align:right;}
.ledger tr.clickable{cursor:pointer; transition:background var(--dur-fast) var(--ease-press);}
.ledger tr.clickable:hover{background:var(--plate);}
.ledger tr.is-hot td{border-bottom-color:var(--signal);}

/* Ledger rows as buttons, where a real <table> would fight the layout. */
.lrow{
  width:100%; text-align:left; display:flex; align-items:center; gap:var(--sp-3);
  background:transparent; border:none; border-bottom:var(--rule-w) solid var(--rule);
  padding:var(--sp-3) 0; transition:background var(--dur-fast) var(--ease-press);
}
.lrow:hover{background:var(--plate);}
.lrow.is-active{border-left:var(--rule-w-strong) solid var(--signal); padding-left:var(--sp-3);}

/* ---- Trend marks: typographic, never iconographic ---- */
.trend{font-family:'DM Mono',monospace; font-size:12px; letter-spacing:.04em;}
.trend-up{color:var(--positive);}
.trend-down{color:var(--critical);}

/* ---- Country marker: mono square, replaces flag emoji (they do not render on Windows/Chrome) ---- */
.cmark{
  width:36px; height:36px; flex-shrink:0; display:inline-flex; align-items:center; justify-content:center;
  border:var(--rule-w) solid var(--rule-strong); border-radius:var(--r-tight);
  font-family:'DM Mono',monospace; font-weight:500; font-size:12px; letter-spacing:.06em;
}
.is-hot .cmark{border-color:var(--signal); color:var(--signal);}

/* ---- Proof frame: platform previews sit inside this, styled unlike anything else ---- */
.proof{position:relative; border:var(--rule-w) solid var(--rule-strong); padding:var(--sp-4); background:var(--plate-sunk);}
.proof::before, .proof::after{
  content:''; position:absolute; width:8px; height:8px; border:var(--rule-w) solid var(--signal);
}
.proof::before{top:4px; left:4px; border-right:none; border-bottom:none;}
.proof::after{bottom:4px; right:4px; border-left:none; border-top:none;}
.proof-cap{margin-top:var(--sp-3); padding-top:var(--sp-2); border-top:var(--rule-w) solid var(--rule);}

/* ---- Press stamp: the uniqueness-score reveal ---- */
.stamp{
  width:200px; height:200px; margin:0 auto; position:relative;
  border:var(--rule-w-strong) solid var(--signal); border-radius:var(--r-round);
  display:flex; flex-direction:column; align-items:center; justify-content:center;
  transform:rotate(-8deg);
}
.stamp::before{
  content:''; position:absolute; inset:7px; border:var(--rule-w) solid var(--signal); border-radius:var(--r-round); opacity:.5;
}
.stamp .stamp-top, .stamp .stamp-bot{font-family:'DM Mono',monospace; font-size:9px; letter-spacing:.22em; text-transform:uppercase; color:var(--signal);}
.stamp .stamp-val{color:var(--signal);}
.stamp.is-low{border-color:var(--critical);}
.stamp.is-low::before{border-color:var(--critical);}
.stamp.is-low .stamp-top, .stamp.is-low .stamp-bot, .stamp.is-low .stamp-val{color:var(--critical);}

/* ---- Hairline gauge ---- */
.gauge{position:relative; width:132px; height:132px; margin:0 auto;}
.gauge svg{transform:rotate(-90deg);}
.gauge circle.track{stroke:var(--rule); fill:none;}
.gauge circle.fill{stroke:var(--signal); fill:none; stroke-linecap:butt;}
.gauge.is-low circle.fill{stroke:var(--critical);}
.gauge .val{position:absolute; inset:0; display:flex; align-items:center; justify-content:center;}

/* ---- Linear progress: a rule that fills ---- */
.prog{height:var(--rule-w-strong); background:var(--rule);}
.prog > i{display:block; height:100%; background:var(--signal); transition:width var(--dur-mid) var(--ease-press);}

/* ---- Upload well ---- */
.well{
  border:var(--rule-w) dashed var(--rule-strong); border-radius:var(--r-flat);
  padding:var(--sp-8) var(--sp-4); text-align:center; color:var(--text-muted); cursor:pointer;
  transition:border-color var(--dur-fast) var(--ease-press);
}
.well:hover{border-color:var(--signal); color:var(--text);}

/* ---- Empty state ---- */
.empty{display:flex; flex-direction:column; align-items:center; text-align:center; gap:var(--sp-3); padding:var(--sp-12) var(--sp-4); color:var(--text-muted);}
.empty svg{width:24px; height:24px; stroke-width:1.25; color:var(--signal);}

/* ---- Footnote strip ---- */
.footnote{margin-top:var(--sp-4); padding-top:var(--sp-2); border-top:var(--rule-w) solid var(--rule);}
```

- [ ] **Step 2: Verify**

In the console, run:

```js
document.body.insertAdjacentHTML('afterbegin',
  '<div style="padding:40px;display:flex;flex-direction:column;gap:16px">'+
  '<div><button class="btn btn-primary">Primary</button> <button class="btn btn-signal">Signal</button> <button class="btn btn-ghost">Ghost</button> <button class="btn btn-destructive">Destructive</button></div>'+
  '<div class="plate"><div class="plate-hd"><span class="t-h2">Plate</span><span class="ibadge ibadge-ai">AI</span></div><p class="t-body">Ruled container, no shadow, no radius.</p></div>'+
  '<div class="rtabs"><button class="rtab active">Instagram</button><button class="rtab">TikTok</button><button class="rtab">Facebook</button></div>'+
  '<div class="field"><label>Business Name</label><input value="Sunset Dive Co."></div>'+
  '<div><span class="cmark">KR</span> <span class="ibadge ibadge-published">Connected</span> <span class="trend trend-up">↑ +34%</span></div>'+
  '<button class="switch on"></button>'+
  '</div>');
```

Expected, in both themes (run `toggleTheme()` between passes):

1. No element has rounded corners beyond a barely-perceptible 2px; no element casts a drop shadow.
2. Primary button is a solid ink fill that **inverts to outline-only** on hover; signal button is amber.
3. The field has a bottom rule only — no box around the input — and the rule turns amber and thickens on focus.
4. The active ruled tab shows a 2px underscore; the others do not.
5. Ink badges are outlined rectangles with monospace uppercase labels, not filled pills.
6. The switch is a square ruled toggle whose thumb sits right and turns amber when `.on`.

Reload to clear.

- [ ] **Step 3: Checkpoint**

Report: primitives complete. Suggested commit message: `feat(prototype): almanac component primitives`.

---

## Task 5: Overlays and feedback

**Files:** Modify `ui-ux-prototype.html` — replace the MODAL/DRAWER/SCRIM, TOAST, and banner blocks (current lines 300–349).

- [ ] **Step 1: Write the overlay block**

Geometry and show/hide class contracts are unchanged from the current file — `openModal`/`closeModal`/`openDrawer`/`closeDrawer` all toggle `.show`, and the mobile breakpoints stay where they are. Only the surface treatment changes.

```css
/* ============ OVERLAYS ============ */
.scrim{position:fixed; inset:0; background:rgba(4,14,16,.62); z-index:40; opacity:0; pointer-events:none; transition:opacity var(--dur-fast) linear;}
.scrim.show{opacity:1; pointer-events:auto;}

.modal{
  position:fixed; z-index:41; background:var(--plate); color:var(--text);
  border:var(--rule-w) solid var(--rule-strong); border-radius:var(--r-flat);
  box-shadow:0 12px 24px rgba(0,0,0,.35);
  left:50%; top:50%; transform:translate(-50%,-46%); width:min(620px,92vw); max-height:86vh; overflow:auto;
  opacity:0; pointer-events:none; transition:opacity var(--dur-fast) var(--ease-press), transform var(--dur-fast) var(--ease-press);
}
.modal.show{opacity:1; pointer-events:auto; transform:translate(-50%,-50%);}
@media(max-width:639px){
  .modal{left:0; top:auto; bottom:0; transform:translateY(16px); width:100%; max-height:92vh; border-bottom:none;}
  .modal.show{transform:translateY(0);}
}
.modal-hd{
  display:flex; align-items:center; justify-content:space-between; gap:var(--sp-3);
  padding:var(--sp-4) var(--sp-6); border-bottom:var(--rule-w) solid var(--rule-strong);
  position:sticky; top:0; background:var(--plate); z-index:2;
}
.modal-bd{padding:var(--sp-6);}

.drawer{
  position:fixed; z-index:41; background:var(--plate); color:var(--text);
  border-left:var(--rule-w) solid var(--rule-strong); box-shadow:-8px 0 24px rgba(0,0,0,.30);
  top:0; right:0; height:100%; width:440px; max-width:92vw;
  transform:translateX(100%); transition:transform var(--dur-mid) var(--ease-press); overflow:auto;
}
.drawer.show{transform:translateX(0);}
@media(max-width:767px){
  .drawer{top:auto; bottom:0; right:0; width:100%; height:auto; max-height:85vh;
          border-left:none; border-top:var(--rule-w-strong) solid var(--signal);
          transform:translateY(100%);}
  .drawer.show{transform:translateY(0);}
  .drawer .drag-handle{width:44px; height:var(--rule-w-strong); background:var(--rule-strong); margin:var(--sp-3) auto 0;}
}
.drawer-hd{position:sticky; top:0; background:var(--plate); padding:var(--sp-4) var(--sp-6); border-bottom:var(--rule-w) solid var(--rule-strong); z-index:2;}
.drawer-bd{padding:var(--sp-6);}

.close-x{background:none; border:none; color:var(--text-muted); display:flex; padding:var(--sp-1); border-radius:var(--r-tight);}
.close-x:hover{color:var(--text); background:var(--plate-sunk);}
.close-x svg{stroke-width:1.25;}

/* ---- Toast: a ruled strip, not a floating pill ---- */
.toast-wrap{position:fixed; z-index:60; bottom:88px; left:var(--sp-4); right:var(--sp-4); display:flex; flex-direction:column; gap:var(--sp-2);}
@media(min-width:1024px){.toast-wrap{left:auto; right:var(--sp-6); bottom:var(--sp-6); width:360px;}}
.toast{
  background:var(--plate); color:var(--text);
  border:var(--rule-w) solid var(--rule-strong); border-left:var(--rule-w-strong) solid var(--signal);
  padding:var(--sp-3) var(--sp-4); display:flex; align-items:center; gap:var(--sp-3);
  font-family:'DM Mono',monospace; font-size:11px; letter-spacing:.06em;
  animation:toast-in var(--dur-fast) var(--ease-press), toast-out var(--dur-fast) var(--ease-press) 3.6s forwards;
}
.toast svg{width:14px; height:14px; stroke-width:1.25; color:var(--signal); flex-shrink:0;}
@keyframes toast-in{from{opacity:0; transform:translateY(8px);} to{opacity:1; transform:none;}}
@keyframes toast-out{to{opacity:0;}}

/* ---- Banner ---- */
.banner{
  display:flex; gap:var(--sp-3); align-items:flex-start;
  padding:var(--sp-3) var(--sp-4); border:var(--rule-w) solid var(--rule);
  border-left:var(--rule-w-strong) solid; margin-bottom:var(--sp-4);
  font-family:'Karla',sans-serif; font-size:14px;
}
.banner svg{width:16px; height:16px; stroke-width:1.25; flex-shrink:0; margin-top:2px;}
.banner-error{border-left-color:var(--critical); color:var(--critical);}
.banner-warning{border-left-color:var(--signal); color:var(--text); background:var(--signal-sunk);}
.banner-success{border-left-color:var(--positive); color:var(--positive);}
.banner-info{border-left-color:var(--text-muted); color:var(--text);}
.banner .close-x{margin-left:auto;}
```

- [ ] **Step 2: Verify**

Reload. In the console run `showToast('Post published to 2 platforms','check-circle')`. Expected: a ruled strip appears bottom-right (desktop width) with an amber left rule and a monospace label, then fades after ~4s. Then run `openModal('invite-modal')`. Expected: the invite modal centers with a ruled border, a monospace-free Caslon header, and no rounded corners; clicking the scrim closes it. Then `openDrawer('notif-drawer')` — expected: slides in from the right with a ruled left border. Repeat both in paper theme.

---

## Task 6: App shell — spine, masthead, tabs

**Files:** Modify `ui-ux-prototype.html` — replace the APP SHELL CSS (current lines 351–419) and the topbar markup (lines 679–691); rewrite `buildNav` (lines 868–883).

- [ ] **Step 1: Write the shell CSS**

```css
/* ============ SHELL ============ */
.app-shell{display:none; min-height:100vh;}
html[data-view]:not([data-view="login"]):not([data-view="onboarding"]) .app-shell{display:flex;}
html[data-view="login"] #view-login{display:flex;}
html[data-view="onboarding"] #view-onboarding{display:block;}
#view-login, #view-onboarding{display:none;}

/* ---- Spine (desktop sidebar) ---- */
.sidebar{
  display:none; flex-direction:column; width:var(--shell-w); flex-shrink:0;
  background:var(--plate-sunk); border-right:var(--rule-w) solid var(--rule-strong);
  padding:var(--sp-6) 0; transition:width var(--dur-fast) var(--ease-press);
}
@media(min-width:1024px){.sidebar{display:flex;}}
.sidebar.collapsed{width:var(--shell-w-collapsed);}
.sb-brand{padding:0 var(--sp-6) var(--sp-4); border-bottom:var(--rule-w) solid var(--rule); margin-bottom:var(--sp-6);}
.sb-brand .word{font-family:'Libre Caslon Display',serif; font-size:24px; line-height:1; white-space:nowrap;}
.sidebar.collapsed .word{font-size:16px;}
.sb-nav{display:flex; flex-direction:column; padding:0 var(--sp-3); flex:1; gap:var(--rule-w);}
.sb-item{
  display:flex; align-items:center; gap:var(--sp-3); width:100%; text-align:left;
  padding:var(--sp-3); background:none; border:none; border-left:var(--rule-w-strong) solid transparent;
  color:var(--text-muted); position:relative;
  font-family:'Karla',sans-serif; font-weight:600; font-size:12px;
  text-transform:uppercase; letter-spacing:.10em;
  transition:color var(--dur-fast) var(--ease-press), border-color var(--dur-fast) var(--ease-press), background var(--dur-fast) var(--ease-press);
}
.sb-item svg{width:18px; height:18px; stroke-width:1.25; flex-shrink:0;}
.sb-item .numeral{font-family:'DM Mono',monospace; font-size:10px; letter-spacing:.12em; opacity:.6; width:20px; flex-shrink:0;}
.sb-item:hover{color:var(--text); background:var(--plate);}
.sb-item.active{color:var(--text); border-left-color:var(--signal); background:var(--plate);}
.sb-item .count{
  margin-left:auto; border:var(--rule-w) solid var(--signal); color:var(--signal);
  font-family:'DM Mono',monospace; font-size:10px; padding:1px 5px; border-radius:var(--r-tight);
}
.sidebar.collapsed .label, .sidebar.collapsed .count, .sidebar.collapsed .numeral{display:none;}
.sb-foot{padding:var(--sp-3); border-top:var(--rule-w) solid var(--rule); margin-top:var(--sp-4);}
.sb-collapse{
  display:flex; align-items:center; gap:var(--sp-3); width:100%; padding:var(--sp-3);
  background:none; border:none; color:var(--text-muted);
  font-family:'DM Mono',monospace; font-size:10px; letter-spacing:.12em; text-transform:uppercase;
}
.sb-collapse:hover{color:var(--text);}
.sb-collapse svg{width:16px; height:16px; stroke-width:1.25;}

/* ---- Masthead ---- */
.main-col{flex:1; min-width:0; display:flex; flex-direction:column;}
.masthead{
  display:flex; align-items:center; justify-content:space-between; gap:var(--sp-4);
  padding:var(--sp-3) var(--sp-4); background:var(--canvas);
  border-bottom:var(--rule-w) solid var(--rule-strong);
  box-shadow:0 3px 0 -2px var(--rule-strong);
  position:sticky; top:0; z-index:20;
}
@media(min-width:1024px){.masthead{padding:var(--sp-4) var(--sp-8);}}
.mh-id{display:flex; flex-direction:column; gap:2px; min-width:0;}
.mh-actions{display:flex; align-items:center; gap:var(--sp-2); flex-shrink:0;}
.mh-btn{background:none; border:var(--rule-w) solid transparent; color:var(--text-muted); padding:var(--sp-2); border-radius:var(--r-tight); position:relative; display:flex;}
.mh-btn:hover{color:var(--text); border-color:var(--rule-strong);}
.mh-btn svg{width:18px; height:18px; stroke-width:1.25;}
.mh-btn .dot{position:absolute; top:4px; right:4px; width:6px; height:6px; background:var(--signal);}
.theme-toggle{
  display:flex; align-items:center; gap:var(--sp-2); background:none;
  border:var(--rule-w) solid var(--rule-strong); border-radius:var(--r-tight);
  padding:var(--sp-2) var(--sp-3); color:var(--text-muted);
  font-family:'DM Mono',monospace; font-size:10px; letter-spacing:.12em;
}
.theme-toggle:hover{color:var(--text); border-color:var(--text);}
.theme-toggle .knob{width:8px; height:8px; border-radius:var(--r-round); background:var(--signal);}

/* ---- Screen container ---- */
.screen{padding:var(--sp-4); max-width:var(--content-max); margin:0 auto; width:100%; padding-bottom:var(--sp-24);}
@media(min-width:1024px){.screen{padding:var(--sp-8); padding-bottom:var(--sp-8);}}
.screen-hd{margin-bottom:var(--sp-6); padding-bottom:var(--sp-3); border-bottom:var(--rule-w) solid var(--rule-strong);}

/* ---- Bottom tabs (mobile) ---- */
.bottom-tabs{
  display:flex; position:fixed; bottom:0; left:0; right:0; background:var(--canvas);
  border-top:var(--rule-w-strong) solid var(--rule-strong); z-index:30; padding-bottom:env(safe-area-inset-bottom);
}
@media(min-width:1024px){.bottom-tabs{display:none;}}
.bt-item{
  flex:1; display:flex; flex-direction:column; align-items:center; gap:3px;
  padding:var(--sp-3) var(--sp-1) var(--sp-2); background:none; border:none;
  border-top:var(--rule-w-strong) solid transparent; color:var(--text-muted); position:relative; margin-top:-2px;
}
.bt-item svg{width:20px; height:20px; stroke-width:1.25;}
.bt-item .lbl{font-family:'DM Mono',monospace; font-size:9px; letter-spacing:.10em; text-transform:uppercase;}
.bt-item.active{color:var(--text); border-top-color:var(--signal);}
.bt-item .dot{position:absolute; top:6px; right:calc(50% - 16px); width:5px; height:5px; background:var(--signal);}

/* ---- Layout helpers ---- */
.grid-2{display:grid; grid-template-columns:1fr; gap:var(--sp-4);}
.grid-2 > *{min-width:0;}
@media(min-width:1024px){.grid-2{grid-template-columns:1fr 1fr; gap:var(--sp-8);}}
.hscroll{display:flex; gap:var(--sp-3); overflow-x:auto; padding-bottom:var(--sp-1);}
.hscroll::-webkit-scrollbar{height:4px;}
.hscroll::-webkit-scrollbar-thumb{background:var(--rule-strong);}
```

- [ ] **Step 2: Replace the topbar markup with the masthead**

Replace the `<div class="topbar">…</div>` block (current lines 679–691) with:

```html
    <div class="masthead">
      <div class="mh-id">
        <span class="t-label" id="mh-dateline">CEBU, PHILIPPINES</span>
        <span class="t-h2">Sunset Dive Co.</span>
      </div>
      <div class="mh-actions">
        <button class="theme-toggle" onclick="toggleTheme()" aria-label="Switch colour theme">
          <span class="knob"></span><span id="theme-toggle-label">INK</span>
        </button>
        <button class="mh-btn" onclick="openDrawer('notif-drawer')" aria-label="Open notifications">
          <span data-lucide="bell"></span><span class="dot"></span>
        </button>
      </div>
    </div>
```

- [ ] **Step 3: Rewrite `buildNav` and add the dateline**

Replace `NAV` and `buildNav` (current lines 860–883) with:

```js
const NAV = [
  {id:'dashboard',   label:'Dashboard',      numeral:'I',   icon:'layout-dashboard', badge:3},
  {id:'content',     label:'Content Studio', numeral:'II',  icon:'sparkles'},
  {id:'calendar',    label:'Calendar',       numeral:'III', icon:'calendar-days'},
  {id:'performance', label:'Performance',    numeral:'IV',  icon:'bar-chart-3'},
  {id:'settings',    label:'Settings',       numeral:'V',   icon:'settings'},
];

function buildNav(){
  document.getElementById('sb-nav').innerHTML = NAV.map(n => `
    <button class="sb-item" data-nav="${n.id}" onclick="goApp('${n.id}')">
      <span class="numeral">${n.numeral}</span>
      <span data-lucide="${n.icon}"></span>
      <span class="label">${n.label}</span>
      ${n.badge ? `<span class="count label">${n.badge}</span>` : ''}
    </button>`).join('');

  document.getElementById('bottom-tabs').innerHTML = NAV.map(n => `
    <button class="bt-item" data-nav="${n.id}" onclick="goApp('${n.id}')">
      <span data-lucide="${n.icon}"></span>
      <span class="lbl">${n.label.split(' ')[0]}</span>
      ${n.badge ? `<span class="dot"></span>` : ''}
    </button>`).join('');

  renderDateline();
}

/** The masthead dateline. Renders the real current date so the almanac reads as an issue. */
function renderDateline(){
  const el = document.getElementById('mh-dateline');
  if(!el) return;
  const d = new Date().toLocaleDateString('en-PH', {day:'numeric', month:'long', year:'numeric'});
  el.textContent = `CEBU, PHILIPPINES · ${d}`;
}
```

Update the brand block markup (current lines 668–671) to:

```html
    <div class="sb-brand">
      <span class="word">CeView</span>
    </div>
```

And the collapse control (line 674) to:

```html
      <button class="sb-collapse" onclick="toggleSidebar()" aria-label="Collapse sidebar"><span data-lucide="panel-left-close" id="collapse-ic"></span><span class="label">Collapse</span></button>
```

- [ ] **Step 4: Verify**

Reload and jump to `dashboard`. At ≥1024px expected: a dark spine at left with the Caslon `CeView` wordmark above a hairline rule, five uppercase nav items each prefixed by a Roman numeral, Dashboard marked active by an amber left rule with no filled pill, and a `3` in a small ruled amber box. The masthead shows today's real date in monospace above the business name in Caslon, with an `INK`/`PAPER` toggle and a bell.

Click the theme toggle. Expected: the entire shell flips to paper and the toggle label reads `PAPER`. Click Collapse. Expected: the spine narrows to 72px, labels and numerals hide, icons remain.

Resize below 1024px. Expected: the spine disappears, a ruled bottom tab bar appears, and the active tab is marked by an amber top rule.

- [ ] **Step 5: Checkpoint**

Report: shell complete. Suggested commit message: `feat(prototype): almanac shell, spine, masthead, theme toggle`.

---

## Task 7: Chart primitives and reveal motion

**Files:** Modify `ui-ux-prototype.html` — add a new MOTION section (the old reveal keyframes were deleted in Task 4), replace the sparkline/skeleton rules (lines 431–437), and add new JS in the BEHAVIOR region.

- [ ] **Step 1: Write the motion and chart CSS**

```css
/* ============ MOTION ============ */
@keyframes rise{from{opacity:0; transform:translateY(8px);} to{opacity:1; transform:none;}}
.reveal{animation:rise var(--dur-mid) var(--ease-press) both;}
.reveal-1{animation-delay:0ms;}   .reveal-2{animation-delay:60ms;}
.reveal-3{animation-delay:120ms;} .reveal-4{animation-delay:180ms;}
.reveal-5{animation-delay:240ms;} .reveal-6{animation-delay:300ms;}

@keyframes strike{
  0%{opacity:0; transform:rotate(-14deg) scale(1.6);}
  70%{opacity:1; transform:rotate(-8deg) scale(.98);}
  100%{opacity:1; transform:rotate(-8deg) scale(1);}
}
.stamp{animation:strike 260ms var(--ease-press) both;}

/* ============ INK CHART ============ */
.inkchart{width:100%; display:block;}
.inkchart .grid line{stroke:var(--rule); stroke-width:1;}
.inkchart .series{fill:none; stroke:var(--text); stroke-width:1.25; stroke-linecap:butt; stroke-linejoin:miter;}
.inkchart .series-signal{stroke:var(--signal);}
.inkchart .tick{fill:var(--text);}
.inkchart .threshold{stroke:var(--signal); stroke-width:1; stroke-dasharray:3 3;}
/* Draw-in: the path is dashed to its own length, then the offset animates to 0. */
.inkchart .series{stroke-dasharray:var(--len,1000); stroke-dashoffset:var(--len,1000);}
.inkchart.drawn .series{transition:stroke-dashoffset var(--dur-slow) var(--ease-press); stroke-dashoffset:0;}

.sparkline{width:100%; height:28px; display:block;}
.sparkline polyline{fill:none; stroke-width:1.25; stroke-linecap:butt;}

.skeleton{background:var(--plate); animation:sk 1.4s ease infinite;}
@keyframes sk{0%,100%{opacity:.5;} 50%{opacity:1;}}
```

- [ ] **Step 2: Add the chart builder and observers**

Insert into the `<script>` BEHAVIOR region, after `showToast`:

```js
/* ============================================================ CHART + REVEAL ENGINE ============================================================ */
/** Builds an ink-on-ruled-paper line chart.
 *  pts: "x,y x,y …" in a 0–300 × 0–80 space, matching the existing CATEGORIES data.
 *  Draws 4 horizontal baseline rules, the series, small ink ticks at each point, and
 *  optionally a dashed amber threshold line. */
function inkChartHTML(pts, opts){
  const o = opts || {};
  const grid = [16,32,48,64].map(y=>`<line x1="0" y1="${y}" x2="300" y2="${y}"/>`).join('');
  const ticks = pts.split(' ').map(p=>{
    const [x,y] = p.split(',');
    return `<rect class="tick" x="${x-1}" y="${y-1}" width="2" height="2"/>`;
  }).join('');
  const threshold = o.threshold != null
    ? `<line class="threshold" x1="0" y1="${o.threshold}" x2="300" y2="${o.threshold}"/>` : '';
  return `<svg class="inkchart" viewBox="0 0 300 80" preserveAspectRatio="none"
               style="height:${o.height || 90}px" role="img" aria-label="${o.label || 'Demand trend'}">
    <g class="grid">${grid}</g>
    ${threshold}
    <polyline class="series ${o.signal ? 'series-signal' : ''}" points="${pts}"/>
    <g>${ticks}</g>
  </svg>`;
}

/** Arms every chart and roll-up numeral currently in the DOM. Idempotent — safe to call
 *  after any re-render. Charts draw once when scrolled into view; numerals count up. */
function armReveals(){
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.querySelectorAll('.inkchart:not([data-armed])').forEach(svg=>{
    svg.setAttribute('data-armed','1');
    const path = svg.querySelector('.series');
    if(!path) return;
    const len = Math.ceil(path.getTotalLength());
    svg.style.setProperty('--len', len);
    if(reduce){ svg.classList.add('drawn'); return; }
    new IntersectionObserver((entries, obs)=>{
      entries.forEach(e=>{
        if(e.isIntersecting){ svg.classList.add('drawn'); obs.unobserve(svg); }
      });
    }, {threshold:.25}).observe(svg);
  });

  document.querySelectorAll('[data-rollup]:not([data-armed])').forEach(el=>{
    el.setAttribute('data-armed','1');
    const target = parseFloat(el.getAttribute('data-rollup'));
    const suffix = el.getAttribute('data-rollup-suffix') || '';
    if(reduce || isNaN(target)){ el.textContent = target + suffix; return; }
    const start = performance.now();
    const dur = 900;
    (function step(now){
      const p = Math.min((now - start) / dur, 1);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))) + suffix;
      if(p < 1) requestAnimationFrame(step);
    })(start);
  });
}
```

Then add `armReveals();` as the final line of `goApp` (after `renderIcons()`), and to the INIT block after the existing `renderIcons()` call.

- [ ] **Step 3: Verify**

In the console run:

```js
document.body.insertAdjacentHTML('afterbegin', '<div style="padding:40px;width:400px">'+inkChartHTML('0,60 40,55 80,58 120,40 160,44 200,25 240,30 300,10',{threshold:30,label:'Test'})+'<div class="t-figure-xl" data-rollup="92">0</div></div>');
armReveals();
```

Expected: a chart with four faint horizontal rules, a 1.25px ink polyline that **draws in left-to-right over about a second**, small square ticks at each vertex, and a dashed amber horizontal line at the threshold. The `92` counts up from 0. No fills, no gradients, no rounded line caps.

Then in DevTools enable *Rendering → Emulate CSS prefers-reduced-motion: reduce*, reload, and repeat. Expected: the chart appears fully drawn immediately and the numeral shows `92` at once — never blank, never mid-draw.

---

## Task 8: Login — the issue cover

**Files:** Modify `ui-ux-prototype.html` — replace the LOGIN CSS (current lines 446–478) and the `#view-login` markup (lines 584–637).

- [ ] **Step 1: Write the cover CSS**

```css
/* ============ LOGIN COVER ============ */
#view-login{min-height:100vh; display:flex; flex-direction:column;}
.cover{
  flex:1; display:flex; flex-direction:column; justify-content:space-between;
  padding:var(--sp-6) var(--sp-4) var(--sp-8); max-width:var(--content-max); margin:0 auto; width:100%;
}
@media(min-width:1024px){.cover{padding:var(--sp-12) var(--sp-16) var(--sp-16);}}
.cover-top{border-bottom:var(--rule-w-strong) solid var(--rule-strong); box-shadow:0 3px 0 -2px var(--rule-strong); padding-bottom:var(--sp-4);}
.cover-issue{display:flex; flex-wrap:wrap; gap:var(--sp-4); justify-content:space-between; margin-top:var(--sp-3);}
.cover-mid{display:grid; grid-template-columns:1fr; gap:var(--sp-8); padding:var(--sp-8) 0;}
@media(min-width:1024px){.cover-mid{grid-template-columns:1.4fr 1fr; gap:var(--sp-16); align-items:start;}}
.cover-contents{list-style:none; margin:0; padding:0;}
.cover-contents li{display:flex; gap:var(--sp-4); padding:var(--sp-4) 0; border-top:var(--rule-w) solid var(--rule);}
.cover-contents li:last-child{border-bottom:var(--rule-w) solid var(--rule);}
.cover-contents .cnum{font-family:'DM Mono',monospace; font-size:11px; letter-spacing:.12em; color:var(--signal); flex-shrink:0; width:28px; padding-top:4px;}
.cover-contents b{display:block; font-family:'Libre Caslon Text',serif; font-weight:700; font-size:17px; margin-bottom:var(--sp-1);}
.cover-form{border:var(--rule-w) solid var(--rule-strong); background:var(--plate); padding:var(--sp-6);}
.cover-quote{border-top:var(--rule-w) solid var(--rule); padding-top:var(--sp-4); max-width:62ch;}
.auth-tabs{display:flex; gap:var(--sp-6); border-bottom:var(--rule-w) solid var(--rule); margin-bottom:var(--sp-6);}
.divider{display:flex; align-items:center; gap:var(--sp-3); margin:var(--sp-4) 0;
  font-family:'DM Mono',monospace; font-size:10px; letter-spacing:.12em; text-transform:uppercase; color:var(--text-muted);}
.divider::before,.divider::after{content:''; flex:1; height:var(--rule-w); background:var(--rule);}
```

- [ ] **Step 2: Replace the login markup**

```html
<div id="view-login">
  <div class="cover">
    <div class="cover-top">
      <div class="t-masthead">CeView</div>
      <div class="cover-issue">
        <span class="t-label" id="cover-dateline">VOL. I · CEBU, PHILIPPINES</span>
        <span class="t-label">TOURISM DEMAND ALMANAC</span>
      </div>
    </div>

    <div class="cover-mid">
      <div>
        <p class="t-deck" style="margin-bottom:var(--sp-6);">A running record of who is coming to Cebu, from where, and when — and what to publish before they arrive.</p>
        <ul class="cover-contents">
          <li>
            <span class="cnum">I</span>
            <div><b>See the surge first</b><span class="t-body" style="color:var(--text-muted);">Demand forecasts per market and per business category, weeks before the bookings land.</span></div>
          </li>
          <li>
            <span class="cnum">II</span>
            <div><b>Speak their language</b><span class="t-body" style="color:var(--text-muted);">Captions written in the traveller's language and tone, not translated after the fact.</span></div>
          </li>
          <li>
            <span class="cnum">III</span>
            <div><b>Know what worked</b><span class="t-body" style="color:var(--text-muted);">Every post reports back, so next month's plan is built on last month's numbers.</span></div>
          </li>
        </ul>
      </div>

      <div class="cover-form">
        <div class="auth-tabs">
          <button class="rtab active" id="tab-signin" onclick="setAuthTab('signin')">Sign In</button>
          <button class="rtab" id="tab-register" onclick="setAuthTab('register')">Register</button>
        </div>

        <div class="banner banner-error" id="auth-error" style="display:none;">
          <span data-lucide="alert-circle"></span>
          <span>Incorrect email or password. Please try again.</span>
          <button class="close-x" onclick="hide('auth-error')" aria-label="Dismiss error"><span data-lucide="x"></span></button>
        </div>

        <button class="btn btn-ghost btn-block btn-lg" onclick="goApp('dashboard')">
          <span data-lucide="chrome"></span> Sign in with Google
        </button>
        <div class="divider">or continue with email</div>

        <div class="field"><label>Email</label><input type="email" placeholder="you@business.com" value="owner@sunsetdive.ph"></div>
        <div class="field" id="pw-field">
          <label>Password</label>
          <input type="password" placeholder="••••••••" value="••••••••">
          <span class="err">Password must be at least 8 characters.</span>
        </div>
        <div class="field" id="pw-confirm-field" style="display:none;">
          <label>Confirm Password</label>
          <input type="password" placeholder="••••••••">
        </div>

        <button class="btn btn-primary btn-block btn-lg" id="auth-submit" onclick="submitAuth()">Sign In</button>
        <p style="text-align:center;margin-top:var(--sp-4);"><a href="#" class="t-foot">FORGOT PASSWORD?</a></p>
      </div>
    </div>

    <div class="cover-quote">
      <p class="t-deck" style="color:var(--text);">"I knew Korean divers were coming before my competitors did."</p>
      <p class="t-foot" style="margin-top:var(--sp-2);">— SUNSET DIVE CO., MACTAN</p>
    </div>
  </div>
</div>
```

- [ ] **Step 3: Populate the cover dateline**

In `renderDateline`, after setting `mh-dateline`, add:

```js
  const cov = document.getElementById('cover-dateline');
  if(cov) cov.textContent = `VOL. I · CEBU, PHILIPPINES · ${d.toUpperCase()}`;
```

(`d` is the formatted date string already computed in that function.)

- [ ] **Step 4: Verify**

Jump to `login`. Expected at ≥1024px: the wordmark dominates the top at ~62px in Caslon above a double rule; the issue line shows today's real date in monospace; three ruled contents entries with amber Roman numerals occupy the left; the sign-in form sits in a bordered plate at the right, visibly secondary to the masthead; the pull-quote is a ruled italic line at the bottom.

Click **Register**. Expected: the underscore slides to Register, the confirm-password field appears, and the submit button reads "Create Account". Click **Sign In** then submit. Expected: the button shows a ruled spinner, then the dashboard loads. Check both themes and 375px width — expected: single column, no horizontal scroll.

- [ ] **Step 5: Checkpoint**

Suggested commit message: `feat(prototype): almanac login cover`.

---

## Task 9: Onboarding — the ruled spread

**Files:** Modify `ui-ux-prototype.html` — replace the ONBOARDING CSS (current lines 480–512 and the category-picker block 514–539), the `#view-onboarding` markup (lines 640–663), and `obRenderSideList` / `obPanelHTML` steps 0–3 and 5.

- [ ] **Step 1: Write the spread CSS**

```css
/* ============ ONBOARDING SPREAD ============ */
#view-onboarding{min-height:100vh;}
.ob-wrap{display:flex; flex-direction:column; min-height:100vh; max-width:var(--content-max); margin:0 auto;}
.ob-progress-strip{padding:var(--sp-4) var(--sp-4) 0;}
@media(min-width:1024px){.ob-progress-strip{padding:var(--sp-6) var(--sp-16) 0;}}
.ob-progress-meta{display:flex; align-items:center; justify-content:space-between; gap:var(--sp-3); margin-bottom:var(--sp-2);}
.ob-back{background:none; border:none; color:var(--text-muted); display:flex; padding:var(--sp-1);}
.ob-back:hover{color:var(--text);}
.ob-back svg{stroke-width:1.25; width:18px; height:18px;}

.ob-spread{flex:1; display:grid; grid-template-columns:1fr; gap:var(--sp-6); padding:var(--sp-6) var(--sp-4) var(--sp-24);}
@media(min-width:1024px){
  .ob-spread{grid-template-columns:340px 1fr; gap:var(--sp-16); padding:var(--sp-12) var(--sp-16) var(--sp-12);}
  .ob-spread.wide{grid-template-columns:280px 1fr;}
}
.ob-leaf-l{border-bottom:var(--rule-w) solid var(--rule); padding-bottom:var(--sp-4);}
@media(min-width:1024px){
  .ob-leaf-l{border-bottom:none; border-right:var(--rule-w) solid var(--rule); padding-bottom:0; padding-right:var(--sp-8);}
}
.ob-stepnum{color:var(--signal); display:block; margin-bottom:var(--sp-2);}
.ob-steps{list-style:none; margin:var(--sp-6) 0 0; padding:0; display:none;}
@media(min-width:1024px){.ob-steps{display:block;}}
.ob-steps li{
  display:flex; align-items:baseline; gap:var(--sp-3); padding:var(--sp-2) 0;
  border-top:var(--rule-w) solid var(--rule);
  font-family:'DM Mono',monospace; font-size:11px; letter-spacing:.08em; text-transform:uppercase; color:var(--text-muted);
}
.ob-steps li .n{width:20px; flex-shrink:0;}
.ob-steps li.done{color:var(--text-muted); text-decoration:line-through; text-decoration-color:var(--rule-strong);}
.ob-steps li.current{color:var(--text);}
.ob-steps li.current .n{color:var(--signal);}
.ob-cta-bar{
  position:fixed; bottom:0; left:0; right:0; background:var(--canvas);
  border-top:var(--rule-w-strong) solid var(--rule-strong); padding:var(--sp-3) var(--sp-4);
  display:flex; gap:var(--sp-3); z-index:25;
}
@media(min-width:1024px){
  .ob-cta-bar{position:static; border:none; background:transparent; padding:var(--sp-8) 0 0; grid-column:2;}
}

/* ---- Category picker: ruled selectable cells ---- */
.cat-picker{display:grid; grid-template-columns:1fr; gap:var(--rule-w);}
@media(min-width:640px){.cat-picker{grid-template-columns:1fr 1fr;}}
.cat-opt{
  position:relative; text-align:left; display:flex; align-items:flex-start; gap:var(--sp-3);
  background:transparent; border:var(--rule-w) solid var(--rule); border-radius:var(--r-flat);
  padding:var(--sp-3) var(--sp-8) var(--sp-3) var(--sp-3);
  transition:border-color var(--dur-fast) var(--ease-press), background var(--dur-fast) var(--ease-press);
}
.cat-opt:hover{border-color:var(--rule-strong); background:var(--plate);}
.cat-opt[aria-pressed="true"]{border-color:var(--signal); background:var(--signal-sunk);}
.cat-opt .co-ic{flex-shrink:0; color:var(--text-muted); display:flex; padding-top:2px;}
.cat-opt .co-ic svg{width:16px; height:16px; stroke-width:1.25;}
.cat-opt[aria-pressed="true"] .co-ic{color:var(--signal);}
.cat-opt .co-name{display:block; font-family:'Libre Caslon Text',serif; font-weight:700; font-size:14px; line-height:1.3;}
.cat-opt .co-sub{display:block; font-family:'Karla',sans-serif; font-size:12px; color:var(--text-muted); margin-top:3px; line-height:1.4;}
.cat-opt .co-tick{
  position:absolute; top:var(--sp-3); right:var(--sp-3);
  font-family:'DM Mono',monospace; font-size:12px; color:var(--signal); display:none;
}
.cat-opt[aria-pressed="true"] .co-tick{display:block;}
.picker-note{display:flex; align-items:center; justify-content:space-between; gap:var(--sp-3); margin-top:var(--sp-4); padding-top:var(--sp-2); border-top:var(--rule-w) solid var(--rule);}
```

- [ ] **Step 2: Replace the onboarding markup**

```html
<div id="view-onboarding">
  <div class="ob-wrap">
    <div class="ob-progress-strip">
      <div class="ob-progress-meta">
        <button class="ob-back" onclick="obPrev()" aria-label="Go back a step"><span data-lucide="arrow-left"></span></button>
        <span class="t-label" id="ob-step-count">STEP 1 OF 6</span>
      </div>
      <div class="prog"><i id="ob-progress-bar" style="width:16.6%;"></i></div>
    </div>

    <div class="ob-spread" id="ob-spread">
      <div class="ob-leaf-l">
        <span class="t-figure-xl ob-stepnum" id="ob-numeral">1</span>
        <span class="t-label" id="ob-stepname">BASIC INFO</span>
        <ol class="ob-steps" id="ob-step-list"></ol>
      </div>
      <div id="ob-panel"><!-- injected --></div>
      <div class="ob-cta-bar">
        <button class="btn btn-ghost" onclick="obPrev()" id="ob-back-btn" style="display:none;">Back</button>
        <button class="btn btn-primary btn-block btn-lg" id="ob-next-btn" onclick="obNext()">Next</button>
      </div>
    </div>
  </div>
</div>
```

- [ ] **Step 3: Rewrite `obRenderSideList` and extend `obRender`**

Replace `obRenderSideList`:

```js
function obRenderSideList(){
  document.getElementById('ob-step-list').innerHTML = OB_STEPS.map((s,i)=>`
    <li class="${i<obIndex?'done':''} ${i===obIndex?'current':''}">
      <span class="n">${i<obIndex ? '✓' : String(i+1).padStart(2,'0')}</span><span>${s}</span>
    </li>`).join('');
  document.getElementById('ob-numeral').textContent = obIndex + 1;
  document.getElementById('ob-stepname').textContent = OB_STEPS[obIndex].toUpperCase();
}
```

In `obRender`, replace the two `wide` class toggles with a single one on the spread, and update the step-count casing:

```js
  const wide = obIndex === OB_STEP_CATEGORY;
  document.getElementById('ob-spread').classList.toggle('wide', wide);
  document.getElementById('ob-progress-bar').style.width = ((obIndex+1)/OB_STEPS.length*100)+'%';
  document.getElementById('ob-step-count').textContent = `STEP ${obIndex+1} OF ${OB_STEPS.length}`;
```

Delete the two lines referencing `panel.classList.toggle('wide', …)` and `document.querySelector('.ob-cta-bar').classList.toggle('wide', …)`.

- [ ] **Step 4: Restyle panels 0, 1, 2, category, and 5 in `obPanelHTML`**

Apply these substitutions throughout `obPanelHTML`, leaving every `id`, `oninput`, `onclick`, and value string untouched:

- `<h2 class="h1" style="margin-bottom:6px;">` → `<h2 class="t-h1" style="margin-bottom:var(--sp-2);">`
- `<p class="body-txt" style="color:var(--text-muted);margin-bottom:24px;">` → `<p class="t-deck" style="margin-bottom:var(--sp-6);">`
- `<span class="caption">At least 1 word required.</span>` → `<span class="t-foot">AT LEAST ONE WORD REQUIRED</span>`
- `class="charcount"` stays (its styling is already redefined in Task 4)
- In the category grid, replace the tick markup `<span class="co-tick"><span data-lucide="check"></span></span>` with `<span class="co-tick">✓</span>` and drop the `co-ic` wrapper's background — the CSS in Step 1 already handles it
- `<span class="caption">Select at least one to continue.</span>` → `<span class="t-foot">SELECT AT LEAST ONE TO CONTINUE</span>`
- `<span class="caption" id="ob-cat-count" style="…">` → `<span class="t-label" id="ob-cat-count" style="color:var(--signal);">`
- In step 5, `<div class="upload-zone">` → `<div class="well">`, and the inner `<div class="body-txt">` → `<div class="t-body">`
- `<div class="divider">or answer 3 quick prompts</div>` keeps its class (restyled in Task 8)

In `obConnectionRow`, replace the `card` wrapper with a ledger row:

```js
function obConnectionRow(key, label, icon){
  const connected = APP_STATE.connections[key];
  return `<div class="lrow" style="cursor:default;">
    <span data-lucide="${icon}" style="width:18px;height:18px;stroke-width:1.25;color:${connected?'var(--signal)':'var(--text-muted)'};"></span>
    <span style="flex:1;min-width:0;">
      <span class="t-body-em" style="display:block;">${label}</span>
      <span class="t-foot">${connected ? '@SUNSETDIVE.PH' : 'NOT CONNECTED'}</span>
    </span>
    ${connected
      ? `<span class="ibadge ibadge-published">Connected</span><button class="btn btn-ghost btn-sm" onclick="obToggleConnect('${key}')">Disconnect</button>`
      : `<button class="btn btn-signal btn-sm" onclick="obToggleConnect('${key}')">Connect</button>`}
  </div>`;
}
```

- [ ] **Step 5: Verify**

Jump to `onboarding`. Expected at ≥1024px: a two-leaf spread with a large amber `1` and `BASIC INFO` on the left above a struck-through contents list of all six steps, fields on the right, a hairline progress rule at the top reading `STEP 1 OF 6`, and a vertical rule dividing the leaves.

Walk all six steps. Confirm: step 2's Vibe field gates Next when emptied; step 3's two textareas show live `n / 50 words` counters in monospace that turn green past 50 and disable Next below it; step 4's category cells toggle with an amber tick and the count updates; step 6's three connection rows toggle between `Connect` and a `Connected` badge. At 375px expected: the left leaf collapses to a compact header, the contents list hides, and the CTA bar pins to the bottom.

---

## Task 10: Onboarding score reveal — the press stamp

**Files:** Modify `ui-ux-prototype.html` — rewrite `obGaugeHTML`, `obLowScorePanelHTML`, and the `OB_STEP_SCORE` branch of `obPanelHTML`.

- [ ] **Step 1: Rewrite the gauge**

Per spec §4.2 the reveal shows **both** marks: the stamp carries the verdict, the gauge beneath carries the score as an arc against 100. To avoid two giant numerals saying the same thing, the gauge's center label is a small monospace `nn/100` rather than a repeat of the display figure.

```js
/** Shared gauge for both reveal paths. r=58 → circumference ≈ 364.
 *  Renders the score as an arc; the numeral lives on the stamp above it. */
function obGaugeHTML(score){
  const CIRC = 364;
  const offset = CIRC - (CIRC * score / 100);
  const low = score < 60;
  return `<div class="gauge ${low?'is-low':''}">
    <svg width="132" height="132" role="img" aria-label="Uniqueness score ${score} out of 100">
      <circle class="track" cx="66" cy="66" r="58" stroke-width="1"/>
      <circle class="fill" cx="66" cy="66" r="58" stroke-width="3"
              stroke-dasharray="${CIRC}" stroke-dashoffset="${offset}"/>
    </svg>
    <div class="val"><span class="t-figure">${score}/100</span></div>
  </div>`;
}

/** The struck stamp shown on the passing reveal. */
function obStampHTML(score){
  const low = score < 60;
  return `<div class="stamp ${low?'is-low':''}">
    <span class="stamp-top">Uniqueness</span>
    <span class="t-figure-xl stamp-val" style="font-size:72px;line-height:1;margin:6px 0;">${score}</span>
    <span class="stamp-bot">${low ? 'Below Threshold' : 'Certified · 60+'}</span>
  </div>`;
}
```

- [ ] **Step 2: Rewrite the `OB_STEP_SCORE` branch**

Replace the branch body (keeping the `obScoreState` logic and both insight strings verbatim):

```js
  if(i===OB_STEP_SCORE){
    if(obScoreState.path==='low' && !obScoreState.finished) return obLowScorePanelHTML();
    const score = obScoreState.path==='low' ? 78 : 82;
    const insight = obScoreState.path==='low'
      ? "After a few tweaks, your coral-restoration program and hands-on PADI teaching style stand out clearly against nearby dive shops."
      : "Your coral-conservation angle and PADI-certified team put you well ahead of nearby dive operators on distinctiveness.";
    return `
    <div style="text-align:center;">
      <h2 class="t-h1" style="margin-bottom:var(--sp-2);">Your Uniqueness Score</h2>
      <p class="t-deck" style="margin-bottom:var(--sp-8);">How distinct you look next to comparable businesses in your categories.</p>
      ${obStampHTML(score)}
      <div style="margin-top:var(--sp-8);">${obGaugeHTML(score)}</div>
      <p class="t-body" style="max-width:44ch;margin:var(--sp-6) auto var(--sp-3);">${insight}</p>
      <span class="ibadge ibadge-ai"><span data-lucide="sparkles"></span> AI-assisted insight</span>
      <div class="footnote"><span class="t-foot">SOURCE · CEVIEW UNIQUENESS MODEL · SAMPLE DATA</span></div>
    </div>`;
  }
```

- [ ] **Step 3: Rewrite the low-score panel**

```js
function obLowScorePanelHTML(){
  const q = obScoreState.qIndex;
  return `
    <div style="text-align:center;">
      <h2 class="t-h1" style="margin-bottom:var(--sp-2);">Your Uniqueness Score</h2>
      <p class="t-deck" style="margin-bottom:var(--sp-8);">How distinct you look next to comparable businesses in your categories.</p>
      ${obStampHTML(42)}
      <div style="margin-top:var(--sp-8);">${obGaugeHTML(42)}</div>
      <p class="t-body" style="max-width:46ch;margin:var(--sp-6) auto var(--sp-6);">Right now you read a lot like other dive shops nearby. Two ways to fix that — answer a few quick prompts below, or go back and rewrite your description yourself.</p>
    </div>

    <button class="btn btn-ghost btn-block" style="margin-bottom:var(--sp-6);" onclick="obReturnToStructuredInputs()">
      <span data-lucide="pencil-line"></span> Rewrite my description &amp; UVP
    </button>

    <div class="divider">or answer 3 quick prompts</div>

    <div class="t-label" style="text-align:center;margin-bottom:var(--sp-2);">QUESTION ${q+1} OF 3</div>
    <div class="prog" style="margin-bottom:var(--sp-6);"><i style="width:${(q/3)*100}%"></i></div>
    <div class="field">
      <label>${LOW_SCORE_QUESTIONS[q]}</label>
      <input id="ob-lowscore-answer" placeholder="Type your answer…">
    </div>
    <div style="text-align:center;">
      <a href="#" class="t-foot" onclick="obLowScoreAdvance(false);return false;">SKIP THIS QUESTION</a>
    </div>`;
}
```

- [ ] **Step 4: Arm the stamp animation**

Add `armReveals();` to the end of `obRender`, after `renderIcons()`.

- [ ] **Step 5: Verify**

Jump to `onboarding`, advance to step 5. Expected: an amber ruled circular stamp rotated −8°, with `82` in Caslon at its center, `UNIQUENESS` arcing above and `CERTIFIED · 60+` below, animating in with a scale-and-rotate strike. Beneath it, a hairline circular gauge whose amber arc covers ~82% of the ring with a small monospace `82/100` at its center, then the insight sentence, an outlined `AI-ASSISTED INSIGHT` badge, and a monospace source footnote.

Jump to `onboarding-low`, advance to step 5. Expected: the stamp and gauge both render in the critical color reading `42` / `BELOW THRESHOLD`, followed by the rewrite escape button, then Question 1 of 3 with a hairline progress rule. Answer or skip three times. Expected: the stamp re-strikes at `78` in amber and the Next button reads "Next" — then advances to Assets & Links. Test "Rewrite my description & UVP" — expected: returns to step 3 with a toast.

Confirm under reduced motion that the stamp appears already struck at −8°, not mid-scale.

- [ ] **Step 6: Checkpoint**

Suggested commit message: `feat(prototype): almanac onboarding spread and press-stamp reveal`.

---

## Task 11: Expand the mock data

**Files:** Modify `ui-ux-prototype.html` — extend `CATEGORIES` (current lines 1208–1281), `CALENDAR_POSTS`, `PERFORMANCE_POSTS`.

- [ ] **Step 1: Add fields the front page needs**

Each market object gains three fields. Add them to **every** market in all four categories:

- `sites` — array of 1–2 real Cebu dive/tour locations relevant to that market's content angle
- `window` — a short phrase naming the demand window, e.g. `'School break · 3 weeks out'`
- `updated` — a monospace-ready recency string, e.g. `'2H AGO'`

Each category object gains:

- `source` — the footnote string, e.g. `'CEVIEW DEMAND MODEL v2 · SEARCH + INQUIRY VOLUME · SAMPLE DATA'`

Worked example, showing the exact shape:

```js
      {code:'KR', name:'South Korea', flight:'direct', flightNote:'4 daily direct', score:92, trend:'+34%', up:true,
       pts:'0,60 40,55 80,58 120,40 160,44 200,25 240,30 300,10',
       sites:['Kontiki Reef','Marigondon Cave'],
       window:'School break · 3 weeks out',
       updated:'2H AGO',
       keywords:['세부 다이빙','막탄 스노클링','필리핀 여행'],
       note:'Korean school break begins in 3 weeks — historically a 2x booking window for dive operators.'},
```

Delete the now-unused `flag:'🇰🇷'` property from every market — the `.cmark` component renders `code` instead, and the emoji do not render on Windows/Chrome.

The exact values for all twelve markets. Use these verbatim; the place names are real Cebu locations and the whole almanac conceit depends on them being right:

| Category | Code | `window` | `updated` | `sites` |
|---|---|---|---|---|
| diving | KR | `School break · 3 weeks out` | `2H AGO` | `['Kontiki Reef','Marigondon Cave']` |
| diving | JP | `Golden Week prep · 12 days out` | `5H AGO` | `['Nalusuan Island','Hilutungan']` |
| diving | US | `US long weekend · 3 weeks out` | `1D AGO` | `['Olango Channel','Talima']` |
| diving | AU | `Post-holiday lull · Nov window` | `2D AGO` | `['Moalboal sardine run','Pescador Island']` |
| tours | JP | `Golden Week prep · 12 days out` | `4H AGO` | `['Oslob','Kawasan Falls']` |
| tours | KR | `Group season · 5 weeks out` | `1D AGO` | `['Kawasan Falls','Bohol day trip']` |
| tours | CN | `Charter capacity rebuild` | `3D AGO` | `['Bohol day trip','Oslob']` |
| cafe | US | `Weekend brunch · rolling` | `6H AGO` | `['Lapu-Lapu Shrine','Mactan Newtown']` |
| cafe | KR | `Visual season · 2 weeks out` | `1D AGO` | `['Mactan Newtown','Carbon Market']` |
| cafe | SG | `Short-stay weekends` | `4D AGO` | `['Carbon Market']` |
| crafts | US | `Evergreen · no window` | `5D AGO` | `['Carbon Market','Lapu-Lapu Shrine']` |
| crafts | JP | `Flat · revisit post-GW` | `6D AGO` | `['Carbon Market']` |

And the four category `source` strings:

```js
// diving
source:'CEVIEW DEMAND MODEL v2 · SEARCH + INQUIRY VOLUME · SAMPLE DATA'
// tours
source:'CEVIEW DEMAND MODEL v2 · SEARCH + BOOKING INTENT · SAMPLE DATA'
// cafe
source:'CEVIEW DEMAND MODEL v2 · SEARCH + FOOTFALL PROXY · SAMPLE DATA'
// crafts
source:'CEVIEW DEMAND MODEL v2 · SEARCH VOLUME · SAMPLE DATA'
```

- [ ] **Step 2: Verify**

In the console run:

```js
CATEGORIES.every(c => c.source && c.markets.every(m => m.sites && m.window && m.updated && !m.flag))
```

Expected: `true`.

---

## Task 12: Dashboard — masthead band and the lead

**Files:** Modify `ui-ux-prototype.html` — rewrite `buildDashboard`; delete `nextBandHTML` and the `.next-band` CSS (current lines 274–298).

- [ ] **Step 1: Add the front-page CSS**

```css
/* ============ DASHBOARD FRONT PAGE ============ */
.fp-masthead{border-bottom:var(--rule-w-strong) solid var(--rule-strong); box-shadow:0 3px 0 -2px var(--rule-strong); padding-bottom:var(--sp-3); margin-bottom:var(--sp-8);}
.fp-masthead .fp-meta{display:flex; flex-wrap:wrap; gap:var(--sp-4); justify-content:space-between; margin-top:var(--sp-2);}

.fp-lead{display:grid; grid-template-columns:1fr; gap:var(--sp-6); padding-bottom:var(--sp-12); margin-bottom:var(--sp-8); border-bottom:var(--rule-w-strong) solid var(--rule-strong);}
@media(min-width:1024px){.fp-lead{grid-template-columns:2fr 1fr; gap:var(--sp-16);}}
.fp-lead-figure{display:flex; flex-direction:column; align-items:flex-start; gap:var(--sp-2); padding-top:var(--sp-4); border-top:var(--rule-w) solid var(--rule);}
@media(min-width:1024px){.fp-lead-figure{border-top:none; border-left:var(--rule-w) solid var(--rule); padding:0 0 0 var(--sp-8);}}
.fp-sites{display:flex; flex-wrap:wrap; gap:var(--sp-2); margin-top:var(--sp-4);}

.fp-index{display:grid; grid-template-columns:1fr; gap:var(--sp-8);}
@media(min-width:1024px){
  .fp-index{grid-template-columns:1fr 2fr; gap:var(--sp-16);}
  .fp-index > * + *{border-left:var(--rule-w) solid var(--rule); padding-left:var(--sp-8);}
}
```

- [ ] **Step 2: Rewrite `buildDashboard`**

```js
function buildDashboard(){
  const cat = activeCategory();
  const lead = cat.markets.reduce((a,b)=> b.score > a.score ? b : a);
  const band = scoreBand(lead.score);
  document.getElementById('screen-dashboard').innerHTML = `
    <div class="fp-masthead reveal reveal-1">
      <div class="t-masthead">The Cebu Almanac</div>
      <div class="fp-meta">
        <span class="t-label" id="fp-dateline"></span>
        <span class="t-label">${cat.name.toUpperCase()} · ${cat.markets.length} MARKETS TRACKED</span>
      </div>
    </div>

    <div class="fp-lead reveal reveal-2">
      <div>
        <span class="t-label" style="color:var(--signal);display:block;margin-bottom:var(--sp-3);">${band.hot ? 'SURGE' : 'LEAD SIGNAL'} · ${lead.window.toUpperCase()}</span>
        <h1 class="t-lead" style="margin-bottom:var(--sp-4);">${lead.name}, ${lead.trend}</h1>
        <p class="t-deck" style="margin-bottom:var(--sp-6);max-width:52ch;">${lead.note}</p>
        ${inkChartHTML(lead.pts, {height:120, threshold:30, signal:band.hot, label:`${lead.name} demand, last 30 days`})}
        <div class="footnote"><span class="t-foot">LAST 30 DAYS · ${cat.source}</span></div>
        <div class="fp-sites">
          ${lead.sites.map(s=>`<span class="ibadge">${s}</span>`).join('')}
        </div>
      </div>

      <div class="fp-lead-figure">
        <span class="t-label">Demand score</span>
        <span class="t-figure-xl" data-rollup="${lead.score}">0</span>
        <span class="t-figure ${lead.up ? 'trend trend-up' : 'trend trend-down'}">${lead.up ? '↑' : '↓'} ${lead.trend} week over week</span>
        <span class="t-label" style="margin-top:var(--sp-2);">${band.label} · ${lead.flightNote}</span>
        <button class="btn btn-signal btn-lg" style="margin-top:var(--sp-6);" onclick="targetThisMarket('${lead.name}')">
          <span data-lucide="target"></span> Target this market
        </button>
      </div>
    </div>

    <div class="fp-index reveal reveal-3">
      <div>
        <div class="sec"><span class="t-label sec-label">Categories watched</span></div>
        <div role="tablist" aria-label="Business categories">${catRailHTML()}</div>
      </div>
      <div>
        <div class="sec"><span class="t-label sec-label" id="market-rail-title">${cat.name} · Market index</span></div>
        <div id="market-rail" role="tabpanel" aria-labelledby="cat-tab-${cat.id}">${marketRailHTML()}</div>
        <div class="footnote"><span class="t-foot">SOURCE · ${cat.source}</span></div>
      </div>
    </div>`;
  const dl = document.getElementById('fp-dateline');
  if(dl) dl.textContent = new Date().toLocaleDateString('en-PH',{weekday:'long', day:'numeric', month:'long', year:'numeric'}).toUpperCase();
  renderIcons();
  armReveals();
}
```

- [ ] **Step 3: Delete `nextBandHTML`**

Remove the whole function and the `const band = document.getElementById('next-band-slot'); if(band) band.innerHTML = nextBandHTML();` lines from `selectCategory`. Remove the `.next-band`, `.nb-copy`, `.nb-eyebrow`, `.nb-title`, `.nb-sub` CSS rules.

- [ ] **Step 4: Verify**

Jump to `dashboard`. Expected: `The Cebu Almanac` in Caslon at masthead scale above a double rule, today's full date in monospace beneath. Then the lead — an amber `SURGE · SCHOOL BREAK · 3 WEEKS OUT` label, `South Korea, +34%` at ~52px in Caslon, an italic deck, and an ink chart that draws in. At the right, a vertical rule separates a `92` counting up from 0 in Caslon at ~96px, a green `↑ +34% week over week`, and an amber "Target this market" button. Click it — expected: navigates to Content Studio with a toast.

Confirm the old gradient band is gone and no console error mentions `nextBandHTML`.

---

## Task 13: Dashboard — the index band

**Files:** Modify `ui-ux-prototype.html` — rewrite `catRailHTML` and `marketRailHTML`; delete the `.cat-item` and `.mkt-row` CSS (current lines 196–272).

- [ ] **Step 1: Rewrite `catRailHTML`**

```js
function catRailHTML(){
  return CATEGORIES.map((c,i)=>`
    <button class="lrow ${c.id===activeCategoryId?'is-active':''}" role="tab" aria-selected="${c.id===activeCategoryId}"
            id="cat-tab-${c.id}" aria-controls="market-rail" onclick="selectCategory('${c.id}')">
      <span data-lucide="${c.icon}" style="width:16px;height:16px;stroke-width:1.25;color:${c.id===activeCategoryId?'var(--signal)':'var(--text-muted)'};"></span>
      <span style="flex:1;min-width:0;">
        <span class="t-body-em" style="display:block;">${c.name}</span>
        <span class="t-foot" style="display:block;margin-top:2px;">${c.headline.toUpperCase()} · ${c.ago.toUpperCase()}</span>
      </span>
      ${c.unread ? `<span class="ibadge ibadge-ai" aria-label="${c.unread} new alerts">${c.unread}</span>` : ''}
    </button>`).join('');
}
```

- [ ] **Step 2: Rewrite `marketRailHTML` as a real ledger table**

```js
function marketRailHTML(){
  const cat = activeCategory();
  const rows = cat.markets.map((m,i)=>{
    const b = scoreBand(m.score);
    const direct = m.flight === 'direct';
    return `
    <tr class="clickable ${b.hot?'is-hot':''}" onclick="openRadar('${cat.id}','${m.code}')" tabindex="0"
        onkeydown="if(event.key==='Enter'){openRadar('${cat.id}','${m.code}')}"
        aria-label="${m.name} — demand score ${m.score}, ${b.label}. Open market radar.">
      <td class="num" style="width:32px;color:var(--text-muted);">${String(i+1).padStart(2,'0')}</td>
      <td style="width:48px;"><span class="cmark">${m.code}</span></td>
      <td>
        <span class="t-body-em" style="display:block;">${m.name}</span>
        <span class="t-foot">${m.window.toUpperCase()}</span>
      </td>
      <td class="num t-figure" style="${b.hot?'color:var(--signal);':''}">${m.score}</td>
      <td class="num"><span class="trend ${m.up?'trend-up':'trend-down'}">${m.up?'↑':'↓'} ${m.trend}</span></td>
      <td style="width:80px;" class="hide-sm">
        <svg class="sparkline" viewBox="0 0 300 80" preserveAspectRatio="none" style="height:22px;">
          <polyline points="${m.pts}" style="stroke:${b.hot?'var(--signal)':'var(--text-muted)'}"/>
        </svg>
      </td>
      <td class="t-foot hide-sm" style="width:110px;">${direct?'DIRECT':'1-STOP'}</td>
      <td class="t-foot num hide-sm" style="width:70px;">${m.updated}</td>
    </tr>`;
  }).join('');

  return `<table class="ledger">
    <thead><tr>
      <th class="num">#</th><th></th><th>Market</th>
      <th class="num">Score</th><th class="num">WoW</th>
      <th class="hide-sm">30d</th><th class="hide-sm">Flights</th><th class="num hide-sm">Updated</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}
```

Add the responsive helper to the SCREENS CSS region:

```css
@media(max-width:767px){.hide-sm{display:none !important;}}
```

- [ ] **Step 3: Verify**

Jump to `dashboard` and scroll to the index. Expected: at left, four category rows separated by hairlines, the active one carrying an amber left rule and an amber icon; at right, a ruled table with monospace uppercase column heads (`# / MARKET / SCORE / WOW / 30D / FLIGHTS / UPDATED`), right-aligned tabular scores, typographic `↑`/`↓` trend marks in green and red, and a hairline sparkline per row. The top row (score 92) shows its score in amber with an amber bottom rule.

Click "Tours & Excursions". Expected: the table swaps to 3 markets led by Japan at 88, the section label updates, and the lead band does **not** change (it rebuilds only on `goApp`). Click any market row. Expected: the radar drawer opens. Press Tab to a row and hit Enter — expected: the drawer opens.

At 375px, expected: the last three columns hide and no horizontal scroll occurs.

- [ ] **Step 4: Checkpoint**

Suggested commit message: `feat(prototype): almanac dashboard front page and market ledger`.

---

## Task 14: Market Radar drawer

**Files:** Modify `ui-ux-prototype.html` — rewrite `renderRadarDrawer`.

- [ ] **Step 1: Rewrite the drawer body**

```js
function renderRadarDrawer(cat, m){
  const b = scoreBand(m.score);
  const direct = m.flight === 'direct';
  document.getElementById('radar-title').innerHTML =
    `<span class="cmark" style="width:28px;height:28px;font-size:11px;margin-right:var(--sp-2);vertical-align:-6px;">${m.code}</span>${m.name}`;
  document.getElementById('radar-sub').textContent = `${cat.name.toUpperCase()} · MARKET RADAR`;
  document.getElementById('radar-body').innerHTML = `
    <div style="display:flex;align-items:flex-start;gap:var(--sp-6);padding-bottom:var(--sp-4);border-bottom:var(--rule-w) solid var(--rule);margin-bottom:var(--sp-6);">
      <div>
        <span class="t-label" style="display:block;">Demand score</span>
        <span class="t-figure-xl" style="font-size:64px;line-height:1;${b.hot?'color:var(--signal);':''}">${m.score}</span>
      </div>
      <div style="flex:1;border-left:var(--rule-w) solid var(--rule);padding-left:var(--sp-4);">
        <span class="t-label" style="display:block;margin-bottom:var(--sp-2);">${b.label}</span>
        <span class="t-body" style="display:block;">${direct?'Direct flights':'No direct flight'}</span>
        <span class="t-foot" style="display:block;margin-top:var(--sp-1);">${m.flightNote.toUpperCase()} INTO MACTAN–CEBU (CEB)</span>
      </div>
    </div>

    <button class="btn btn-signal btn-block btn-lg" style="margin-bottom:var(--sp-8);" onclick="targetThisMarket('${m.name}')">
      <span data-lucide="target"></span> Target this market
    </button>

    <div class="sec"><span class="t-label sec-label">Demand trend</span></div>
    ${inkChartHTML(m.pts, {height:100, signal:b.hot, label:`${m.name} demand, last 30 days`})}
    <div class="footnote" style="margin-bottom:var(--sp-8);"><span class="t-foot">LAST 30 DAYS · ${cat.source}</span></div>

    <div class="sec"><span class="t-label sec-label">Top keywords</span></div>
    <div class="cell-grid" style="margin-bottom:var(--sp-8);">${m.keywords.map(k=>`<span class="cell">${k}</span>`).join('')}</div>

    <div class="sec"><span class="t-label sec-label">Relevant sites</span></div>
    <div class="cell-grid" style="margin-bottom:var(--sp-8);">${m.sites.map(s=>`<span class="ibadge">${s}</span>`).join('')}</div>

    <div class="plate-flush">
      <span class="t-label" style="display:block;margin-bottom:var(--sp-2);">Seasonal note</span>
      <p class="t-body" style="color:var(--text-muted);">${m.note}</p>
    </div>`;
  renderIcons();
  armReveals();
}
```

Update the drawer's static header markup (current lines 715–722) so the title uses `t-h1` and the subtitle uses `t-label`:

```html
  <div class="drawer-hd">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:var(--sp-3);">
      <div class="t-h1" id="radar-title">Market Radar</div>
      <button class="close-x" onclick="closeDrawer('radar-drawer')" aria-label="Close market radar"><span data-lucide="x"></span></button>
    </div>
    <div class="t-label" id="radar-sub" style="margin-top:var(--sp-1);"></div>
  </div>
```

- [ ] **Step 2: Verify**

From the dashboard index, click South Korea. Expected: the drawer slides in with a `KR` mono square beside the market name, a large Caslon `92`, an amber "Target this market" button, an ink chart that draws in, keywords as ruled cells, dive sites as ink badges, and a monospace source footnote. No gradient fill appears under the chart. Click "Target this market" — expected: the drawer closes, Content Studio opens, a toast appears. Repeat in paper theme and at 375px (drawer becomes a bottom sheet with an amber top rule).

---

## Task 15: Content Studio — the manuscript column

**Files:** Modify `ui-ux-prototype.html` — rewrite `csCaptionCardHTML`, `csVisualGuideHTML`, and the composer half of `buildContentStudio`.

- [ ] **Step 1: Rewrite the caption card**

```js
function csCaptionCardHTML(){
  if(csSelectedPlatforms.length===0){
    return `<div class="plate">
      <div class="plate-hd"><span class="t-h2">Caption</span><span class="ibadge ibadge-ai"><span data-lucide="sparkles"></span>AI</span></div>
      <div class="empty">
        <span data-lucide="megaphone"></span>
        <p class="t-body">Select a platform below to generate a caption.</p>
      </div>
    </div>`;
  }
  return `<div class="plate">
    <div class="plate-hd"><span class="t-h2">Caption</span><span class="ibadge ibadge-ai"><span data-lucide="sparkles"></span>AI</span></div>
    <div class="rtabs">
      ${csSelectedPlatforms.map(k=>`<button class="rtab ${k===csActiveTab?'active':''}" onclick="csSetActiveTab('${k}')">${CS_PLATFORM_META[k].label}</button>`).join('')}
    </div>
    <div class="field" style="margin-bottom:var(--sp-3);">
      <textarea id="cs-caption" oninput="csUpdateCaption(this.value)">${CS_CAPTIONS[csActiveTab]}</textarea>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <span class="t-foot">${CS_PLATFORM_META[csActiveTab].label.toUpperCase()} VOICE</span>
      <button class="btn btn-ghost btn-sm" onclick="regenCaption()" id="regen-btn"><span data-lucide="refresh-cw"></span> Regenerate</button>
    </div>
  </div>`;
}
```

- [ ] **Step 2: Rewrite the visual guide as a numbered ledger**

```js
function csVisualGuideHTML(){
  const numerals = ['I','II','III','IV','V'];
  return `<div class="plate">
    <div class="plate-hd"><span class="t-h2">Visual Guide</span><span class="ibadge ibadge-ai"><span data-lucide="sparkles"></span>AI</span></div>
    ${VISUAL_GUIDE_ASPECTS.map((a,idx)=>`
      <div class="lrow" style="align-items:flex-start;cursor:default;">
        <span class="t-label" style="width:28px;flex-shrink:0;color:var(--signal);">${numerals[idx]}</span>
        <div style="flex:1;min-width:0;">
          <span class="t-body-em" style="display:block;font-family:'Libre Caslon Text',serif;font-weight:700;">${a.name}</span>
          <span class="t-foot" style="display:block;margin:3px 0 var(--sp-2);">${a.def.toUpperCase()}</span>
          <span class="t-body" style="display:block;">${a.apply}</span>
        </div>
      </div>`).join('')}
  </div>`;
}
```

- [ ] **Step 3: Rewrite the composer column in `buildContentStudio`**

Keep `csPreviewHTML()` in place for now (Task 16 rewrites it). Replace everything from the screen header through the publish buttons:

```js
  document.getElementById('screen-content').innerHTML = `
    <div class="screen-hd">
      <span class="t-label">Content Studio</span>
      <h1 class="t-h1" style="margin-top:var(--sp-2);">Draft a post</h1>
    </div>
    <div class="grid-2" style="align-items:start;">
      <div style="display:flex;flex-direction:column;gap:var(--sp-6);">
        <div>
          <span class="t-label" style="display:block;margin-bottom:var(--sp-2);">Targeting</span>
          <span class="cell selected">South Korea <span data-lucide="x" style="opacity:.7;"></span></span>
        </div>

        ${csCaptionCardHTML()}
        ${csVisualGuideHTML()}

        <div class="plate">
          <div class="plate-hd"><span class="t-h2">Pubmat</span></div>
          <div class="well"><span data-lucide="image-plus"></span><div class="t-body" style="margin-top:var(--sp-2);">Tap to upload your photo or video</div></div>
        </div>

        <div class="plate">
          <div class="plate-hd"><span class="t-h2">Platforms</span></div>
          <div class="cell-grid">
            ${Object.keys(CS_PLATFORM_META).map(k=>`<button class="cell ${csSelectedPlatforms.includes(k)?'selected':''}" onclick="csTogglePlatform('${k}')"><span data-lucide="${CS_PLATFORM_META[k].icon}"></span>${CS_PLATFORM_META[k].label}</button>`).join('')}
          </div>
        </div>

        <div class="plate">
          <div class="toggle-row">
            <div class="lbl"><span class="t-body-em">Public Visibility</span><span class="t-foot">ANYONE CAN SEE THIS POST</span></div>
            <button class="switch on" onclick="this.classList.toggle('on')" aria-label="Public visibility"></button>
          </div>
          <div class="toggle-row">
            <div class="lbl"><span class="t-body-em">Allow Comments</span><span class="t-foot">VIEWERS CAN COMMENT</span></div>
            <button class="switch on" onclick="this.classList.toggle('on')" aria-label="Allow comments"></button>
          </div>
          <div class="toggle-row">
            <div class="lbl"><span class="t-body-em">Boosted / Paid</span><span class="t-foot">PROMOTE WITH AD SPEND</span></div>
            <button class="switch" onclick="this.classList.toggle('on')" aria-label="Boosted or paid"></button>
          </div>
        </div>

        <label class="lrow" style="cursor:pointer;align-items:flex-start;">
          <input type="checkbox" id="agree-check" onchange="checkPublishReady()" style="margin-top:4px;accent-color:var(--signal);">
          <span class="t-body" style="flex:1;">I've reviewed this content and confirm it's accurate and ready to publish.</span>
        </label>

        <div style="display:flex; gap:var(--sp-3);">
          <button class="btn btn-primary btn-lg btn-block is-disabled" id="publish-btn" onclick="publishPost()">Publish Now</button>
          <button class="btn btn-ghost btn-lg">Save as Draft</button>
        </div>
      </div>

      ${csPreviewHTML()}
    </div>
    ${csBoardHTML()}`;
  renderIcons();
  armReveals();
```

- [ ] **Step 4: Add the board ledger**

`buildContentStudio` above calls `csBoardHTML()`, so it must exist before you reload. Define it immediately after `csVisualGuideHTML`:

```js
/** Draft / Scheduled / Published board, as three ruled ledger columns. */
function csBoardHTML(){
  const cols = [
    {name:'Draft',     badge:'ibadge-draft',     items:[{t:'Coral dive teaser', m:'INSTAGRAM'},{t:'Café weekend combo', m:'FACEBOOK'}]},
    {name:'Scheduled', badge:'ibadge-scheduled', items:[{t:'Golden Week promo', m:'AUG 12 · FB · TIKTOK'}]},
    {name:'Published', badge:'ibadge-published', items:[{t:'Reef cleanup dive', m:'AUG 18 · INSTAGRAM'}]}
  ];
  return `<div style="margin-top:var(--sp-12);">
    <div class="screen-hd"><span class="t-label">Board</span></div>
    <div class="grid-3">
      ${cols.map(c=>`
        <div>
          <div style="display:flex;align-items:center;justify-content:space-between;padding-bottom:var(--sp-2);border-bottom:var(--rule-w-strong) solid var(--rule-strong);">
            <span class="t-label">${c.name}</span>
            <span class="ibadge ${c.badge}">${c.items.length}</span>
          </div>
          ${c.items.map(it=>`
            <div class="lrow" style="cursor:default;">
              <span style="flex:1;min-width:0;">
                <span class="t-body-em" style="display:block;">${it.t}</span>
                <span class="t-foot">${it.m}</span>
              </span>
            </div>`).join('')}
        </div>`).join('')}
    </div>
  </div>`;
}
```

Add to the SCREENS CSS region (Task 18 also depends on this rule):

```css
.grid-3{display:grid; grid-template-columns:1fr; gap:var(--sp-8);}
@media(min-width:900px){.grid-3{grid-template-columns:repeat(3,1fr); gap:var(--sp-8);}}
```

- [ ] **Step 5: Verify**

Jump to `content`. Expected: a ruled manuscript column — the targeting cell, a caption plate with ruled tabs for TikTok and Facebook (TikTok active, marked by an ink underscore), a bottom-ruled textarea, a `TIKTOK VOICE` monospace footnote, then the Visual Guide as five hairline-separated rows numbered I–V in amber with Caslon aspect names.

Click the Instagram platform cell. Expected: an Instagram tab appears in the caption card and the Instagram caption (with Korean greeting and hashtags) loads. Click Facebook's cell to deselect it. Expected: its tab disappears. Deselect all three. Expected: the caption plate shows the empty state with an amber megaphone icon. Toggle the agreement checkbox — expected: "Publish Now" enables and disables.

---

## Task 16: Content Studio — proof frames

**Files:** Modify `ui-ux-prototype.html` — rewrite `csPreviewHTML`.

- [ ] **Step 1: Rewrite the preview with proof framing**

The platform mocks themselves stay faithful — they deliberately break the almanac style, which is the point. Only the frame is editorial.

```js
function csPreviewHTML(){
  if(csSelectedPlatforms.length===0){
    return `<div class="plate">
      <div class="plate-hd"><span class="t-h2">Proof</span></div>
      <div class="empty">
        <span data-lucide="eye"></span>
        <p class="t-body">Select a platform to see a proof.</p>
      </div>
    </div>`;
  }
  const tab = csActiveTab;
  const caption = CS_CAPTIONS[tab];
  const dims = {instagram:'1080×1080', tiktok:'1080×1920', facebook:'1200×630'};
  let inner;

  if(tab==='instagram'){
    inner = `<div style="background:#fff;color:#111;border:1px solid #dbdbdb;">
      <div style="display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid #efefef;">
        <div style="width:26px;height:26px;border-radius:50%;background:#dbdbdb;display:flex;align-items:center;justify-content:center;font:600 10px/1 sans-serif;">SD</div>
        <span style="font:600 13px/1 sans-serif;">sunsetdive.ph</span>
      </div>
      <div style="aspect-ratio:1/1;background:#243b40;display:flex;align-items:center;justify-content:center;color:#fff;">
        <span data-lucide="waves" style="width:36px;height:36px;opacity:.7;"></span>
      </div>
      <div style="padding:10px 12px 4px;display:flex;gap:12px;color:#111;">
        <span data-lucide="heart" style="width:18px;height:18px;"></span><span data-lucide="message-circle" style="width:18px;height:18px;"></span><span data-lucide="send" style="width:18px;height:18px;"></span>
      </div>
      <div style="padding:6px 12px 12px;"><p id="cs-preview-caption" style="font:400 12px/1.5 sans-serif;color:#111;">${caption}</p></div>
    </div>`;
  } else if(tab==='tiktok'){
    inner = `<div style="position:relative;aspect-ratio:9/16;max-width:220px;margin:0 auto;background:#12333a;color:#fff;">
      <div style="position:absolute;top:10px;left:10px;display:flex;align-items:center;gap:6px;">
        <div style="width:22px;height:22px;border-radius:50%;background:rgba(255,255,255,.25);display:flex;align-items:center;justify-content:center;font:600 9px/1 sans-serif;">SD</div>
        <span style="font:400 11px/1 sans-serif;">@sunsetdive.ph</span>
      </div>
      <div style="position:absolute;right:8px;bottom:70px;display:flex;flex-direction:column;gap:14px;align-items:center;">
        <span data-lucide="heart"></span><span data-lucide="message-circle"></span><span data-lucide="share-2"></span>
      </div>
      <div style="position:absolute;left:10px;right:44px;bottom:14px;display:flex;flex-direction:column;gap:6px;">
        <p id="cs-preview-caption" style="font:400 11px/1.45 sans-serif;color:#fff;">${caption}</p>
        <div style="display:flex;align-items:center;gap:4px;"><span data-lucide="music-2" style="width:12px;height:12px;"></span><span style="font:400 10px/1 sans-serif;">original sound — Sunset Dive Co.</span></div>
      </div>
    </div>`;
  } else {
    inner = `<div style="background:#fff;color:#1c1e21;border:1px solid #dddfe2;">
      <div style="display:flex;align-items:center;gap:8px;padding:10px 12px;">
        <div style="width:32px;height:32px;border-radius:50%;background:#dddfe2;display:flex;align-items:center;justify-content:center;font:600 12px/1 sans-serif;">SD</div>
        <div><div style="font:600 13px/1.2 sans-serif;">Sunset Dive Co.</div><div style="font:400 11px/1.2 sans-serif;color:#65676b;">Just now · 🌐</div></div>
      </div>
      <div style="padding:0 12px 10px;"><p id="cs-preview-caption" style="font:400 13px/1.5 sans-serif;">${caption}</p></div>
      <div style="aspect-ratio:16/10;background:#243b40;display:flex;align-items:center;justify-content:center;color:#fff;">
        <span data-lucide="waves" style="width:36px;height:36px;opacity:.7;"></span>
      </div>
      <div style="padding:10px 12px;display:flex;gap:16px;border-top:1px solid #dddfe2;font:400 12px/1 sans-serif;color:#65676b;">
        <span>👍 Like</span><span>💬 Comment</span><span>↗ Share</span>
      </div>
    </div>`;
  }

  return `<div class="plate" style="position:sticky; top:96px;">
    <div class="plate-hd"><span class="t-h2">Proof</span></div>
    <div class="rtabs">
      ${csSelectedPlatforms.map(k=>`<button class="rtab ${k===csActiveTab?'active':''}" onclick="csSetActiveTab('${k}')">${CS_PLATFORM_META[k].label}</button>`).join('')}
    </div>
    <div class="proof">
      ${inner}
      <div class="proof-cap"><span class="t-foot">PROOF · ${CS_PLATFORM_META[tab].label.toUpperCase()} · ${dims[tab]}</span></div>
    </div>
  </div>`;
}
```

- [ ] **Step 2: Verify**

Jump to `content`. Expected: the right column shows a "Proof" plate whose inner mock renders in the real platform's own look (white Instagram chrome, dark 9:16 TikTok, white Facebook card) inside a ruled frame with small amber corner registration marks and a monospace caption reading e.g. `PROOF · TIKTOK · 1080×1920`. Switch tabs — expected: the proof format changes shape (square → tall → wide) and the caption text matches the active platform. Edit the caption textarea — expected: the proof text updates live. Click Regenerate — expected: the textarea empties, both show "Generating…", then the alternate caption appears in each.

Scroll to the board — expected: three ruled columns with monospace heads and hairline-separated entries, no shadowed cards.

- [ ] **Step 3: Checkpoint**

Suggested commit message: `feat(prototype): almanac content studio, proof frames, board ledger`.

---

## Task 17: Calendar — the printed month

**Files:** Modify `ui-ux-prototype.html` — rewrite `calGridHTML`, `calListHTML`, `buildCalendar`; update `CAL_STATUS_META`.

- [ ] **Step 1: Retarget the status map to tokens**

```js
const CAL_STATUS_META = {
  published: { mark: 'var(--text)',       badgeClass: 'ibadge-published' },
  scheduled: { mark: 'var(--signal)',     badgeClass: 'ibadge-scheduled' },
  draft:     { mark: 'var(--text-muted)', badgeClass: 'ibadge-draft' }
};
```

- [ ] **Step 2: Write the calendar CSS**

```css
/* ============ CALENDAR ============ */
.cal-grid{display:grid; grid-template-columns:repeat(7,1fr); border-top:var(--rule-w) solid var(--rule-strong); border-left:var(--rule-w) solid var(--rule);}
.cal-hd{
  padding:var(--sp-2); text-align:center; border-right:var(--rule-w) solid var(--rule); border-bottom:var(--rule-w) solid var(--rule-strong);
  font-family:'DM Mono',monospace; font-size:10px; letter-spacing:.12em; color:var(--text-muted);
}
.cal-cell{
  aspect-ratio:1; padding:var(--sp-2); position:relative;
  border-right:var(--rule-w) solid var(--rule); border-bottom:var(--rule-w) solid var(--rule);
  display:flex; flex-direction:column; justify-content:space-between; background:transparent;
  transition:background var(--dur-fast) var(--ease-press);
}
.cal-cell .d{font-family:'DM Mono',monospace; font-size:11px; color:var(--text-muted); text-align:left;}
.cal-cell.has-post{cursor:pointer;}
.cal-cell.has-post:hover{background:var(--plate);}
.cal-cell.is-season{background:var(--signal-sunk);}
.cal-cell .mark{height:var(--rule-w-strong); width:100%;}
```

- [ ] **Step 3: Rewrite the renderers**

```js
function calGridHTML(){
  const cells = [];
  for(let i=1;i<=31;i++){
    const post = CALENDAR_POSTS[i];
    const season = [10,11,12].includes(i);
    cells.push(`<div class="cal-cell ${post?'has-post':''} ${season?'is-season':''}"
      ${post ? `onclick="calendarDayClick(${i})" tabindex="0" onkeydown="if(event.key==='Enter'){calendarDayClick(${i})}" aria-label="${post.title}, ${post.status}"` : ''}>
      <span class="d">${String(i).padStart(2,'0')}</span>
      ${post ? `<span class="mark" style="background:${CAL_STATUS_META[post.status].mark};"></span>` : ''}
    </div>`);
  }
  return `<div>
    <div class="cal-grid">
      ${['SUN','MON','TUE','WED','THU','FRI','SAT'].map(d=>`<div class="cal-hd">${d}</div>`).join('')}
      ${cells.join('')}
    </div>
    <div class="footnote"><span class="t-foot">MARKS · INK = PUBLISHED · AMBER = SCHEDULED · GREY = DRAFT</span></div>
  </div>`;
}

function calListHTML(){
  const days = Object.keys(CALENDAR_POSTS).map(Number).sort((a,b)=>a-b);
  return `<div>
    ${days.map(day=>{
      const post = CALENDAR_POSTS[day];
      return `
      <div style="margin-bottom:var(--sp-6);">
        <div class="t-label" style="padding-bottom:var(--sp-2);border-bottom:var(--rule-w-strong) solid var(--rule-strong);">AUG ${String(day).padStart(2,'0')}</div>
        <button class="lrow" onclick="calendarDayClick(${day})">
          <span style="flex:1;min-width:0;">
            <span class="t-body-em" style="display:block;">${post.title}</span>
            <span class="t-foot">${post.platform.toUpperCase()}</span>
          </span>
          <span class="ibadge ${CAL_STATUS_META[post.status].badgeClass}">${post.status}</span>
        </button>
      </div>`;
    }).join('')}
  </div>`;
}

function buildCalendar(){
  document.getElementById('screen-calendar').innerHTML = `
    <div class="screen-hd" style="display:flex;align-items:flex-end;justify-content:space-between;gap:var(--sp-4);">
      <div>
        <span class="t-label">Calendar</span>
        <h1 class="t-masthead" style="margin-top:var(--sp-2);">August 2026</h1>
      </div>
      <button class="btn btn-ghost btn-sm" id="cal-toggle" onclick="toggleCalView()">${calViewMode==='grid' ? 'List View' : 'Grid View'}</button>
    </div>
    <div class="banner banner-warning">
      <span data-lucide="calendar-clock"></span>
      <span>Golden Week Prep (JP) window: Aug 10–12 — marked below.</span>
    </div>
    ${calViewMode==='grid' ? calGridHTML() : calListHTML()}`;
  renderIcons();
  armReveals();
}
```

- [ ] **Step 4: Verify**

Jump to `calendar`. Expected: `August 2026` set at masthead scale in Caslon; a true ruled table with monospace weekday heads and hairline cell borders; zero-padded day numerals top-left in each cell; posts marked by a 2px full-width bar at the cell's bottom (ink/amber/grey by status); days 10–12 tinted with the amber wash; a monospace legend footnote.

Click day 18 — expected: the analytics modal opens showing "Reef cleanup dive", 2.4k engagements, +18%. Click day 27 (draft) — expected: a routing toast, no modal. Click **List View** — expected: a dated agenda with `AUG 03` style monospace heads over ruled rows with status ink badges, and the button now reads "Grid View".

---

## Task 18: Performance — the ledger

**Files:** Modify `ui-ux-prototype.html` — rewrite `buildPerformance`, `filterPills`, and the analytics modal markup (current lines 743–777).

- [ ] **Step 1: Rewrite `buildPerformance`**

```js
function buildPerformance(){
  const kpis = [
    {label:'Engagement Rate', val:6.8,  suffix:'%', trend:'+1.2%', up:true,  pts:'0,60 50,54 100,44 150,50 200,28 250,22 300,16'},
    {label:'Reach',           val:12.4, suffix:'k', trend:'+9%',   up:true,  pts:'0,66 50,60 100,54 150,44 200,50 250,34 300,26'},
    {label:'Performance Score',val:78,  suffix:'',  trend:'-3',    up:false, pts:'0,26 50,32 100,38 150,44 200,52 250,58 300,64'}
  ];
  document.getElementById('screen-performance').innerHTML = `
    <div class="screen-hd">
      <span class="t-label">Performance</span>
      <h1 class="t-h1" style="margin-top:var(--sp-2);">How your content is doing</h1>
    </div>

    <div class="grid-3" style="gap:var(--sp-4);margin-bottom:var(--sp-8);">
      ${kpis.map(s=>`
        <div class="plate-flush">
          <span class="t-label" style="display:block;margin-bottom:var(--sp-2);">${s.label}</span>
          <span class="t-figure-xl" style="font-size:48px;line-height:1;" data-rollup="${s.val}" data-rollup-suffix="${s.suffix}">0</span>
          <div style="margin:var(--sp-2) 0;">
            <svg class="sparkline" viewBox="0 0 300 80" preserveAspectRatio="none" style="height:24px;">
              <polyline points="${s.pts}" style="stroke:${s.up?'var(--positive)':'var(--critical)'}"/>
            </svg>
          </div>
          <span class="trend ${s.up?'trend-up':'trend-down'}">${s.up?'↑':'↓'} ${s.trend}</span>
        </div>`).join('')}
    </div>

    <div class="rtabs" id="perf-filters">
      ${performanceFilterChips().map((p,i)=>`<button class="rtab ${i===0?'active':''}" onclick="filterPills(this)">${p}</button>`).join('')}
    </div>

    <table class="ledger">
      <thead><tr>
        <th>Post</th><th class="hide-sm">Platform</th><th class="hide-sm">Published</th><th class="num">Engagements</th>
      </tr></thead>
      <tbody>
        ${PERFORMANCE_POSTS.map((c,idx)=>`
          <tr class="clickable" onclick="openAnalyticsFor(PERFORMANCE_POSTS[${idx}])" tabindex="0"
              onkeydown="if(event.key==='Enter'){openAnalyticsFor(PERFORMANCE_POSTS[${idx}])}">
            <td><span class="t-body-em" style="font-family:'Libre Caslon Text',serif;font-weight:700;">${c.title}</span></td>
            <td class="hide-sm"><span class="ibadge">${c.platform}</span></td>
            <td class="hide-sm t-foot">${c.date.toUpperCase()}</td>
            <td class="num t-figure">${c.engagements}</td>
          </tr>`).join('')}
      </tbody>
    </table>
    <div class="footnote"><span class="t-foot">SOURCE · PLATFORM INSIGHTS API · SAMPLE DATA</span></div>`;
  renderIcons();
  armReveals();
}

function filterPills(el){
  el.parentElement.querySelectorAll('.rtab').forEach(c=>c.classList.remove('active'));
  el.classList.add('active');
}
```

- [ ] **Step 2: Restyle the analytics modal**

Replace the `modal-bd` contents of `#analytics-modal` (keeping every `id` intact — `openAnalyticsFor` writes to all of them):

```html
  <div class="modal-bd">
    <div style="padding-bottom:var(--sp-4);border-bottom:var(--rule-w) solid var(--rule);margin-bottom:var(--sp-6);">
      <div class="t-h2" id="am-title">"Golden hour dive briefing"</div>
      <div class="t-foot" id="am-meta" style="margin-top:var(--sp-1);">INSTAGRAM · PUBLISHED JUL 29</div>
    </div>
    <div class="grid-2" style="gap:var(--sp-6);margin-bottom:var(--sp-6);">
      <div class="plate-flush">
        <span class="t-label" style="display:block;">Engagements</span>
        <span class="t-figure-xl" style="font-size:44px;line-height:1;" id="am-eng">2,412</span>
        <div><span class="ibadge ibadge-published" id="am-eng-badge">↑ <span id="am-eng-trend">+18%</span></span></div>
      </div>
      <div class="plate-flush">
        <span class="t-label" style="display:block;">Reach</span>
        <span class="t-figure-xl" style="font-size:44px;line-height:1;" id="am-reach">9,880</span>
        <div><span class="ibadge ibadge-published" id="am-reach-badge">↑ <span id="am-reach-trend">+9%</span></span></div>
      </div>
    </div>
    <span class="t-label" style="display:block;margin-bottom:var(--sp-3);">Engagement &amp; reach, 30 days</span>
    <svg class="inkchart" viewBox="0 0 300 80" preserveAspectRatio="none" style="height:110px;" role="img" aria-label="Engagement and reach over 30 days">
      <g class="grid"><line x1="0" y1="16" x2="300" y2="16"/><line x1="0" y1="32" x2="300" y2="32"/><line x1="0" y1="48" x2="300" y2="48"/><line x1="0" y1="64" x2="300" y2="64"/></g>
      <polyline class="series" points="0,66 50,60 100,62 150,40 200,46 250,26 300,20"/>
      <polyline class="series series-signal" points="0,72 50,70 100,66 150,62 200,58 250,52 300,44"/>
    </svg>
    <div class="footnote" style="display:flex;gap:var(--sp-6);">
      <span class="t-foot">— ENGAGEMENT</span><span class="t-foot" style="color:var(--signal);">— REACH</span>
    </div>
  </div>
```

Update `openAnalyticsFor` so the meta line stays uppercase:

```js
  document.getElementById('am-meta').textContent = `${post.platform} · Published ${post.date}`.toUpperCase();
```

- [ ] **Step 3: Verify**

Jump to `performance`. Expected: three flush KPI cells separated by rules, each with a monospace label, a large Caslon numeral **counting up from 0**, a hairline sparkline in green or red, and a typographic trend mark. Filter tabs render as ruled tabs reading `All / Instagram / Facebook`. The list is a ruled table with Caslon titles and right-aligned monospace engagement figures.

Click a row — expected: the analytics modal opens with a two-series ink chart that draws in, ink and amber, on a ruled grid.

Now go to Settings, connect TikTok, return to Performance. Expected: a `TikTok` ruled tab has appeared. Disconnect it — expected: it disappears.

- [ ] **Step 4: Checkpoint**

Suggested commit message: `feat(prototype): almanac calendar and performance ledgers`.

---

## Task 19: Settings — the ruled index

**Files:** Modify `ui-ux-prototype.html` — rewrite `buildSettings` and `settingsPlatformRow`; restyle the profile and invite modals.

- [ ] **Step 1: Rewrite `buildSettings`**

```js
function buildSettings(){
  document.getElementById('screen-settings').innerHTML = `
    <div class="screen-hd">
      <span class="t-label">Settings</span>
      <h1 class="t-h1" style="margin-top:var(--sp-2);">Business &amp; account</h1>
    </div>
    <div style="display:flex;flex-direction:column;gap:var(--sp-8);max-width:840px;">

      <div class="plate">
        <div class="plate-hd">
          <span class="t-h2"><span class="t-label" style="margin-right:var(--sp-2);">I</span>Business Profile</span>
          <button class="btn btn-ghost btn-sm" onclick="openProfileModal()">Edit</button>
        </div>
        <p class="t-body" style="color:var(--text-muted);">Sunset Dive Co. · Dive Shop · Mactan, Cebu</p>
      </div>

      <div class="plate">
        <div class="plate-hd"><span class="t-h2"><span class="t-label" style="margin-right:var(--sp-2);">II</span>Platforms</span></div>
        ${settingsPlatformRow('instagram','Instagram','instagram')}
        ${settingsPlatformRow('facebook','Facebook','facebook')}
        ${settingsPlatformRow('tiktok','TikTok','music-2')}
      </div>

      <div class="plate">
        <div class="plate-hd">
          <span class="t-h2"><span class="t-label" style="margin-right:var(--sp-2);">III</span>Workspace</span>
          <button class="btn btn-primary btn-sm" onclick="openModal('invite-modal')"><span data-lucide="user-plus"></span>Invite</button>
        </div>
        <div class="lrow" style="cursor:default;">
          <span style="flex:1;min-width:0;">
            <span class="t-body-em" style="display:block;">Maria Alcantara</span>
            <span class="t-foot">MARIA@SUNSETDIVE.PH</span>
          </span>
          <span class="ibadge">Owner</span>
        </div>
        <div class="lrow" style="cursor:default;">
          <span style="flex:1;min-width:0;">
            <span class="t-body-em" style="display:block;">JP Reyes</span>
            <span class="t-foot">JP@SUNSETDIVE.PH</span>
          </span>
          <span class="ibadge ibadge-scheduled">Pending</span>
        </div>
      </div>
    </div>`;
  renderIcons();
  armReveals();
}

function settingsPlatformRow(key, label, icon){
  const connected = APP_STATE.connections[key];
  return `<div class="lrow" style="cursor:default;">
    <span data-lucide="${icon}" style="width:18px;height:18px;stroke-width:1.25;color:${connected?'var(--signal)':'var(--text-muted)'};"></span>
    <span style="flex:1;min-width:0;">
      <span class="t-body-em" style="display:block;">${label}</span>
      <span class="t-foot">${connected ? '@SUNSETDIVE.PH' : 'NOT CONNECTED'}</span>
    </span>
    ${connected
      ? `<span class="ibadge ibadge-published">Connected</span><button class="btn btn-ghost btn-sm" onclick="settingsToggleConnect('${key}')">Disconnect</button>`
      : `<button class="btn btn-signal btn-sm" onclick="settingsToggleConnect('${key}')">Connect</button>`}
  </div>`;
}
```

- [ ] **Step 2: Restyle the two modals**

In `#profile-modal`, change the header `<span class="h2">` to `<span class="t-h2">`, and the save bar to:

```html
  <div id="pf-save-bar" style="display:none; position:sticky; bottom:0; background:var(--plate); border-top:var(--rule-w-strong) solid var(--rule-strong); padding:var(--sp-4) var(--sp-6); gap:var(--sp-3); justify-content:flex-end;">
    <button class="btn btn-ghost" onclick="closeModal('profile-modal')">Cancel</button>
    <button class="btn btn-primary" onclick="pfSaveChanges()">Save Changes</button>
  </div>
```

In `#invite-modal`, change `<span class="h2">` to `<span class="t-h2">` and the submit button class from `btn-primary` to `btn-primary` (unchanged) — its styling now comes from Task 4.

In both modals, the `.field` blocks need no markup change; they pick up the new flush/ruled styling automatically. Only the tag-input's `<span class="tag">` icons need their inline sizes removed so the new `.tag` rule governs.

- [ ] **Step 3: Verify**

Jump to `settings`. Expected: three ruled plates headed `I Business Profile`, `II Platforms`, `III Workspace`, each numeral in monospace. Platform rows are hairline-separated ledger rows; Instagram and Facebook show outlined green `CONNECTED` badges, TikTok shows an amber `Connect` button.

Click **Edit** on Business Profile. Expected: the modal opens with flush bottom-ruled fields, monospace `n / 50 words` counters under both textareas, and no save bar. Type one character in Business Name — expected: the save bar slides in at the bottom. Click Save Changes — expected: the modal closes and a ruled toast confirms. Reopen — expected: the save bar is hidden again.

---

## Task 20: Reduced-motion parity and the colophon

**Files:** Modify `ui-ux-prototype.html` — replace the accessibility block (current lines 557–563) and the PROTOTYPE NAV CSS (lines 565–578).

- [ ] **Step 1: Write hand-authored reduced-motion equivalents**

Do **not** simply zero out durations — every effect needs a designed static end state.

```css
/* ============ REDUCED MOTION ============ */
/* Each effect resolves to its finished state, not to nothing. A user with this
   preference sees the same composition, arrived at instantly. */
@media(prefers-reduced-motion: reduce){
  *,*::before,*::after{
    animation-duration:1ms !important; animation-iteration-count:1 !important;
    transition-duration:1ms !important; scroll-behavior:auto !important;
  }
  /* Staggered plates: fully present, no offset. */
  .reveal{animation:none !important; opacity:1 !important; transform:none !important;}
  /* Charts: rendered complete rather than mid-draw. */
  .inkchart .series{stroke-dasharray:none !important; stroke-dashoffset:0 !important;}
  /* Stamp: already struck at its resting angle. */
  .stamp{animation:none !important; opacity:1 !important; transform:rotate(-8deg) !important;}
  /* Tab underscore: present, not sliding. */
  .rtab.active::after{transform:scaleX(1) !important;}
  /* Toast: visible and stable; it still self-removes on its JS timer. */
  .toast{animation:none !important; opacity:1 !important; transform:none !important;}
  /* Loading spinner would be a static ring; make it a dashed arc instead so it reads as busy. */
  .btn.is-loading::after{animation:none !important; border-style:dashed !important;}
}
```

`armReveals` already checks `prefers-reduced-motion` and short-circuits both the draw-in observer and the numeral roll-up — verify that branch is intact.

- [ ] **Step 2: Restyle the jump-bar as a colophon**

```css
/* ============ COLOPHON (prototype jump bar) ============ */
.proto-nav{
  position:fixed; bottom:76px; left:var(--sp-3); z-index:100;
  background:var(--plate); border:var(--rule-w) solid var(--rule-strong);
  max-width:calc(100vw - 24px);
}
@media(min-width:1024px){.proto-nav{bottom:var(--sp-3);}}
.proto-nav-hd{
  display:flex; align-items:center; gap:var(--sp-2); padding:var(--sp-2) var(--sp-3);
  cursor:pointer; user-select:none; border-bottom:var(--rule-w) solid var(--rule);
}
.proto-nav.collapsed .proto-nav-hd{border-bottom:none;}
.proto-nav-hd .dot{width:5px; height:5px; background:var(--signal); flex-shrink:0;}
.proto-nav-hd .lbl{font-family:'DM Mono',monospace; font-size:9px; letter-spacing:.18em; text-transform:uppercase; color:var(--text-muted);}
.proto-nav-hd svg{width:12px; height:12px; stroke-width:1.25; color:var(--text-muted); margin-left:auto; transition:transform var(--dur-fast) var(--ease-press);}
.proto-nav.collapsed .proto-nav-hd svg{transform:rotate(-90deg);}
.proto-nav-body{display:flex; gap:var(--rule-w); flex-wrap:wrap; padding:var(--sp-2); max-width:min(400px,calc(100vw - 24px));}
.proto-nav.collapsed .proto-nav-body{display:none;}
.proto-nav-body button{
  background:none; border:var(--rule-w) solid transparent; color:var(--text-muted);
  font-family:'DM Mono',monospace; font-size:9px; letter-spacing:.10em; text-transform:uppercase;
  padding:var(--sp-1) var(--sp-2); cursor:pointer;
}
.proto-nav-body button:hover{color:var(--signal); border-color:var(--rule-strong);}
```

In the colophon IIFE, change the header label text from `Prototype Views` to `Colophon`.

- [ ] **Step 3: Verify**

In DevTools, enable *Rendering → Emulate CSS prefers-reduced-motion: reduce*, then reload and walk every screen. Expected on each: content fully visible with nothing faded out or offset; charts fully drawn; KPI and forecast numerals at their final values; the onboarding stamp already struck at −8°; the active tab underscore present. Nothing invisible, nothing frozen mid-transition.

Confirm the colophon reads `COLOPHON` in the corner as a small ruled chip with monospace links, and that all eight jump targets still work.

---

## Task 21: Cross-screen consistency sweep

**Files:** Modify `ui-ux-prototype.html` — remove dead CSS and any surviving legacy class references.

- [ ] **Step 1: Delete every orphaned rule**

Most of these were already removed by the block replacements in Tasks 2–6. Search the `<style>` block for each selector below and delete any that survived — all are superseded and now style nothing:

`.card`, `.card-header`, `.card-tight`, `.sec-hd`, `.eyebrow`, `.h-display`, `.h1`, `.h2`, `.h3`, `.body-txt`, `.body-emphasis`, `.caption`, `.cta-label`, `.badge` and all its `.badge-*` variants, `.chip`, `.chip-grid`, `.cat-item` and all its descendants, `.mkt-row` and all its descendants, `.mkt-flag`, `.mkt-score`, `.mkt-bar`, `.next-band` and all its descendants, `.btn-secondary`, `.progress-linear`, `.upload-zone`, `.login-wrap`, `.login-card`, `.login-logo`, `.login-tagline`, `.login-tabs`, `.login-tab`, `.login-photo`, `.lp-points`, `.ob-side`, `.ob-main`, `.ob-topbar`, `.ob-body`, `.ob-panel`, `.ob-step-item`, `.reveal-wrap`, `.reveal-gauge`, `.score-verdict`, `.post-card`, `.post-thumb`, `.kanban`, `.kanban-col`, `.kanban-col-hd`, `.empty-state`, `.topbar`, `.topbar-biz`, `.avatar`, `.bell-btn`, `.bell-dot`, `.sb-brand .mark`, `.sb-biz`.

**Do not delete these — they are live:** `.divider` (redefined in Task 8, used by the login cover and the low-score onboarding panel), `.charcount` (Task 4, used by both word-counter surfaces), `.toggle-row .lbl` (Task 4, used by Content Studio), `.drag-handle` (mobile drawer), `.skeleton` (Task 7).

**`.stamp` needs care.** The current file has a `.stamp` rule at line 469 for the login passport stamp — delete that one. Task 4 defines a new `.stamp` for the press stamp and Task 7 adds its `animation` declaration in the MOTION section; **both of those are intentional and must remain.** After this step, searching for `.stamp{` should find exactly the two new rules and none of the old.

- [ ] **Step 2: Find surviving legacy class references in the JS**

Run:

```bash
grep -nE 'class="[^"]*\b(card|caption|body-txt|body-emphasis|badge|chip|h1|h2|h3|mkt-|cat-item|next-band|post-card|post-thumb|kanban|empty-state|avatar|topbar|upload-zone|progress-linear|score-verdict)\b' "c:/Users/austi/CeView/ui-ux-prototype.html"
```

Expected: **no output**. Every hit is a legacy class that lost its styling — convert it to the equivalent primitive (`card`→`plate`, `caption`→`t-foot` or `t-label`, `body-txt`→`t-body`, `body-emphasis`→`t-body-em`, `h1/h2/h3`→`t-h1/t-h2`, `badge`→`ibadge`, `chip`→`cell`, `upload-zone`→`well`, `empty-state`→`empty`, `progress-linear`→`prog`).

Note the exceptions that are **intentional** and must not be flagged: the `class="cal-hd"`, `class="proof-cap"`, and the platform-preview mocks inside `csPreviewHTML`, which use raw inline `font:` shorthand rather than any project class — that is deliberate, per spec §4.4.

- [ ] **Step 3: Check for hardcoded color literals**

Run:

```bash
grep -nE '#[0-9A-Fa-f]{6}' "c:/Users/austi/CeView/ui-ux-prototype.html"
```

Expected hits only in: the two `html[data-theme]` token blocks, the favicon data-URI, the `theme-color` meta, the `setTheme` function's two literals, and the platform-preview mocks in `csPreviewHTML` (Instagram/TikTok/Facebook chrome colors, which must not re-theme — a real Instagram post is white in both themes). Any other hit is a token leak; replace it with the appropriate `var(--…)`.

- [ ] **Step 4: Verify**

Reload and walk all seven screens in both themes. Expected: no element renders unstyled, no default-serif text appears, no white-on-white or black-on-black anywhere, and the console is clean.

---

## Task 22: Full verification sweep

**Files:** none modified — this is the spec §6 checklist, executed.

- [ ] **Step 1: Structural and regression checks**

At 1440px, ink theme, walk all eight jump targets. Confirm each item:

1. All seven views render; console has zero errors or warnings.
2. Onboarding reports "STEP 1 OF 6" — matches the Task 1 baseline.
3. Dashboard category rail has 4 entries; selecting "Tours & Excursions" swaps the market ledger to 3 rows led by Japan at 88.
4. Content Studio starts with TikTok + Facebook selected, TikTok tab active.
5. Performance filter tabs read `All / Instagram / Facebook`.
6. Settings → connect TikTok → Performance shows a TikTok tab; disconnect removes it.

- [ ] **Step 2: Theme parity**

Toggle to paper and repeat the walk. Confirm: every surface re-themes, the toggle label reads `PAPER`, no element retains an ink-theme color, and text contrast is legible everywhere — in particular check the proof frames (which stay light in both themes by design) and the amber signal against the paper canvas.

- [ ] **Step 3: Responsive**

Repeat at 768px and 375px in both themes. Confirm at each width:

- No horizontal scroll on any screen. Test by running `document.documentElement.scrollWidth <= document.documentElement.clientWidth` in the console on each screen — expected `true` every time.
- Below 1024px the spine hides and the ruled bottom tab bar appears.
- The market ledger drops its last three columns; the calendar grid stays square-celled.
- Drawers become bottom sheets; modals become bottom sheets.

- [ ] **Step 4: Interaction sweep**

- Onboarding: both score paths complete end to end; word counters gate Next at 50; category multi-select gates Next at 1; connection rows toggle.
- Content Studio: platform cells drive both caption tabs and proof frames; the empty state appears with none selected; Regenerate changes only the active tab's caption.
- Calendar: grid ↔ list toggles; day 18 opens pre-filled analytics; day 27 shows a toast.
- Performance: KPI numerals roll up; a row opens the analytics modal.
- Settings: the profile modal's save bar is dirty-gated.

- [ ] **Step 5: Accessibility**

- Tab through each screen. Confirm every interactive element is reachable and the amber focus outline is visible against both canvases.
- Confirm ledger rows respond to Enter.
- Re-run the reduced-motion pass from Task 20 Step 3.

- [ ] **Step 6: Report**

Write a short completion report stating what was verified and, explicitly, anything that failed or was left incomplete. Do not claim completion for any check you did not actually perform in a browser.

- [ ] **Step 7: Final checkpoint**

Suggested commit message: `feat(prototype): complete Cebu Tourism Almanac overhaul`.

---

## Spec Coverage Map

| Spec section | Task(s) |
|---|---|
| §1.4 Prerequisite | 1 |
| §2 Implementation approach, preserved JS | 1, and honored throughout |
| §3.1 Color, dual palette | 2 |
| §3.2 Typography | 3 |
| §3.3 Structure, spacing, rules | 2, 4 |
| §3.4 Texture (grain, letterpress, registration marks) | 2, 3, 4 |
| §3.5 Component inventory | 4, 5, 7 |
| §3.6 Iconography | 4, 6, and enforced in 21 |
| §3.7 Motion + reduced-motion parity | 7, 10, 20 |
| §4.1 Login issue cover | 8 |
| §4.2 Onboarding ruled spread | 9, 10 |
| §4.3 Dashboard front page + radar drawer | 12, 13, 14 |
| §4.4 Content Studio + proofs + board | 15, 16 |
| §4.5 Calendar | 17 |
| §4.6 Performance + analytics modal | 18 |
| §4.7 Settings | 19 |
| §4.8 App shell, spine, masthead, tabs, colophon | 6, 20 |
| §5 Mock data expansion | 11 |
| §6 Verification | 22 |
| §7 Out of scope | honored — no `ceview/` file is touched by any task |
