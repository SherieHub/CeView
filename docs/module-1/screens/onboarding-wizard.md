# Screen — Onboarding Wizard

**Route:** `/onboarding` · **Module:** 1 (Business Classification & Uniqueness Scoring) · **Access:**
authenticated, only while `profile.uniquenessScore == null`; redirects to `/dashboard` once complete.

**Prototype reference:** [`ui-ux-prototype.html:961–996`](../../../ui-ux-prototype.html#L961) (shell
markup), [`:1894–2339`](../../../ui-ux-prototype.html#L1894) (step logic), driven from
[`init()`](../../../ui-ux-prototype.html#L4448) and `submitAuth()` on registration.

**Component:** `components/module-1/onboarding/OnboardingWizard.tsx` (new — replaces the standalone
`BusinessProfile.tsx` + `UniquenessCalibrationView.tsx` screens; see
[schema-delta.md](../backend/schema-delta.md) for the backend fields this wizard collects that the
current API doesn't yet accept).

## Why this replaces the two old screens

Today, Module 1 is two permanently-routed screens an operator can revisit from the sidebar any time:
`BusinessProfile` (identity + core services + description + UVP) and `UniquenessCalibrationView`
(category confidence + score computation). The prototype merges both into a single five-step
first-run wizard that runs once, immediately after registration. Editing afterward happens through
[Settings → Business profile](settings-business-profile.md), which is a flat form, not a wizard —
there is no reason to re-walk five gated steps to fix a typo in the slogan.

## Layout

Two-pane: a left rail (`ob-rail`) with the CeView mark, a vertical step list showing done/current/
pending state per step, and a static "every field feeds the AI" info banner; a right pane (`ob-main`)
with a progress bar, the active step's panel, and a footer with Back / Continue.

## State

```
obIndex: number                 // 0-4, current step
obPhase: 'idle'|'analyzing'|'categories'|'computing'|'scored'   // step 5 sub-machine
obCategories: {name, percentage, selected}[]
obScores: {overallScore, semanticsScore, categoryScore} | null
obDraft: {
  businessName, industry, slogan,
  vibes: string[], coreServices: string[],
  description, uvp,
  socials: {instagram, facebook, tiktok, naver},
  logo: string|null, website
}
```

On completion, `obDraft` + `obCategories` (selected only) + `obScores` are written into the shared
`ProfileContext`; any non-empty social handle marks that platform as connected (feeds
[Settings → Platforms](../../module-3/screens/settings-platforms.md)).

## Steps

### 1 — Basic Info (`steps/BasicInfoStep.tsx`)
Fields: business name (required, >1 char), industry (required, one of the seven
[`BUSINESS_CATEGORIES`](../../../ceview/constants.ts)), slogan (optional). "Fill with demo business"
dev shortcut populates all five steps from a sample resort profile — keep behind a dev flag, not
shipped to production users.
**Gate:** name non-empty AND industry selected.

### 2 — Brand Identity (`steps/BrandIdentityStep.tsx`)
Fields: vibe (multi-select chip grid, 8 options — Serene & Restorative, Adventurous, Luxury &
Exclusive, Family-Friendly, Eco-Conscious, Local & Authentic, Youthful & Social, Romantic), core
services (tag input — type + Enter to add, ✕ to remove).
**Gate:** ≥1 vibe AND ≥1 core service.

### 3 — Structured Inputs (`steps/StructuredInputsStep.tsx`)
Fields: full description (textarea, live word count), unique value proposition (textarea, live word
count). These two fields are what gets embedded into the 768-dim vector Module 1.2 scores against the
Cebu MSME corpus — say so in the copy, the prototype does (line 2081).
**Gate:** description ≥50 words AND UVP ≥30 words. Word count updates on every keystroke; a green
check replaces the counter once the threshold is met, red/amber below it.

### 4 — Assets & Links (`steps/AssetsLinksStep.tsx`)
Fields: four social handle inputs (Instagram/Facebook/TikTok/Naver — plain text, no OAuth here),
logo (drag-drop or click, client-side base64 preview via `FileReader`), website URL. All optional.
Copy notes these can be changed later in Settings → Platforms / Business profile.
**Gate:** none — always valid.

### 5 — Analysis (`steps/AnalysisStep.tsx`)
Three sub-phases driven by `obPhase`, not by step navigation (Back/Continue are hidden or repurposed
here):
1. **analyzing** — skeleton rows + "Running multilingual E5 embedding, then the Dense(256→128→7)
   classifier head…" banner. Calls `POST /api/v1/classification/analyze` (Module 1.1).
2. **categories** — sorted-by-confidence rows, each a toggle; percentage bar per row. At least one
   category must stay selected — attempting to deselect the last one is blocked with a toast
   ("At least one category must stay selected"), not a disabled control. A "Compute uniqueness score"
   button appears once ready.
3. **computing → scored** — calls `POST /api/v1/classification/uniqueness` (Module 1.2) with the
   confirmed profile + selected categories. Result renders as three score cards (Overall / Semantics
   / Category, `StatTypography`), a pass banner at ≥70 ("Well differentiated") or a warning banner
   below 70 ("Room to sharpen") with a "Strengthen my UVP" link that jumps back to step 3 without
   losing step 1/2/4 data.
**Gate to finish:** `obPhase === 'scored'`.

## Reused components (no changes needed)

`InferredCategoryBoard`, `AdjustableCategoryItem`, `DynamicListManager`, `TextField`,
`TextAreaField`, `ValidationBanner` — from
[`1.1-business-input/components/`](../1.1-business-input/); `OverallScoreCard`,
`ActionableScoreCard`, `ComputeUniquenessButton`, `StatTypography` — from
[`1.2-uniqueness-scoring/components/`](../1.2-uniqueness-scoring/).

## API calls

| Call | Step | Endpoint |
|---|---|---|
| `apiClient.classifyAnalyze` | 5 (analyzing) | `POST /api/v1/classification/analyze` |
| `apiClient.classifyUniqueness` | 5 (computing) | `POST /api/v1/classification/uniqueness` |
| `apiClient.saveProfile` | on finish | `PUT /api/v1/business-profile` |

## Backend detail

See [`docs/module-1/backend/`](../backend/) for `BusinessProfileController`,
`ClassificationAnalyzeController`, `UniquenessScoringController`, `AIInferenceGatewayService`, and
the entity/DTO shapes; [`schema-delta.md`](../backend/schema-delta.md) for the columns this wizard
needs that don't exist yet. Processing-logic detail (embedding pipeline, scoring formula) lives in
[`MODULE1_SYSTEM_DOCUMENTATION.md`](../MODULE1_SYSTEM_DOCUMENTATION.md).
