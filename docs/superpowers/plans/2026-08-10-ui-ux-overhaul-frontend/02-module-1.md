# Module 1 — Business Classification & Uniqueness Scoring

Screen docs: [`docs/module-1/screens/onboarding-wizard.md`](../../../module-1/screens/onboarding-wizard.md),
[`settings-business-profile.md`](../../../module-1/screens/settings-business-profile.md). Spec file:
`e2e/tests/onboarding-wizard.spec.ts` (Cards 4–8), `e2e/tests/settings-business-profile.spec.ts` (Card 9).

---

### CARD — Onboarding: Wizard Shell & Step 1 Basic Info

**Depends on:** Foundation — Shell & Routing
**Summary:** The five-step wizard's shell (side rail, progress bar, footer nav) plus the first step.

**Steps:**
- [ ] `components/module-1/onboarding/OnboardingWizard.tsx` — side step list, progress bar, step
      panel, Back/Continue footer gated by `obValid(i)` (`ui-ux-prototype.html:1928–1946`)
- [ ] `steps/BasicInfoStep.tsx` — business name (required, >1 char), industry select (required, one
      of the seven `BUSINESS_CATEGORIES`), slogan (optional). Lines 1990–2019
- [ ] `obDraft` state shape + wizard-level state container

**Milestone (finished state):** Navigating to `/onboarding` shows Step 1; Continue is disabled until
name + industry are filled; the side rail shows Step 1 as current, Steps 2–5 as pending.

**Definition of Done:**
- [ ] `OnboardingWizard.test.tsx` covers the step-1 validity gate
- [ ] `onboarding-wizard.spec.ts` → "Wizard Shell & Step 1 Basic Info" passes
- [ ] Code review approved

**Verification:**
```
cd ceview && npm run test:unit -- OnboardingWizard
cd e2e && npx playwright test onboarding-wizard.spec.ts -g "Wizard Shell & Step 1 Basic Info"
```

---

### CARD — Onboarding: Step 2 Brand Identity

**Depends on:** Card 4 (Wizard Shell & Step 1)
**Summary:** Vibe multi-select + core-services tag input.

**Steps:**
- [ ] `steps/BrandIdentityStep.tsx` — vibe chip grid (8 options), core-services tag input
      (type + Enter to add, ✕ to remove). Lines 2035–2073
- [ ] Gate: ≥1 vibe AND ≥1 core service

**Milestone (finished state):** Step 2 blocks Continue until both minimums are met; adding/removing a
service tag updates the list live.

**Definition of Done:**
- [ ] `BrandIdentityStep.test.tsx` covers the ≥1 vibe / ≥1 service gate and tag add/remove
- [ ] `onboarding-wizard.spec.ts` → "Step 2 Brand Identity" passes
- [ ] Code review approved

**Verification:**
```
cd ceview && npm run test:unit -- BrandIdentityStep
cd e2e && npx playwright test onboarding-wizard.spec.ts -g "Step 2 Brand Identity"
```

---

### CARD — Onboarding: Step 3 Structured Inputs

**Depends on:** Card 4 (Wizard Shell & Step 1)
**Summary:** Description + UVP textareas with live word-count validity gates.

**Steps:**
- [ ] `steps/StructuredInputsStep.tsx` — description (≥50 words), UVP (≥30 words), live word-count
      hint that flips red→green at threshold (`obCount`, lines 2096–2109)

**Milestone (finished state):** Typing below threshold shows the red "N more needed" hint; crossing
the threshold shows the green check and unblocks Continue.

**Definition of Done:**
- [ ] `StructuredInputsStep.test.tsx` covers both word-count gates independently
- [ ] `onboarding-wizard.spec.ts` → "Step 3 Structured Inputs" passes
- [ ] Code review approved

**Verification:**
```
cd ceview && npm run test:unit -- StructuredInputsStep
cd e2e && npx playwright test onboarding-wizard.spec.ts -g "Step 3 Structured Inputs"
```

---

### CARD — Onboarding: Step 4 Assets & Links

**Depends on:** Card 4 (Wizard Shell & Step 1)
**Summary:** Social handles, logo upload, website — all optional, no gate.

**Steps:**
- [ ] `steps/AssetsLinksStep.tsx` — 4 social handle inputs, logo dropzone (drag + click, base64
      preview via `FileReader`), website input. Lines 2110–2158
- [ ] Gate: none — always valid

**Milestone (finished state):** Dropping or picking an image file previews it inline; Continue is
enabled with every field empty.

**Definition of Done:**
- [ ] `AssetsLinksStep.test.tsx` covers logo file selection → preview render
- [ ] `onboarding-wizard.spec.ts` → "Step 4 Assets & Links" passes
- [ ] Code review approved

**Verification:**
```
cd ceview && npm run test:unit -- AssetsLinksStep
cd e2e && npx playwright test onboarding-wizard.spec.ts -g "Step 4 Assets & Links"
```

---

### CARD — Onboarding: Step 5 Analysis

**Depends on:** Cards 5, 6 (Brand Identity + Structured Inputs data feeds this step), Foundation —
Fixture Data Layer
**Summary:** Classify → category board → compute → three score cards, the wizard's terminal step.

**Steps:**
- [ ] `steps/AnalysisStep.tsx`, three sub-phases via `obPhase`:
  - [ ] `analyzing` — skeleton + embedding-pipeline banner, calls
        `POST /api/v1/classification/analyze`
  - [ ] `categories` — sorted-by-confidence toggleable rows, ≥1 must stay selected (blocked with a
        toast, not a disabled control — lines 2202–2211), "Compute uniqueness score" button
  - [ ] `computing → scored` — calls `POST /api/v1/classification/uniqueness`, renders 3 score cards,
        pass banner ≥70 / warning banner <70 with a "Strengthen my UVP" link back to Step 3
- [ ] Wizard finish: writes `obDraft` + selected categories + scores into `ProfileContext`, marks any
      filled social handle as connected, navigates to `/dashboard` (lines 2319–2338)
- [ ] Reuse as-is: `InferredCategoryBoard`, `AdjustableCategoryItem`, `OverallScoreCard`,
      `ActionableScoreCard`, `ComputeUniquenessButton`, `StatTypography`

**Milestone (finished state):** Completing all 5 steps with the fixture-backed classify/uniqueness
calls lands on `/dashboard` with the new profile's identity visible in the sidebar footer.

**Definition of Done:**
- [ ] `AnalysisStep.test.tsx` covers the ≥1-category-selected toggle rule and the <70 vs. ≥70 banner
      branch
- [ ] `onboarding-wizard.spec.ts` → "Step 5 Analysis" passes, including the full end-to-end
      register→wizard→dashboard path
- [ ] Code review approved

**Verification:**
```
cd ceview && npm run test:unit -- AnalysisStep
cd e2e && npx playwright test onboarding-wizard.spec.ts -g "Step 5 Analysis"
```

---

### CARD — Settings: Business Profile

**Depends on:** Foundation — Shell & Routing, Foundation — Fixture Data Layer
**Summary:** The permanent post-onboarding edit surface at `/settings/profile`.

**Steps:**
- [ ] `components/module-1/settings/BusinessProfileSettings.tsx` — identity header (avatar, name,
      industry, score chips), flat form (name, slogan, categories toggle grid — same ≥1-selected
      rule as onboarding, core services read-only, description, UVP, website), single Save
      (`ui-ux-prototype.html:4217–4265`)
- [ ] Flag, don't silently resolve: Save does not recompute the uniqueness score after an edit — the
      copy under Save claims it does. Raise in code review before wiring for real; see
      [`settings-business-profile.md`](../../../module-1/screens/settings-business-profile.md)'s
      "Known gap" section for the two resolution options

**Milestone (finished state):** Editing any field and clicking Save persists via
`apiClient.saveProfile` and re-syncs the sidebar identity block without a page reload.

**Definition of Done:**
- [ ] `BusinessProfileSettings.test.tsx` covers the ≥1-category-selected rule and Save→re-sync
- [ ] `settings-business-profile.spec.ts` → "Business Profile" passes
- [ ] Code review approved (including explicit sign-off on the uniqueness-score gap above)

**Verification:**
```
cd ceview && npm run test:unit -- BusinessProfileSettings
cd e2e && npx playwright test settings-business-profile.spec.ts
```
