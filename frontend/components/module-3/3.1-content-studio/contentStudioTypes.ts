import type { PlatformId } from '../../../types';
import type { OmcsAuditResult } from '../../../services/fixtures/omcs';
import type { PublishedPost } from '../../../services/fixtures/posts';

export interface PublishDraftState {
  caption: string;
  mediaDataUrl: string | null;
  platforms: PlatformId[];
  visibility: 'public' | 'private';
  commentsEnabled: boolean;
  paidPartnership: boolean;
  agreementChecked: boolean;
}

export type AuditStatus = 'idle' | 'running' | 'complete';
export interface AuditState {
  status: AuditStatus;
  step: number;
  result: OmcsAuditResult | null;
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
