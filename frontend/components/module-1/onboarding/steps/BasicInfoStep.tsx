/**
 * CARD — Onboarding: Wizard Shell & Step 1 Basic Info
 * Depends on: Foundation — Shell & Routing
 * Prototype reference: obStepBasic() — ui-ux-prototype.html:1990–2019
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/02-module-1.md
 *
 * TODO:
 * - Business name (required, >1 char), industry select (required, one of the
 *   seven BUSINESS_CATEGORIES), slogan (optional)
 * - Gate: Continue disabled until name + industry are filled
 */
export default function BasicInfoStep() {
  return (
    <div className="empty flex h-full flex-col items-center justify-center gap-1 text-center">
      <h2 className="h-lg">Basic Info</h2>
      <p className="body-sm">
        Not implemented yet — see CARD — Onboarding: Wizard Shell &amp; Step 1 Basic Info in
        02-module-1.md.
      </p>
    </div>
  );
}
