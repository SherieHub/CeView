/**
 * CARD — Performance: Previously Published & Post Analytics Modal
 * Depends on: Foundation — Performance Shell & Ingestion (M4-F), Module 3's Foundation — Shared Stores (M3-F0)
 * Prototype reference: openPostAnalytics() — ui-ux-prototype.html:3965-3996
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/05-module-4.md (M4-6)
 * Pseudocode: pseudocode/module-4/previously-published-post-analytics-modal.ts
 *
 * Only ever mounted by PreviouslyPublished.tsx while a post id is selected —
 * `open` is always true here. Uses Recharts for the reach chart (Related
 * Files note on this card: keep Recharts, not the prototype's miniLine()
 * SVG helper).
 */
import { useEffect, useState } from 'react';
import { apiClient } from '../../../services/apiClient';
import type { PublishedPost } from '../../../types';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Modal from '../../shared/Modal';
import { usePosts } from '../../../services/postStore';

interface PostAnalyticsModalProps {
  postId: string;
  onClose: () => void;
}

const STAT_LABELS = ['Reach', 'Likes', 'Comments', 'Shares', 'Engagement', 'Platform'] as const;

export default function PostAnalyticsModal({ postId, onClose }: PostAnalyticsModalProps) {
  const { metricsFor } = usePosts();
  const [fresh, setFresh] = useState<PublishedPost | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    apiClient.posts.metrics(postId).then((value) => { if (active) setFresh(value); })
      .catch(() => { if (active) setError('Unable to refresh post metrics.'); });
    return () => { active = false; };
  }, [postId]);
  const post = fresh ?? metricsFor(postId);

  if (!post) return null;

  const truncatedCaption = post.caption.length > 110 ? `${post.caption.slice(0, 110)}…` : post.caption;
  const stats = [
    post.reach?.toLocaleString() ?? 'Unavailable',
    post.likes?.toLocaleString() ?? 'Unavailable',
    post.comments?.toLocaleString() ?? 'Unavailable',
    post.shares?.toLocaleString() ?? 'Unavailable',
    post.engagementRate == null ? 'Unavailable' : `${post.engagementRate.toFixed(1)}%`,
    post.platform,
  ];
  const chartData = post.series.map((value, i) => ({ day: `Day ${i + 1}`, reach: value }));

  return (
    <Modal open onClose={onClose} title={`${post.platform} · ${post.date}`}>
      <p className="body-sm mb-4 max-w-[56ch]">{truncatedCaption}</p>

      {error && <p role="alert">{error}</p>}
      {post.metricsAvailable === false && <p role="status">Metrics unavailable: the platform has not supplied post metrics.</p>}
      <div className="mb-5 grid grid-cols-2 gap-3">
        {STAT_LABELS.map((label, i) => (
          <div key={label} className="rounded-md bg-mint-pale-alt p-3">
            <span className="text-meta block">{label}</span>
            <b className="num heading-sm">{post.metricsAvailable === false && i < 5 ? 'Unavailable' : stats[i]}</b>
          </div>
        ))}
      </div>

      <div>
        <p className="eyebrow mb-2">Reach accumulation — first 7 days</p>
        {post.metricsAvailable !== false && post.series.some((v) => v != null) ? (
          <div data-testid="reach-chart" className="h-[160px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} width={32} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="reach"
                  stroke="var(--color-mint-primary)"
                  fill="var(--color-mint-pale)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="empty py-6">
            <p className="body-sm">No data yet — this post hasn't accumulated reach.</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
