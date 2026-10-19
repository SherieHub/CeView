/**
 * One campaign post, prepared: the suggested visual beside the existing media
 * upload (PublishComposer part="media"), the caption, and the existing
 * six-step Compliance Audit (CompliancePanel) — reused as they are, scoring
 * rules untouched.
 *
 * Approval is the owner's, and is only offered once the audit has passed.
 * Editing the caption or media resets the audit and withdraws approval, the
 * same rule Quick Post applies, so an approved post is always the one audited.
 */
import { useCallback, useMemo, useRef } from 'react';
import { Check, ImageIcon, Undo2 } from 'lucide-react';
import Drawer from '../../../shared/Drawer';
import CompliancePanel from '../CompliancePanel';
import PublishComposer from '../PublishComposer';
import { CaptionTranslationToggle, EnglishEditBar } from '../CaptionTranslationToggle';
import { useEditableCaptionTranslation } from '../useCaptionTranslation';
import { PLATFORM_CHAR_LIMITS } from '../AIContentMatrixPanel';
import { STUDIO_PLATFORMS } from '../contentStudioTypes';
import type { AuditState, PublishDraftState } from '../contentStudioTypes';
import type { ContentResponse } from '@/types';
import { postAuditRecommendations } from './campaignRecommendations';
import { IDLE_AUDIT, PREP_LABELS, formatDate, prepState } from './campaignTypes';
import type { PlannedPost } from './campaignTypes';

interface PreparePostDrawerProps {
  post: PlannedPost | null;
  open: boolean;
  onClose: () => void;
  onPatch: (patch: Partial<PlannedPost>) => void;
  content: ContentResponse | null;
}

const NEXT_STEP: Record<string, string> = {
  'needs-caption': 'Add a caption to continue.',
  'needs-media': 'Add your own photo to run the audit.',
  'needs-audit': 'Run the audit below to check this post.',
  'audit-failed': 'The audit found issues. Adjust the caption or photo and run it again.',
};

export default function PreparePostDrawer({ post, open, onClose, onPatch, content }: PreparePostDrawerProps) {
  const state = post ? prepState(post) : null;

  // Both stable: CompliancePanel's step timer re-runs whenever either changes
  // identity, so fresh ones each render would restart it and could fire the
  // audit request twice.
  const recommendations = useMemo(
    () => (post ? postAuditRecommendations(content, post) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [content, post?.id, post?.platform, post?.caption, post?.visual],
  );
  const patchRef = useRef(onPatch);
  patchRef.current = onPatch;
  const onAuditChange = useCallback((audit: AuditState) => patchRef.current({ audit }), []);

  const draft: PublishDraftState | null = post
    ? {
        caption: post.caption,
        captionEn: post.captionEn,
        mediaDataUrl: post.mediaDataUrl,
        platforms: [post.platform],
        visibility: 'public',
        commentsEnabled: true,
        paidPartnership: false,
        agreementChecked: false,
      }
    : null;

  const onDraftChange = (patch: Partial<PublishDraftState>) => {
    const next: Partial<PlannedPost> = {};
    if ('mediaDataUrl' in patch) next.mediaDataUrl = patch.mediaDataUrl ?? null;
    if ('captionEn' in patch) next.captionEn = patch.captionEn ?? null;
    if ('caption' in patch && patch.caption !== undefined) {
      next.caption = patch.caption;
      next.captionOrigin = 'edited';
    }
    if ('caption' in next || 'mediaDataUrl' in next) {
      next.audit = IDLE_AUDIT;
      if (post?.status === 'approved') next.status = 'accepted';
    }
    if (Object.keys(next).length) onPatch(next);
  };

  const translation = useEditableCaptionTranslation(post?.caption ?? '', {
    knownEnglish: post?.captionEn,
    platform: post?.platform,
    onTranslated: (captionEn) => onDraftChange({ captionEn }),
    onApply: (caption, captionEn) => onDraftChange({ caption, captionEn }),
  });
  const viewingEnglish = translation.showing === 'english';

  const label = post ? STUDIO_PLATFORMS.find((p) => p.id === post.platform)?.label : '';
  const limit = post ? PLATFORM_CHAR_LIMITS[post.platform] : 0;

  return (
    <Drawer
      open={open && post != null}
      onClose={onClose}
      label={post ? `Prepare ${post.topic || 'post'}` : 'Prepare post'}
      footer={
        post &&
        state && (
          <div className="cp-drawer-foot">
            <span className="cp-status" data-prep={state}>{PREP_LABELS[state]}</span>
            {state === 'approved' ? (
              <button type="button" className="btn-outline btn-outline--sm" onClick={() => onPatch({ status: 'accepted' })}>
                <Undo2 size={14} aria-hidden="true" /> Return to editing
              </button>
            ) : (
              <button
                type="button"
                className="btn-primary btn-primary--sm"
                disabled={state !== 'ready'}
                onClick={() => {
                  onPatch({ status: 'approved' });
                  onClose();
                }}
              >
                <Check size={15} aria-hidden="true" /> Approve post
              </button>
            )}
          </div>
        )
      }
    >
      {post && draft && state && (
        <div className="cp-drawer cp-prep">
          <p className="cp-drawer-eyebrow">
            {label} · {formatDate(post.date)} · {post.purpose}
          </p>
          <h2 className="cp-drawer-heading">{post.topic || 'Untitled post'}</h2>
          {NEXT_STEP[state] && <p className="cp-next" role="status">{NEXT_STEP[state]}</p>}
          {state === 'approved' && (
            <p className="cp-next cp-next--ok" role="status">
              Approved by you. It isn&rsquo;t scheduled or published — campaign publishing isn&rsquo;t connected yet.
            </p>
          )}

          <div className="cp-visual-box">
            <span className="cp-visual-icon" aria-hidden="true"><ImageIcon size={18} /></span>
            <div>
              <p className="cp-box-label">Suggested photo or video</p>
              <p>{post.visual || 'No visual suggestion for this post.'}</p>
              <p className="cp-box-note">Use a real photo of your business — the audit checks it against your profile.</p>
            </div>
          </div>

          <div className="cp-prep-media">
            <PublishComposer
              draft={draft}
              onDraftChange={onDraftChange}
              audit={post.audit}
              platform={post.platform}
              part="media"
              uploadToStorage={false}
            />
          </div>

          <div className="cb-field">
            <div className="cp-field-head">
              <label htmlFor={`cp-prep-caption-${post.id}`}>Caption</label>
              <CaptionTranslationToggle state={translation} />
            </div>
            <textarea
              id={`cp-prep-caption-${post.id}`}
              className="textarea cp-caption"
              rows={7}
              lang={viewingEnglish ? 'en' : undefined}
              value={viewingEnglish ? translation.englishDraft : post.caption}
              onChange={(e) =>
                viewingEnglish
                  ? translation.setEnglishDraft(e.target.value)
                  : onDraftChange({ caption: e.target.value })
              }
            />
            <EnglishEditBar state={translation} />
            <div className="cp-field-foot">
              <span>{post.cta ? `Call to action: ${post.cta}` : ''}</span>
              <span className="num" data-over={post.caption.length > limit}>
                {post.caption.length.toLocaleString()} / {limit.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="cp-prep-audit">
            <CompliancePanel
              key={post.id}
              draft={draft}
              audit={post.audit}
              onAuditChange={onAuditChange}
              recommendations={recommendations}
            />
          </div>
        </div>
      )}
    </Drawer>
  );
}
