// ---- components/module-3/3.1-content-studio/PublishComposer.tsx ----
imports: ComposerSlotProps + PublishDraftState from './contentStudioTypes',
         useConnections from '../../../services/connectionsStore'

// The shell (M3-F1) owns the draft and the audit state; M3-F0 owns connection state and the
// disconnect event. This card owns the composer UI and the block-reason ladder only.

type BlockReason = 'caption'|'media'|'platform'|'agreement'|'audit-running'|'audit-missing'|'audit-failed'|null

function PublishComposer({ draft, onDraftChange, audit }: ComposerSlotProps):
  { isConnected } ← useConnections()

  setPubmatFile(file): onDraftChange({ mediaDataUrl: dataUrlOf(file) })
    // the shell resets a stale audit when media/caption/platforms change

  togglePlatform(id):
    if !isConnected(id) → no-op          // deviation from prototype v1 — not freely selectable
    else → onDraftChange({ platforms: toggled(draft.platforms, id) })

  toggleAgreement(): onDraftChange({ agreementChecked: !draft.agreementChecked })
    // M3-4 watches agreementChecked and runs the audit; this card never runs it

  blockReason ← first unmet gate, in priority order:
    1. !draft.caption → 'caption'
    2. !draft.mediaDataUrl → 'media'
    3. draft.platforms.length === 0 → 'platform'
    4. !draft.agreementChecked → 'agreement'
    5. audit.status === 'running' → 'audit-running'
    6. audit.result === null → 'audit-missing'
    7. audit.result.status !== 'Pass' → 'audit-failed'
    else → null

  render: staged caption textarea (onChange → onDraftChange({caption})) + char count for
          activePlatform's limit + pubmat dropzone + platform picker (rows for unconnected
          platforms render disabled with an inline Connect link to /settings/platforms) +
          3 config switches (visibility / comments / paid, no gate) + agreement checkbox +
          Publish button (disabled unless blockReason === null;
          tooltip = BLOCK_REASON_TEXT[blockReason])
  // The Publish button's click handler lives in M3-5 (ContentBoard); this card only reports
  // readiness through the shell's canPublish computation.
