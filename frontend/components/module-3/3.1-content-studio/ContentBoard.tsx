import { CheckCircle2, Send } from 'lucide-react';
import { useState } from 'react';
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
  return <section className="card" aria-labelledby="content-board-title"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><h2 id="content-board-title" className="heading-lg">Content board</h2><p className="body-sm">Review drafts and published content in one place.</p></div><button type="button" className="btn btn--primary" disabled={!canPublish} title={canPublish ? 'Publish selected content' : 'Complete the composer and pass the audit to publish'} onClick={onPublished}><Send size={16} />Publish {draft.platforms.length ? `to ${draft.platforms.length} platform${draft.platforms.length === 1 ? '' : 's'}` : ''}</button></div><div className="mt-5 flex gap-2 border-b border-gray-light">{FILTERS.map((item) => <button type="button" key={item} onClick={() => setFilter(item)} className={`px-3 py-2 text-sm font-semibold capitalize ${filter === item ? 'border-b-2 border-teal-accent text-navy-dark' : 'text-[var(--color-text-muted)]'}`}>{item}</button>)}</div>{canPublish && <p className="mt-4 flex gap-2 rounded-lg bg-mint-pale p-3 text-sm text-navy-dark"><CheckCircle2 size={18} className="shrink-0 text-success" />Ready to publish after a successful compliance audit.</p>}<div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{visible.map((post) => <PostCard key={post.id} post={post} />)}</div></section>;
}
