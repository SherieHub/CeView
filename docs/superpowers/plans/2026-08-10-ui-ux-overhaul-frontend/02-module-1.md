# Module 1 — Business Classification & Uniqueness Scoring

All paths in this file are relative to `frontend/` (see `00-index.md`'s "Target directory" note).
Card 9's Settings component lives in the consolidated `components/settings/`, not
`components/module-1/settings/` — see that card below for why.

Screen docs: [`docs/module-1/screens/onboarding-wizard.md`](../../../module-1/screens/onboarding-wizard.md),
[`settings-business-profile.md`](../../../module-1/screens/settings-business-profile.md). Spec file:
`e2e/tests/onboarding-wizard.spec.ts` (Cards 4–8), `e2e/tests/settings-business-profile.spec.ts` (Card 9).

**Component diagram:** [`diagrams/module-1.mmd`](diagrams/module-1.mmd)

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

**Flow:** [`diagrams/cards/module-1/wizard-shell-step-1.mmd`](diagrams/cards/module-1/wizard-shell-step-1.mmd)

**Steps (pseudocode):** [`pseudocode/module-1/wizard-shell-step-1.ts`](pseudocode/module-1/wizard-shell-step-1.ts)

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

**Flow:** [`diagrams/cards/module-1/brand-identity-step-2.mmd`](diagrams/cards/module-1/brand-identity-step-2.mmd)

**Steps (pseudocode):** [`pseudocode/module-1/brand-identity-step-2.ts`](pseudocode/module-1/brand-identity-step-2.ts)

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

**Flow:** [`diagrams/cards/module-1/structured-inputs-step-3.mmd`](diagrams/cards/module-1/structured-inputs-step-3.mmd)

**Steps (pseudocode):** [`pseudocode/module-1/structured-inputs-step-3.ts`](pseudocode/module-1/structured-inputs-step-3.ts)

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

**Flow:** [`diagrams/cards/module-1/assets-links-step-4.mmd`](diagrams/cards/module-1/assets-links-step-4.mmd)

**Steps (pseudocode):** [`pseudocode/module-1/assets-links-step-4.ts`](pseudocode/module-1/assets-links-step-4.ts)

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

**Flow:** [`diagrams/cards/module-1/analysis-step-5.mmd`](diagrams/cards/module-1/analysis-step-5.mmd)

**Steps (pseudocode):** [`pseudocode/module-1/analysis-step-5.ts`](pseudocode/module-1/analysis-step-5.ts)

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

**Flow:** [`diagrams/cards/module-1/settings-business-profile.mmd`](diagrams/cards/module-1/settings-business-profile.mmd)

**Steps (pseudocode):** [`pseudocode/module-1/settings-business-profile.ts`](pseudocode/module-1/settings-business-profile.ts)

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
