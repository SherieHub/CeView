/**
 * CARD — Performance: Previously Published & Post Analytics Modal
 * Depends on: Foundation — Performance Shell & Ingestion (M4-F), Module 3's Foundation — Shared Stores (M3-F0)
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/05-module-4.md (M4-6)
 * Pseudocode: pseudocode/module-4/previously-published-post-analytics-modal.ts
 *
 * M3-F0 owns the shared post store; this card is a read-only consumer — no
 * dependency on any Content Studio feature card, only on M3-F0 and M4-F.
 *
 * Filter tabs are All/TikTok/Instagram/Facebook exactly as specced (not all
 * 4 PlatformId values — Naver has no tab here, per the card's own pseudocode
 * comment, not an oversight).
 *
 * KNOWN RUNTIME GAP: usePosts() throws unless a PostStoreProvider ancestor
 * exists. No PostStoreProvider is mounted in App.tsx yet (flagged when
 * services/postStore.tsx landed) — so this component will crash if reached
 * in the live app until that wiring is done. Out of this card's file scope.
 */
import { useState } from 'react';
import type { PlatformId } from '../../../types';
import { usePosts } from '../../../services/postStore';
import PostAnalyticsModal from './PostAnalyticsModal';

type Filter = 'all' | PlatformId;

const TABS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
];

export default function PreviouslyPublished() {
  const { posts } = usePosts();
  const [filter, setFilter] = useState<Filter>('all');
  const [openPostId, setOpenPostId] = useState<string | null>(null);

  const published = (posts ?? []).filter(
    (p) => p.status === 'published' && (filter === 'all' || p.platform === filter)
  );

  return (
    <div className="card flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="heading-md">Previously Published</h3>
        <div role="group" aria-label="Platform filter" className="inline-flex gap-1 rounded-pill bg-mint-pale p-1">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              aria-pressed={filter === tab.value}
              onClick={() => setFilter(tab.value)}
              className={`rounded-pill px-3 py-1.5 text-sm font-semibold transition-colors ${
                filter === tab.value ? 'bg-mint-primary text-navy-dark' : 'text-navy-primary hover:text-cyan-deep'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {published.length === 0 ? (
        <div className="empty py-6">
          <p className="body-sm">Nothing published yet for this filter.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {published.map((post) => (
            <button
              key={post.id}
              type="button"
              onClick={() => setOpenPostId(post.id)}
              className="flex items-center justify-between gap-3 rounded-md bg-mint-pale-alt px-4 py-3 text-left transition-colors hover:bg-mint-pale"
            >
              <div className="min-w-0">
                <p className="body-sm truncate">{post.caption}</p>
                <span className="text-meta">
                  {post.date} · {post.platform}
                </span>
              </div>
              <div className="flex shrink-0 gap-4">
                <span className="text-meta">
                  <b className="num">{post.reach ? post.reach.toLocaleString() : '—'}</b> Reach
                </span>
                <span className="text-meta">
                  <b className="num">{post.reach ? `${post.engagementRate.toFixed(1)}%` : '—'}</b> Eng.
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {openPostId && <PostAnalyticsModal postId={openPostId} onClose={() => setOpenPostId(null)} />}
    </div>
  );
}
