/**
 * Per-post engagement metrics, derived from MOCK_POSTS so the two stay in step.
 *
 * Was declared inline in apiClient.ts while every other fixture lived here —
 * moved so the whole mock layer is one directory.
 */
import type { PostMetric } from '../../types';
import { MOCK_POSTS } from './posts';

export const MOCK_POST_METRICS: PostMetric[] = MOCK_POSTS.map((p, i) => ({
  postId: p.id,
  impressions: 1200 + i * 340,
  engagements: 80 + i * 21,
  clicks: 14 + i * 3,
  engagementRate: Number((0.04 + i * 0.006).toFixed(3)),
}));
