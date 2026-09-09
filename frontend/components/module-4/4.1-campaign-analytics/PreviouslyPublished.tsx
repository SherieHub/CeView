/**
 * CARD — Performance: Previously Published & Post Analytics Modal
 * Depends on: Foundation — Performance Shell & Ingestion (M4-F), Module 3's Foundation — Shared Stores (M3-F0)
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/05-module-4.md (M4-6)
 * Pseudocode: pseudocode/module-4/previously-published-post-analytics-modal.ts
 *
 * M3-F0 owns the shared post store; this card is a read-only consumer — no
 * dependency on any Content Studio feature card, only on M3-F0 and M4-F.
 *
 * Filter tabs are All/TikTok/Instagram/Facebook exactly as specced — one tab
 * per PlatformId, plus All.
 *
 * Fixed-height card (matches PesGauge, which it's paired with in
 * CampaignAnalyticsView.tsx — both are 660px, sized to fit PesGauge's own
 * fixed content) so the two stay the same size regardless of how many posts
 * exist — the post list scrolls internally instead of growing the card
 * (wheel/trackpad/scrollbar all work; no dedicated scroll buttons — the
 * native scrollbar shown by overflow-y-auto is affordance enough).
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
    <div className="card flex h-[660px] flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="heading-md">Previously Published</h3>
        <div role="group" aria-label="Platform filter" className="inline-flex flex-wrap gap-1 rounded-pill bg-mint-pale p-1">
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

      {/* flex-1 + min-h-0 is what lets this area actually shrink to fit the
          fixed-height card instead of forcing the card to grow with it —
          without min-h-0 a flex child never shrinks below its content size. */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {published.length === 0 ? (
          <div className="empty py-6">
            <p className="body-sm">Nothing published yet for this filter.</p>
          </div>
        ) : (
          // Matches Content Studio's ContentBoard post-card style: bordered
          // tile, platform + status pill, caption preview, meta row — so a
          // published post reads the same way wherever it's shown.
          <div className="flex flex-col gap-3">
            {published.map((post) => (
              <button
                key={post.id}
                type="button"
                onClick={() => setOpenPostId(post.id)}
                className="flex flex-col rounded-lg border border-gray-light bg-white p-4 text-left transition-colors hover:border-teal-accent"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="capitalize text-sm font-semibold text-navy-dark">{post.platform}</span>
                  <span className="rounded-full bg-mint-pale px-2 py-1 text-xs font-semibold text-success">
                    published
                  </span>
                </div>
                <p className="mt-3 line-clamp-3 text-sm leading-6 text-navy-dark">{post.caption}</p>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-text-muted)]">
                  <span>{post.date}</span>
                  <span>Reach {post.reach ? post.reach.toLocaleString() : '—'}</span>
                  <span>Eng. {post.reach ? `${post.engagementRate.toFixed(1)}%` : '—'}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {openPostId && <PostAnalyticsModal postId={openPostId} onClose={() => setOpenPostId(null)} />}
    </div>
  );
}
