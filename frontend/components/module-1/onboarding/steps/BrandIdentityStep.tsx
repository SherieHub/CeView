/**
 * CARD — Onboarding: Step 2 Brand Identity
 * Depends on: Card 4 (Wizard Shell & Step 1)
 * Prototype reference: obStepBrand() — ui-ux-prototype.html:2035–2073
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/02-module-1.md
 *
 * TODO:
 * - Vibe chip grid (8 options), core-services tag input (type + Enter to add, x to remove)
 * - Gate: >=1 vibe AND >=1 core service
 * - BrandIdentityStep.test.tsx: cover the gate and tag add/remove
 */
export default function BrandIdentityStep() {
  return (
    <div className="empty flex h-full flex-col items-center justify-center gap-1 text-center">
      <h2 className="h-lg">Brand Identity</h2>
      <p className="body-sm">
        Not implemented yet — see CARD — Onboarding: Step 2 Brand Identity in 02-module-1.md.
      </p>
    </div>
  );
}
