/**
 * DEV-PREVIEW fixtures for the Content Studio — used only by App.tsx's
 * /preview/content route, never by the authenticated app.
 *
 * ┌─ TEMPORARY. HOW TO DELETE ALL OF IT ─────────────────────────────────────┐
 * │ 1. Delete this file.                                                     │
 * │ 2. In App.tsx: drop the `previewFixtures` import and replace             │
 * │    <ContentPreviewScreen /> with <ContentStudioView />, then delete the  │
 * │    ContentPreviewScreen function.                                        │
 * │ 3. In ContentStudioView.tsx: delete the ContentStudioViewProps interface │
 * │    and take the component back to `export default function              │
 * │    ContentStudioView() {`, with useState(EMPTY_DRAFT) / useState(        │
 * │    MOCK_POSTS).                                                          │
 * │ Nothing else references it — `npx tsc --noEmit` will confirm.            │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Distinct from testFixtures.ts next door, which builds minimal shapes for
 * assertions. These are for looking at: the point is that /preview/content
 * shows every panel in its populated state without a backend, a login, or a
 * file picker.
 *
 * Without a seeded draft, three of the five panels on that screen are
 * unreachable in preview. The composer starts empty, and CompliancePanel only
 * leaves its idle prompt once a caption, media, a destination AND the
 * authorisation checkbox are all present — so the audit's stepper, the OMCS
 * dial and the rubric bars, which are the most designed objects on the screen,
 * could not be seen at all without staging a real image by hand every reload.
 *
 * Lives in module-3 rather than services/fixtures/ because PublishDraftState
 * is a module-3 type: putting it in services/ would make the shared fixture
 * layer depend on a component folder.
 */
import type { PublishedPost } from '../../../types';
import type { PublishDraftState } from './contentStudioTypes';
import { BRIEF_SEEN_KEY } from './useFirstRunDrawer';

/**
 * Stand-in publication media, inlined as an SVG data URI rather than shipped
 * as a binary asset: it keeps the fixture self-contained, costs no network
 * request, and survives `vite build` without an entry in the asset pipeline.
 *
 * Deliberately abstract — a golden-hour horizon in the brand's own palette,
 * not a photograph. A realistic stock beach photo in a fixture invites the
 * screenshot into a slide deck as though it were real operator content.
 */
const PREVIEW_MEDIA_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540" role="img" aria-label="Placeholder golden-hour horizon">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#124A52"/>
      <stop offset="55%" stop-color="#3CBDB1"/>
      <stop offset="100%" stop-color="#FFB88C"/>
    </linearGradient>
    <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0E7A7C"/>
      <stop offset="100%" stop-color="#15304C"/>
    </linearGradient>
  </defs>
  <rect width="960" height="330" fill="url(#sky)"/>
  <circle cx="670" cy="268" r="54" fill="#FF8C69" opacity="0.92"/>
  <rect y="330" width="960" height="150" fill="url(#sea)"/>
  <rect y="480" width="960" height="60" fill="#E4F6EF"/>
  <g fill="#FFFFFF" opacity="0.22">
    <rect y="352" width="960" height="3"/>
    <rect y="386" width="960" height="2"/>
    <rect y="418" width="960" height="2"/>
  </g>
</svg>`;

export const DEMO_MEDIA_DATA_URL = `data:image/svg+xml;utf8,${encodeURIComponent(PREVIEW_MEDIA_SVG)}`;

/**
 * A draft mid-flight: the Instagram storytelling caption already approved out
 * of the matrix, media staged, one destination chosen.
 *
 * `agreementChecked` is left FALSE on purpose. It is the trigger that starts
 * the audit, so seeding it true would run the six-step stepper on mount and
 * land on the finished result before the screen had finished painting —
 * skipping past the running state, which is itself worth previewing. Ticking
 * the box in the preview plays the whole sequence through.
 *
 * The caption is MOCK_CONTENT's third Instagram option verbatim, so the
 * composer shows exactly what approving that card would have staged.
 */
export const DEMO_DRAFT: PublishDraftState = {
  caption:
    'The water goes quiet first.\n\nThen the light shifts, and a wall of silver turns beneath you — a million sardines moving as one body, close enough to touch, thirty metres from where you had breakfast.\n\nYou surface. Nobody says anything for a while.\n\nThat is the moment people fly to Moalboal for. 힐링은 그렇게 시작됩니다.\n\nSunset Cove — link in bio 🌊\n\n#힐링여행 #세부여행 #모알보알 #사딘런 #OceanHealing',
  mediaDataUrl: DEMO_MEDIA_DATA_URL,
  platforms: ['instagram'],
  visibility: 'public',
  commentsEnabled: true,
  paidPartnership: false,
  agreementChecked: false,
};

/**
 * TEMPORARY. A fuller content board than MOCK_POSTS' six records, so the
 * three-column grid can be judged with enough cards to fill more than two
 * rows, and with the range of real content in it: one-line TikTok captions
 * next to multi-sentence Facebook copy, and five-figure reach next to a
 * zero-metric draft.
 *
 * Dates run backwards from the demo "today" (2026-08-20) so the board reads
 * as a history rather than as a set of records generated at once.
 */
export const DEMO_BOARD_POSTS: PublishedPost[] = [
  { id: 'd1', date: '2026-08-19', platform: 'instagram', caption: 'The water goes quiet first. Then the light shifts, and a wall of silver turns beneath you — a million sardines moving as one body, thirty metres from where you had breakfast.', status: 'published', reach: 52400, likes: 4870, comments: 233, shares: 1410, engagementRate: 12.4, series: [9, 18, 31, 44, 51, 52, 50] },
  { id: 'd2', date: '2026-08-18', platform: 'tiktok', caption: 'no thoughts. just sardines. 🐟🌊', status: 'published', reach: 118900, likes: 9240, comments: 412, shares: 3180, engagementRate: 11.1, series: [22, 55, 88, 108, 117, 119, 116] },
  { id: 'd4', date: '2026-08-14', platform: 'facebook', caption: 'Sunset Cove Beach Resort — Moalboal, Cebu. Direct shoreline access to the sardine run, visible year-round roughly 30 metres offshore.', status: 'published', reach: 24700, likes: 1680, comments: 240, shares: 590, engagementRate: 10.2, series: [7, 12, 18, 22, 24, 25, 24] },
  { id: 'd5', date: '2026-08-12', platform: 'instagram', caption: 'POV: you booked the 호캉스 you kept postponing 🌴 Sunset Cove, Moalboal — sardine run at sunrise, hammock by noon, zero notifications all day.', status: 'published', reach: 38100, likes: 3220, comments: 176, shares: 940, engagementRate: 11.4, series: [8, 16, 26, 33, 37, 38, 37] },
  { id: 'd6', date: '2026-08-11', platform: 'tiktok', caption: 'Moalboal, Cebu: the sardine run is visible year-round, 30m offshore. Certified marine biologist on every dive.', status: 'published', reach: 61200, likes: 4110, comments: 198, shares: 1520, engagementRate: 9.5, series: [14, 31, 46, 56, 60, 61, 60] },
  { id: 'd7', date: '2026-08-08', platform: 'facebook', caption: '호캉스 yet? 🌴 Sunset Cove sits 30 metres from the Moalboal sardine run — sunrise snorkel, hammock by noon, nothing else on the schedule.', status: 'published', reach: 19400, likes: 1240, comments: 151, shares: 402, engagementRate: 9.3, series: [5, 10, 14, 17, 19, 19, 18] },
  { id: 'd8', date: '2026-08-05', platform: 'instagram', caption: 'Sunset Cove Beach Resort — Moalboal, Cebu. 📍 Direct access to the sardine run. 🐢 Certified marine biologist on site. 📅 Peak Korean season: July–August and December–January.', status: 'published', reach: 27600, likes: 1930, comments: 104, shares: 511, engagementRate: 9.2, series: [6, 12, 19, 24, 27, 28, 27] },
  { id: 'd9', date: '2026-08-26', platform: 'facebook', caption: 'Golden Week bundle — flight + stay + guided dive, one price. Draft pending rate confirmation.', status: 'draft', reach: 0, likes: 0, comments: 0, shares: 0, engagementRate: 0, series: [] },
  { id: 'd11', date: '2026-08-30', platform: 'tiktok', caption: 'sunrise dive vs. sunset hammock — which one are you 🌅', status: 'draft', reach: 0, likes: 0, comments: 0, shares: 0, engagementRate: 0, series: [] },
  { id: 'd12', date: '2026-09-02', platform: 'instagram', caption: 'Shoulder-season rates open next week. Same reef, half the boats.', status: 'draft', reach: 0, likes: 0, comments: 0, shares: 0, engagementRate: 0, series: [] },
];

/**
 * TEMPORARY. Clears the campaign-brief FTUE flag so /preview/content replays
 * the first-run auto-open on every reload — the behaviour is one-shot by
 * design, which otherwise makes it impossible to look at twice.
 *
 * Imports BRIEF_SEEN_KEY rather than repeating the literal: a reset helper
 * that clears a stale key name would fail silently, and silently is the worst
 * way for a debugging aid to fail.
 *
 * Call it from the preview screen only. Delete with the rest of this file.
 */
export function resetBriefFtue(): void {
  try {
    localStorage.removeItem(BRIEF_SEEN_KEY);
  } catch {
    // Storage blocked — the FTUE will not auto-open anyway.
  }
}
