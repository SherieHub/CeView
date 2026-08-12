/**
 * CARD — Onboarding: Step 4 Assets & Links
 * Depends on: Card 4 (Wizard Shell & Step 1)
 * Prototype reference: obStepAssets() — ui-ux-prototype.html:2110–2158
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/02-module-1.md
 *
 * TODO:
 * - 4 social handle inputs, logo dropzone (drag + click, base64 preview via FileReader), website input
 * - Gate: none — always valid
 * - AssetsLinksStep.test.tsx: cover logo file selection -> preview render
 */
export default function AssetsLinksStep() {
  return (
    <div className="empty flex h-full flex-col items-center justify-center gap-1 text-center">
      <h2 className="h-lg">Assets &amp; Links</h2>
      <p className="body-sm">
        Not implemented yet — see CARD — Onboarding: Step 4 Assets &amp; Links in 02-module-1.md.
      </p>
    </div>
  );
}
