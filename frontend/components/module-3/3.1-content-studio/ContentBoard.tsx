import { CheckCircle2, Send } from 'lucide-react';
import { useState } from 'react';
import type { PublishedPost } from '@/types';
import type { BoardSlotProps } from './contentStudioTypes';

type Filter = 'all' | 'draft' | 'published';
const FILTERS: Filter[] = ['all', 'draft', 'published'];

/**
 * One record on the board. .post-card is .rank-card's object minus the button
 * affordances — these are records, not controls — with the caption sitting
 * under the same hairline .alert-card puts above its description.
 */
function PostCard({ post }: { post: PublishedPost }) {
  const published = post.status === 'published';
  return (
    <article className="post-card">
      <div className="post-head">
        <span className="post-plat">{post.platform}</span>
        {/* Colour-coded status pill: soft green for published, neutral grey
            for draft. A plain .chip is mint-pale, which paired the two as two
            shades of the same verdict rather than as opposites. */}
        <span className={`chip ${published ? 'chip--success' : 'chip--muted'}`}>{post.status}</span>
      </div>
      <p className="post-cap">{post.caption}</p>
      <div className="post-facts">
        <span>{post.date}</span>
        {published && (
          <>
            <span className="num">Reach {post.reach.toLocaleString()}</span>
            <span className="num">Likes {post.likes.toLocaleString()}</span>
          </>
        )}
      </div>
    </article>
  );
}

export default function ContentBoard({ draft, posts, canPublish, onPublished }: BoardSlotProps) {
  const [filter, setFilter] = useState<Filter>('all');
  const visible = filter === 'all' ? posts : posts.filter((post) => post.status === filter);

  return (
    <section className="card" aria-labelledby="content-board-title">
      {/* The Publish control rides the panel head rather than sitting above
          the filters as a separate row — .studio-head-act is the same
          trailing-control slot PageHead's actions use one level up. */}
      <div className="studio-head">
        <div className="studio-head-text">
          <h2 id="content-board-title" className="heading-md">Content board</h2>
          <p className="body-sm">Review drafts and published content in one place.</p>
        </div>
        {/* Progressive disclosure: hidden, not disabled. A greyed-out Publish
            invited the operator to hunt for what unlocks it; absent, the audit
            above is unambiguously the next thing to do. */}
        {canPublish && (
          <button
            type="button"
            className="btn-primary studio-head-act"
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
            {item}
          </button>
        ))}
      </div>

      {canPublish && (
        <p className="studio-note mt-4">
          <CheckCircle2 size={18} aria-hidden="true" />
          Ready to publish after a successful compliance audit.
        </p>
      )}

      <div className="post-grid mt-4">
        {visible.map((post) => <PostCard key={post.id} post={post} />)}
      </div>
    </section>
  );
}
