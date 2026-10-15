/**
 * Content Library — every draft and published post, as a compact list.
 *
 * Same data and actions as the former Content board: the All / Draft /
 * Published filter, and the Publish disclosure (hidden until a passing audit,
 * then opening the publish modal). Each row shows the platform, a clamped
 * caption, status, date and — for published posts — the metrics the record
 * carries. Nothing here is computed; it renders the PublishedPost records.
 */
import { CheckCircle2, Facebook, Inbox, Instagram, Send } from 'lucide-react';
import { useState } from 'react';
import { TikTokGlyph } from '../../shared/PlatformGlyphs';
import type { PublishedPost } from '@/types';
import type { BoardSlotProps } from './contentStudioTypes';

type Filter = 'all' | 'draft' | 'published';
const FILTERS: Filter[] = ['all', 'draft', 'published'];

const PLATFORM_NAMES: Record<string, string> = { instagram: 'Instagram', tiktok: 'TikTok', facebook: 'Facebook' };

export function PlatformIcon({ platform }: { platform: string }) {
  const Icon = platform === 'instagram' ? Instagram : platform === 'facebook' ? Facebook : null;
  return (
    <span className="lib-plat" data-platform={platform} aria-hidden="true">
      {Icon ? <Icon size={16} strokeWidth={1.75} /> : <TikTokGlyph size={15} />}
    </span>
  );
}

function PostCard({ post }: { post: PublishedPost }) {
  const published = post.status === 'published';
  return (
    <article className="post-card">
      <PlatformIcon platform={post.platform} />
      <div className="post-main">
        <div className="post-head">
          <span className="post-plat">{PLATFORM_NAMES[post.platform] ?? post.platform}</span>
          <span className="post-date num">{post.date}</span>
        </div>
        <p className="post-cap">{post.caption}</p>
      </div>
      <div className="post-facts">
        {published ? (
          <>
            <span className="num">
              <b>{post.reach.toLocaleString()}</b> reach
            </span>
            <span className="num">
              <b>{post.likes.toLocaleString()}</b> likes
            </span>
          </>
        ) : (
          <span className="post-facts-none">No results yet</span>
        )}
      </div>
      <span className={`chip ${published ? 'chip--success' : 'chip--muted'}`}>{post.status}</span>
    </article>
  );
}

export default function ContentBoard({ draft, posts, canPublish, onPublished }: BoardSlotProps) {
  const [filter, setFilter] = useState<Filter>('all');
  const visible = filter === 'all' ? posts : posts.filter((post) => post.status === filter);
  const count = (f: Filter) => (f === 'all' ? posts.length : posts.filter((p) => p.status === f).length);

  return (
    <section className="lib" aria-labelledby="content-board-title">
      <div className="studio-head">
        <div className="studio-head-text">
          <h2 id="content-board-title" className="heading-md">Content Library</h2>
          <p className="body-sm">All your drafts, published content, and campaign materials in one place.</p>
        </div>
        {/* Progressive disclosure: hidden, not disabled, until a passing audit. */}
        {canPublish && (
          <button
            type="button"
            className="btn-cta studio-head-act"
            title="Publish selected content"
            onClick={onPublished}
          >
            <Send size={16} aria-hidden="true" />
            Publish {draft.platforms.length ? `to ${draft.platforms.length} platform${draft.platforms.length === 1 ? '' : 's'}` : ''}
          </button>
        )}
      </div>

      <div className="seg" role="tablist" aria-label="Filter content">
        {FILTERS.map((item) => (
          <button
            type="button"
            key={item}
            role="tab"
            aria-selected={filter === item}
            onClick={() => setFilter(item)}
            className="capitalize"
          >
            {item} <span className="seg-count num">{count(item)}</span>
          </button>
        ))}
      </div>

      {canPublish && (
        <p className="studio-note mt-4">
          <CheckCircle2 size={18} aria-hidden="true" />
          Ready to publish after a successful compliance audit.
        </p>
      )}

      {visible.length === 0 ? (
        <div className="lib-empty">
          <span className="lib-empty-glyph" aria-hidden="true">
            <Inbox size={20} strokeWidth={1.75} />
          </span>
          <p className="lib-empty-title">
            {posts.length === 0 ? 'Nothing in your library yet' : `No ${filter} posts`}
          </p>
          <p className="lib-empty-sub">
            {posts.length === 0
              ? 'Posts you publish from Quick Post appear here.'
              : 'Switch the filter to see the rest of your content.'}
          </p>
        </div>
      ) : (
        <div className="post-grid mt-4">
          {visible.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </section>
  );
}
