/**
 * Stage 2 — the proposed posts as one compact timeline. A row carries only
 * date, platform, title, a one-line preview and status; everything else opens
 * in a side drawer for that one post (no nested wizard). "Accept Content Plan"
 * accepts every post still suggested in one action — accepting the plan is
 * not approval to publish, which comes after preparation.
 */
import { useState } from 'react';
import { Check, CircleSlash, Plus, RefreshCw, Sparkles, Undo2 } from 'lucide-react';
import Drawer from '../../../shared/Drawer';
import { PlatformIcon } from '../ContentBoard';
import { PLATFORM_CHAR_LIMITS } from '../AIContentMatrixPanel';
import { STUDIO_PLATFORMS } from '../contentStudioTypes';
import type { StudioPlatformId } from '../contentStudioTypes';
import { blankPost, dateRange, formatShortDate, sortedPosts } from './campaignTypes';
import type { CampaignDraft, PlannedPost } from './campaignTypes';

export const PLAN_STATUS_LABELS: Record<PlannedPost['status'], string> = {
  suggested: 'Suggested',
  accepted: 'Accepted',
  skipped: 'Skipped',
  approved: 'Approved',
};

interface ContentPlanReviewProps {
  campaign: CampaignDraft;
  onChange: (campaign: CampaignDraft) => void;
  /** Swaps in a caption the plan isn't using yet. Resolves false when none could be found. */
  onRegenerateCaption: (postId: string) => Promise<boolean>;
  onRegenerateVisual: (postId: string) => void;
  onRegeneratePlan: () => void;
  onAccept: () => void;
  /** Hand-built campaigns have no generated captions to fall back on. */
  generated: boolean;
}

function preview(p: PlannedPost): string {
  const text = p.caption.trim() || p.direction.trim();
  return text.split('\n').find((l) => l.trim()) ?? '';
}

export default function ContentPlanReview({
  campaign: c,
  onChange,
  onRegenerateCaption,
  onRegenerateVisual,
  onRegeneratePlan,
  onAccept,
  generated,
}: ContentPlanReviewProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  // The drawer keeps showing the last post while it slides shut.
  const [shownId, setShownId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [captionNote, setCaptionNote] = useState<string | null>(null);

  const posts = sortedPosts(c.posts);
  const post = c.posts.find((p) => p.id === shownId) ?? null;
  const live = posts.filter((p) => p.status !== 'skipped');
  const edited = c.posts.some((p) => p.captionOrigin === 'edited' || p.status !== 'suggested');

  const open = (id: string) => {
    setShownId(id);
    setOpenId(id);
    setCaptionNote(null);
  };
  const patchPost = (id: string, p: Partial<PlannedPost>) =>
    onChange({ ...c, posts: c.posts.map((x) => (x.id === id ? { ...x, ...p } : x)) });

  const addPost = () => {
    const p = { ...blankPost(c), topic: 'New post' };
    onChange({ ...c, posts: [...c.posts, p] });
    open(p.id);
  };

  const regenerateCaption = async () => {
    if (!post) return;
    if (post.captionOrigin === 'edited' && !window.confirm('Replace the caption you edited with a new one?')) return;
    setBusy(true);
    setCaptionNote(null);
    const ok = await onRegenerateCaption(post.id);
    setBusy(false);
    if (!ok) setCaptionNote('CeView couldn’t get a new caption just now. Try again, or write your own.');
  };

  const regeneratePlan = () => {
    if (edited && !window.confirm('Regenerate the whole plan? Your edits and accepted posts will be replaced.')) return;
    setOpenId(null);
    onRegeneratePlan();
  };

  const limit = post ? PLATFORM_CHAR_LIMITS[post.platform] : 0;

  return (
    <section className="cp-stage" aria-labelledby="cp-plan-title">
      <header className="cp-stage-head cp-stage-head--row">
        <div>
          <h2 id="cp-plan-title" className="cp-stage-title">Your Content Plan</h2>
          <p className="cp-stage-sub">
            {generated
              ? 'CeView has prepared what to post, when to post it, and what visuals to use.'
              : 'Your posts, by date. Open one to fill in its details.'}
          </p>
        </div>
        <div className="cp-head-acts">
          <button type="button" className="btn-outline btn-outline--sm" onClick={addPost}>
            <Plus size={15} aria-hidden="true" /> Add a post
          </button>
          {generated && (
            <button type="button" className="btn-outline btn-outline--sm" onClick={regeneratePlan}>
              <RefreshCw size={14} aria-hidden="true" /> Regenerate plan
            </button>
          )}
        </div>
      </header>

      <p className="cp-plan-meta">
        <b className="num">{live.length}</b> post{live.length === 1 ? '' : 's'} · {dateRange(c)} · {c.marketName || 'Any market'}
      </p>

      {posts.length === 0 ? (
        <div className="cb-empty">
          <p className="cb-empty-title">No posts in this plan yet</p>
          <p className="cb-empty-sub">Add a post for each moment in your campaign.</p>
        </div>
      ) : (
        <ol className="cp-timeline">
          {posts.map((p) => (
            <li key={p.id} className="cp-row" data-status={p.status}>
              <span className="cp-row-date num">{formatShortDate(p.date)}</span>
              <PlatformIcon platform={p.platform} />
              <div className="cp-row-main">
                <span className="cp-row-title">
                  {p.topic || 'Untitled post'}
                  <span className="cp-row-purpose">{p.purpose}</span>
                </span>
                <span className="cp-row-preview">{preview(p) || 'No caption yet'}</span>
              </div>
              <span className="cp-status" data-status={p.status}>
                {p.captionOrigin === 'edited' && p.status === 'suggested' ? 'Edited' : PLAN_STATUS_LABELS[p.status]}
              </span>
              <button type="button" className="btn-outline btn-outline--sm" onClick={() => open(p.id)} aria-label={`Review ${p.topic || 'post'}`}>
                Review
              </button>
            </li>
          ))}
        </ol>
      )}

      <footer className="cp-foot">
        <p className="cp-foot-note">
          Accepting the plan doesn&rsquo;t publish anything. You&rsquo;ll add your own photos and approve each post next.
        </p>
        <button type="button" className="btn-primary" onClick={onAccept} disabled={live.length === 0}>
          <Check size={16} aria-hidden="true" /> Accept Content Plan
        </button>
      </footer>

      <Drawer
        open={openId != null && post != null}
        onClose={() => setOpenId(null)}
        label={post?.topic || 'Post'}
        footer={
          post && (
            <div className="cp-drawer-foot">
              {post.status === 'skipped' ? (
                <button type="button" className="btn-outline btn-outline--sm" onClick={() => patchPost(post.id, { status: 'suggested' })}>
                  <Undo2 size={14} aria-hidden="true" /> Restore post
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-outline btn-outline--sm"
                  onClick={() => {
                    patchPost(post.id, { status: 'skipped' });
                    setOpenId(null);
                  }}
                >
                  <CircleSlash size={14} aria-hidden="true" /> Skip
                </button>
              )}
              {post.status !== 'skipped' && (
                <button
                  type="button"
                  className="btn-primary btn-primary--sm"
                  onClick={() => {
                    patchPost(post.id, { status: post.status === 'approved' ? 'approved' : 'accepted' });
                    setOpenId(null);
                  }}
                >
                  <Check size={15} aria-hidden="true" /> Accept
                </button>
              )}
            </div>
          )
        }
      >
        {post && (
          <div className="cp-drawer">
            <p className="cp-drawer-eyebrow">{post.purpose}</p>
            <label className="cb-field">
              <span className="sr-only">Post title</span>
              <input
                className="cp-drawer-title"
                value={post.topic}
                onChange={(e) => patchPost(post.id, { topic: e.target.value })}
                aria-label="Post title"
              />
            </label>

            <div className="cp-drawer-row">
              <label className="cb-field">
                <span>Date</span>
                <input
                  className="input"
                  type="date"
                  value={post.date}
                  onChange={(e) => e.target.value && patchPost(post.id, { date: e.target.value })}
                />
              </label>
              <label className="cb-field">
                <span>Platform</span>
                <select
                  className="input"
                  value={post.platform}
                  onChange={(e) => patchPost(post.id, { platform: e.target.value as StudioPlatformId })}
                >
                  {STUDIO_PLATFORMS.map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="cp-why-box">
              <p className="cp-box-label">Why this post?</p>
              <p>{post.why}</p>
            </div>

            <label className="cb-field">
              <span>Content direction</span>
              <textarea
                className="textarea"
                rows={2}
                value={post.direction}
                onChange={(e) => patchPost(post.id, { direction: e.target.value })}
              />
            </label>

            <div className="cb-field">
              <div className="cp-field-head">
                <label htmlFor={`cp-caption-${post.id}`}>Recommended caption</label>
                {generated && (
                  <button type="button" className="link-inline" onClick={regenerateCaption} disabled={busy}>
                    <Sparkles size={13} aria-hidden="true" /> {busy ? 'Getting a new caption…' : 'Regenerate caption'}
                  </button>
                )}
              </div>
              <textarea
                id={`cp-caption-${post.id}`}
                className="textarea cp-caption"
                rows={7}
                value={post.caption}
                onChange={(e) => patchPost(post.id, { caption: e.target.value, captionOrigin: 'edited' })}
                placeholder={generated ? 'No caption generated for this post — regenerate one or write your own.' : 'Write a caption for this post.'}
              />
              <div className="cp-field-foot">
                <span>
                  {post.captionOrigin === 'generated'
                    ? `Drafted by CeView’s caption generator for ${c.marketName}. Check it fits this post.`
                    : post.captionOrigin === 'edited'
                      ? 'Edited by you.'
                      : ''}
                </span>
                <span className="num" data-over={post.caption.length > limit}>
                  {post.caption.length.toLocaleString()} / {limit.toLocaleString()}
                </span>
              </div>
              {captionNote && <p className="cp-inline-error" role="alert">{captionNote}</p>}
            </div>

            <div className="cb-field">
              <div className="cp-field-head">
                <label htmlFor={`cp-visual-${post.id}`}>Recommended visual</label>
                {generated && (
                  <button type="button" className="link-inline" onClick={() => onRegenerateVisual(post.id)}>
                    <RefreshCw size={12} aria-hidden="true" /> Another idea
                  </button>
                )}
              </div>
              <textarea
                id={`cp-visual-${post.id}`}
                className="textarea"
                rows={2}
                value={post.visual}
                onChange={(e) => patchPost(post.id, { visual: e.target.value })}
                placeholder="What photo or video should go with this post?"
              />
            </div>

            <label className="cb-field">
              <span>Call to action</span>
              <input className="input" value={post.cta} onChange={(e) => patchPost(post.id, { cta: e.target.value })} />
            </label>
          </div>
        )}
      </Drawer>
    </section>
  );
}
