/**
 * CARD — Settings: Workspace
 * Depends on: Foundation — Settings Shell (M3-F3)
 * Prototype reference: ui-ux-prototype.html:4203–4212
 * Screen doc: docs/shared/workspace.md
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/04-module-3.md (M3-10)
 *
 * Route: /settings/workspace
 *
 * TODO:
 * - Member list (avatar, name, email, role chip, "Invite pending" chip)
 * - Invite form (email + role select, Editor/Viewer only)
 * - Submitting appends a pending member row optimistically
 * - Flag, don't silently resolve: no invite acceptance/expiry/revocation modeled —
 *   real gaps, see docs/shared/workspace.md's "Behavior" section
 * - WorkspaceSettings.test.tsx: cover the invite-submit -> optimistic-row behavior
 */
export default function WorkspaceSettings() {
  return (
    <div className="empty flex h-full flex-col items-center justify-center gap-1 text-center">
      <h2 className="heading-lg">Workspace</h2>
      <p className="body-sm">
        Not implemented yet — see CARD — Settings: Workspace (M3-10) in 04-module-3.md.
      </p>
    </div>
  );
}
