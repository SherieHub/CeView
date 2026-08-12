/**
 * CARD — Onboarding: Wizard Shell & Step 1 Basic Info
 * Depends on: Foundation — Shell & Routing
 * Prototype reference: view-onboarding / obValid() — ui-ux-prototype.html:1928–1946
 * Screen doc: docs/module-1/screens/onboarding-wizard.md
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/02-module-1.md
 *
 * TODO:
 * - Side step list, progress bar, step panel, Back/Continue footer gated by obValid(i)
 * - Own `obDraft` state shape + wizard-level state container
 * - Mount steps/BasicInfoStep.tsx as Step 1; Steps 2–5 land in later cards
 * - OnboardingWizard.test.tsx: cover the step-1 validity gate
 */
export default function OnboardingWizard() {
  return (
    <div className="empty flex h-full flex-col items-center justify-center gap-1 text-center">
      <h2 className="h-lg">Onboarding Wizard</h2>
      <p className="body-sm">
        Not implemented yet — see CARD — Onboarding: Wizard Shell &amp; Step 1 Basic Info in
        02-module-1.md.
      </p>
    </div>
  );
}
