/**
 * CARD — Onboarding: Step 3 Structured Inputs
 * Depends on: Card 4 (Wizard Shell & Step 1)
 * Prototype reference: obCount() — ui-ux-prototype.html:2096–2109
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/02-module-1.md
 *
 * TODO:
 * - Description textarea (>=50 words), UVP textarea (>=30 words)
 * - Live word-count hint that flips red -> green at threshold
 * - StructuredInputsStep.test.tsx: cover both word-count gates independently
 */
export default function StructuredInputsStep() {
  return (
    <div className="empty flex h-full flex-col items-center justify-center gap-1 text-center">
      <h2 className="heading-lg">Structured Inputs</h2>
      <p className="body-sm">
        Not implemented yet — see CARD — Onboarding: Step 3 Structured Inputs in
        02-module-1.md.
      </p>
    </div>
  );
}
