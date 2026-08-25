// ---- components/module-3/3.1-content-studio/contentStudioTypes.ts ----
import type { PlatformId } from '../../../types'
import type { OmcsAuditResult } from '../../../services/fixtures/omcs'

export interface PublishDraftState {
  caption: string
  mediaDataUrl: string | null
  platforms: PlatformId[]
  visibility: 'public' | 'private'
  commentsEnabled: boolean
  paidPartnership: boolean
  agreementChecked: boolean
}

export type AuditStatus = 'idle' | 'running' | 'complete'
export interface AuditState { status: AuditStatus; step: number; result: OmcsAuditResult | null }

// M3-1
export interface MatrixSlotProps {
  activePlatform: PlatformId
  onPlatformChange(p: PlatformId): void
  onStageCaption(text: string): void        // "Approve" copies the option's text into the draft
  stagedCaption: string
}
// M3-2
export interface VisualDirectionSlotProps { activePlatform: PlatformId }
// M3-3
export interface ComposerSlotProps {
  draft: PublishDraftState
  onDraftChange(patch: Partial<PublishDraftState>): void
  audit: AuditState
}
// M3-4
export interface ComplianceSlotProps {
  draft: PublishDraftState
  audit: AuditState
  onAuditChange(next: AuditState): void
}
// M3-5
export interface BoardSlotProps {
  draft: PublishDraftState
  canPublish: boolean
  onPublished(): void                        // shell resets draft + audit
}

// ---- components/module-3/3.1-content-studio/ContentStudioView.tsx ----
imports: useState, useEffect, useConnections, contentStudioTypes,
         AIContentMatrixPanel, VisualDirectionBoard, PublishComposer, CompliancePanel, ContentBoard

function useContentStudioState():
  state: activePlatform ← 'instagram'
         draft ← { caption: '', mediaDataUrl: null, platforms: [], visibility: 'public',
                   commentsEnabled: true, paidPartnership: false, agreementChecked: false }
         audit ← { status: 'idle', step: 0, result: null }
  patchDraft(patch): setDraft(d => ({ ...d, ...patch }))
    → if patch touches caption / mediaDataUrl / platforms, reset audit to idle (stale result)
  on connections.onDisconnect(p) → patchDraft({ platforms: draft.platforms.filter(x => x !== p) })
  reset(): draft ← initial, audit ← idle       // called after a successful publish
  returns { activePlatform, setActivePlatform, draft, patchDraft, audit, setAudit, reset }

function ContentStudioView():
  { activePlatform, setActivePlatform, draft, patchDraft, audit, setAudit, reset } ← useContentStudioState()
  canPublish ← draft.caption !== '' && draft.mediaDataUrl !== null
               && draft.platforms.length > 0 && draft.agreementChecked
               && audit.status === 'complete' && audit.result?.status === 'Pass'
  render:
    left column:  <AIContentMatrixPanel activePlatform onPlatformChange={setActivePlatform}
                    onStageCaption={t => patchDraft({ caption: t })} stagedCaption={draft.caption}/>
                  <VisualDirectionBoard activePlatform={activePlatform}/>
    right column: <PublishComposer draft={draft} onDraftChange={patchDraft} audit={audit}/>
                  <CompliancePanel draft={draft} audit={audit} onAuditChange={setAudit}/>
    below:        <ContentBoard draft={draft} canPublish={canPublish} onPublished={reset}/>

// ---- 3.1-content-studio/AIContentMatrixPanel.tsx (stub) ----
// ---- 3.1-content-studio/VisualDirectionBoard.tsx (stub) ----
// ---- 3.1-content-studio/PublishComposer.tsx (stub) ----
// ---- 3.1-content-studio/CompliancePanel.tsx (stub) ----
// ---- 3.1-content-studio/ContentBoard.tsx (stub) ----
each: typed against its Slot interface in contentStudioTypes.ts; renders the same
"Not implemented yet — see CARD M3-<n>" placeholder style the current stubs use.
Ownership of each transfers whole to the sibling card named in the comment above its interface.
