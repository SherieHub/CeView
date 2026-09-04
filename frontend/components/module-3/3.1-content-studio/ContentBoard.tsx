import { CheckCircle2, LayoutList, Send } from 'lucide-react';
import { useState } from 'react';
import PanelHead from './PanelHead';
import type { PublishedPost } from '@/types';
import type { BoardSlotProps } from './contentStudioTypes';

type Filter = 'all' | 'draft' | 'published';
const FILTERS: Filter[] = ['all', 'draft', 'published'];

function PostCard({ post }: { post: PublishedPost }) {
  const published = post.status === 'published';
  return <article className="rounded-lg border border-gray-light bg-white p-4"><div className="flex items-center justify-between gap-3"><span className="capitalize text-sm font-semibold text-navy-dark">{post.platform === 'naver' ? 'Naver Blog' : post.platform}</span><span className={`rounded-full px-2 py-1 text-xs font-semibold ${published ? 'bg-mint-pale text-success' : 'bg-gray-light text-[var(--color-text-muted)]'}`}>{post.status}</span></div><p className="mt-3 line-clamp-3 text-sm leading-6 text-navy-dark">{post.caption}</p><div className="mt-3 flex gap-4 text-xs text-[var(--color-text-muted)]"><span>{post.date}</span>{published && <><span>Reach {post.reach.toLocaleString()}</span><span>Likes {post.likes.toLocaleString()}</span></>}</div></article>;
}

export default function ContentBoard({ draft, posts, canPublish, onPublished }: BoardSlotProps) {
  const [filter, setFilter] = useState<Filter>('all');
  const visible = filter === 'all' ? posts : posts.filter((post) => post.status === filter);
  return <section className="card" aria-labelledby="content-board-title">
    {/* The board's own action sits in the head's actions slot, on the title's
        baseline. It used to be a `btn btn--primary` — a class pair the
        stylesheet never defined — so the screen's single most consequential
        control rendered as an unstyled icon stacked over its label in the
        corner. It is the one publish action on this screen, which is what
        .btn-cta is for (§4: at most one per view). */}
    <PanelHead
      icon={<LayoutList />}
      titleId="content-board-title"
      title="Content board"
      subtitle="Review drafts and published content in one place."
      actions={
        <button type="button" className="btn-cta" disabled={!canPublish} title={canPublish ? 'Publish selected content' : 'Complete the composer and pass the audit to publish'} onClick={onPublished}>
          <Send size={16} />Publish {draft.platforms.length ? `to ${draft.platforms.length} platform${draft.platforms.length === 1 ? '' : 's'}` : ''}
        </button>
      }
    />
    <div className="mt-4 flex gap-2 border-b border-gray-light">{FILTERS.map((item) => <button type="button" key={item} onClick={() => setFilter(item)} className={`px-3 py-2 text-sm font-semibold capitalize ${filter === item ? 'border-b-2 border-teal-accent text-navy-dark' : 'text-[var(--color-text-muted)]'}`}>{item}</button>)}</div>{canPublish && <p className="mt-4 flex gap-2 rounded-lg bg-mint-pale p-3 text-sm text-navy-dark"><CheckCircle2 size={18} className="shrink-0 text-success" />Ready to publish after a successful compliance audit.</p>}<div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{visible.map((post) => <PostCard key={post.id} post={post} />)}</div></section>;
}
