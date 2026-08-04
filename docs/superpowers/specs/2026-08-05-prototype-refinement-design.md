# CeView Prototype Refinement — Design Spec

## 1. Overview

This spec covers a targeted round of changes to the existing static wireframe prototype,
[`ui-ux-prototype.html`](../../../ui-ux-prototype.html) (built per
[`2026-08-04-ui-ux-overhaul-design.md`](2026-08-04-ui-ux-overhaul-design.md)). It is **not** a
change to the real `ceview/` frontend — the prototype remains a single self-contained HTML file
at the repo root, no backend, no build step, and no project code is touched.

The changes below refine five areas of the prototype based on direct feedback: Onboarding,
Content Studio, Calendar, Performance, and Settings. Where the real frontend already implements
related behavior (e.g. per-platform captions in `ContentStudioView.tsx`), this spec references
that as the pattern to mirror in spirit — not to copy verbatim, since the prototype has no backend
to call.

**Constraints carried over from the original prototype spec:** single HTML file, vanilla JS view
switching, Plus Jakarta Sans + lucide icons via CDN, navy/gold/cream design tokens, mobile-first
with desktop deltas, dev jump-bar retained for navigation during review.

---

## 2. Onboarding Changes

### 2.1 Step 2 — Brand Identity: Vibe/Theme as free text

Replace the current chip multi-select for Vibe/Theme with a single-line text input.
- Placeholder: `"e.g. warm, adventurous, community-rooted"`
- Validation: at least 1 word (non-empty after trim) required to enable "Next." Inline helper
  text explains the requirement when empty and Next is attempted.
- Core Services tag input is unchanged.

### 2.2 Step 3 — Structured Inputs: 50-word minimums

Both Full Description and Unique Value Proposition textareas require **at least 50 words** before
"Next" enables.
- Live word counter under each field (`"32 / 50 words"`), turning from muted to a success tone
  once the threshold is met.
- Helper copy under the counter while below threshold: `"A bit more detail helps our AI speak
  your brand's language."`
- "Next" button is disabled (existing `.is-disabled` pattern) until both fields clear 50 words.

### 2.3 Step 4 — Assets & Links: account connection instead of handles

Remove the per-platform handle text inputs. Replace with three connection rows — Instagram,
Facebook, TikTok — using the same visual pattern as Settings → Platforms (icon, label, connected
state with green "Connected" badge + handle once connected, or a gold "Connect" button that
flips the row to connected state on click, since there's no real OAuth in this prototype).
Logo upload (drag/tap, circular preview) and Website URL fields are unchanged and remain on this
step.

### 2.4 Step 5 — Uniqueness Score reveal: low-score branch

The reveal step gets a second, low-score path in addition to the existing celebratory one.

- **High-score path (existing):** gauge animates to 82, one-line AI insight, "Go to Dashboard" CTA.
  Unchanged.
- **Low-score path (new):** triggered when the demo score is below 60. For this prototype, the
  score is a hardcoded JS value reachable via the dev jump bar's onboarding shortcut (a toggle or
  second jump-bar entry, e.g. `onboarding-low-score`), not from any real calculation.
  - Gauge shows a lower score (e.g. 42) with softer, non-alarming copy:
    `"Let's sharpen this a bit — a few quick questions can reveal what makes you different."`
  - Three guided questions are shown **progressively, one at a time** (not a form dump), each with
    a short prompt (e.g. "What do customers thank you for most often, unprompted?"), a text input,
    a "Next" action, and a "Skip for now" link that moves on without answering.
  - After the third question (answered or skipped), the gauge re-animates to a final, higher
    hardcoded score (e.g. 78) with new AI insight text reflecting the "improvement," then reveals
    the standard "Go to Dashboard" CTA.
  - This is a scripted demo sequence (fixed before/after numbers and copy) — no real scoring logic.

---

## 3. Content Studio Changes

### 3.1 Platform-driven caption tabs

The Platform Selection chips (TikTok / Facebook / Instagram) become the source of truth for which
caption tabs exist, mirroring the real app's per-platform caption pattern
(`ContentStudioView.tsx`'s `activeTab` / `content.captions[activeTab]` model, and
`AIContentMatrixPanel.tsx`'s per-platform option cards).

- The Caption card shows one sub-tab per **currently selected** platform. Selecting a platform
  chip adds its tab (with a freshly generated caption in that platform's voice); deselecting a
  chip removes its tab and drops that platform's caption.
- Each platform's caption differs in voice/format, hardcoded per platform for the demo:
  - **Instagram:** warm, emoji-forward, ends with 2–3 relevant hashtags.
  - **TikTok:** punchy, hook-first opening line, casual/trend-inflected language, minimal
    hashtags.
  - **Facebook:** fuller sentences, community/local-toned, emoji used sparingly.
- "Regenerate" only regenerates the caption for the currently active tab.
- If no platform is selected, the Caption card shows an empty state: `"Select a platform above to
  generate a caption."`

### 3.2 Visual Guide restructured into 5 defined aspects

Replace the current freeform paragraph with 5 labeled sub-cards, each with a bolded aspect name, a
one-line definition of what the aspect means, and a specific "Apply" tip tied to the demo
business/market context:

1. **Lighting** — what it is: how light shapes mood and clarity. Apply: shoot at golden hour
   (5:30–6:30pm), warm backlight behind divers.
2. **Composition** — how elements are arranged in frame. Apply: rule-of-thirds, diver off-center,
   reef leading toward the horizon.
3. **Color Palette** — dominant tones that set the brand feel. Apply: deep teal water + amber
   highlights; avoid oversaturated blue filters.
4. **Framing & Angle** — camera distance and perspective. Apply: wide shot from just above the
   water surface, full group included for scale.
5. **Mood & Styling** — the overall emotional tone. Apply: aspirational/adventurous, candid smiles
   rather than posed stares.

### 3.3 Live Preview varies per platform

The Live Preview panel gets tabs matching the currently selected platforms (same set driving
§3.1), and each renders a visually distinct mock of that platform's post format:

- **Instagram:** square (1:1) photo area, caption text below the image, a like/comment/share icon
  row beneath.
- **TikTok:** tall 9:16 frame, caption text overlaid near the bottom-left over the image, a small
  music-note icon beside it.
- **Facebook:** wider card, caption text above the photo, a reaction bar (👍 Like · 💬 Comment ·
  ↗ Share) beneath.

If no platform is selected, Live Preview shows the same empty state as the Caption card.

---

## 4. Calendar Changes

### 4.1 List View implemented

The existing "List View" toggle button (currently a stub toast) becomes functional, swapping the
month grid for a chronological agenda:
- Grouped by date header (e.g. `AUG 7`), each post shown as a compact horizontal card: thumbnail,
  platform badge(s), status badge (Draft/Scheduled/Published), and title.
- Tapping a published post's card opens the Analytics Modal (§4.2). Tapping a draft/scheduled
  post shows the existing "routes into Content Studio" toast, consistent with current grid-view
  stub behavior.
- A "Grid View" button appears in list mode to toggle back.

### 4.2 Hardcoded published posts with stats

3–4 of the currently dot-marked calendar dates get real mock post data (title, platform, date,
engagements, reach) instead of the single generic example currently reused everywhere. Clicking
those specific dates (in either grid or list view) opens the existing Analytics Modal pre-filled
with that post's own numbers and chart. Other dot-marked dates without assigned mock data continue
to open the current generic example, unchanged.

---

## 5. Performance Changes

### 5.1 Filter chips dynamic to connected platforms

The `All / TikTok / Instagram / Facebook` filter row is replaced with `All` plus one chip per
platform currently marked "Connected" in Settings → Platforms. In the current mock data that's
Instagram and Facebook (TikTok starts "Not connected"), so the row renders `All / Instagram /
Facebook`.

Connection state is lifted into shared JS state read by both the Settings and Performance screen
builders, so connecting TikTok in Settings during the same session causes its filter chip to
appear on Performance without a page reload — demonstrating the intended dynamic relationship.

---

## 6. Settings Changes

### 6.1 Business Profile opens an edit modal

Tapping the Business Profile card opens a modal (reusing the Modal component pattern already in
the prototype) containing the same field components used in Onboarding, in one scrollable form:
Business Name, Industry, Vibe/Theme (free text, §2.1's validation), Core Services (tag input),
Full Description and UVP (both with the 50-word counters from §2.2). A "Save Changes" bar appears
pinned at the bottom of the modal only once a field has been edited (dirty-state gated), with
"Cancel" and "Save Changes" actions. Saving just closes the modal and shows a confirmation toast —
no persistence beyond the open session.

---

## 7. Explicitly Out of Scope

- No real backend, persistence, or OAuth — all "connect account" and "save" actions are
  client-side state changes within the single HTML file, reset on reload.
- No changes to the real `ceview/` frontend codebase.
- The low-score onboarding path's before/after numbers and question copy are fixed/scripted, not
  computed.
- Filter-chip reactivity (§5.1) only needs to work within a single browser session/tab; no
  cross-tab or persisted state is required.
