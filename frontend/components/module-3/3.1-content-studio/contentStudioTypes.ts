import type { PlatformId, OmcsAuditResult, PublishedPost } from '../../../types';

/**
 * The platforms the Content Studio offers.
 *
 * A SUBSET of PlatformId. Naver Blog was removed from this screen, but the id
 * stays in the shared union because the API contract, the connections store and
 * Module 4's analytics all still carry it — narrowing the union would ripple
 * into the backend response types for a change that is only about this page.
 */
export type StudioPlatformId = Exclude<PlatformId, 'naver'>;

export const STUDIO_PLATFORMS: Array<{ id: StudioPlatformId; label: string }> = [
  { id: 'instagram', label: 'Instagram' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'facebook', label: 'Facebook' },
];


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

export interface ComposerSlotProps {
  draft: PublishDraftState;
  onDraftChange: (patch: Partial<PublishDraftState>) => void;
  audit: AuditState;
  /**
   * The platform being drafted for. The composer's character counter used to
   * read its limit from draft.platforms, but destination choice moved to the
   * publish modal, so that array is empty here and every caption was measured
   * against the 5000 fallback.
   */
  platform: StudioPlatformId;
  /** Increments each time an option is staged, to replay the highlight. */
  stageToken?: number;
  /**
   * Opens the visual-guide drawer. The composer offers it beside the upload
   * control, because that is where an operator who has not shot the asset yet
   * needs the shot list — and the drawer is now its only home.
   */
  onOpenBrief?: () => void;
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
