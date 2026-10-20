/**
 * Stage 3 — the owner's hands-on part. Each accepted post arrives with its
 * caption, visual brief, platform and date already filled in; the owner adds
 * a real photo, runs the existing audit, and approves. A readiness strip says
 * where the campaign stands, each row names its own next step, and bulk
 * approval only covers posts whose audit actually passed.
 */
import { useState } from 'react';
import { ArrowRight, CheckCheck } from 'lucide-react';
import type { ContentResponse } from '@/types';
import { PlatformIcon } from '../ContentBoard';
import PreparePostDrawer from './PreparePostDrawer';
import { PREP_LABELS, activePosts, formatShortDate, prepState, sortedPosts } from './campaignTypes';
import type { CampaignDraft, PlannedPost, PrepState } from './campaignTypes';

export const PREP_ACTION: Record<PrepState, string> = {
  skipped: 'Restore',
  'needs-caption': 'Add caption',
  'needs-media': 'Add photo',
  'needs-audit': 'Run audit',
  'audit-failed': 'Fix issues',
  ready: 'Approve',
  approved: 'View',
};

interface PreparePostsProps {
  campaign: CampaignDraft;
  onPatchPost: (postId: string, patch: Partial<PlannedPost>) => void;
  content: ContentResponse | null;
  onFinalize: () => void;
}

export default function PreparePosts({ campaign: c, onPatchPost, content, onFinalize }: PreparePostsProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [shownId, setShownId] = useState<string | null>(null);

  const posts = sortedPosts(activePosts(c.posts));
  const states = posts.map(prepState);
  const count = (s: PrepState) => states.filter((x) => x === s).length;
  const approved = count('approved');
  const ready = posts.filter((p) => prepState(p) === 'ready');
  const post = c.posts.find((p) => p.id === shownId) ?? null;

  const open = (id: string) => {
    setShownId(id);
    setOpenId(id);
  };

  const strip = [
    { label: 'Approved', n: approved },
    { label: 'Ready to approve', n: count('ready') },
    { label: 'Need a photo or caption', n: count('needs-media') + count('needs-caption') },
    { label: 'Need an audit', n: count('needs-audit') + count('audit-failed') },
  ];

  return (
    <section className="cp-stage" aria-labelledby="cp-prepare-title">
      <header className="cp-stage-head cp-stage-head--row">
        <div>
          <h2 id="cp-prepare-title" className="cp-stage-title">Prepare &amp; Approve</h2>
          <p className="cp-stage-sub">Add your own photos, check each post with the audit, and approve it when it&rsquo;s ready.</p>
        </div>
        <button
          type="button"
          className="btn-outline btn-outline--sm"
          disabled={ready.length === 0}
          onClick={() => ready.forEach((p) => onPatchPost(p.id, { status: 'approved' }))}
        >
          <CheckCheck size={15} aria-hidden="true" /> Approve ready posts{ready.length ? ` (${ready.length})` : ''}
        </button>
      </header>

      <div className="cp-progress" aria-label="Preparation progress">
        <div className="cp-progress-bar">
          <span className="bar" aria-hidden="true">
            <i style={{ width: `${posts.length ? (approved / posts.length) * 100 : 0}%` }} />
          </span>
          <span className="num">
            <b>{approved}</b> of {posts.length} approved
          </span>
        </div>
        <ul className="cp-strip">
          {strip.map((s) => (
            <li key={s.label}>
              <b className="num">{s.n}</b> {s.label}
            </li>
          ))}
        </ul>
      </div>

      <ol className="cp-timeline">
        {posts.map((p) => {
          const st = prepState(p);
          return (
            <li key={p.id} className="cp-row" data-prep={st}>
              <span className="cp-row-date num">{formatShortDate(p.date)}</span>
              <PlatformIcon platform={p.platform} />
              <div className="cp-row-main">
                <span className="cp-row-title">{p.topic || 'Untitled post'}</span>
                <span className="cp-row-preview">{p.visual ? `Photo: ${p.visual}` : p.purpose}</span>
              </div>
              <span className="cp-status" data-prep={st}>{PREP_LABELS[st]}</span>
              <button
                type="button"
                className={st === 'ready' ? 'btn-primary btn-primary--sm' : 'btn-outline btn-outline--sm'}
                onClick={() => open(p.id)}
                aria-label={`${PREP_ACTION[st]}: ${p.topic || 'post'}`}
              >
                {PREP_ACTION[st]}
              </button>
            </li>
          );
        })}
      </ol>

      <footer className="cp-foot">
        <p className="cp-foot-note">
          Posts you haven&rsquo;t approved stay in the campaign to finish later. Nothing is scheduled or published from here.
        </p>
        <button type="button" className="btn-primary" onClick={onFinalize}>
          Finalize Campaign <ArrowRight size={16} aria-hidden="true" />
        </button>
      </footer>

      <PreparePostDrawer
        post={post}
        open={openId != null}
        onClose={() => setOpenId(null)}
        onPatch={(patch) => post && onPatchPost(post.id, patch)}
        content={content}
      />
    </section>
  );
}
