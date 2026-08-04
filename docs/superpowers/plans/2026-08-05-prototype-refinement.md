# Prototype Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine `ui-ux-prototype.html` (a single-file static wireframe, no backend/build) per
[`2026-08-05-prototype-refinement-design.md`](../specs/2026-08-05-prototype-refinement-design.md):
free-text onboarding fields with word-count gates, account-connection UX, a scripted low-score
guided-question flow, platform-aware Content Studio (captions/visual guide/live preview),
Calendar list view + hardcoded stats wired to the Analytics Modal, connection-driven Performance
filters, and a Settings profile-edit modal.

**Architecture:** All work happens inside the existing single HTML file's `<style>` and `<script>`
blocks. State lives in a few top-level JS objects/arrays (`APP_STATE`, `CS_CAPTIONS`,
`CALENDAR_POSTS`, `obScoreState`, etc.) that "screen builder" functions (`buildX()`) read from and
re-render into their `<section>` via `innerHTML`. No new files, no build step, no backend calls —
every "AI generation," "connect account," and "save" action is a client-side state mutation
followed by a re-render.

**Tech Stack:** Vanilla HTML/CSS/JS, `lucide` icon CDN script, Plus Jakarta Sans via Google Fonts
CDN — unchanged from the existing prototype.

**Repo policy note:** Per this repo's `CLAUDE.md`, do not run `git commit` or `git push`. Each
task ends with a manual verification step instead of a commit step; leave changes unstaged for
the user to review and commit themselves.

---

## Before You Start

All tasks modify one file: `c:\Users\austi\CeView\ui-ux-prototype.html`. Read it fully once before
starting (it's ~1100 lines) so the exact text you're matching in each `Edit` call is fresh.

**Verification server** (used by every task's manual-check step): from the repo root,

```bash
cd "c:/Users/austi/CeView" && (python -m http.server 8791 >/tmp/httpserver.log 2>&1 &)
```

Then open `http://localhost:8791/ui-ux-prototype.html` (via the Playwright MCP tools —
`browser_navigate`, `browser_evaluate` with `window.__jump('<view>')` to hop screens, and
`browser_take_screenshot` to visually confirm). Kill it when done: `pkill -f "http.server 8791"`.

---

### Task 1: Shared state and helper functions

**Files:**
- Modify: `ui-ux-prototype.html` (inside `<script>`, right after the `renderIcons()` function)

This task adds the shared pieces every later task depends on: a connection-state object (used by
Onboarding, Settings, and Performance) and word-count helpers (used by Onboarding and the Settings
profile modal). Doing this first means later tasks never have to touch this block again.

- [ ] **Step 1: Add `APP_STATE`, `wordCount`, and `updateWordCounter`**

Find:
```js
/* ============================================================ ICONS ============================================================ */
function renderIcons(){ if(window.lucide) lucide.createIcons(); }
```

Replace with:
```js
/* ============================================================ ICONS ============================================================ */
function renderIcons(){ if(window.lucide) lucide.createIcons(); }

/* ============================================================ SHARED APP STATE ============================================================ */
/** Platform connection state — shared by Onboarding step 4, Settings → Platforms, and
 *  Performance's filter chips, so connecting/disconnecting in one place reflects everywhere. */
const APP_STATE = {
  connections: { instagram: true, facebook: true, tiktok: false }
};

/** Counts words in a string (whitespace-separated, trimmed). Empty/whitespace-only -> 0. */
function wordCount(str){
  const t = (str || '').trim();
  return t ? t.split(/\s+/).length : 0;
}

/** Updates a word-count caption element's text and color against a minimum threshold. */
function updateWordCounter(elId, count, min){
  const el = document.getElementById(elId);
  if(!el) return;
  el.textContent = `${count} / ${min} words`;
  el.style.color = count >= min ? 'var(--state-success-text)' : 'var(--text-muted)';
}
```

- [ ] **Step 2: Verify no syntax errors**

Start the verification server (see "Before You Start"), navigate to
`http://localhost:8791/ui-ux-prototype.html` with the Playwright MCP tool, and check console
messages (`browser_console_messages`, level `error`). Expect 0 JS errors (a `favicon.ico` 404 is
fine and unrelated). The Login screen should render exactly as before — this task only adds
unused-so-far code.

---

### Task 2: Onboarding — free-text Vibe/Theme + 50-word Description/UVP gates

**Files:**
- Modify: `ui-ux-prototype.html` (`obPanelHTML`, `obRender`, add `obUpdateNextState`)

- [ ] **Step 1: Replace the Vibe/Theme chip-select with a free-text field**

Find (inside `obPanelHTML`):
```js
  if(i===1) return `
    <h2 class="h1" style="margin-bottom:6px;">What's your brand's vibe?</h2>
    <p class="body-txt" style="color:var(--text-muted);margin-bottom:24px;">Pick up to 3 — this shapes the tone of your AI-generated content.</p>
    <div class="field"><label>Vibe / Theme</label>
      <div class="chip-grid" id="vibe-chips">
        ${['Adventurous','Relaxed','Luxury','Family-friendly','Rustic','Modern'].map((v,idx)=>`<span class="chip ${idx===0?'selected':''}" onclick="toggleChip(this)">${v}</span>`).join('')}
      </div>
    </div>
    <div class="field"><label>Core Services</label>
      <div class="tag-input">
        <span class="tag">Guided Reef Dives <span data-lucide="x" style="width:10px;height:10px;"></span></span>
        <span class="tag">PADI Certification <span data-lucide="x" style="width:10px;height:10px;"></span></span>
        <input placeholder="Add a service…">
      </div>
    </div>`;
```

Replace with:
```js
  if(i===1) return `
    <h2 class="h1" style="margin-bottom:6px;">What's your brand's vibe?</h2>
    <p class="body-txt" style="color:var(--text-muted);margin-bottom:24px;">Describe it in your own words — this shapes the tone of your AI-generated content.</p>
    <div class="field">
      <label>Vibe / Theme</label>
      <input id="vibe-input" placeholder="e.g. warm, adventurous, community-rooted" value="Adventurous, warm, community-rooted" oninput="obUpdateNextState()">
      <span class="caption">At least 1 word required.</span>
    </div>
    <div class="field"><label>Core Services</label>
      <div class="tag-input">
        <span class="tag">Guided Reef Dives <span data-lucide="x" style="width:10px;height:10px;"></span></span>
        <span class="tag">PADI Certification <span data-lucide="x" style="width:10px;height:10px;"></span></span>
        <input placeholder="Add a service…">
      </div>
    </div>`;
```

- [ ] **Step 2: Require 50 words in Description and UVP**

Find:
```js
  if(i===2) return `
    <h2 class="h1" style="margin-bottom:6px;">Describe your business</h2>
    <p class="body-txt" style="color:var(--text-muted);margin-bottom:24px;">The more detail, the sharper your AI content will be.</p>
    <div class="field">
      <label>Full Description</label>
      <textarea placeholder="e.g. We're a family-run dive shop on Mactan offering PADI courses and reef tours for all skill levels...">Family-run dive shop on Mactan offering PADI courses and reef tours for all skill levels, with a focus on marine conservation.</textarea>
      <span class="charcount">128 / 500</span>
    </div>
    <div class="field"><label>Unique Value Proposition</label><input placeholder="What makes you different in one sentence?" value="Every dive funds a coral restoration project."></div>`;
```

Replace with:
```js
  if(i===2) return `
    <h2 class="h1" style="margin-bottom:6px;">Describe your business</h2>
    <p class="body-txt" style="color:var(--text-muted);margin-bottom:24px;">The more detail, the sharper your AI content will be. Full Description and UVP each need at least 50 words.</p>
    <div class="field">
      <label>Full Description</label>
      <textarea id="desc-textarea" oninput="obUpdateNextState()" placeholder="e.g. We're a family-run dive shop on Mactan offering PADI courses and reef tours for all skill levels...">Family-run dive shop on Mactan offering PADI courses and reef tours for all skill levels, with a focus on marine conservation. We work with local fisherfolk associations to run monthly reef cleanups, and every certification course includes a half-day session on coral identification so guests leave understanding what they just swam through, not just with a card in their wallet.</textarea>
      <span class="charcount" id="desc-count">0 / 50 words</span>
    </div>
    <div class="field">
      <label>Unique Value Proposition</label>
      <textarea id="uvp-textarea" oninput="obUpdateNextState()" placeholder="What makes you different? (at least 50 words)">Every dive funds a coral restoration project: a fixed portion of each booking goes directly to the reef nursery we maintain with the local fisherfolk cooperative, and guests can see the actual coral fragments they helped fund on a follow-up dive months later, which nobody else offering PADI courses on Mactan currently does.</textarea>
      <span class="charcount" id="uvp-count">0 / 50 words</span>
    </div>`;
```

- [ ] **Step 3: Add `obUpdateNextState` and wire it into `obRender`**

Find:
```js
function obRender(){
  obRenderSideList();
  document.getElementById('ob-panel').innerHTML = obPanelHTML(obIndex);
  document.getElementById('ob-progress-bar').style.width = ((obIndex+1)/OB_STEPS.length*100)+'%';
  document.getElementById('ob-step-count').textContent = `Step ${obIndex+1} of ${OB_STEPS.length}`;
  document.getElementById('ob-back-btn').style.display = obIndex===0 ? 'none':'inline-flex';
  document.getElementById('ob-next-btn').textContent = obIndex===OB_STEPS.length-1 ? 'Go to Dashboard' : 'Next';
  renderIcons();
}
```

Replace with:
```js
function obRender(){
  obRenderSideList();
  document.getElementById('ob-panel').innerHTML = obPanelHTML(obIndex);
  document.getElementById('ob-progress-bar').style.width = ((obIndex+1)/OB_STEPS.length*100)+'%';
  document.getElementById('ob-step-count').textContent = `Step ${obIndex+1} of ${OB_STEPS.length}`;
  document.getElementById('ob-back-btn').style.display = obIndex===0 ? 'none':'inline-flex';
  document.getElementById('ob-next-btn').textContent =
    (obIndex===4 && obScoreState.path==='low' && !obScoreState.finished) ? 'Next Question' :
    (obIndex===OB_STEPS.length-1 ? 'Go to Dashboard' : 'Next');
  obUpdateNextState();
  renderIcons();
}

/** Gates the Next button on the current step's validation rules. Steps without rules are
 *  always valid. Also refreshes the word-count captions on step 3 (Structured Inputs). */
function obUpdateNextState(){
  const btn = document.getElementById('ob-next-btn');
  let valid = true;
  if(obIndex===1){
    const vibe = document.getElementById('vibe-input');
    if(vibe) valid = wordCount(vibe.value) >= 1;
  } else if(obIndex===2){
    const desc = document.getElementById('desc-textarea');
    const uvp = document.getElementById('uvp-textarea');
    if(desc && uvp){
      const dWords = wordCount(desc.value);
      const uWords = wordCount(uvp.value);
      updateWordCounter('desc-count', dWords, 50);
      updateWordCounter('uvp-count', uWords, 50);
      valid = dWords >= 50 && uWords >= 50;
    }
  }
  if(btn) btn.classList.toggle('is-disabled', !valid);
}
```

> Note: `obScoreState` referenced above is added in Task 4. Until Task 4 lands, this reference is
> harmless dead code only reached when `obIndex===4`, which Task 2's changes don't affect — but do
> Task 4 before manually testing step 5 of Onboarding. Steps 2 and 3 (this task's changes) are
> fully testable now.

- [ ] **Step 4: Verify in browser**

With the verification server running, navigate to the prototype and run:
```js
window.__jump('onboarding');
```
Confirm: Vibe/Theme is a single text input (not chips) with a pre-filled value, and clearing it to
empty disables "Next" (button visibly dims). Click Next twice to reach Structured Inputs; confirm
both textareas show live `"N / 50 words"` counters that turn from muted-gray to green once at or
above 50, and that Next is disabled while either is under 50 words. Screenshot both steps.

---

### Task 3: Onboarding — account connections replace handle fields

**Files:**
- Modify: `ui-ux-prototype.html` (`obPanelHTML` step 4, add `obConnectionRow`, `obToggleConnect`)

Depends on Task 1 (`APP_STATE`).

- [ ] **Step 1: Replace the handle inputs with connection rows**

Find:
```js
  if(i===3) return `
    <h2 class="h1" style="margin-bottom:6px;">Assets & links</h2>
    <p class="body-txt" style="color:var(--text-muted);margin-bottom:24px;">All optional — add what you have, skip the rest.</p>
    <div class="field"><label>Instagram handle <span class="opt">(optional)</span></label><input placeholder="@yourbusiness"></div>
    <div class="field"><label>TikTok handle <span class="opt">(optional)</span></label><input placeholder="@yourbusiness"></div>
    <div class="field"><label>Website URL <span class="opt">(optional)</span></label><input placeholder="https://"></div>
    <div class="field"><label>Logo <span class="opt">(optional)</span></label>
      <div class="upload-zone"><span data-lucide="upload-cloud" style="width:24px;height:24px;margin-bottom:6px;"></span><div class="body-txt">Tap to upload or drag & drop</div></div>
    </div>`;
```

Replace with:
```js
  if(i===3) return `
    <h2 class="h1" style="margin-bottom:6px;">Connect your platforms</h2>
    <p class="body-txt" style="color:var(--text-muted);margin-bottom:24px;">Connect the accounts you want CeView to publish to — you can add more later in Settings.</p>
    ${obConnectionRow('instagram','Instagram','instagram')}
    ${obConnectionRow('facebook','Facebook','facebook')}
    ${obConnectionRow('tiktok','TikTok','music-2')}
    <div class="field" style="margin-top:20px;"><label>Logo <span class="opt">(optional)</span></label>
      <div class="upload-zone"><span data-lucide="upload-cloud" style="width:24px;height:24px;margin-bottom:6px;"></span><div class="body-txt">Tap to upload or drag & drop</div></div>
    </div>
    <div class="field"><label>Website URL <span class="opt">(optional)</span></label><input placeholder="https://"></div>`;
```

- [ ] **Step 2: Add `obConnectionRow` and `obToggleConnect` next to `toggleChip`**

Find:
```js
function toggleChip(el){ el.classList.toggle('selected'); }
```

Replace with:
```js
function toggleChip(el){ el.classList.toggle('selected'); }

/** Renders one Connect/Connected row for Onboarding step 4, reading/writing APP_STATE.connections
 *  so it stays in sync with Settings → Platforms. */
function obConnectionRow(key, label, icon){
  const connected = APP_STATE.connections[key];
  return `<div class="card" style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
    <span data-lucide="${icon}" style="color:${connected?'var(--brand-primary)':'var(--text-muted)'};"></span>
    <div style="flex:1;">
      <div class="body-emphasis">${label}</div>
      <div class="caption">${connected ? '@sunsetdive.ph' : 'Not connected'}</div>
    </div>
    ${connected
      ? `<span class="badge badge-published">Connected</span><button class="btn btn-ghost btn-sm" onclick="obToggleConnect('${key}')">Disconnect</button>`
      : `<button class="btn btn-secondary btn-sm" onclick="obToggleConnect('${key}')">Connect</button>`}
  </div>`;
}
function obToggleConnect(key){
  APP_STATE.connections[key] = !APP_STATE.connections[key];
  obRender();
  showToast(APP_STATE.connections[key] ? `${label(key)} connected` : `${label(key)} disconnected`, 'link');
  function label(k){ return k==='tiktok' ? 'TikTok' : k.charAt(0).toUpperCase()+k.slice(1); }
}
```

- [ ] **Step 3: Verify in browser**

`window.__jump('onboarding')`, click Next three times to reach step 4. Confirm three
Connect/Connected rows render (Instagram and Facebook already "Connected", TikTok "Connect").
Click TikTok's "Connect" button — it should flip to "Connected" with a green badge and a
"Disconnect" ghost button, and a toast should appear ("TikTok connected"). Screenshot.

---

### Task 4: Onboarding — low-score guided-questions branch

**Files:**
- Modify: `ui-ux-prototype.html` (`obPanelHTML` step 5, `obNext`, the onboarding state
  declaration, the dev jump-bar IIFE at the bottom of the script)

- [ ] **Step 1: Add `obScoreState` next to `obIndex`**

Find:
```js
const OB_STEPS = ['Basic Info','Brand Identity','Structured Inputs','Assets & Links','Uniqueness Score'];
let obIndex = 0;
```

Replace with:
```js
const OB_STEPS = ['Basic Info','Brand Identity','Structured Inputs','Assets & Links','Uniqueness Score'];
let obIndex = 0;
/** Drives the Uniqueness Score reveal's scripted demo path. `path` is 'high' (score starts at
 *  82, standard celebratory reveal) or 'low' (score starts at 42, triggers 3 guided questions
 *  before revealing a boosted final score). Reset via resetOnboardingDemo(). */
let obScoreState = { path: 'high', qIndex: 0, answers: [], finished: false };
function resetOnboardingDemo(path){
  obScoreState = { path: path || 'high', qIndex: 0, answers: [], finished: false };
}
const LOW_SCORE_QUESTIONS = [
  "What do customers thank you for most often, unprompted?",
  "What's something you do that most competitors skip?",
  "If a guest could only remember one thing about you, what would you want it to be?"
];
```

- [ ] **Step 2: Replace the reveal step (`i===4`) with the branching version**

Find:
```js
  if(i===4) return `
    <div class="reveal-wrap">
      <h2 class="h1" style="margin-bottom:20px;">Your Uniqueness Score</h2>
      <div class="gauge reveal-gauge">
        <svg width="120" height="120"><circle cx="60" cy="60" r="52" stroke="#E4E9F2" stroke-width="12" fill="none"/>
        <circle cx="60" cy="60" r="52" stroke="#F4A216" stroke-width="12" fill="none" stroke-dasharray="326" stroke-dashoffset="70" stroke-linecap="round"/></svg>
        <div class="val">82</div>
      </div>
      <p class="body-txt" style="max-width:360px;margin:0 auto 8px;">Your coral-conservation angle and PADI-certified team put you well ahead of nearby dive operators on distinctiveness.</p>
      <span class="badge badge-ai"><span data-lucide="sparkles" style="width:12px;height:12px;"></span> AI-assisted insight</span>
    </div>`;
}
```

Replace with:
```js
  if(i===4){
    if(obScoreState.path==='low' && !obScoreState.finished) return obLowScorePanelHTML();
    const score = obScoreState.path==='low' ? 78 : 82;
    const insight = obScoreState.path==='low'
      ? "After a few tweaks, your coral-restoration program and hands-on PADI teaching style stand out clearly against nearby dive shops."
      : "Your coral-conservation angle and PADI-certified team put you well ahead of nearby dive operators on distinctiveness.";
    const offset = 326 - (326 * score / 100);
    return `
    <div class="reveal-wrap">
      <h2 class="h1" style="margin-bottom:20px;">Your Uniqueness Score</h2>
      <div class="gauge reveal-gauge">
        <svg width="120" height="120"><circle cx="60" cy="60" r="52" stroke="#E4E9F2" stroke-width="12" fill="none"/>
        <circle cx="60" cy="60" r="52" stroke="#F4A216" stroke-width="12" fill="none" stroke-dasharray="326" stroke-dashoffset="${offset}" stroke-linecap="round"/></svg>
        <div class="val">${score}</div>
      </div>
      <p class="body-txt" style="max-width:360px;margin:0 auto 8px;">${insight}</p>
      <span class="badge badge-ai"><span data-lucide="sparkles" style="width:12px;height:12px;"></span> AI-assisted insight</span>
    </div>`;
  }
}

/** Renders the low-score path's current guided question (progressive, one at a time) with a
 *  "Skip for now" escape hatch. Shown while obScoreState.path==='low' and not yet finished. */
function obLowScorePanelHTML(){
  const q = obScoreState.qIndex;
  const offset = 326 - (326 * 42 / 100);
  return `
    <div class="reveal-wrap">
      <h2 class="h1" style="margin-bottom:12px;">Your Uniqueness Score</h2>
      <div class="gauge reveal-gauge">
        <svg width="120" height="120"><circle cx="60" cy="60" r="52" stroke="#E4E9F2" stroke-width="12" fill="none"/>
        <circle cx="60" cy="60" r="52" stroke="#F4A216" stroke-width="12" fill="none" stroke-dasharray="326" stroke-dashoffset="${offset}" stroke-linecap="round"/></svg>
        <div class="val">42</div>
      </div>
      <p class="body-txt" style="max-width:360px;margin:0 auto 20px;">Let's sharpen this a bit — a few quick questions can reveal what makes you different.</p>
    </div>
    <div class="caption" style="text-align:center;margin-bottom:6px;">Question ${q+1} of 3</div>
    <div class="field">
      <label>${LOW_SCORE_QUESTIONS[q]}</label>
      <input id="ob-lowscore-answer" placeholder="Type your answer…">
    </div>
    <div style="display:flex;gap:12px;justify-content:center;">
      <a href="#" class="caption" style="color:var(--brand-primary);font-weight:700;" onclick="obLowScoreAdvance(false);return false;">Skip for now</a>
    </div>`;
}

/** Advances the low-score question sequence. Called by the "Next Question" primary button
 *  (answered=true, via obNext) or the "Skip for now" link (answered=false). */
function obLowScoreAdvance(answered){
  if(answered){
    const input = document.getElementById('ob-lowscore-answer');
    obScoreState.answers.push(input ? input.value : '');
  }
  obScoreState.qIndex++;
  if(obScoreState.qIndex >= 3) obScoreState.finished = true;
  obRender();
}
```

- [ ] **Step 3: Make `obNext` drive the question sequence instead of jumping straight to Dashboard**

Find:
```js
function obNext(){
  if(obIndex < OB_STEPS.length-1){ obIndex++; obRender(); }
  else { goApp('dashboard'); }
}
```

Replace with:
```js
function obNext(){
  if(obIndex===4 && obScoreState.path==='low' && !obScoreState.finished){
    obLowScoreAdvance(true);
    return;
  }
  if(obIndex < OB_STEPS.length-1){ obIndex++; obRender(); }
  else { goApp('dashboard'); }
}
```

- [ ] **Step 4: Add a dev jump-bar entry to reach the low-score demo path directly**

Find:
```js
  bar.innerHTML = ['login','onboarding','dashboard','content','calendar','performance','settings'].map(v=>
    `<button onclick="window.__jump('${v}')" style="background:none;border:none;color:#B9C5DA;font-size:10px;font-weight:700;padding:6px 8px;border-radius:6px;cursor:pointer;text-transform:uppercase;letter-spacing:.03em;">${v}</button>`
  ).join('');
  document.body.appendChild(bar);
  window.__jump = function(v){
    if(v==='login'){ document.documentElement.setAttribute('data-view','login'); }
    else if(v==='onboarding'){ document.documentElement.setAttribute('data-view','onboarding'); obIndex=0; obRender(); }
    else { document.documentElement.setAttribute('data-view', v); goApp(v); }
  };
```

Replace with:
```js
  bar.innerHTML = ['login','onboarding','onboarding-low','dashboard','content','calendar','performance','settings'].map(v=>
    `<button onclick="window.__jump('${v}')" style="background:none;border:none;color:#B9C5DA;font-size:10px;font-weight:700;padding:6px 8px;border-radius:6px;cursor:pointer;text-transform:uppercase;letter-spacing:.03em;">${v}</button>`
  ).join('');
  document.body.appendChild(bar);
  window.__jump = function(v){
    if(v==='login'){ document.documentElement.setAttribute('data-view','login'); }
    else if(v==='onboarding'){ resetOnboardingDemo('high'); document.documentElement.setAttribute('data-view','onboarding'); obIndex=0; obRender(); }
    else if(v==='onboarding-low'){ resetOnboardingDemo('low'); document.documentElement.setAttribute('data-view','onboarding'); obIndex=0; obRender(); }
    else { document.documentElement.setAttribute('data-view', v); goApp(v); }
  };
```

- [ ] **Step 5: Verify both paths in browser**

`window.__jump('onboarding')`, click Next four times to reach step 5 — confirm the gauge shows 82
with the original insight text and "Go to Dashboard" (unchanged high path).

Then `window.__jump('onboarding-low')`, click Next four times to reach step 5 — confirm the gauge
shows 42 with the softer copy, "Question 1 of 3" appears, and the button reads "Next Question."
Click "Next Question" three times (or use "Skip for now" once to confirm it also advances) —
confirm the gauge re-animates to 78 with new insight text and the button reads "Go to Dashboard."
Screenshot the 42-state and the 78-state.

---

### Task 5: Content Studio — platform-aware captions, structured visual guide, per-platform live preview

**Files:**
- Modify: `ui-ux-prototype.html` (replaces the entire "CONTENT STUDIO" script section:
  `buildContentStudio`, `checkPublishReady`, `regenCaption`, `publishPost`, plus new consts/helpers)

This is the largest single task — it rewrites one cohesive block, so it's done as one edit rather
than split into three (captions/guide/preview all live inside the same template literal and share
`csSelectedPlatforms`/`csActiveTab` state).

- [ ] **Step 1: Replace the whole Content Studio script block**

Find (the entire block from the section comment through the end of `publishPost`):
```js
/* ============================================================ CONTENT STUDIO ============================================================ */
function buildContentStudio(){
  document.getElementById('screen-content').innerHTML = `
    <div class="screen-hd">
      <div class="caption kicker">CONTENT STUDIO</div>
      <h1 class="h1">Draft a post</h1>
    </div>
    <div class="grid-2" style="align-items:start;">
      <div style="display:flex;flex-direction:column;gap:16px;">
        <div class="chip selected" style="width:fit-content;">🇰🇷 Targeting Korea <span data-lucide="x" style="width:12px;height:12px;"></span></div>

        <div class="card">
          <div class="card-header"><span class="h3">Caption</span><span class="badge badge-ai"><span data-lucide="sparkles" style="width:12px;height:12px;"></span>AI-generated</span></div>
          <textarea id="cs-caption" style="width:100%;min-height:100px;border:1px solid var(--border-subtle);border-radius:8px;padding:10px 12px;font-size:14px;" >안녕하세요! 🌊 Discover Mactan's coral gardens on our sunrise reef dive — PADI-certified guides, small groups, and a portion of every booking funds local coral restoration. Book your golden-hour dive today.</textarea>
          <div style="display:flex;justify-content:flex-end;margin-top:10px;">
            <button class="btn btn-ghost btn-sm" onclick="regenCaption()" id="regen-btn"><span data-lucide="refresh-cw"></span> Regenerate</button>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><span class="h3">Visual Guide</span><span class="badge badge-ai"><span data-lucide="sparkles" style="width:12px;height:12px;"></span>AI-generated</span></div>
          <p class="body-txt" style="color:var(--text-muted);">Warm golden-hour lighting, wide shot of divers descending over coral. Palette: deep teal water + amber sun flare. Avoid flash-lit close-ups — this market responds to natural light, aspirational framing.</p>
        </div>

        <div class="card">
          <div class="h3" style="margin-bottom:10px;">Pubmat Upload</div>
          <div class="upload-zone"><span data-lucide="image-plus" style="width:24px;height:24px;margin-bottom:6px;"></span><div class="body-txt">Tap to upload your photo or video</div></div>
        </div>

        <div class="card">
          <div class="h3" style="margin-bottom:10px;">Platforms</div>
          <div class="chip-grid">
            <span class="chip selected" onclick="toggleChip(this)"><span data-lucide="music-2" style="width:14px;height:14px;"></span>TikTok</span>
            <span class="chip selected" onclick="toggleChip(this)"><span data-lucide="facebook" style="width:14px;height:14px;"></span>Facebook</span>
            <span class="chip" onclick="toggleChip(this)"><span data-lucide="instagram" style="width:14px;height:14px;"></span>Instagram</span>
          </div>
        </div>

        <div class="card">
          <div class="toggle-row">
            <div class="lbl"><span class="body-emphasis">Public Visibility</span><span class="caption">Anyone can see this post</span></div>
            <button class="switch on" onclick="this.classList.toggle('on')"></button>
          </div>
          <div class="toggle-row">
            <div class="lbl"><span class="body-emphasis">Allow Comments</span><span class="caption">Viewers can comment</span></div>
            <button class="switch on" onclick="this.classList.toggle('on')"></button>
          </div>
          <div class="toggle-row">
            <div class="lbl"><span class="body-emphasis">Boosted / Paid</span><span class="caption">Promote with ad spend</span></div>
            <button class="switch" onclick="this.classList.toggle('on')"></button>
          </div>
        </div>

        <label style="display:flex;gap:10px;align-items:flex-start;font-size:13px;color:var(--text-muted);">
          <input type="checkbox" id="agree-check" onchange="checkPublishReady()" style="margin-top:3px;">
          I've reviewed this content and confirm it's accurate and ready to publish.
        </label>

        <div style="display:flex; gap:12px;">
          <button class="btn btn-primary btn-lg btn-block is-disabled" id="publish-btn" onclick="publishPost()">Publish Now</button>
          <button class="btn btn-ghost btn-lg">Save as Draft</button>
        </div>
      </div>

      <div class="card" style="position:sticky; top:88px;">
        <div class="h3" style="margin-bottom:12px;">Live Preview</div>
        <div style="border:1px solid var(--border-subtle); border-radius:12px; overflow:hidden;">
          <div style="display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid var(--border-subtle);">
            <div class="avatar" style="width:26px;height:26px;font-size:11px;">SD</div>
            <span class="body-emphasis" style="font-size:13px;">sunsetdive.ph</span>
          </div>
          <div style="aspect-ratio:1/1;background:linear-gradient(160deg,#0F2854,#F4A216 130%); display:flex;align-items:center;justify-content:center;color:#fff;">
            <span data-lucide="waves" style="width:40px;height:40px;opacity:.8;"></span>
          </div>
          <div style="padding:10px 12px;">
            <p class="caption" style="color:var(--text-primary);">안녕하세요! 🌊 Discover Mactan's coral gardens on our sunrise reef dive...</p>
          </div>
        </div>
      </div>
    </div>

    <div style="margin-top:32px;">
      <div class="h2" style="margin-bottom:14px;">Board</div>
      <div class="kanban">
        <div class="kanban-col">
          <div class="kanban-col-hd"><span class="body-emphasis">Draft</span><span class="badge badge-draft">2</span></div>
          <div class="post-card"><div class="post-thumb"><span data-lucide="image"></span></div><div><div class="body-emphasis" style="font-size:13px;">Coral dive teaser</div><span class="badge badge-draft">Draft</span></div></div>
          <div class="post-card"><div class="post-thumb"><span data-lucide="image"></span></div><div><div class="body-emphasis" style="font-size:13px;">Café weekend combo</div><span class="badge badge-draft">Draft</span></div></div>
        </div>
        <div class="kanban-col">
          <div class="kanban-col-hd"><span class="body-emphasis">Scheduled</span><span class="badge badge-scheduled">1</span></div>
          <div class="post-card"><div class="post-thumb"><span data-lucide="image"></span></div><div><div class="body-emphasis" style="font-size:13px;">Golden Week promo</div><span class="badge badge-scheduled">Aug 12</span></div></div>
        </div>
        <div class="kanban-col">
          <div class="kanban-col-hd"><span class="body-emphasis">Published</span><span class="badge badge-published">3</span></div>
          <div class="post-card"><div class="post-thumb"><span data-lucide="image"></span></div><div><div class="body-emphasis" style="font-size:13px;">Reef cleanup dive</div><span class="badge badge-published">Published</span></div></div>
        </div>
      </div>
    </div>`;
  renderIcons();
}
function checkPublishReady(){
  const ready = document.getElementById('agree-check').checked;
  document.getElementById('publish-btn').classList.toggle('is-disabled', !ready);
}
function regenCaption(){
  const btn = document.getElementById('regen-btn');
  const ta = document.getElementById('cs-caption');
  btn.classList.add('is-loading');
  const before = ta.value;
  ta.value = '';
  ta.placeholder='Generating…';
  setTimeout(()=>{
    btn.classList.remove('is-loading');
    ta.value = "Chase the sunrise 🌅 Join our small-group reef dive around Mactan's coral gardens — PADI guides, easy pace, big payoff. Every booking helps fund reef restoration nearby.";
  }, 1100);
}
function publishPost(){
  showToast('Post published to 2 platforms', 'check-circle');
}
```

Replace with:
```js
/* ============================================================ CONTENT STUDIO ============================================================ */
const CS_PLATFORM_META = {
  tiktok:    { label: 'TikTok',    icon: 'music-2' },
  facebook:  { label: 'Facebook',  icon: 'facebook' },
  instagram: { label: 'Instagram', icon: 'instagram' }
};
/** Current caption text per platform, in that platform's voice. Mutated directly as the user
 *  types (csUpdateCaption) or regenerates (regenCaption). */
const CS_CAPTIONS = {
  instagram: "안녕하세요! 🌊 Sunrise reef dive around Mactan's coral gardens — PADI-certified guides, small groups, big payoff. Every booking funds local coral restoration. 📍 Book your golden-hour dive today. #CebuDiving #MactanReef #PADICebu",
  tiktok: "POV: your alarm says 5am but the reef says worth it 🌅🤿 small-group sunrise dive, PADI guides, zero crowds. link in bio to book",
  facebook: "Good morning from Mactan! 🌅 Our sunrise reef dive is back — small groups, PADI-certified guides, and every booking helps fund the coral restoration project we run with local fisherfolk. Come see what we've been growing. Message us to book your spot this week."
};
/** "Regenerate" swaps in these alternates rather than calling a real AI. */
const CS_CAPTION_ALTS = {
  instagram: "Chase the sunrise 🌅 Small-group reef dive around Mactan's coral gardens — PADI guides, easy pace, big payoff. Every booking funds reef restoration nearby. #CebuDiving #MactanReef #PADICebu",
  tiktok: "the ocean at 6am hits different 🤿🌊 small group, PADI-certified, reef restoration funded by your booking. book the sunrise dive, link in bio",
  facebook: "There's something about the reef at sunrise that photos don't quite capture. Join our small-group dive this week — PADI-certified guides, easy pace for all levels, and every booking helps fund the coral nursery we're growing with local fisherfolk. Message us to reserve your spot."
};
const VISUAL_GUIDE_ASPECTS = [
  { name: 'Lighting',          def: 'How light shapes the mood and clarity of your shot.',        apply: 'Shoot at golden hour (5:30–6:30pm), warm backlight behind divers.' },
  { name: 'Composition',       def: 'How elements are arranged within the frame.',                 apply: 'Rule-of-thirds — keep the diver off-center, let the reef lead toward the horizon.' },
  { name: 'Color Palette',     def: 'The dominant tones that set your brand feel.',                 apply: 'Deep teal water + amber highlights. Avoid oversaturated blue filters.' },
  { name: 'Framing & Angle',   def: 'Camera distance and perspective.',                             apply: 'Wide shot from just above the water surface, full group included for scale.' },
  { name: 'Mood & Styling',    def: 'The overall emotional tone of the image.',                     apply: 'Aspirational and adventurous — candid smiles, not posed stares.' }
];
/** Platforms currently selected in the Platforms card — drives which Caption and Live Preview
 *  tabs exist. Starts matching the prototype's original default (TikTok + Facebook selected). */
let csSelectedPlatforms = ['tiktok','facebook'];
/** Which selected platform's caption/preview is currently shown. */
let csActiveTab = 'tiktok';

function csTogglePlatform(key){
  const idx = csSelectedPlatforms.indexOf(key);
  if(idx>-1) csSelectedPlatforms.splice(idx,1);
  else csSelectedPlatforms.push(key);
  if(!csSelectedPlatforms.includes(csActiveTab)) csActiveTab = csSelectedPlatforms[0] || null;
  buildContentStudio();
}
function csSetActiveTab(key){
  csActiveTab = key;
  buildContentStudio();
}
function csUpdateCaption(val){
  CS_CAPTIONS[csActiveTab] = val;
  csUpdatePreview();
}
function csUpdatePreview(){
  const capEl = document.getElementById('cs-preview-caption');
  if(capEl) capEl.textContent = CS_CAPTIONS[csActiveTab];
}

function csCaptionCardHTML(){
  if(csSelectedPlatforms.length===0){
    return `<div class="card">
      <div class="card-header"><span class="h3">Caption</span><span class="badge badge-ai"><span data-lucide="sparkles" style="width:12px;height:12px;"></span>AI-generated</span></div>
      <div class="empty-state" style="padding:24px 12px;">
        <div class="ic"><span data-lucide="megaphone"></span></div>
        <p class="body-txt">Select a platform below to generate a caption.</p>
      </div>
    </div>`;
  }
  return `<div class="card">
    <div class="card-header"><span class="h3">Caption</span><span class="badge badge-ai"><span data-lucide="sparkles" style="width:12px;height:12px;"></span>AI-generated</span></div>
    <div class="chip-grid" style="margin-bottom:12px;">
      ${csSelectedPlatforms.map(k=>`<span class="chip ${k===csActiveTab?'selected':''}" onclick="csSetActiveTab('${k}')"><span data-lucide="${CS_PLATFORM_META[k].icon}" style="width:14px;height:14px;"></span>${CS_PLATFORM_META[k].label}</span>`).join('')}
    </div>
    <textarea id="cs-caption" oninput="csUpdateCaption(this.value)" style="width:100%;min-height:100px;border:1px solid var(--border-subtle);border-radius:8px;padding:10px 12px;font-size:14px;">${CS_CAPTIONS[csActiveTab]}</textarea>
    <div style="display:flex;justify-content:flex-end;margin-top:10px;">
      <button class="btn btn-ghost btn-sm" onclick="regenCaption()" id="regen-btn"><span data-lucide="refresh-cw"></span> Regenerate</button>
    </div>
  </div>`;
}

function csVisualGuideHTML(){
  return `<div class="card">
    <div class="card-header"><span class="h3">Visual Guide</span><span class="badge badge-ai"><span data-lucide="sparkles" style="width:12px;height:12px;"></span>AI-generated</span></div>
    <div style="display:flex;flex-direction:column;gap:14px;">
      ${VISUAL_GUIDE_ASPECTS.map((a,idx)=>`
        <div style="display:flex;gap:12px;">
          <div style="width:26px;height:26px;border-radius:50%;background:var(--surface-sand);color:var(--brand-accent-strong);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;flex-shrink:0;">${idx+1}</div>
          <div>
            <div class="body-emphasis">${a.name}</div>
            <div class="caption" style="margin:2px 0 4px;">${a.def}</div>
            <div class="body-txt">${a.apply}</div>
          </div>
        </div>`).join('')}
    </div>
  </div>`;
}

function csPreviewHTML(){
  if(csSelectedPlatforms.length===0){
    return `<div class="card">
      <div class="h3" style="margin-bottom:12px;">Live Preview</div>
      <div class="empty-state" style="padding:24px 12px;">
        <div class="ic"><span data-lucide="eye"></span></div>
        <p class="body-txt">Select a platform below to see a preview.</p>
      </div>
    </div>`;
  }
  const tab = csActiveTab;
  const caption = CS_CAPTIONS[tab];
  let inner;
  if(tab==='instagram'){
    inner = `<div style="border:1px solid var(--border-subtle); border-radius:12px; overflow:hidden;">
      <div style="display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid var(--border-subtle);">
        <div class="avatar" style="width:26px;height:26px;font-size:11px;">SD</div>
        <span class="body-emphasis" style="font-size:13px;">sunsetdive.ph</span>
      </div>
      <div style="aspect-ratio:1/1;background:linear-gradient(160deg,#0F2854,#F4A216 130%); display:flex;align-items:center;justify-content:center;color:#fff;">
        <span data-lucide="waves" style="width:40px;height:40px;opacity:.8;"></span>
      </div>
      <div style="padding:10px 12px 4px;display:flex;gap:12px;color:var(--brand-primary);">
        <span data-lucide="heart" style="width:18px;height:18px;"></span><span data-lucide="message-circle" style="width:18px;height:18px;"></span><span data-lucide="send" style="width:18px;height:18px;"></span>
      </div>
      <div style="padding:6px 12px 12px;">
        <p class="caption" id="cs-preview-caption" style="color:var(--text-primary);">${caption}</p>
      </div>
    </div>`;
  } else if(tab==='tiktok'){
    inner = `<div style="border-radius:12px; overflow:hidden; position:relative; aspect-ratio:9/16; max-width:220px; margin:0 auto; background:linear-gradient(200deg,#0F2854,#132D5E 60%,#0A1B39);">
      <div style="position:absolute;top:10px;left:10px;display:flex;align-items:center;gap:6px;color:#fff;">
        <div class="avatar" style="width:22px;height:22px;font-size:9px;">SD</div>
        <span class="caption" style="color:#fff;">@sunsetdive.ph</span>
      </div>
      <div style="position:absolute;right:8px;bottom:70px;display:flex;flex-direction:column;gap:14px;color:#fff;align-items:center;">
        <span data-lucide="heart"></span><span data-lucide="message-circle"></span><span data-lucide="share-2"></span>
      </div>
      <div style="position:absolute;left:10px;right:44px;bottom:14px;color:#fff;display:flex;flex-direction:column;gap:6px;">
        <p class="caption" id="cs-preview-caption" style="color:#fff;">${caption}</p>
        <div style="display:flex;align-items:center;gap:4px;"><span data-lucide="music-2" style="width:12px;height:12px;"></span><span class="caption" style="color:#fff;">original sound — Sunset Dive Co.</span></div>
      </div>
    </div>`;
  } else {
    inner = `<div style="border:1px solid var(--border-subtle); border-radius:12px; overflow:hidden;">
      <div style="display:flex;align-items:center;gap:8px;padding:10px 12px;">
        <div class="avatar" style="width:32px;height:32px;font-size:12px;">SD</div>
        <div><div class="body-emphasis" style="font-size:13px;">Sunset Dive Co.</div><div class="caption">Just now · 🌐</div></div>
      </div>
      <div style="padding:0 12px 10px;"><p class="body-txt" id="cs-preview-caption">${caption}</p></div>
      <div style="aspect-ratio:16/10;background:linear-gradient(160deg,#0F2854,#F4A216 130%); display:flex;align-items:center;justify-content:center;color:#fff;">
        <span data-lucide="waves" style="width:40px;height:40px;opacity:.8;"></span>
      </div>
      <div style="padding:10px 12px;display:flex;gap:16px;border-top:1px solid var(--border-subtle);">
        <span class="caption" style="display:flex;gap:4px;align-items:center;"><span data-lucide="thumbs-up" style="width:14px;height:14px;"></span>Like</span>
        <span class="caption" style="display:flex;gap:4px;align-items:center;"><span data-lucide="message-circle" style="width:14px;height:14px;"></span>Comment</span>
        <span class="caption" style="display:flex;gap:4px;align-items:center;"><span data-lucide="share-2" style="width:14px;height:14px;"></span>Share</span>
      </div>
    </div>`;
  }
  return `<div class="card" style="position:sticky; top:88px;">
    <div class="h3" style="margin-bottom:12px;">Live Preview</div>
    <div class="chip-grid" style="margin-bottom:12px;">
      ${csSelectedPlatforms.map(k=>`<span class="chip ${k===csActiveTab?'selected':''}" onclick="csSetActiveTab('${k}')">${CS_PLATFORM_META[k].label}</span>`).join('')}
    </div>
    ${inner}
  </div>`;
}

function buildContentStudio(){
  document.getElementById('screen-content').innerHTML = `
    <div class="screen-hd">
      <div class="caption kicker">CONTENT STUDIO</div>
      <h1 class="h1">Draft a post</h1>
    </div>
    <div class="grid-2" style="align-items:start;">
      <div style="display:flex;flex-direction:column;gap:16px;">
        <div class="chip selected" style="width:fit-content;">🇰🇷 Targeting Korea <span data-lucide="x" style="width:12px;height:12px;"></span></div>

        ${csCaptionCardHTML()}
        ${csVisualGuideHTML()}

        <div class="card">
          <div class="h3" style="margin-bottom:10px;">Pubmat Upload</div>
          <div class="upload-zone"><span data-lucide="image-plus" style="width:24px;height:24px;margin-bottom:6px;"></span><div class="body-txt">Tap to upload your photo or video</div></div>
        </div>

        <div class="card">
          <div class="h3" style="margin-bottom:10px;">Platforms</div>
          <div class="chip-grid">
            ${Object.keys(CS_PLATFORM_META).map(k=>`<span class="chip ${csSelectedPlatforms.includes(k)?'selected':''}" onclick="csTogglePlatform('${k}')"><span data-lucide="${CS_PLATFORM_META[k].icon}" style="width:14px;height:14px;"></span>${CS_PLATFORM_META[k].label}</span>`).join('')}
          </div>
        </div>

        <div class="card">
          <div class="toggle-row">
            <div class="lbl"><span class="body-emphasis">Public Visibility</span><span class="caption">Anyone can see this post</span></div>
            <button class="switch on" onclick="this.classList.toggle('on')"></button>
          </div>
          <div class="toggle-row">
            <div class="lbl"><span class="body-emphasis">Allow Comments</span><span class="caption">Viewers can comment</span></div>
            <button class="switch on" onclick="this.classList.toggle('on')"></button>
          </div>
          <div class="toggle-row">
            <div class="lbl"><span class="body-emphasis">Boosted / Paid</span><span class="caption">Promote with ad spend</span></div>
            <button class="switch" onclick="this.classList.toggle('on')"></button>
          </div>
        </div>

        <label style="display:flex;gap:10px;align-items:flex-start;font-size:13px;color:var(--text-muted);">
          <input type="checkbox" id="agree-check" onchange="checkPublishReady()" style="margin-top:3px;">
          I've reviewed this content and confirm it's accurate and ready to publish.
        </label>

        <div style="display:flex; gap:12px;">
          <button class="btn btn-primary btn-lg btn-block is-disabled" id="publish-btn" onclick="publishPost()">Publish Now</button>
          <button class="btn btn-ghost btn-lg">Save as Draft</button>
        </div>
      </div>

      ${csPreviewHTML()}
    </div>

    <div style="margin-top:32px;">
      <div class="h2" style="margin-bottom:14px;">Board</div>
      <div class="kanban">
        <div class="kanban-col">
          <div class="kanban-col-hd"><span class="body-emphasis">Draft</span><span class="badge badge-draft">2</span></div>
          <div class="post-card"><div class="post-thumb"><span data-lucide="image"></span></div><div><div class="body-emphasis" style="font-size:13px;">Coral dive teaser</div><span class="badge badge-draft">Draft</span></div></div>
          <div class="post-card"><div class="post-thumb"><span data-lucide="image"></span></div><div><div class="body-emphasis" style="font-size:13px;">Café weekend combo</div><span class="badge badge-draft">Draft</span></div></div>
        </div>
        <div class="kanban-col">
          <div class="kanban-col-hd"><span class="body-emphasis">Scheduled</span><span class="badge badge-scheduled">1</span></div>
          <div class="post-card"><div class="post-thumb"><span data-lucide="image"></span></div><div><div class="body-emphasis" style="font-size:13px;">Golden Week promo</div><span class="badge badge-scheduled">Aug 12</span></div></div>
        </div>
        <div class="kanban-col">
          <div class="kanban-col-hd"><span class="body-emphasis">Published</span><span class="badge badge-published">3</span></div>
          <div class="post-card"><div class="post-thumb"><span data-lucide="image"></span></div><div><div class="body-emphasis" style="font-size:13px;">Reef cleanup dive</div><span class="badge badge-published">Published</span></div></div>
        </div>
      </div>
    </div>`;
  renderIcons();
}
function checkPublishReady(){
  const ready = document.getElementById('agree-check').checked;
  document.getElementById('publish-btn').classList.toggle('is-disabled', !ready);
}
function regenCaption(){
  const btn = document.getElementById('regen-btn');
  const ta = document.getElementById('cs-caption');
  const tab = csActiveTab;
  btn.classList.add('is-loading');
  ta.value = '';
  ta.placeholder='Generating…';
  setTimeout(()=>{
    btn.classList.remove('is-loading');
    CS_CAPTIONS[tab] = CS_CAPTION_ALTS[tab];
    ta.value = CS_CAPTIONS[tab];
    csUpdatePreview();
  }, 1100);
}
function publishPost(){
  showToast('Post published to 2 platforms', 'check-circle');
}
```

- [ ] **Step 2: Verify in browser**

`window.__jump('content')`. Confirm: two caption tabs exist by default (TikTok, Facebook — no
Instagram since it starts unselected), each with visibly different caption text and tone. Click
the Instagram platform chip in the Platforms card — confirm a third Caption tab and Live Preview
tab appear for Instagram, each rendering that platform's caption. Deselect TikTok — confirm its
tab disappears from both Caption and Live Preview, and if it was the active tab, the view falls
back to another selected platform automatically. Deselect all three platforms — confirm both the
Caption and Live Preview cards show their empty state. Re-select one, click "Regenerate" — confirm
only the active tab's caption changes (switch tabs first to confirm the other tab's text is
untouched). Confirm Live Preview mocks look visually distinct per platform (square Instagram post
w/ icon row, tall dark TikTok frame w/ overlaid caption, wide Facebook card w/ reaction bar).
Confirm the Visual Guide shows 5 numbered aspects, each with a bolded name, a definition line, and
an apply line. Screenshot each platform's Live Preview.

---

### Task 6: Calendar — List View + hardcoded published-post stats

**Files:**
- Modify: `ui-ux-prototype.html` (`buildCalendar`, `toggleCalView`, add `CALENDAR_POSTS`,
  `calListHTML`, `calendarDayClick`, `openAnalyticsFor`; also the static Analytics Modal markup
  and the Performance post list — see Step 3)

- [ ] **Step 1: Replace `buildCalendar`/`toggleCalView` with data-driven grid + list rendering**

Find:
```js
/* ============================================================ CALENDAR ============================================================ */
function buildCalendar(){
  const days = [];
  for(let i=1;i<=31;i++){
    const hasContent = [3,7,12,18,21,27].includes(i);
    const isSeason = [10,11,12].includes(i);
    days.push(`<div style="aspect-ratio:1;border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;
      background:${isSeason?'#FFF5DF':'#fff'}; border:1px solid var(--border-subtle); cursor:pointer; position:relative;"
      ${hasContent? `onclick="openModal('analytics-modal')"`:''}>
      <span class="caption" style="color:var(--text-primary);">${i}</span>
      ${hasContent? `<span style="display:flex;gap:2px;">${i%2===0?'<i style="width:5px;height:5px;border-radius:50%;background:#0F2854;"></i>':'<i style="width:5px;height:5px;border-radius:50%;background:#F4A216;"></i>'}</span>`:''}
    </div>`);
  }
  document.getElementById('screen-calendar').innerHTML = `
    <div class="screen-hd" style="display:flex;align-items:center;justify-content:space-between;">
      <div><div class="caption kicker">CALENDAR</div><h1 class="h1">August 2026</h1></div>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-ghost btn-sm" id="cal-toggle" onclick="toggleCalView()">List View</button>
      </div>
    </div>
    <div class="banner banner-warning">
      <span data-lucide="calendar-clock" style="width:16px;height:16px;flex-shrink:0;"></span>
      <span>Golden Week Prep (JP) window: Aug 10–12 — highlighted below.</span>
    </div>
    <div class="grid-2" style="grid-template-columns:1fr; gap:24px;" id="cal-layout">
      <div class="card">
        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:8px;margin-bottom:8px;">
          ${['S','M','T','W','T','F','S'].map(d=>`<div class="caption" style="text-align:center;">${d}</div>`).join('')}
        </div>
        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:8px;">${days.join('')}</div>
      </div>
    </div>`;
  renderIcons();
}
function toggleCalView(){ showToast('List view (prototype)', 'list'); }
```

Replace with:
```js
/* ============================================================ CALENDAR ============================================================ */
/** Hardcoded post data keyed by day-of-month (August 2026). Published posts carry real mock
 *  stats and open the Analytics Modal; draft/scheduled posts show a routing toast instead. */
const CALENDAR_POSTS = {
  3:  { title: 'Sunrise dive teaser',          platform: 'TikTok',            status: 'published', date: 'Aug 3',  engagements: '1.1k', engTrend: '+5%',  reach: '4.6k',  reachTrend: '+3%'  },
  7:  { title: 'PADI cert weekend special',    platform: 'Facebook',          status: 'published', date: 'Aug 7',  engagements: '980',  engTrend: '+2%',  reach: '3.9k',  reachTrend: '+1%'  },
  12: { title: 'Golden Week promo',            platform: 'Facebook · TikTok', status: 'scheduled', date: 'Aug 12', engagements: '—',    engTrend: '',     reach: '—',     reachTrend: ''     },
  18: { title: 'Reef cleanup dive',            platform: 'Instagram',         status: 'published', date: 'Aug 18', engagements: '2.4k', engTrend: '+18%', reach: '9.9k',  reachTrend: '+9%'  },
  21: { title: 'Behind the scenes: boat prep', platform: 'TikTok',            status: 'published', date: 'Aug 21', engagements: '5.1k', engTrend: '+22%', reach: '14.2k', reachTrend: '+11%' },
  27: { title: 'Café weekend combo',           platform: 'Draft',             status: 'draft',     date: 'Aug 27', engagements: '—',    engTrend: '',     reach: '—',     reachTrend: ''     }
};
let calViewMode = 'grid';

function calendarDayClick(day){
  const post = CALENDAR_POSTS[day];
  if(!post) return;
  if(post.status === 'published') openAnalyticsFor(post);
  else showToast(`Opening "${post.title}" in Content Studio…`, 'edit-3');
}

/** Fills in the Analytics Modal's dynamic fields and opens it. Shared by Calendar and
 *  Performance so both surfaces show real per-post numbers instead of one static example. */
function openAnalyticsFor(post){
  document.getElementById('am-title').textContent = `"${post.title}"`;
  document.getElementById('am-meta').textContent = `${post.platform} · Published ${post.date}`;
  document.getElementById('am-eng').textContent = post.engagements;
  document.getElementById('am-reach').textContent = post.reach;
  document.getElementById('am-eng-trend').textContent = post.engTrend;
  document.getElementById('am-reach-trend').textContent = post.reachTrend;
  document.getElementById('am-eng-badge').style.display = post.engTrend ? 'inline-flex' : 'none';
  document.getElementById('am-reach-badge').style.display = post.reachTrend ? 'inline-flex' : 'none';
  openModal('analytics-modal');
}

function calGridHTML(){
  const days = [];
  for(let i=1;i<=31;i++){
    const post = CALENDAR_POSTS[i];
    const isSeason = [10,11,12].includes(i);
    days.push(`<div style="aspect-ratio:1;border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;
      background:${isSeason?'#FFF5DF':'#fff'}; border:1px solid var(--border-subtle); cursor:pointer; position:relative;"
      ${post ? `onclick="calendarDayClick(${i})"` : ''}>
      <span class="caption" style="color:var(--text-primary);">${i}</span>
      ${post ? `<span style="display:flex;gap:2px;"><i style="width:5px;height:5px;border-radius:50%;background:${post.status==='published'?'#0F2854':post.status==='scheduled'?'#F4A216':'#98A7B9'};"></i></span>` : ''}
    </div>`);
  }
  return `<div class="card">
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:8px;margin-bottom:8px;">
      ${['S','M','T','W','T','F','S'].map(d=>`<div class="caption" style="text-align:center;">${d}</div>`).join('')}
    </div>
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:8px;">${days.join('')}</div>
  </div>`;
}

function calListHTML(){
  const days = Object.keys(CALENDAR_POSTS).map(Number).sort((a,b)=>a-b);
  const statusBadgeClass = { published: 'badge-published', scheduled: 'badge-scheduled', draft: 'badge-draft' };
  return `<div style="display:flex;flex-direction:column;gap:20px;">
    ${days.map(day=>{
      const post = CALENDAR_POSTS[day];
      return `<div>
        <div class="caption" style="margin-bottom:8px;">AUG ${day}</div>
        <div class="card" style="display:flex;gap:12px;align-items:center;cursor:pointer;" onclick="calendarDayClick(${day})">
          <div class="post-thumb"><span data-lucide="image"></span></div>
          <div style="flex:1;">
            <div class="body-emphasis">${post.title}</div>
            <div class="caption">${post.platform}</div>
          </div>
          <span class="badge ${statusBadgeClass[post.status]}">${post.status.charAt(0).toUpperCase()+post.status.slice(1)}</span>
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

function buildCalendar(){
  document.getElementById('screen-calendar').innerHTML = `
    <div class="screen-hd" style="display:flex;align-items:center;justify-content:space-between;">
      <div><div class="caption kicker">CALENDAR</div><h1 class="h1">August 2026</h1></div>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-ghost btn-sm" id="cal-toggle" onclick="toggleCalView()">${calViewMode==='grid' ? 'List View' : 'Grid View'}</button>
      </div>
    </div>
    <div class="banner banner-warning">
      <span data-lucide="calendar-clock" style="width:16px;height:16px;flex-shrink:0;"></span>
      <span>Golden Week Prep (JP) window: Aug 10–12 — highlighted below.</span>
    </div>
    <div class="grid-2" style="grid-template-columns:1fr; gap:24px;" id="cal-layout">
      ${calViewMode==='grid' ? calGridHTML() : calListHTML()}
    </div>`;
  renderIcons();
}
function toggleCalView(){
  calViewMode = calViewMode === 'grid' ? 'list' : 'grid';
  buildCalendar();
}
```

- [ ] **Step 2: Give the Analytics Modal dynamic IDs**

Find:
```html
<div class="modal-bd">
    <div style="display:flex; gap:12px; align-items:center; margin-bottom:20px;">
      <div class="post-thumb" style="width:56px;height:56px;"><span data-lucide="image"></span></div>
      <div>
        <div class="body-emphasis">"Golden hour dive briefing 🌅" </div>
        <div class="caption">Instagram · Published Jul 29</div>
      </div>
    </div>
    <div class="grid-2" style="margin-bottom:20px;">
      <div class="card" style="box-shadow:none;border:1px solid var(--border-subtle);">
        <div class="caption">Engagements</div>
        <div class="h1">2,412</div>
        <div class="badge badge-published"><span data-lucide="trending-up" style="width:12px;height:12px;"></span> +18%</div>
      </div>
      <div class="card" style="box-shadow:none;border:1px solid var(--border-subtle);">
        <div class="caption">Reach</div>
        <div class="h1">9,880</div>
        <div class="badge badge-published"><span data-lucide="trending-up" style="width:12px;height:12px;"></span> +9%</div>
      </div>
    </div>
```

Replace with:
```html
<div class="modal-bd">
    <div style="display:flex; gap:12px; align-items:center; margin-bottom:20px;">
      <div class="post-thumb" style="width:56px;height:56px;"><span data-lucide="image"></span></div>
      <div>
        <div class="body-emphasis" id="am-title">"Golden hour dive briefing 🌅"</div>
        <div class="caption" id="am-meta">Instagram · Published Jul 29</div>
      </div>
    </div>
    <div class="grid-2" style="margin-bottom:20px;">
      <div class="card" style="box-shadow:none;border:1px solid var(--border-subtle);">
        <div class="caption">Engagements</div>
        <div class="h1" id="am-eng">2,412</div>
        <div class="badge badge-published" id="am-eng-badge"><span data-lucide="trending-up" style="width:12px;height:12px;"></span> <span id="am-eng-trend">+18%</span></div>
      </div>
      <div class="card" style="box-shadow:none;border:1px solid var(--border-subtle);">
        <div class="caption">Reach</div>
        <div class="h1" id="am-reach">9,880</div>
        <div class="badge badge-published" id="am-reach-badge"><span data-lucide="trending-up" style="width:12px;height:12px;"></span> <span id="am-reach-trend">+9%</span></div>
      </div>
    </div>
```

- [ ] **Step 3: Wire Performance's post list to the same `openAnalyticsFor` function**

This keeps the modal from showing stale Calendar data when opened from Performance. Find (inside
`buildPerformance`):
```js
    <div style="display:flex;flex-direction:column;gap:12px;">
      ${[
        {t:'Reef cleanup dive 🌊', p:'Instagram', d:'Jul 29', m:'2.4k engagements'},
        {t:'PADI cert weekend special', p:'Facebook', d:'Jul 24', m:'980 engagements'},
        {t:'Behind the scenes: boat prep', p:'TikTok', d:'Jul 18', m:'5.1k engagements'},
      ].map(c=>`<div class="card" style="display:flex; gap:12px; align-items:center; cursor:pointer;" onclick="openModal('analytics-modal')">
        <div class="post-thumb" style="width:52px;height:52px;"><span data-lucide="image"></span></div>
        <div style="flex:1;">
          <div class="body-emphasis">${c.t}</div>
          <div class="caption">${c.p} · ${c.d}</div>
        </div>
        <div class="body-emphasis" style="color:var(--brand-primary);">${c.m}</div>
      </div>`).join('')}
    </div>`;
  renderIcons();
}
```

Replace with:
```js
    <div style="display:flex;flex-direction:column;gap:12px;">
      ${PERFORMANCE_POSTS.map((c,idx)=>`<div class="card" style="display:flex; gap:12px; align-items:center; cursor:pointer;" onclick="openAnalyticsFor(PERFORMANCE_POSTS[${idx}])">
        <div class="post-thumb" style="width:52px;height:52px;"><span data-lucide="image"></span></div>
        <div style="flex:1;">
          <div class="body-emphasis">${c.title}</div>
          <div class="caption">${c.platform} · ${c.date}</div>
        </div>
        <div class="body-emphasis" style="color:var(--brand-primary);">${c.metric}</div>
      </div>`).join('')}
    </div>`;
  renderIcons();
}
```

Now add the `PERFORMANCE_POSTS` array right before `buildPerformance`. Find:
```js
/* ============================================================ PERFORMANCE ============================================================ */
function buildPerformance(){
```

Replace with:
```js
/* ============================================================ PERFORMANCE ============================================================ */
/** Mock published-post data, structured for openAnalyticsFor (shared with Calendar). */
const PERFORMANCE_POSTS = [
  { title: 'Reef cleanup dive 🌊',          platform: 'Instagram', date: 'Jul 29', engagements: '2.4k', engTrend: '+18%', reach: '9.9k',  reachTrend: '+9%',  metric: '2.4k engagements' },
  { title: 'PADI cert weekend special',      platform: 'Facebook',  date: 'Jul 24', engagements: '980',  engTrend: '+6%',  reach: '3.9k',  reachTrend: '+2%',  metric: '980 engagements'  },
  { title: 'Behind the scenes: boat prep',   platform: 'TikTok',    date: 'Jul 18', engagements: '5.1k', engTrend: '+22%', reach: '14.2k', reachTrend: '+11%', metric: '5.1k engagements' }
];
function buildPerformance(){
```

- [ ] **Step 4: Verify in browser**

`window.__jump('calendar')`. Click Aug 18 (Reef cleanup dive) — confirm the Analytics Modal opens
showing "Reef cleanup dive," Instagram, 2.4k engagements / +18%, 9.9k reach / +9% (not the old
static "Golden hour dive briefing" numbers). Close it, click Aug 12 (Golden Week promo, scheduled)
— confirm a toast appears instead of the modal, and that the modal's stat badges are hidden when
trend is empty (open Aug 12 isn't applicable since it's scheduled, but re-open Aug 3 afterward to
confirm the modal is unaffected). Click "List View" — confirm the month grid is replaced by a
date-grouped agenda of the 6 mock posts with correct status badges, and the button now reads "Grid
View." Click a published entry in list view — confirm it opens the modal with matching data too.
Then `window.__jump('performance')` and click each of the 3 post rows — confirm each opens the
modal with that row's own title/numbers (not the Calendar's leftover data). Screenshot list view
and one Analytics Modal instance.

---

### Task 7: Settings — dynamic platform connect/disconnect; Performance — connection-driven filters

**Files:**
- Modify: `ui-ux-prototype.html` (`buildSettings`'s Platforms card, `buildPerformance`'s filter
  chip row; adds `settingsPlatformRow`, `settingsToggleConnect`, `performanceFilterChips`)

Depends on Task 1 (`APP_STATE`). Fixes a pre-existing bug in the same pass: the original
Connect/Disconnect buttons in Settings had no `onclick` handler at all.

- [ ] **Step 1: Make Settings' Platforms card read/write `APP_STATE.connections`**

Find:
```js
      <div class="card">
        <div class="h2" style="margin-bottom:14px;">Platforms</div>
        <div style="display:flex;flex-direction:column;gap:14px;">
          <div style="display:flex;align-items:center;gap:12px;">
            <span data-lucide="instagram" style="color:var(--brand-primary);"></span>
            <div style="flex:1;"><div class="body-emphasis">Instagram</div><div class="caption">@sunsetdive.ph</div></div>
            <span class="badge badge-published">Connected</span>
            <button class="btn btn-ghost btn-sm">Disconnect</button>
          </div>
          <div style="display:flex;align-items:center;gap:12px;">
            <span data-lucide="facebook" style="color:var(--brand-primary);"></span>
            <div style="flex:1;"><div class="body-emphasis">Facebook</div><div class="caption">Sunset Dive Co.</div></div>
            <span class="badge badge-published">Connected</span>
            <button class="btn btn-ghost btn-sm">Disconnect</button>
          </div>
          <div style="display:flex;align-items:center;gap:12px;">
            <span data-lucide="music-2" style="color:var(--text-muted);"></span>
            <div style="flex:1;"><div class="body-emphasis">TikTok</div><div class="caption">Not connected</div></div>
            <button class="btn btn-secondary btn-sm">Connect</button>
          </div>
        </div>
      </div>
```

Replace with:
```js
      <div class="card">
        <div class="h2" style="margin-bottom:14px;">Platforms</div>
        <div style="display:flex;flex-direction:column;gap:14px;">
          ${settingsPlatformRow('instagram','Instagram','instagram')}
          ${settingsPlatformRow('facebook','Facebook','facebook')}
          ${settingsPlatformRow('tiktok','TikTok','music-2')}
        </div>
      </div>
```

- [ ] **Step 2: Add `settingsPlatformRow` and `settingsToggleConnect`**

Find:
```js
function sendInvite(){ closeModal('invite-modal'); showToast('Invite sent', 'mail-check'); }
```

Replace with:
```js
function sendInvite(){ closeModal('invite-modal'); showToast('Invite sent', 'mail-check'); }

function settingsPlatformRow(key, label, icon){
  const connected = APP_STATE.connections[key];
  return `<div style="display:flex;align-items:center;gap:12px;">
    <span data-lucide="${icon}" style="color:${connected?'var(--brand-primary)':'var(--text-muted)'};"></span>
    <div style="flex:1;"><div class="body-emphasis">${label}</div><div class="caption">${connected ? '@sunsetdive.ph' : 'Not connected'}</div></div>
    ${connected
      ? `<span class="badge badge-published">Connected</span><button class="btn btn-ghost btn-sm" onclick="settingsToggleConnect('${key}')">Disconnect</button>`
      : `<button class="btn btn-secondary btn-sm" onclick="settingsToggleConnect('${key}')">Connect</button>`}
  </div>`;
}
/** Flips connection state and re-renders both Settings and Performance, so Performance's
 *  connection-driven filter chips (see performanceFilterChips) update live in the same session. */
function settingsToggleConnect(key){
  APP_STATE.connections[key] = !APP_STATE.connections[key];
  buildSettings();
  buildPerformance();
  showToast(APP_STATE.connections[key] ? `${key.charAt(0).toUpperCase()+key.slice(1)} connected` : `${key.charAt(0).toUpperCase()+key.slice(1)} disconnected`, 'link');
}
```

- [ ] **Step 3: Derive Performance's filter chips from `APP_STATE.connections`**

Find (inside `buildPerformance`):
```js
    <div class="hscroll" style="margin-bottom:16px;">
      ${['All','TikTok','Instagram','Facebook'].map((p,i)=>`<span class="chip ${i===0?'selected':''}" onclick="filterPills(this)">${p}</span>`).join('')}
    </div>
```

Replace with:
```js
    <div class="hscroll" style="margin-bottom:16px;">
      ${performanceFilterChips().map((p,i)=>`<span class="chip ${i===0?'selected':''}" onclick="filterPills(this)">${p}</span>`).join('')}
    </div>
```

Add `performanceFilterChips` right before `buildPerformance`. Find:
```js
/* ============================================================ PERFORMANCE ============================================================ */
/** Mock published-post data, structured for openAnalyticsFor (shared with Calendar). */
const PERFORMANCE_POSTS = [
```

Replace with:
```js
/* ============================================================ PERFORMANCE ============================================================ */
/** "All" plus one chip per platform currently connected in Settings (APP_STATE.connections). */
function performanceFilterChips(){
  const labels = { instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok' };
  const connected = Object.keys(APP_STATE.connections).filter(k=>APP_STATE.connections[k]).map(k=>labels[k]);
  return ['All', ...connected];
}
/** Mock published-post data, structured for openAnalyticsFor (shared with Calendar). */
const PERFORMANCE_POSTS = [
```

- [ ] **Step 4: Verify in browser**

`window.__jump('settings')`. Confirm the three Platforms rows now have working buttons: click
TikTok's "Connect" — it flips to "Connected" with a toast. Click Instagram's "Disconnect" — it
flips to "Connect" with a toast. Now `window.__jump('performance')` — confirm the filter row reads
`All / Facebook / TikTok` (Instagram gone since you just disconnected it, TikTok present since you
just connected it) without a page reload. Screenshot Settings and Performance in this
newly-toggled state.

---

### Task 8: Settings — Business Profile edit modal

**Files:**
- Modify: `ui-ux-prototype.html` (adds a new modal block in the body, near `invite-modal`; wires
  the Business Profile card's `onclick`; adds `openProfileModal`, `pfMarkDirty`, `pfSaveChanges`)

Depends on Task 1 (`wordCount`, `updateWordCounter`).

- [ ] **Step 1: Add the profile edit modal markup**

Find:
```html
<div class="toast-wrap" id="toast-wrap"></div>
```

Replace with:
```html
<!-- ---------- Business Profile Edit Modal ---------- -->
<div class="scrim" id="scrim-profile" onclick="closeModal('profile-modal')"></div>
<div class="modal" id="profile-modal">
  <div class="modal-hd">
    <span class="h2">Edit Business Profile</span>
    <button class="close-x" onclick="closeModal('profile-modal')"><span data-lucide="x"></span></button>
  </div>
  <div class="modal-bd">
    <div class="field"><label>Business Name</label><input id="pf-name" value="Sunset Dive Co." oninput="pfMarkDirty()"></div>
    <div class="field"><label>Industry</label>
      <select id="pf-industry" onchange="pfMarkDirty()"><option>Dive Shop</option><option>Café</option><option>Tour Operator</option><option>Craft Shop</option></select>
    </div>
    <div class="field"><label>Vibe / Theme</label><input id="pf-vibe" value="Adventurous, warm, community-rooted" oninput="pfMarkDirty()"></div>
    <div class="field"><label>Core Services</label>
      <div class="tag-input">
        <span class="tag">Guided Reef Dives <span data-lucide="x" style="width:10px;height:10px;"></span></span>
        <span class="tag">PADI Certification <span data-lucide="x" style="width:10px;height:10px;"></span></span>
        <input placeholder="Add a service…" oninput="pfMarkDirty()">
      </div>
    </div>
    <div class="field">
      <label>Full Description</label>
      <textarea id="pf-desc" oninput="pfMarkDirty()">Family-run dive shop on Mactan offering PADI courses and reef tours for all skill levels, with a focus on marine conservation. We work with local fisherfolk associations to run monthly reef cleanups, and every certification course includes a half-day session on coral identification so guests leave understanding what they just swam through.</textarea>
      <span class="charcount" id="pf-desc-count">0 / 50 words</span>
    </div>
    <div class="field">
      <label>Unique Value Proposition</label>
      <textarea id="pf-uvp" oninput="pfMarkDirty()">Every dive funds a coral restoration project: a fixed portion of each booking goes directly to the reef nursery we maintain with the local fisherfolk cooperative, and guests can see the actual coral fragments they helped fund on a follow-up dive months later.</textarea>
      <span class="charcount" id="pf-uvp-count">0 / 50 words</span>
    </div>
  </div>
  <div id="pf-save-bar" style="display:none; position:sticky; bottom:0; background:#fff; border-top:1px solid var(--border-subtle); padding:14px 24px; gap:12px; justify-content:flex-end;">
    <button class="btn btn-ghost" onclick="closeModal('profile-modal')">Cancel</button>
    <button class="btn btn-primary" onclick="pfSaveChanges()">Save Changes</button>
  </div>
</div>

<div class="toast-wrap" id="toast-wrap"></div>
```

- [ ] **Step 2: Wire the Business Profile card to open the modal**

Find:
```js
      <div class="card">
        <div class="card-header"><span class="h2">Business Profile</span><span data-lucide="chevron-right" style="color:var(--text-muted);"></span></div>
        <p class="body-txt" style="color:var(--text-muted);">Sunset Dive Co. · Dive Shop · Mactan, Cebu</p>
      </div>
```

Replace with:
```js
      <div class="card" style="cursor:pointer;" onclick="openProfileModal()">
        <div class="card-header"><span class="h2">Business Profile</span><span data-lucide="chevron-right" style="color:var(--text-muted);"></span></div>
        <p class="body-txt" style="color:var(--text-muted);">Sunset Dive Co. · Dive Shop · Mactan, Cebu</p>
      </div>
```

- [ ] **Step 3: Add `openProfileModal`, `pfMarkDirty`, `pfSaveChanges`**

Find:
```js
function sendInvite(){ closeModal('invite-modal'); showToast('Invite sent', 'mail-check'); }

function settingsPlatformRow(key, label, icon){
```

Replace with:
```js
function sendInvite(){ closeModal('invite-modal'); showToast('Invite sent', 'mail-check'); }

/** Business Profile edit modal — reuses Onboarding's word-count pattern for Description/UVP.
 *  The Save Changes bar only appears once a field has been touched (dirty-gated per spec). */
function openProfileModal(){
  document.getElementById('pf-save-bar').style.display = 'none';
  updateWordCounter('pf-desc-count', wordCount(document.getElementById('pf-desc').value), 50);
  updateWordCounter('pf-uvp-count', wordCount(document.getElementById('pf-uvp').value), 50);
  openModal('profile-modal');
}
function pfMarkDirty(){
  document.getElementById('pf-save-bar').style.display = 'flex';
  updateWordCounter('pf-desc-count', wordCount(document.getElementById('pf-desc').value), 50);
  updateWordCounter('pf-uvp-count', wordCount(document.getElementById('pf-uvp').value), 50);
}
function pfSaveChanges(){
  document.getElementById('pf-save-bar').style.display = 'none';
  closeModal('profile-modal');
  showToast('Profile changes saved', 'check-circle');
}

function settingsPlatformRow(key, label, icon){
```

- [ ] **Step 4: Verify in browser**

`window.__jump('settings')`. Click the Business Profile card — confirm a modal opens with all six
fields pre-filled and no "Save Changes" bar visible yet. Edit the Business Name field — confirm
the Save Changes bar slides into view at the bottom. Edit the Description textarea — confirm its
word counter updates live. Click "Save Changes" — confirm the modal closes and a "Profile changes
saved" toast appears. Re-open the modal — confirm the Save Changes bar is hidden again until
something is edited. Screenshot the open modal both before and after editing a field.

---

### Task 9: Full regression pass across all seven screens

**Files:** none (verification only)

- [ ] **Step 1: Walk every screen with the dev jump-bar**

With the verification server running, visit each of: `login`, `onboarding`, `onboarding-low`,
`dashboard`, `content`, `calendar`, `performance`, `settings`. For each, take a screenshot and
check `browser_console_messages` (level `error`) — expect 0 JS errors throughout (a `favicon.ico`
404 is expected and fine).

- [ ] **Step 2: Re-check the two shared-state flows end-to-end**

1. From Settings, disconnect Instagram and connect TikTok. Navigate to Onboarding (`onboarding`
   jump) and step through to step 4 — confirm it reflects the same connection state (Instagram
   "Connect," TikTok "Connected") since both read `APP_STATE.connections`.
2. From Content Studio, select all three platforms, edit one platform's caption text directly in
   the textarea, switch to another tab and back — confirm your edit persisted (backed by
   `CS_CAPTIONS` mutation via `csUpdateCaption`, not lost on tab switch).

- [ ] **Step 3: Confirm nothing from the original prototype regressed**

Spot-check: Login's desktop split photo panel still renders (this was fixed in the prior session —
confirm it wasn't reintroduced by any edit here), the Market Radar drawer's "Target This Market"
button still navigates to Content Studio with a toast, and the Kanban board / Invite Member modal
in Settings still open correctly.

- [ ] **Step 4: Stop the verification server**

```bash
pkill -f "http.server 8791"
```

Do not run `git add`/`git commit` — leave the modified `ui-ux-prototype.html` for the user to
review and commit themselves, per this repo's `CLAUDE.md`.

---

## Self-Review Notes

- **Spec coverage:** §2.1(Task 2) §2.2(Task 2) §2.3(Task 3) §2.4(Task 4) §3.1(Task 5) §3.2(Task 5)
  §3.3(Task 5) §4.1(Task 6) §4.2(Task 6) §5.1(Task 7) §6.1(Task 8) — every spec section maps to a
  task.
- **Shared-state consistency:** `APP_STATE.connections` keys (`instagram`/`facebook`/`tiktok`) are
  used identically by Task 3 (`obConnectionRow`), Task 7 (`settingsPlatformRow`,
  `performanceFilterChips`) — same key spelling throughout, verified against Task 1's declaration.
- **Function name consistency:** `openAnalyticsFor(post)` takes one object with the same six keys
  (`title`,`platform`,`status`,`date`,`engagements`,`engTrend`,`reach`,`reachTrend`) whether called
  from `calendarDayClick` (Task 6, `CALENDAR_POSTS` entries) or Performance's row click (Task 6,
  `PERFORMANCE_POSTS` entries) — both data arrays were written with matching shapes.
- **No placeholders:** every task's code blocks are complete, runnable JS/HTML — no "add logic
  here" gaps.
