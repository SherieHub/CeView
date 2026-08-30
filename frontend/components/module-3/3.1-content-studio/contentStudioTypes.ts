import type { PlatformId, OmcsAuditResult, PublishedPost } from '../../../types';

export interface PublishDraftState {
  caption: string;
  mediaDataUrl: string | null;
  platforms: PlatformId[];
  visibility: 'public' | 'private';
  commentsEnabled: boolean;
  paidPartnership: boolean;
  agreementChecked: boolean;
}

export type AuditStatus = 'idle' | 'running' | 'complete' | 'error';
export interface AuditState {
  status: AuditStatus;
  step: number;
  result: OmcsAuditResult | null;
  /** Present when status is 'error' — the rejected POST /api/compliance/omcs-analyze call. */
  error?: unknown;
}

export interface MatrixSlotProps {
  activePlatform: PlatformId;
  onPlatformChange: (platform: PlatformId) => void;
  onStageCaption: (caption: string) => void;
  stagedCaption: string;
}
export interface VisualDirectionSlotProps { activePlatform: PlatformId; }
export interface ComposerSlotProps {
  draft: PublishDraftState;
  onDraftChange: (patch: Partial<PublishDraftState>) => void;
  audit: AuditState;
}
export interface ComplianceSlotProps {
  draft: PublishDraftState;
  audit: AuditState;
  onAuditChange: (audit: AuditState) => void;
}
export interface BoardSlotProps {
  draft: PublishDraftState;
  posts: PublishedPost[];
  canPublish: boolean;
  onPublished: () => void;
}
