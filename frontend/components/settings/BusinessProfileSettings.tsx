/**
 * CARD — Settings: Business Profile
 * Depends on: Foundation — Shell & Routing, Foundation — Fixture Data Layer
 * Prototype reference: ui-ux-prototype.html:4217–4265
 * Screen doc: docs/module-1/screens/settings-business-profile.md
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/02-module-1.md
 *
 * Route: /settings/profile
 *
 * TODO:
 * - Identity header (avatar, name, industry, score chips)
 * - Flat form: name, slogan, categories toggle grid (same >=1-selected rule as onboarding),
 *   core services (read-only), description, UVP, website; single Save
 * - Flag, don't silently resolve: Save does not recompute the uniqueness score after an
 *   edit — the copy under Save currently claims it does. Raise in code review before
 *   wiring for real; see settings-business-profile.md's "Known gap" section.
 * - Save persists via apiClient.saveProfile and re-syncs the sidebar identity block
 *   without a page reload
 * - BusinessProfileSettings.test.tsx: cover the >=1-category-selected rule and Save->re-sync
 */
export default function BusinessProfileSettings() {
  return (
    <div className="empty flex h-full flex-col items-center justify-center gap-1 text-center">
      <h2 className="h-lg">Business Profile</h2>
      <p className="body-sm">
        Not implemented yet — see CARD — Settings: Business Profile in 02-module-1.md.
      </p>
    </div>
  );
}
