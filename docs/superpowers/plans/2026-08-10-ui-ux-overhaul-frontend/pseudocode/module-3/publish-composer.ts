// ---- components/module-3/3.1-content-studio/PublishComposer.tsx ----
imports: useState, PlatformId + PlatformConnection types, OmcsAuditResult type

props: { staged, onStagedChange, connections }  // connections from Card 22, gates platform picker

type BlockReason: 'caption'|'media'|'platform'|'agreement'|'audit-running'|'audit-missing'|'audit-failed'|null

function PublishComposer({staged, onStagedChange, connections}):
  state: pubmat ← null, publishPlatforms ← [], switches ← {visibility:true, comments:true, paid:false},
         agreed ← false, omcs ← null, auditRunning ← false

  resetAudit(): omcs ← null, agreed ← false
    // pubmat change, platform toggle, or staged-text edit all invalidate a stale audit

  setPubmatFile(file): pubmat ← file; resetAudit()

  togglePlatform(id):
    if connection for id not connected → no-op  // deviation from v1 — not freely selectable
    else → toggle id in publishPlatforms; resetAudit()

  toggleAgreement():
    agreed ← !agreed
    if agreed AND staged AND pubmat → auditRunning ← true  // triggers Card 18
    // unchecking does NOT undo a completed audit

  blockReason ← priority-ordered first unmet gate:
    1. !staged → 'caption'
    2. !pubmat → 'media'
    3. publishPlatforms.length===0 → 'platform'
    4. !agreed → 'agreement'
    5. auditRunning → 'audit-running'
    6. !omcs → 'audit-missing'
    7. omcs.status !== 'Pass' → 'audit-failed'
    else → null

  render: staged textarea + char count + pubmat dropzone + platform picker (disabled if not
          connected, shows Connect affordance) + 3 config switches (no gate) + agreement checkbox +
          Publish button (disabled unless blockReason===null; tooltip = BLOCK_REASON_TEXT[blockReason])
