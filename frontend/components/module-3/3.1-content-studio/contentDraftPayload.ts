/**
 * The shape Content Studio saves as a draft (the backend stores it as opaque JSON), and
 * the pure functions that build, validate and compare it.
 *
 * What is saved: the generated captions with their content direction (each platform's
 * `guide` rides inside `content`), the chosen option, the operator's edits, where they were in
 * Quick Post — and what they need to publish without redoing work: the attached media (as a
 * reference to the copy already uploaded to storage, never the bytes) and the compliance audit
 * result. What is not: the audit's in-progress state and shot slides (derived), and the
 * authorisation tick, which must be given again.
 *
 * The audit is only ever saved with the caption and media it was run for: editing either resets
 * the audit (see `patchDraft` in ContentStudioView), so an audit present at save time matches them.
 */
import type { ContentResponse, OmcsAuditResult, PublishAd } from '../../../types';
import type { AuditState, PublishDraftState, StudioPlatformId } from './contentStudioTypes';
import { STUDIO_PLATFORMS } from './contentStudioTypes';
import type { StudioStepId } from './studioSteps';
import { normalizeAd } from './adRules';

export const DRAFT_SCHEMA_VERSION = 1;

/**
 * A video's poster frame is a data URL. It is kept only while small, so a draft stays far below
 * the backend's 512 KB cap; without one the operator re-attaches that video.
 */
export const MAX_POSTER_CHARS = 120_000;

/** The composer fields that survive a restore. */
export interface SavedComposer {
  caption: string;
  captionEn: string | null;
  platforms: PublishDraftState['platforms'];
  visibility: PublishDraftState['visibility'];
  commentsEnabled: boolean;
  paidPartnership: boolean;
  ad?: PublishAd;
  scheduledFor?: string | null;
}

/** The attached media, as a reference to the copy already uploaded to storage. */
export interface SavedMedia {
  kind: 'image' | 'video';
  mediaId: string;
  publicUrl: string;
  /** A video's thumbnail frame, when small enough to keep. */
  posterDataUrl?: string | null;
}

export interface ContentDraftPayload {
  schemaVersion: typeof DRAFT_SCHEMA_VERSION;
  content: ContentResponse;
  activePlatform: StudioPlatformId;
  selectedOption: number | null;
  qpStep: StudioStepId;
  draft: SavedComposer;
  /** Absent in drafts saved before media was included. */
  media?: SavedMedia | null;
  /** The finished audit for exactly this caption and media. Absent in older drafts. */
  audit?: OmcsAuditResult | null;
  /** What the captions were generated for, so a draft can tell when it has gone stale. */
  meta: { alertId: string; windowOpenDate: string | null; profileFingerprint: string };
}

/** Everything that feeds caption generation besides the market itself. */
export function profileFingerprint(
  profile: { businessName: string; description: string; categories: string[] },
  trend: string,
): string {
  return [profile.businessName, profile.description, [...profile.categories].sort().join(','), trend].join('|');
}

function savedMedia(draft: PublishDraftState): SavedMedia | null {
  const upload = draft.mediaUpload;
  // Only media that has finished uploading exists anywhere but this browser.
  if (upload?.status !== 'ready') return null;
  const kind = draft.mediaType === 'video' ? 'video' : 'image';
  const media: SavedMedia = { kind, mediaId: upload.mediaId, publicUrl: upload.publicUrl };
  const poster = draft.mediaDataUrl;
  if (kind === 'video' && poster?.startsWith('data:') && poster.length <= MAX_POSTER_CHARS) {
    media.posterDataUrl = poster;
  }
  return media;
}

export function buildPayload(input: {
  content: ContentResponse;
  activePlatform: StudioPlatformId;
  selectedOption: number | null;
  qpStep: StudioStepId;
  draft: PublishDraftState;
  /** The audit as the panel holds it; saved only when complete (and only with media). */
  audit?: AuditState;
  alertId: string;
  windowOpenDate: string | null;
  fingerprint: string;
}): ContentDraftPayload {
  const { draft } = input;
  const media = savedMedia(draft);
  const audit = media && input.audit?.status === 'complete' ? input.audit.result : null;
  return {
    schemaVersion: DRAFT_SCHEMA_VERSION,
    content: input.content,
    activePlatform: input.activePlatform,
    selectedOption: input.selectedOption,
    // Validate is only worth resuming when there is something there: the media and its audit.
    qpStep: input.qpStep === 'validate' && !(media && audit) ? 'attach' : input.qpStep,
    draft: {
      caption: draft.caption,
      captionEn: draft.captionEn ?? null,
      platforms: draft.platforms,
      visibility: draft.visibility,
      commentsEnabled: draft.commentsEnabled,
      paidPartnership: draft.paidPartnership,
      ...(draft.ad ? { ad: draft.ad } : {}),
      scheduledFor: draft.scheduledFor ?? null,
    },
    media,
    audit,
    meta: { alertId: input.alertId, windowOpenDate: input.windowOpenDate, profileFingerprint: input.fingerprint },
  };
}

function parseMedia(raw: unknown): SavedMedia | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as Partial<SavedMedia>;
  if (m.kind !== 'image' && m.kind !== 'video') return null;
  if (typeof m.mediaId !== 'string' || !m.mediaId || typeof m.publicUrl !== 'string' || !m.publicUrl) return null;
  return {
    kind: m.kind,
    mediaId: m.mediaId,
    publicUrl: m.publicUrl,
    posterDataUrl: typeof m.posterDataUrl === 'string' ? m.posterDataUrl : null,
  };
}

function parseAudit(raw: unknown): OmcsAuditResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const a = raw as Partial<OmcsAuditResult>;
  if (a.status !== 'Pass' && a.status !== 'Fail') return null;
  if (typeof a.omcsScore !== 'number' || !Number.isFinite(a.omcsScore)) return null;
  if (!a.rubricEvaluationData || typeof a.rubricEvaluationData.scores !== 'object' || a.rubricEvaluationData.scores === null) {
    return null;
  }
  return a as OmcsAuditResult;
}

/**
 * A draft saved by an older or newer build, or damaged, is treated as no draft at all. A damaged
 * `media` or `audit` alone is dropped instead: the captions and edits are still worth restoring.
 */
export function parsePayload(raw: unknown): ContentDraftPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Partial<ContentDraftPayload>;
  if (p.schemaVersion !== DRAFT_SCHEMA_VERSION) return null;
  const captions = p.content?.captions;
  if (!captions) return null;
  for (const { id } of STUDIO_PLATFORMS) {
    if (!Array.isArray(captions[id]?.options)) return null;
  }
  if (!STUDIO_PLATFORMS.some((s) => s.id === p.activePlatform)) return null;
  if (!p.draft || typeof p.draft.caption !== 'string' || !p.meta) return null;

  const media = parseMedia(p.media);
  // An audit only means something beside the media it judged.
  const audit = media ? parseAudit(p.audit) : null;
  const restoredStep = p.qpStep === 'validate' && !(media && audit) ? 'attach' : p.qpStep;
  return { ...(p as ContentDraftPayload), media, audit, qpStep: restoredStep as StudioStepId };
}

/** The saved ad in today's shape (drafts from before targeting hold an older one), or no `ad` key. */
function adOf(saved: unknown): { ad?: PublishAd } {
  const ad = normalizeAd(saved);
  return ad ? { ad } : {};
}

/**
 * The composer state a saved draft restores to. The authorisation tick is never restored.
 *
 * Media comes back as the copy in storage: an image's preview is its public URL, a video plays
 * from its public URL and shows its saved poster (without one it cannot be previewed or
 * audited, so the operator re-attaches it).
 */
export function composerFromSaved(saved: SavedComposer, media?: SavedMedia | null): PublishDraftState {
  const base: PublishDraftState = {
    caption: saved.caption,
    captionEn: saved.captionEn,
    mediaDataUrl: null,
    platforms: saved.platforms,
    visibility: saved.visibility,
    commentsEnabled: saved.commentsEnabled,
    paidPartnership: saved.paidPartnership,
    ...adOf(saved.ad),
    scheduledFor: saved.scheduledFor ?? null,
    agreementChecked: false,
  };
  if (!media) return base;

  const mediaUpload = { status: 'ready' as const, mediaId: media.mediaId, publicUrl: media.publicUrl };
  if (media.kind === 'video') {
    return {
      ...base,
      mediaDataUrl: media.posterDataUrl ?? null,
      localVideoUrl: media.publicUrl,
      mediaType: 'video',
      mediaUpload,
    };
  }
  return { ...base, mediaDataUrl: media.publicUrl, mediaType: 'image', localVideoUrl: null, mediaUpload };
}

/** True when the captions were made for another surge window or from an older profile. */
export function isStale(payload: ContentDraftPayload, alertId: string, fingerprint: string): boolean {
  return payload.meta.alertId !== alertId || payload.meta.profileFingerprint !== fingerprint;
}
