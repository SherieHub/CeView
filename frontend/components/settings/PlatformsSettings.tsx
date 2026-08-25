/**
 * CARD — Settings: Platforms
 * Depends on: Foundation — Settings Shell (M3-F3)
 * Prototype reference: ui-ux-prototype.html:4131–4202
 * Screen doc: docs/module-3/screens/settings-platforms.md
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/04-module-3.md (M3-9)
 *
 * Route: /settings/platforms
 * Gates: Content Studio's publish picker (see PublishComposer.tsx, Card 17)
 *
 * TODO:
 * - One row per platform, Verified+Disconnect or Connect
 * - Connect modal: redirecting spinner -> scope-grant list -> Grant scope -> connected toast
 * - Disconnect: immediate, toast; new rule — also removes that platform from Content
 *   Studio's in-progress "Publish to" selection if it was selected
 * - Connecting here must immediately unlock the platform in Content Studio's picker
 *   without a reload (shared state, not a re-fetch)
 * - PlatformsSettings.test.tsx: cover connect/disconnect state propagation and the
 *   cross-screen selection-removal rule
 */
export default function PlatformsSettings() {
  return (
    <div className="empty flex h-full flex-col items-center justify-center gap-1 text-center">
      <h2 className="heading-lg">Platforms</h2>
      <p className="body-sm">
        Not implemented yet — see CARD — Settings: Platforms (M3-9) in 04-module-3.md.
      </p>
    </div>
  );
}
