/**
 * Module 3/4 published-post performance fixtures — transcribed from
 * ui-ux-prototype.html:1468–1475. Distinct from the leaner `SocialPost`
 * type in ../../types.ts (used by the Content Studio composer/board);
 * this richer shape backs Calendar's day-click modal and Performance's
 * "Previously Published" list / post-analytics modal.
 */
import type { PublishedPost } from '../../types';
import { thumbnailFor } from '../../content/image-credits';

export type { PublishedPost };

export const MOCK_POSTS: PublishedPost[] = [
  { id: 'p1', date: '2026-08-04', platform: 'instagram', caption: 'POV: you booked the 호캉스 you kept postponing 🌴 Sunset Cove, Moalboal — sardine run at sunrise, hammock by noon.', status: 'published', reach: 31200, likes: 2810, comments: 142, shares: 890, engagementRate: 12.4, mediaUrl: thumbnailFor('product-malapascua-beach'), series: [8, 14, 22, 29, 31, 30, 28] },
  { id: 'p2', date: '2026-08-02', platform: 'tiktok', caption: 'no thoughts. just sardines. 🐟🌊 30m from breakfast, Moalboal', status: 'published', reach: 45400, likes: 3520, comments: 120, shares: 915, engagementRate: 10.0, mediaUrl: thumbnailFor('who-dive'), series: [12, 26, 38, 44, 45, 43, 41] },
  { id: 'p3', date: '2026-07-30', platform: 'facebook', caption: 'Sunset Cove Beach Resort — Moalboal, Cebu. Direct shoreline access to the sardine run, visible year-round.', status: 'published', reach: 22100, likes: 1510, comments: 210, shares: 522, engagementRate: 10.1, mediaUrl: thumbnailFor('hero-cebu-coast'), series: [6, 11, 16, 20, 22, 22, 21] },
  { id: 'p4', date: '2026-07-28', platform: 'instagram', caption: 'The water goes quiet first. Then the light shifts, and a wall of silver turns beneath you.', status: 'published', reach: 18600, likes: 1180, comments: 64, shares: 301, engagementRate: 8.8, mediaUrl: thumbnailFor('who-dive'), series: [5, 9, 13, 16, 18, 18, 17] },
  { id: 'p5', date: '2026-08-12', platform: 'facebook', caption: 'Golden Week bundle — flight + stay + guided dive, one price. Draft pending rate confirmation.', status: 'draft', reach: 0, likes: 0, comments: 0, shares: 0, engagementRate: 0, mediaUrl: thumbnailFor('challenge-aerial-boats'), series: [] },
  // October: two published, four scheduled ahead — so the Calendar has a month to show.
  { id: 'po1', date: '2026-10-06', platform: 'instagram', caption: 'Golden hour from the cove deck. Nobody planned this one — the sky just did it.', status: 'published', reach: 27400, likes: 2310, comments: 118, shares: 604, engagementRate: 11.2, mediaUrl: thumbnailFor('product-malapascua-beach'), series: [7, 13, 20, 25, 27, 27, 26] },
  { id: 'po2', date: '2026-10-13', platform: 'facebook', caption: 'Weekday dive packages are back: two boat dives, lunch on the sandbar, and the sardine run on the way home.', status: 'published', reach: 16800, likes: 1040, comments: 96, shares: 312, engagementRate: 8.6, mediaUrl: thumbnailFor('challenge-aerial-boats'), series: [4, 8, 12, 15, 16, 17, 16] },
  { id: 'po3', date: '2026-10-21', platform: 'instagram', caption: 'Sardine season is here. Thirty metres from breakfast, a million fish moving as one.', status: 'scheduled', scheduledFor: '2026-10-21T09:00', reach: 0, likes: 0, comments: 0, shares: 0, engagementRate: 0, mediaUrl: thumbnailFor('who-dive'), series: [] },
  { id: 'po4', date: '2026-10-24', platform: 'tiktok', caption: 'pov: your morning commute is a boat ride 🚤🌊 #moalboal', status: 'scheduled', scheduledFor: '2026-10-24T18:30', reach: 0, likes: 0, comments: 0, shares: 0, engagementRate: 0, mediaUrl: thumbnailFor('challenge-aerial-boats'), series: [] },
  { id: 'po5', date: '2026-10-29', platform: 'facebook', caption: 'Planning a November trip from Seoul? Here is how to get from Mactan airport to Moalboal, step by step.', status: 'scheduled', scheduledFor: '2026-10-29T10:00', reach: 0, likes: 0, comments: 0, shares: 0, engagementRate: 0, mediaUrl: thumbnailFor('hero-cebu-coast'), series: [] },
  { id: 'po6', date: '2026-11-03', platform: 'instagram', caption: 'The slow, unplugged kind of morning: coffee, hammock, and the reef just past your feet.', status: 'scheduled', scheduledFor: '2026-11-03T08:00', reach: 0, likes: 0, comments: 0, shares: 0, engagementRate: 0, mediaUrl: thumbnailFor('product-malapascua-beach'), series: [] },
];
