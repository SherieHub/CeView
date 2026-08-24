/**
 * CARD — Onboarding: Step 5 Analysis
 * Depends on: Cards 5, 6 (Brand Identity + Structured Inputs data feeds this step),
 *   Foundation — Fixture Data Layer
 * Prototype reference: ui-ux-prototype.html:2202–2338
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/02-module-1.md
 *
 * TODO:
 * - Three sub-phases via obPhase: analyzing -> categories -> computing -> scored
 *   - analyzing: skeleton + embedding-pipeline banner, POST /api/v1/classification/analyze
 *   - categories: sorted-by-confidence toggleable rows, >=1 must stay selected
 *     (blocked with a toast, not a disabled control), "Compute uniqueness score" button
 *   - computing -> scored: POST /api/v1/classification/uniqueness, 3 score cards,
 *     pass banner >=70 / warning banner <70 with "Strengthen my UVP" link back to Step 3
 * - Wizard finish: write obDraft + selected categories + scores into ProfileContext,
 *   mark any filled social handle as connected, navigate to /dashboard
 * - Reuse as-is (port in, don't rebuild): InferredCategoryBoard, AdjustableCategoryItem,
 *   OverallScoreCard, ActionableScoreCard, ComputeUniquenessButton, StatTypography
 * - AnalysisStep.test.tsx: cover the >=1-category-selected toggle rule and the <70 vs. >=70 banner branch
 */
export default function AnalysisStep() {
  return (
    <div className="empty flex h-full flex-col items-center justify-center gap-1 text-center">
      <h2 className="heading-lg">Analysis</h2>
      <p className="body-sm">
        Not implemented yet — see CARD — Onboarding: Step 5 Analysis in 02-module-1.md.
      </p>
    </div>
  );
}
