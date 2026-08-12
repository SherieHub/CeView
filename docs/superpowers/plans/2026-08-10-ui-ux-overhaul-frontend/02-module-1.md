# Module 1 — Business Classification & Uniqueness Scoring

All paths in this file are relative to `frontend/` (see `00-index.md`'s "Target directory" note).
Card 9's Settings component lives in the consolidated `components/settings/`, not
`components/module-1/settings/` — see that card below for why.

Screen docs: [`docs/module-1/screens/onboarding-wizard.md`](../../../module-1/screens/onboarding-wizard.md),
[`settings-business-profile.md`](../../../module-1/screens/settings-business-profile.md). Spec file:
`e2e/tests/onboarding-wizard.spec.ts` (Cards 4–8), `e2e/tests/settings-business-profile.spec.ts` (Card 9).

---

### CARD — Onboarding: Wizard Shell & Step 1 Basic Info

**Depends on:** Foundation — Shell & Routing
**Summary:** The five-step wizard's shell (side rail, progress bar, footer nav) plus the first step.
**Prototype reference:** view-onboarding / `obRender()` + `obStepBasic()` —
`ui-ux-prototype.html:962–1989`, `:1990–2019`

**Project files to add/implement:**
- `components/module-1/onboarding/OnboardingWizard.tsx` — wizard shell: side step list, progress
  bar, step panel, Back/Continue footer
- `components/module-1/onboarding/steps/BasicInfoStep.tsx` — Step 1 form
- `components/module-1/onboarding/obDraft.ts` (or equivalent state module) — the wizard-wide draft
  state shape + setters

**Related files:**
- `services/profileContext.tsx` (Foundation — Shell & Routing) — the wizard's final destination for
  `obDraft` once Step 5 completes
- `types.ts` — `BusinessProfile` fields the draft state must eventually match

**Steps (pseudocode):**
1. Define `obDraft` state: `businessName`, `industry`, `slogan`, `vibes` (string[]),
   `coreServices` (string[]), `description`, `uvp`, `socials` (per-platform handle map), `logo`
   (data URL or null), `website`. All fields start empty.
2. Define a per-step validity function, one branch per step index:
   - Step 1 (this card): valid when `businessName` is longer than 1 character AND `industry` is set.
   - Steps 2–5: implemented by their own cards below; this card's gate only covers Step 1.
3. `OnboardingWizard.tsx`:
   - Render a side list of all 5 steps, marking each `done` / `current` / `pending` based on the
     wizard's current step index.
   - Render a progress bar sized to `(currentStep + 1) / 5`.
   - Render the active step's panel (this card only implements Step 1's panel; later steps render a
     placeholder until their own cards land).
   - Footer: Back button (hidden on step 1), Continue button disabled unless the current step's
     validity function returns true.
4. `BasicInfoStep.tsx`:
   - Business name: required text input, bound to `obDraft.businessName`.
   - Industry: required select, one of the seven `BUSINESS_CATEGORIES`, bound to
     `obDraft.industry`.
   - Slogan: optional text input, bound to `obDraft.slogan`.
   - A "Fill with demo business" button that populates every `obDraft` field with fixed demo values
     in one action (useful for manually exercising later steps without re-typing).

**Milestone (finished state):** Navigating to `/onboarding` shows Step 1; Continue is disabled until
name + industry are filled; the side rail shows Step 1 as current, Steps 2–5 as pending.

**Definition of Done:**
- [ ] `OnboardingWizard.test.tsx` covers the step-1 validity gate
- [ ] `onboarding-wizard.spec.ts` → "Wizard Shell & Step 1 Basic Info" — deferred, not wired for
      `frontend/` yet (see `00-index.md`'s Testing Strategy)
- [ ] Code review approved

**Verification:**
```
cd frontend && npm run test:unit -- OnboardingWizard
```

---

### CARD — Onboarding: Step 2 Brand Identity

**Depends on:** Card 4 (Wizard Shell & Step 1)
**Summary:** Vibe multi-select + core-services tag input.
**Prototype reference:** view-onboarding / `obStepBrand()` — `ui-ux-prototype.html:2035–2071`

**Project files to add/implement:**
- `components/module-1/onboarding/steps/BrandIdentityStep.tsx` — Step 2 form

**Related files:**
- `components/module-1/onboarding/obDraft.ts` (Card 4) — reads/writes `vibes`, `coreServices`

**Steps (pseudocode):**
1. Render a chip grid of the 8 fixed `VIBES` options; each chip toggles itself in/out of
   `obDraft.vibes` on click (multi-select, no minimum enforced by the chip itself).
2. Render a tag input for core services:
   - Typing text and pressing Enter appends it to `obDraft.coreServices` (skip if already present or
     empty), then clears and refocuses the input.
   - Each existing tag renders with a ✕ button that removes it from `obDraft.coreServices`.
3. Extend the wizard's per-step validity function: Step 2 is valid when `vibes.length >= 1` AND
   `coreServices.length >= 1`.

**Milestone (finished state):** Step 2 blocks Continue until both minimums are met; adding/removing a
service tag updates the list live.

**Definition of Done:**
- [ ] `BrandIdentityStep.test.tsx` covers the ≥1 vibe / ≥1 service gate and tag add/remove
- [ ] `onboarding-wizard.spec.ts` → "Step 2 Brand Identity" — deferred, not wired for `frontend/` yet
      (see `00-index.md`'s Testing Strategy)
- [ ] Code review approved

**Verification:**
```
cd frontend && npm run test:unit -- BrandIdentityStep
```

---

### CARD — Onboarding: Step 3 Structured Inputs

**Depends on:** Card 4 (Wizard Shell & Step 1)
**Summary:** Description + UVP textareas with live word-count validity gates.
**Prototype reference:** view-onboarding / `obStepStructured()` + `obCount()` —
`ui-ux-prototype.html:2074–2107`

**Project files to add/implement:**
- `components/module-1/onboarding/steps/StructuredInputsStep.tsx` — Step 3 form

**Related files:**
- `components/module-1/onboarding/obDraft.ts` (Card 4) — reads/writes `description`, `uvp`

**Steps (pseudocode):**
1. Render two textareas bound to `obDraft.description` (min 50 words) and `obDraft.uvp` (min 30
   words).
2. On every keystroke in either textarea, recompute its word count and:
   - If the count is below the field's minimum and greater than 0: show a red "N / min words — X
     more needed" hint, mark the field invalid.
   - If the count meets the minimum: show a green "N words — threshold met" hint, mark the field
     valid.
   - If the count is 0: show a neutral placeholder hint, no red/green state yet.
3. Extend the wizard's per-step validity function: Step 3 is valid when both fields independently
   meet their minimum word count.

**Milestone (finished state):** Typing below threshold shows the red "N more needed" hint; crossing
the threshold shows the green check and unblocks Continue.

**Definition of Done:**
- [ ] `StructuredInputsStep.test.tsx` covers both word-count gates independently
- [ ] `onboarding-wizard.spec.ts` → "Step 3 Structured Inputs" — deferred, not wired for `frontend/`
      yet (see `00-index.md`'s Testing Strategy)
- [ ] Code review approved

**Verification:**
```
cd frontend && npm run test:unit -- StructuredInputsStep
```

---

### CARD — Onboarding: Step 4 Assets & Links

**Depends on:** Card 4 (Wizard Shell & Step 1)
**Summary:** Social handles, logo upload, website — all optional, no gate.
**Prototype reference:** view-onboarding / `obStepAssets()` — `ui-ux-prototype.html:2109–2162`

**Project files to add/implement:**
- `components/module-1/onboarding/steps/AssetsLinksStep.tsx` — Step 4 form

**Related files:**
- `components/module-1/onboarding/obDraft.ts` (Card 4) — reads/writes `socials`, `logo`, `website`

**Steps (pseudocode):**
1. Render one text input per known platform (from a fixed platform-metadata list: icon, brand
   color, label), each bound to `obDraft.socials[platform]`.
2. Render a logo dropzone:
   - Click opens a file picker; dragging a file over the zone highlights it; dropping or picking an
     image file reads it via `FileReader` into a data URL and stores it in `obDraft.logo`.
   - If `obDraft.logo` is already set, show the image preview instead of the empty-state prompt.
3. Render a text input bound to `obDraft.website`.
4. This step has no validity gate — Continue is always enabled regardless of field contents.

**Milestone (finished state):** Dropping or picking an image file previews it inline; Continue is
enabled with every field empty.

**Definition of Done:**
- [ ] `AssetsLinksStep.test.tsx` covers logo file selection → preview render
- [ ] `onboarding-wizard.spec.ts` → "Step 4 Assets & Links" — deferred, not wired for `frontend/` yet
      (see `00-index.md`'s Testing Strategy)
- [ ] Code review approved

**Verification:**
```
cd frontend && npm run test:unit -- AssetsLinksStep
```

---

### CARD — Onboarding: Step 5 Analysis

**Depends on:** Cards 5, 6 (Brand Identity + Structured Inputs data feeds this step), Foundation —
Fixture Data Layer
**Summary:** Classify → category board → compute → three score cards, the wizard's terminal step.
**Prototype reference:** view-onboarding / `obStepAnalysis()` + `fakeClassify()` + `obCompute()` —
`ui-ux-prototype.html:2164–2338`

**Project files to add/implement:**
- `components/module-1/onboarding/steps/AnalysisStep.tsx` — Step 5, all three sub-phases
- `components/module-1/InferredCategoryBoard.tsx` — sorted-by-confidence toggleable category rows
- `components/module-1/AdjustableCategoryItem.tsx` — one row within the board
- `components/module-1/OverallScoreCard.tsx` — the combined uniqueness score display
- `components/module-1/ActionableScoreCard.tsx` — the semantics/category sub-score displays
- `components/module-1/ComputeUniquenessButton.tsx` — triggers the compute phase
- `components/module-1/StatTypography.tsx` — shared number/label display used by the score cards

**Related files:**
- `services/apiClient.ts` (Foundation — Fixture Data Layer) — classify/uniqueness calls this step
  makes (fixture-backed until the real classification service is wired)
- `services/profileContext.tsx` (Foundation — Shell & Routing) — where this step writes the finished
  profile
- `components/shared/Toast.tsx` (Foundation — Shell & Routing) — used for the "at least one category"
  block message

**Steps (pseudocode):**
1. Track a step-local phase: `idle` → `analyzing` → `categories` → `computing` → `scored`.
2. On entering this step (or on demand), set phase to `analyzing`, show a skeleton + an
   embedding-pipeline banner, and call `apiClient`'s classify endpoint with the combined
   description + UVP + core-services text.
   - On response, store the returned categories (each with a name, a confidence percentage, and
     whether it's pre-selected — the two highest-confidence categories start selected) and set phase
     to `categories`.
3. In the `categories` phase, render `InferredCategoryBoard`: rows sorted by confidence descending,
   each toggleable.
   - Toggling a category off when it's the only selected one is blocked: show a toast ("at least one
     category must stay selected") instead of deselecting it.
   - If the score was already computed and the operator changes the selection, drop back to the
     `categories` phase and discard the stale score.
   - A "Compute uniqueness score" button advances to the next phase.
4. On Compute, set phase to `computing`, call `apiClient`'s uniqueness endpoint with the current
   selection, then on response:
   - Store `overallScore`, `semanticsScore` (from the description/UVP text), and `categoryScore`
     (from the selected categories' confidence share).
   - Set phase to `scored`.
5. In the `scored` phase, render `OverallScoreCard` (the combined score) and two
   `ActionableScoreCard`s (semantics, category):
   - If `overallScore >= 70`: show a pass banner.
   - If `overallScore < 70`: show a warning banner with a "Strengthen my UVP" link that navigates
     back to Step 3.
6. Wizard finish (leaving Step 5 successfully): write the full `obDraft` plus the selected
   categories and computed scores into `ProfileContext`; mark any social handle the operator filled
   in as "connected"; navigate to `/dashboard`.

**Milestone (finished state):** Completing all 5 steps with the fixture-backed classify/uniqueness
calls lands on `/dashboard` with the new profile's identity visible in the sidebar footer.

**Definition of Done:**
- [ ] `AnalysisStep.test.tsx` covers the ≥1-category-selected toggle rule and the <70 vs. ≥70 banner
      branch
- [ ] `onboarding-wizard.spec.ts` → "Step 5 Analysis" — deferred, not wired for `frontend/` yet (see
      `00-index.md`'s Testing Strategy); once wired, this block should cover the full end-to-end
      register→wizard→dashboard path
- [ ] Code review approved

**Verification:**
```
cd frontend && npm run test:unit -- AnalysisStep
```

---

### CARD — Settings: Business Profile

**Depends on:** Foundation — Shell & Routing, Foundation — Fixture Data Layer
**Summary:** The permanent post-onboarding edit surface at `/settings/profile`.
**Prototype reference:** screen-settings (profile tab) / `renderSettings()` —
`ui-ux-prototype.html:4217–4265`

**Project files to add/implement:**
- `components/settings/BusinessProfileSettings.tsx` — profile identity header + edit form for
  `/settings/profile`. Lives in the consolidated `components/settings/` alongside Cards 22–23's
  `PlatformsSettings.tsx`/`WorkspaceSettings.tsx` (`04-module-3.md`) — all three Settings sub-tabs
  share one directory regardless of which module's card describes them, per project decision
  (diverges from `e2e.yml`'s current per-module settings path filters, which still target
  `ceview/`'s split layout and are out of scope for `frontend/` — see `00-index.md`'s Testing
  Strategy)

**Related files:**
- `services/profileContext.tsx` (Foundation — Shell & Routing) — the profile this form reads and
  writes; also what re-syncs the sidebar identity block after Save
- `services/apiClient.ts` (Foundation — Fixture Data Layer) — the `saveProfile` call this card wires
  up
- `types.ts` — `BusinessProfile` shape this form's fields must match

**Steps (pseudocode):**
1. Render an identity header: avatar, business name, industry, uniqueness-score chips — all read
   from `ProfileContext`, not local state.
2. Render a flat edit form, pre-filled from `ProfileContext`:
   - Name, slogan (text inputs).
   - Categories (toggle grid, same "≥1 must stay selected" rule as onboarding Step 5's category
     board).
   - Core services (read-only list — not editable here).
   - Description, UVP (textareas, no word-count gate on this screen — the gate is onboarding-only).
   - Website (text input).
3. On Save:
   - Call `apiClient.saveProfile(formValues)`.
   - On success, update `ProfileContext` with the new values so the sidebar identity block re-renders
     without a page reload.
4. Known gap — flag, don't silently resolve: Save does not recompute the uniqueness score after an
   edit, even though the copy under the Save button implies it does. Raise this in code review before
   wiring it for real; see
   [`settings-business-profile.md`](../../../module-1/screens/settings-business-profile.md)'s "Known
   gap" section for the two resolution options.

**Milestone (finished state):** Editing any field and clicking Save persists via
`apiClient.saveProfile` and re-syncs the sidebar identity block without a page reload.

**Definition of Done:**
- [ ] `BusinessProfileSettings.test.tsx` covers the ≥1-category-selected rule and Save→re-sync
- [ ] `settings-business-profile.spec.ts` → "Business Profile" — deferred, not wired for `frontend/`
      yet (see `00-index.md`'s Testing Strategy)
- [ ] Code review approved (including explicit sign-off on the uniqueness-score gap above)

**Verification:**
```
cd frontend && npm run test:unit -- BusinessProfileSettings
```
