// ---- components/module-3/3.1-content-studio/CompliancePanel.tsx ----
imports: useEffect, useState, apiClient, OMCS_RUBRIC_LABELS + OmcsAuditResult type, OmcsGauge

const AUDIT_STEPS: [6 fixed step labels]
props: ComplianceSlotProps from './contentStudioTypes'  // { draft, audit, onAuditChange }
// The shell (M3-F1) owns audit state; this card drives it: on draft.agreementChecked
// becoming true with a caption and media staged, it walks the 6 steps calling
// onAuditChange({status:'running', step:n, result:null}) and finishes with
// onAuditChange({status:'complete', step:6, result: MOCK_OMCS}).
// It reads nothing from PublishComposer and no longer depends on M3-3.

function CompliancePanel({auditRunning, onAuditComplete}):
  state: step ← 0, result ← null

  on auditRunning becomes true:
    step ← 0, result ← null
    advance step every ~420ms
    on last step complete → apiClient.omcs.evaluate() → setResult, onAuditComplete(result)

  handleRerun(): step ← 0, result ← null  // re-triggers via parent-owned auditRunning flip

  render:
    if !auditRunning AND !result → empty "not run yet" placeholder (prereqs listed)
    if auditRunning AND !result → 6-step checklist (done/in-progress/inert per step index)
    if result:
      passed ← result.status === 'Pass'  // pass at score >= 70
      OmcsGauge(score, colored by band: green>=80, gold>=60, red below) +
      pass/fail chip + 3 weighted sub-score bars (0.35/0.45/0.20) + formula text +
      7-row rubric table (OMCS_RUBRIC_LABELS) + feedback banner + consistency explanation +
      Re-run button (calls handleRerun)
