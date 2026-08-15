/**
 * CARD — Content Studio: Compliance Audit Panel
 * Depends on: Card 17 (Publish Composer)
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/04-module-3.md
 *
 * TODO — 3 states:
 * - Not-run-yet empty state
 * - Auditing — 6-step checklist animation (~420ms/step)
 * - Complete — OMCS radial gauge (color by score band), pass/fail chip at threshold 70,
 *   3 weighted sub-scores as bars with the formula shown verbatim, 7-row rubric table,
 *   feedback banner, consistency-explanation paragraph, "Re-run" button
 *
 * CompliancePanel.test.tsx: all 3 states (empty/auditing/complete) and the pass/fail
 * color branch.
 */
export default function CompliancePanel() {
  return (
    <div className="card empty flex h-full flex-col items-center justify-center gap-1 text-center">
      <h2 className="h-lg">Compliance Audit</h2>
      <p className="body-sm">
        Not implemented yet — see CARD — Content Studio: Compliance Audit Panel in
        04-module-3.md.
      </p>
    </div>
  );
}
