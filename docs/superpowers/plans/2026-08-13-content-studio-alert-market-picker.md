# Content Studio: Alert → Market Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate Content Studio v1 (`ui-ux-prototype.html`, `renderContent()`) behind a two-step picker — surge alert, then target market — so no entry point shows generated captions without an explicit choice of both.

**Architecture:** Add three fields to `APP_STATE.content` (`pickedAlertId`, `pickedMarketId`, `pickerStep`). `renderContent()` branches: render Step 1 (alert list) if no alert picked, Step 2 (market list for that alert's category) if no market picked, otherwise the existing captions UI with its header now driven by the pick instead of the hardcoded `MOCK_CONTENT.market`. The dashboard's "Target this market" shortcut is changed to reset the pick (forcing the picker) instead of skipping straight to captions.

**Tech Stack:** Single static HTML file, vanilla JS, no build step, no bundler, no existing test runner for this file.

**A note on verification:** `ui-ux-prototype.html` is a standalone prototype with no unit test harness (it isn't wired into Vitest/Playwright's `e2e/` suite). Each task below is verified by driving the actual page with the Playwright MCP browser tools (`mcp__plugin_playwright_playwright__browser_navigate` / `browser_click` / `browser_snapshot`) against the local file, since that's the only way to observe this file's behavior. This substitutes for automated tests — verify by reading the snapshot output, don't skip the step.

The file under test throughout: `c:\Users\austi\CeView\ui-ux-prototype.html`, loaded as `file:///C:/Users/austi/CeView/ui-ux-prototype.html`.

---

### Task 1: Add picker fields to content state

**Files:**
- Modify: `ui-ux-prototype.html:1507-1519`

- [ ] **Step 1: Add the three new fields to `APP_STATE.content`**

Current code:

```js
  content:{
    platform:'instagram',
    approved:{},          // platform -> option index
    approvedText:{},      // platform -> caption text
    edits:{},             // "platform-idx" -> edited text
    staged:'',
    media:null,
    publishPlatforms:[],
    toggles:{ visibility:true, comments:true, paid:false },
    agreed:false,
    omcs:null,
    auditing:false
  },
```

Replace with:

```js
  content:{
    platform:'instagram',
    approved:{},          // platform -> option index
    approvedText:{},      // platform -> caption text
    edits:{},             // "platform-idx" -> edited text
    staged:'',
    media:null,
    publishPlatforms:[],
    toggles:{ visibility:true, comments:true, paid:false },
    agreed:false,
    omcs:null,
    auditing:false,
    pickedAlertId:null,   // MOCK_NOTIFICATIONS id chosen in the Content Studio picker's Step 1
    pickedMarketId:null,  // market id chosen in Step 2 (marketsForCategory(alert.category))
    pickerStep:'alert'    // 'alert' | 'market' — only meaningful while a pick isn't complete
  },
```

- [ ] **Step 2: Verify the file still loads with no console errors**

Use the Playwright MCP tools:
1. `mcp__plugin_playwright_playwright__browser_navigate` to `file:///C:/Users/austi/CeView/ui-ux-prototype.html`
2. `mcp__plugin_playwright_playwright__browser_console_messages` — expect no new errors compared to a baseline load (the page should reach the login screen normally).

- [ ] **Step 3: Commit**

This repo's project instructions (`.claude/CLAUDE.md`) forbid Claude from running `git commit`/`git push`. Stop here and hand this change back to the user to commit, or fold it into the same commit as later tasks if the user prefers to commit once at the end.

---

### Task 2: Add picker step renderers and handlers

**Files:**
- Modify: `ui-ux-prototype.html` — insert new functions immediately before `function renderContent(){` (currently at `ui-ux-prototype.html:2794`)

- [ ] **Step 1: Add the Step 1 (alert) renderer, the Step 2 (market) renderer, and the four picker handlers**

Insert this block directly above `function renderContent(){`:

```js
/* ---- Content Studio picker: Step 1 (surge alert), Step 2 (target market) ---- */
function renderContentAlertStep(){
  const p = APP_STATE.profile;
  const myAlerts = MOCK_NOTIFICATIONS.filter(n => p.categories.includes(n.category));

  const body = myAlerts.length===0
    ? `<div class="card"><div class="empty">
         <div class="empty-glyph"><i data-lucide="tag"></i></div>
         <h3>No surge alerts for your categories yet</h3>
         <p>Nothing is currently trending for ${esc(p.categories.join(', ') || 'your business categories')}. Add another category in Settings → Business Profile to widen coverage.</p>
       </div></div>`
    : `<div style="display:grid;gap:var(--sp-3);">${myAlerts.map(n=>`
        <button class="alert-card ${n.isRead?'':'unread'}" onclick="csPickAlert('${n.id}')">
          <div class="alert-top">
            ${n.isRead?'':'<span class="unread-dot"></span>'}
            <span class="alert-date">${esc(n.date)}</span>
            ${n.alertLevel==='WARNING'?'<span class="chip chip-red"><i data-lucide="zap"></i> Surge</span>':''}
          </div>
          <h4>${esc(n.title)}</h4>
          <p class="body-sm" style="margin-top:7px;">${esc(n.alertMessage)}</p>
          <div class="alert-meta">
            <span class="chip chip-navy"><i data-lucide="map-pin"></i> ${esc(n.market)}</span>
            <span class="chip"><i data-lucide="tag"></i> ${esc(n.category)}</span>
            <span class="chip"><i data-lucide="trending-up"></i> ${esc(n.trend)}</span>
          </div>
          <div class="alert-cta">Pick this alert <i data-lucide="arrow-right"></i></div>
        </button>`).join('')}
      </div>`;

  $('#screen-content').innerHTML = `
    <div class="page-head">
      <div>
        <h2>Content Studio</h2>
        <p>Step 1 of 2 — pick the surge alert you're creating content for.</p>
      </div>
    </div>
    ${body}`;
  icons();
}

function renderContentMarketStep(){
  const c = C();
  const alert = MOCK_NOTIFICATIONS.find(n=>n.id===c.pickedAlertId);
  const list = marketsForCategory(alert.category);
  const ranks = list.map(m=>{
    const hasSpike = m.chartData.some(d=>d.spike===1);
    return `<button class="rank-card" data-rank="${m.rank}" onclick="csPickMarket('${m.id}')">
      <div class="rank-head">
        <span class="rank-no">${m.rank}</span>
        <div style="min-width:0;">
          <h4>${esc(m.name)}</h4>
          <p class="rank-sub">${esc(m.city)} · ${num(m.distanceKm)} km to Cebu</p>
        </div>
        <div class="rank-score"><b class="num">${m.matchScore}</b><span>Potential</span></div>
      </div>
      <div style="margin-top:var(--sp-4);">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:6px;">
          <span class="eyebrow">Market potential</span>
          <span class="num" style="font-size:11.5px;font-weight:800;">${m.matchScore}/100</span>
        </div>
        <div class="bar ${m.rank===1?'gold':''}"><i style="width:${m.matchScore}%"></i></div>
      </div>
      <div class="rank-facts">
        <span class="rank-fact"><i data-lucide="plane" style="stroke:${m.directFlight?'#0F7A4E':'#D48E15'}"></i>
          <b>${m.directFlight?'Direct':'Via Manila'}</b> · ${esc(m.flightHours)}</span>
        <span class="rank-fact"><i data-lucide="calendar-clock"></i> ${m.flightFrequency}x / week</span>
        ${hasSpike?'<span class="chip chip-red" style="margin-left:auto;"><i data-lucide="zap"></i> Surge active</span>':''}
      </div>
    </button>`;
  }).join('');

  $('#screen-content').innerHTML = `
    <div class="page-head" style="display:flex;align-items:flex-start;justify-content:space-between;gap:var(--sp-4);flex-wrap:wrap;">
      <div>
        <h2>Content Studio</h2>
        <p>Step 2 of 2 — pick a target market for ${esc(alert.category)}.</p>
      </div>
      <button class="btn btn-ghost btn-sm" onclick="csBackToAlertStep()">
        <i data-lucide="arrow-left"></i> Back to alerts</button>
    </div>
    <section class="markets-reveal">
      <div style="display:grid;gap:var(--sp-3);">${ranks}</div>
    </section>`;
  icons();
}

function csPickAlert(id){
  const c = C();
  c.pickedAlertId = id;
  c.pickerStep = 'market';
  renderContent();
}
function csBackToAlertStep(){
  const c = C();
  c.pickedAlertId = null;
  c.pickerStep = 'alert';
  renderContent();
}
function csPickMarket(id){
  const c = C();
  c.pickedMarketId = id;
  renderContent();
}
function csChangeTarget(){
  const c = C();
  c.pickedAlertId = null;
  c.pickedMarketId = null;
  c.pickerStep = 'alert';
  renderContent();
}

```

- [ ] **Step 2: Verify the file still parses (no syntax errors)**

Use `mcp__plugin_playwright_playwright__browser_navigate` to reload the file, then `mcp__plugin_playwright_playwright__browser_console_messages` — expect no new "Uncaught SyntaxError" entries. These functions aren't called yet (Task 3 wires them up), so no visible behavior change is expected at this point.

- [ ] **Step 3: Commit**

Per this repo's `.claude/CLAUDE.md`, do not run `git commit` — hand back to the user.

---

### Task 3: Branch `renderContent()` on the picker state

**Files:**
- Modify: `ui-ux-prototype.html:2794-2796`

- [ ] **Step 1: Add the branch and switch the market lookup to the picked market**

Current code:

```js
function renderContent(){
  const c = C();
  const m = marketById(APP_STATE.activeMarketId);
  const plat = c.platform;
```

Replace with:

```js
function renderContent(){
  const c = C();
  if(!c.pickedAlertId){ renderContentAlertStep(); return; }
  if(!c.pickedMarketId){ renderContentMarketStep(); return; }
  const pickedAlert = MOCK_NOTIFICATIONS.find(n=>n.id===c.pickedAlertId);
  const m = marketById(c.pickedMarketId);
  const plat = c.platform;
```

- [ ] **Step 2: Verify Step 1 of the picker now renders when Content Studio is opened fresh**

1. `mcp__plugin_playwright_playwright__browser_navigate` to `file:///C:/Users/austi/CeView/ui-ux-prototype.html`
2. Use the page's dev jump bar to reach a logged-in state, then click into "Content Studio" (`goApp('content')` — the existing dev link at this point in the plan still jumps straight there without pre-setting picks, since Task 6 hasn't run yet).
3. `mcp__plugin_playwright_playwright__browser_snapshot` — expect to see "Step 1 of 2 — pick the surge alert you're creating content for." and a list of alert cards, **not** the AI copywriting matrix.
4. `mcp__plugin_playwright_playwright__browser_click` one of the alert cards — expect the snapshot after the click to show "Step 2 of 2 — pick a target market for {category}." with a list of market rank-cards.
5. `mcp__plugin_playwright_playwright__browser_click` one of the market cards — expect the snapshot to now show the AI copywriting matrix (the pre-existing captions UI). This confirms the full picker → captions path works even though the header text hasn't been updated yet (that's Task 4).

- [ ] **Step 3: Commit**

Per this repo's `.claude/CLAUDE.md`, do not run `git commit` — hand back to the user.

---

### Task 4: Drive the captions view header from the pick, add "Change target market"

**Files:**
- Modify: `ui-ux-prototype.html:2922-2933`

- [ ] **Step 1: Replace the hardcoded header with the picked alert/market, add the change-target control**

Current code:

```js
  $('#screen-content').innerHTML = `
    <div class="page-head" style="display:flex;align-items:flex-start;justify-content:space-between;gap:var(--sp-4);flex-wrap:wrap;">
      <div>
        <h2>Content Studio</h2>
        <p>Localized copy generated for ${esc(m.name)}, gated by a compliance audit before anything leaves the platform.</p>
      </div>
      <div style="display:flex;gap:9px;align-items:center;flex-wrap:wrap;">
        <span class="chip chip-navy"><i data-lucide="map-pin"></i> ${esc(MOCK_CONTENT.market.country)} — ${esc(MOCK_CONTENT.market.city)}</span>
        <span class="chip chip-teal"><i data-lucide="git-branch"></i> ${esc(MOCK_CONTENT.framework)}</span>
        ${MOCK_CONTENT.source==='fallback'?'<span class="chip chip-gold"><i data-lucide="cloud-off"></i> Demo content (LLM offline)</span>':''}
      </div>
    </div>
```

Replace with:

```js
  $('#screen-content').innerHTML = `
    <div class="page-head" style="display:flex;align-items:flex-start;justify-content:space-between;gap:var(--sp-4);flex-wrap:wrap;">
      <div>
        <h2>Content Studio</h2>
        <p>Localized copy generated for ${esc(m.name)} — ${esc(pickedAlert.category)}, gated by a compliance audit before anything leaves the platform.</p>
      </div>
      <div style="display:flex;gap:9px;align-items:center;flex-wrap:wrap;">
        <span class="chip chip-navy"><i data-lucide="map-pin"></i> ${esc(m.name)} — ${esc(m.city)}</span>
        <span class="chip chip-teal"><i data-lucide="git-branch"></i> ${esc(MOCK_CONTENT.framework)}</span>
        ${MOCK_CONTENT.source==='fallback'?'<span class="chip chip-gold"><i data-lucide="cloud-off"></i> Demo content (LLM offline)</span>':''}
        <button class="btn btn-ghost btn-sm" onclick="csChangeTarget()">
          <i data-lucide="refresh-cw"></i> Change target market</button>
      </div>
    </div>
```

- [ ] **Step 2: Verify the header reflects the pick, and "Change target market" returns to Step 1**

1. Repeat the navigate → alert → market click sequence from Task 3 Step 2.
2. `mcp__plugin_playwright_playwright__browser_snapshot` — expect the subtitle to read "Localized copy generated for {picked market name} — {picked alert category}..." and a chip reading "{picked market name} — {picked market city}", matching whichever alert/market were clicked (not always "South Korea — Seoul" regardless of pick).
3. `mcp__plugin_playwright_playwright__browser_click` the "Change target market" button.
4. `mcp__plugin_playwright_playwright__browser_snapshot` — expect Step 1 of the picker again ("Step 1 of 2 — pick the surge alert...").

- [ ] **Step 3: Commit**

Per this repo's `.claude/CLAUDE.md`, do not run `git commit` — hand back to the user.

---

### Task 5: Make the dashboard's "Target this market" force the picker

**Files:**
- Modify: `ui-ux-prototype.html:2660-2666`

- [ ] **Step 1: Reset the picker state before navigating, update the toast copy**

Current code:

```js
function targetThisMarket(id){
  APP_STATE.targetedMarketId = id;
  APP_STATE.activeMarketId = id;
  closeDrawer();
  goApp('content');
  showToast('Targeting ' + marketById(id).name + ' — content generated');
}
```

Replace with:

```js
function targetThisMarket(id){
  APP_STATE.targetedMarketId = id;
  APP_STATE.activeMarketId = id;
  APP_STATE.content.pickedAlertId = null;
  APP_STATE.content.pickedMarketId = null;
  APP_STATE.content.pickerStep = 'alert';
  closeDrawer();
  goApp('content');
  showToast('Opening Content Studio for ' + marketById(id).name);
}
```

- [ ] **Step 2: Verify the dashboard shortcut lands on Step 1, not on captions**

1. `mcp__plugin_playwright_playwright__browser_navigate` to `file:///C:/Users/austi/CeView/ui-ux-prototype.html`.
2. Use the dev jump bar's "Radar — Korea" link (`Dashboard states` group) to open the market radar drawer directly.
3. `mcp__plugin_playwright_playwright__browser_click` the "Target this market" button in the drawer.
4. `mcp__plugin_playwright_playwright__browser_snapshot` — expect to land on Content Studio's Step 1 ("Step 1 of 2 — pick the surge alert...") and a toast reading "Opening Content Studio for South Korea" — **not** the captions UI.

- [ ] **Step 3: Commit**

Per this repo's `.claude/CLAUDE.md`, do not run `git commit` — hand back to the user.

---

### Task 6: Update the dev jump bar

**Files:**
- Modify: `ui-ux-prototype.html:4339-4341`

- [ ] **Step 1: Pre-set picks on the existing QA shortcuts, add a picker-only shortcut**

Current code:

```js
  ['Screens', [
    ['Content Studio', ()=>{ seedCompletedProfile(); goApp('content'); }],
    ['Content — audited', ()=>{ seedCompletedProfile(); primeStudio(); goApp('content'); }],
```

Replace with:

```js
  ['Screens', [
    ['Content Studio', ()=>{ seedCompletedProfile(); APP_STATE.content.pickedAlertId='n1'; APP_STATE.content.pickedMarketId='korea'; goApp('content'); }],
    ['Content Studio — picker', ()=>{ seedCompletedProfile(); APP_STATE.content.pickedAlertId=null; APP_STATE.content.pickedMarketId=null; APP_STATE.content.pickerStep='alert'; goApp('content'); }],
    ['Content — audited', ()=>{ seedCompletedProfile(); primeStudio(); APP_STATE.content.pickedAlertId='n1'; APP_STATE.content.pickedMarketId='korea'; goApp('content'); }],
```

- [ ] **Step 2: Verify all three dev links land where expected**

1. `mcp__plugin_playwright_playwright__browser_navigate` to `file:///C:/Users/austi/CeView/ui-ux-prototype.html`, open the dev jump bar.
2. Click "Content Studio" → `browser_snapshot` — expect the captions UI (AI copywriting matrix) to appear immediately, header reading "South Korea — {n1's category, Accommodation & Staycation}".
3. Click "Content Studio — picker" → `browser_snapshot` — expect Step 1 of the picker.
4. Click "Content — audited" → `browser_snapshot` — expect the captions UI with the pre-staged Instagram caption approved and the OMCS audit panel populated (`primeStudio()`'s existing behavior), header reading the same picked market/category as step 2.

- [ ] **Step 3: Commit**

Per this repo's `.claude/CLAUDE.md`, do not run `git commit` — hand back to the user.

---

### Task 7: Full regression pass — remembered pick across navigation

**Files:** none (verification only)

- [ ] **Step 1: Verify a completed pick is remembered when leaving and re-entering Content Studio**

1. `mcp__plugin_playwright_playwright__browser_navigate` to `file:///C:/Users/austi/CeView/ui-ux-prototype.html`, reach a logged-in state via the dev jump bar, use "Content Studio — picker" to land on Step 1.
2. Click an alert, then click a market — `browser_snapshot` to confirm the captions UI shows that alert's category and market.
3. Navigate to Dashboard via the sidebar nav.
4. Navigate back to "Content Studio" via the sidebar nav.
5. `mcp__plugin_playwright_playwright__browser_snapshot` — expect to land directly back on the same captions UI (same market/category as step 2), **not** Step 1 of the picker — confirming the pick is remembered for the rest of the session.
6. Click "Change target market" — `browser_snapshot` — expect Step 1 again.

- [ ] **Step 2: Verify the empty-alerts state**

There's no existing dev link for a zero-category profile, so force it directly:

1. Still in the same session (logged in, on Content Studio), use `mcp__plugin_playwright_playwright__browser_evaluate` to run:
   ```js
   () => { APP_STATE.profile.categories = ['Nonexistent Category']; APP_STATE.content.pickedAlertId = null; APP_STATE.content.pickedMarketId = null; APP_STATE.content.pickerStep = 'alert'; renderContent(); }
   ```
2. `mcp__plugin_playwright_playwright__browser_snapshot` — expect the "No surge alerts for your categories yet" empty state, with body text referencing "Nonexistent Category", and no alert cards or picker controls present.
3. Restore state for any later checks with `mcp__plugin_playwright_playwright__browser_evaluate`:
   ```js
   () => { APP_STATE.profile.categories = ['Coastal & Island','Accommodation & Staycation']; renderContent(); }
   ```

- [ ] **Step 3: Report results**

Summarize pass/fail for every `browser_snapshot` check above. If anything failed, stop and fix before considering this plan complete — do not report success without having actually seen the passing snapshot output.

