/**
 * Module 3.2 creative-direction fixture — backs ShotListAccordion and the
 * CampaignBriefDrawer's moodboard when
 * VITE_USE_FIXTURES=true.
 *
 * apiClient.creativeDirection.generate previously answered its fixture branch
 * with an inline `{ visualGuide: [], shots: [], moodboard: { palette: '',
 * references: [] } }`. That is a valid CreativeDirection, so nothing errored —
 * the board simply rendered its heading and its closing caveat with nothing in
 * between, which read as a finished empty state rather than as missing data.
 *
 * Continues the same fictional business as DEMO_BUSINESS / DEMO_PROFILE /
 * MOCK_CONTENT: Sunset Cove Beach Resort in Moalboal, targeting the Korean
 * market. The shot list deliberately answers MOCK_OMCS's
 * consistencyExplanation, which names the sardine run as "the caption's
 * strongest concrete claim [that] is not visible in the asset" — so the
 * direction leads with the shot that would close that gap. The two fixtures
 * are read side by side on this screen and should not contradict each other.
 */
import type { CreativeDirection } from '../../types';

export type { CreativeDirection };

export const MOCK_CREATIVE_DIRECTION: CreativeDirection = {
  visualGuide: [
    'Lead with the sardine run, not the room. It is the one thing no competitor on this coast can photograph, and the compliance check looks for it.',
    'Shoot the golden hour either side of the day — 06:00–07:00 and 17:00–18:30. Korean feeds skew toward soft, warm, low-contrast light; midday sun on white sand blows the highlights and reads as a stock photo.',
    'Keep one human element in frame — a hand on the rail, a silhouette entering the water, a towel left on a chair — so the viewer can project themselves into the shot rather than assess it.',
    'Shoot 4:5 for Instagram and 9:16 for TikTok natively. Do not crop a 16:9 frame down; the reframe is visible and TikTok demotes letterboxed footage.',
    'Leave the top-left eighth of every frame clear. That is where the platform chrome and your burned-in caption land.',
  ],
  shots: [
    {
      label: 'Hero — sardine run, mid-shoal',
      shotType: 'Hero',
      subject: 'Sardine Run, Mid-Shoal',
      placement: 'Underwater, 3–5 m down, positioned inside the bait ball.',
      action: 'Shoot upward so the silver wall reads against the surface light.',
      context: 'Opening frame for the carousel; first 0.8 seconds of the TikTok cut.',
      lighting:
        'Ambient only (sun behind the shoal). Strictly no strobe — it flattens the silver and scatters on particulate.',
      description:
        'Underwater, 3–5 m down, inside the bait ball rather than beside it. Shoot upward so the silver wall reads against the surface light. This is the opening frame of the carousel and the first 0.8 seconds of the TikTok cut.',
    },
    {
      label: 'Threshold — balcony doors to the sea',
      shotType: 'Threshold',
      subject: 'Balcony Doors to the Sea',
      placement: 'Inside the room looking out. Doors open, no people.',
      action: 'Expose for the water, allowing the interior to fall into natural shadow.',
      context: 'Frame must read as an invitation, not a standard room listing.',
      lighting:
        'Backlit, exposed for the horizon. Shoot between 17:30–18:00 for warm falloff without silhouetting the frame edges.',
      description:
        'From inside the room looking out, doors open, no people. The frame should read as an invitation rather than as a room listing. Expose for the water, let the interior fall into shadow.',
    },
    {
      label: 'Rest — hammock, mid-afternoon',
      shotType: 'Rest',
      subject: 'Hammock, Mid-Afternoon',
      placement: 'Eye level, six or seven metres back from the hammock.',
      action: 'Shoot it observed rather than staged — a paperback face-down, nobody in a hurry.',
      context: 'The unstructured-day promise made concrete.',
      lighting:
        'Open shade under palms, warm bounce off the sand. Avoid dappled light — it reads as noise at feed size.',
      description:
        'The unstructured-day promise made concrete: a hammock, a paperback face-down, nobody in a hurry. Shoot at eye level from six or seven metres back so it reads as observed rather than staged.',
    },
    {
      label: 'Credential — guided dive briefing',
      shotType: 'Credential',
      subject: 'Guided Dive Briefing',
      placement: 'At the boat, with the on-site marine biologist and a small group.',
      action: 'Keep faces legible and the group reading as briefed, not posed.',
      context: 'Supports the formal caption archetype, where the certification claim needs a picture behind it.',
      lighting: 'Overcast or early-morning flat light. No squinting into low sun.',
      description:
        'The on-site marine biologist briefing a small group at the boat. Supports the formal caption archetype, where the certification claim needs a picture to stand behind it.',
    },
  ],
  moodboard: {
    palette:
      'Warm, desaturated, salt-washed. Anchor on the sea greens and the golden-hour sand, and let white be the only bright value in frame. Hold saturation roughly 15% below native and lift the shadows slightly — Korean healing-travel feeds read heavy contrast as advertising.',
    references: [
      'Sea glass green',
      'Golden-hour sand',
      'Bleached driftwood',
      'Deep reef blue',
      'Coral sunset',
    ],
  },
};
