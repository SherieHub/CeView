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
 * Height-capped card (max 660px): it now sits alone as the Performance
 * screen's last band rather than paired with PesGauge, so it shrinks to fit
 * an empty or short list instead of holding a fixed 660px box open. A long
 * post history still scrolls internally instead of growing the card
 * (wheel/trackpad/scrollbar all work; no dedicated scroll buttons — the
 * native scrollbar shown by overflow-y-auto is affordance enough).
 *
 * KNOWN RUNTIME GAP: usePosts() throws unless a PostStoreProvider ancestor
 * exists. No PostStoreProvider is mounted in App.tsx yet (flagged when
 * services/postStore.tsx landed) — so this component will crash if reached
 * in the live app until that wiring is done. Out of this card's file scope.
 */
import { useState } from 'react';
import { ImageOff } from 'lucide-react';
import type { PlatformId } from '../../../types';
import { usePosts } from '../../../services/postStore';
import { BrandMark } from '../../module-3/3.1-content-studio/ContentBoard';
import PostAnalyticsModal from './PostAnalyticsModal';

type Filter = 'all' | PlatformId;

const TABS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
];

const PLATFORM_NAMES: Record<string, string> = { instagram: 'Instagram', tiktok: 'TikTok', facebook: 'Facebook', meta_ads: 'Meta Ads' };

const prettyDate = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

export default function PreviouslyPublished() {
  const { posts } = usePosts();
  const [filter, setFilter] = useState<Filter>('all');
  const [openPostId, setOpenPostId] = useState<string | null>(null);

  // Newest first, so the latest post is the first one compared.
  const published = (posts ?? [])
    .filter((p) => (p.status === 'published' || (p.status === 'inbox' && p.metricsAvailable === true)
      || (p.platform === 'meta_ads' && p.metricsAvailable === true && (p.reach ?? 0) > 0))
      && (filter === 'all' || p.platform === filter))
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="card pp">
      <div className="pp-head">
        <div>
          <h3 className="pp-title">Published Posts</h3>
          <p className="pp-sub">Your published content and what each post reached.</p>
        </div>
        <div role="group" aria-label="Platform filter" className="pp-filters">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              aria-pressed={filter === tab.value}
              onClick={() => setFilter(tab.value)}
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
        <ul className="pp-grid">
          {published.map((post) => (
            <li key={post.id}>
              <button type="button" className="pp-card" onClick={() => setOpenPostId(post.id)}>
                <span className="pp-thumb" aria-hidden="true">
                  {post.mediaUrl ? (post.mediaType === 'video' ? <video src={post.mediaUrl} muted playsInline preload="metadata" /> : <img src={post.mediaUrl} alt="" loading="lazy" />) : <ImageOff size={20} />}
                </span>
                <span className="pp-body">
                  <span className="pp-meta">
                    <BrandMark platform={post.platform} />
                    <span className="pp-platform">{PLATFORM_NAMES[post.platform] ?? post.platform}</span>
                    <span className="pp-date">{prettyDate(post.date)}</span>
                  </span>
                  <span className="pp-caption">{post.caption}</span>
                  <span className="pp-stats">
                    <span><b className="num">{post.reach != null ? post.reach.toLocaleString() : '—'}</b> reach</span>
                    <span><b className="num">{post.engagementRate != null ? `${post.engagementRate.toFixed(1)}%` : '—'}</b> engagement</span>
                    <span className="pp-view">View</span>
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {openPostId && <PostAnalyticsModal postId={openPostId} onClose={() => setOpenPostId(null)} />}
    </div>
  );
}
