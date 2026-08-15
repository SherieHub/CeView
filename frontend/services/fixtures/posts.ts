/**
 * Module 3/4 published-post performance fixtures — transcribed from
 * ui-ux-prototype.html:1468–1475. Distinct from the leaner `SocialPost`
 * type in ../../types.ts (used by the Content Studio composer/board);
 * this richer shape backs Calendar's day-click modal and Performance's
 * "Previously Published" list / post-analytics modal.
 */
import type { PlatformId } from '../../types';

export interface PublishedPost {
  id: string;
  date: string;
  platform: PlatformId;
  caption: string;
  status: 'published' | 'draft';
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  engagementRate: number;
  series: number[];
}

export const MOCK_POSTS: PublishedPost[] = [
  { id: 'p1', date: '2026-08-04', platform: 'instagram', caption: 'POV: you booked the 호캉스 you kept postponing 🌴 Sunset Cove, Moalboal — sardine run at sunrise, hammock by noon.', status: 'published', reach: 31200, likes: 2810, comments: 142, shares: 890, engagementRate: 12.4, series: [8, 14, 22, 29, 31, 30, 28] },
  { id: 'p2', date: '2026-08-02', platform: 'tiktok', caption: 'no thoughts. just sardines. 🐟🌊 30m from breakfast, Moalboal', status: 'published', reach: 45400, likes: 3520, comments: 120, shares: 915, engagementRate: 10.0, series: [12, 26, 38, 44, 45, 43, 41] },
  { id: 'p3', date: '2026-07-30', platform: 'facebook', caption: 'Sunset Cove Beach Resort — Moalboal, Cebu. Direct shoreline access to the sardine run, visible year-round.', status: 'published', reach: 22100, likes: 1510, comments: 210, shares: 522, engagementRate: 10.1, series: [6, 11, 16, 20, 22, 22, 21] },
  { id: 'p4', date: '2026-07-28', platform: 'instagram', caption: 'The water goes quiet first. Then the light shifts, and a wall of silver turns beneath you.', status: 'published', reach: 18600, likes: 1180, comments: 64, shares: 301, engagementRate: 8.8, series: [5, 9, 13, 16, 18, 18, 17] },
  { id: 'p5', date: '2026-08-12', platform: 'facebook', caption: 'Golden Week bundle — flight + stay + guided dive, one price. Draft pending rate confirmation.', status: 'draft', reach: 0, likes: 0, comments: 0, shares: 0, engagementRate: 0, series: [] },
  { id: 'p6', date: '2026-08-18', platform: 'naver', caption: '세부에서 찾은 나만의 힐링 스팟 🌴 모알보알 선셋코브 리조트 후기입니다.', status: 'draft', reach: 0, likes: 0, comments: 0, shares: 0, engagementRate: 0, series: [] },
];
