/**
 * CARD — Content Studio: Visual Direction Board
 * Depends on: Foundation — Content Studio Shell (M3-F1)
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/04-module-3.md (M3-2)
 *
 * TODO:
 * - Wire to the active platform tab from AIContentMatrixPanel.tsx
 * - Render pc.guide[] (numbered shot-list guidance) as numbered items
 *
 * VisualDirectionBoard.test.tsx: cover the platform-tab wiring.
 */
export default function VisualDirectionBoard() {
  return (
    <div className="card empty flex h-full flex-col items-center justify-center gap-1 text-center">
      <h2 className="heading-lg">Visual Direction Board</h2>
      <p className="body-sm">
        Not implemented yet — see CARD — Content Studio: Visual Direction Board in
        04-module-3.md.
      </p>
    </div>
  );
}
