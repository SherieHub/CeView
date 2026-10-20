/**
 * The Visual guide's slides — shots for THIS caption, not a general catalogue.
 *
 * Two sources, best first:
 *  1. The AI shot list (POST /api/creative-direction/generate), once the
 *     owner has approved the market's captions — real, caption-specific.
 *  2. Until then, the caption itself: each slide is a moment the caption
 *     actually mentions ("sardine run at sunrise", "hammock by noon"), matched
 *     against the shot library below, quoting the line it illustrates. If the
 *     caption names fewer than four, the platform's AI visual guide lines
 *     (POST /api/content/generate → captions[platform].guide) fill the rest.
 *
 * The inspiration photos are MOCK: licensed Cebu photos the landing page
 * already ships (content/image-credits.ts, credited in the UI), standing in
 * until a service returns example imagery. The UI labels them as examples.
 */
import type { ImageSlot } from '../../../content/image-credits';
import type { CreativeDirection } from '../../../types';

export const SLIDE_COUNT = 4;

/**
 * MOCK generation time. "Generate AI shots" stands in for a real generation
 * request; until that service exists the shots are built locally and revealed
 * after this delay. Replace the timer in ContentStudioView with the request.
 */
export const MOCK_GENERATION_MS = 1800;

export type ShotsState = 'idle' | 'loading' | 'ready';

export type SlideSource = 'ai' | 'caption' | 'guide';

export interface ShotSlide {
  id: string;
  source: SlideSource;
  title: string;
  /** The words in the caption this shot illustrates. */
  quote?: string;
  /** Camera position and framing, in a phrase. */
  angle?: string;
  steps: string[];
  lighting?: string;
  /** Mock inspiration photo. */
  slot: ImageSlot;
}

interface ShotIdea {
  id: string;
  /** Lower-case; matched as substrings, so stems ("snorkel") cover variants. */
  keywords: string[];
  slot: ImageSlot;
  title: string;
  angle: string;
  steps: string[];
  lighting: string;
}

const IDEAS: ShotIdea[] = [
  {
    id: 'shoal',
    keywords: ['sardine', 'shoal', 'school of fish', 'wall of silver', 'million fish', '정어리', 'イワシ'],
    slot: 'who-dive',
    title: 'Inside the sardine run',
    angle: 'Underwater, level with the shoal, looking along it',
    steps: [
      'Use an action camera or a phone in a rated waterproof case, on a guided swim.',
      'Stay level with the shoal and shoot along its length so it fills the frame edge to edge.',
      'Hold still and let the fish turn around you — chasing them scatters the shape.',
    ],
    lighting: 'Shallow water before 10 am, sun behind you, so the silver flashes.',
  },
  {
    id: 'turtle',
    keywords: ['turtle', '거북', 'ウミガメ', '🐢'],
    slot: 'product-sea-turtle',
    title: 'The turtle encounter',
    angle: 'Close, at the turtle’s eye level, from the side',
    steps: [
      'Keep a respectful distance — never touch, block or chase wildlife.',
      'Drop to its level rather than shooting down on its shell.',
      'Take a burst as it glides past and keep the sharpest frame.',
    ],
    lighting: 'Sunny, shallow water; cloud and depth turn everything blue-grey.',
  },
  {
    id: 'snorkel',
    keywords: ['snorkel', '스노클', 'スノーケル', 'reef', 'surface', 'swim'],
    slot: 'howitworks-ocean-texture',
    title: 'Reef from the surface',
    angle: 'Split-level or straight down from the surface',
    steps: [
      'Float face-down and point the camera straight at the reef below.',
      'For a split shot, hold the lens half in, half out of the water, on a calm day.',
      'Include a fin or hand at the frame edge for scale.',
    ],
    lighting: 'Midday, when the sun is overhead and the shallows glow.',
  },
  {
    id: 'dive-guide',
    keywords: ['dive', 'diving', 'scuba', 'marine biologist', 'instructor', 'briefed', '다이빙', 'ダイビング'],
    slot: 'who-dive',
    title: 'Your guide at work',
    angle: 'Medium shot, beside the diver, looking where they look',
    steps: [
      'Ask permission and get a signed OK from anyone identifiable.',
      'Frame from beside or slightly behind, so the viewer follows their gaze.',
      'Show the briefing on the boat too — it proves the safety the caption promises.',
    ],
    lighting: 'Even light near the surface; avoid the noon glare on the boat deck.',
  },
  {
    id: 'sunrise',
    keywords: ['sunrise', 'sunset', 'golden hour', 'dawn', 'dusk', '일출', '노을', '朝日', '夕日'],
    slot: 'demo-side',
    title: 'First light on the water',
    angle: 'Low and wide, from the shoreline, facing the sun',
    steps: [
      'Arrive 20 minutes early and set up low, close to the sand.',
      'Put the horizon on the lower third so the sky does the work.',
      'Tap to expose for the sky, then lift the shadows slightly.',
    ],
    lighting: 'The 15 minutes around sunrise or sunset — warm, low and long.',
  },
  {
    id: 'rest',
    keywords: ['hammock', 'relax', 'slow morning', 'nap', 'lounging', 'healing', '힐링', '휴식', 'zero notifications', 'unplug', 'nobody says', 'quiet'],
    slot: 'product-malapascua-beach',
    title: 'The slow, unplugged moment',
    angle: 'Medium shot from behind the guest, toward the sea',
    steps: [
      'Show a guest resting — in a hammock, on a lounger — from behind or the side, face not needed.',
      'Leave the phone out of frame: the point is having nowhere to be.',
      'Let the sea and palms take two-thirds of the frame.',
    ],
    lighting: 'Late morning shade, or soft late-afternoon light.',
  },
  {
    id: 'boat',
    keywords: ['boat', 'bangka', 'island hopping', 'engine', '보트', 'ボート'],
    slot: 'challenge-aerial-boats',
    title: 'Arriving by boat',
    angle: 'From the bow, looking ahead to the shore',
    steps: [
      'Sit at the front of the boat and frame the bow and the approaching shore together.',
      'Shoot the moment the engine cuts and the boat drifts in.',
      'Brace your elbows — boats rock; take several frames.',
    ],
    lighting: 'Morning, sun behind the boat, so the water stays clear and blue.',
  },
  {
    id: 'stay',
    keywords: ['호캉스', 'resort', 'villa', 'room', 'hotel', 'pool', 'staycation', 'balcony', '숙소', 'ホテル'],
    slot: 'who-resort',
    title: 'The stay itself',
    angle: 'Wide, from a corner at chest height — or from inside looking out',
    steps: [
      'Tidy first: make the bed, hide cables, open every curtain.',
      'Shoot from a corner at chest height, phone held straight, so walls stay vertical.',
      'Frame the sea through the balcony doors so the room reads as an invitation.',
    ],
    lighting: 'Daylight with all lights on; no flash.',
  },
  {
    id: 'shoreline',
    keywords: ['shoreline', 'beach', 'coast', 'metres', 'meters', 'offshore', 'water', 'sea', '바다', '해변', '海'],
    slot: 'hero-cebu-coast',
    title: 'How close the sea is',
    angle: 'Wide, eye level, from your doorstep to the water',
    steps: [
      'Stand at your property and include both it and the water in one frame.',
      'Keep the horizon level on the upper third.',
      'A small figure or boat gives scale without stealing focus.',
    ],
    lighting: 'Mid-morning or late afternoon, sun beside you, so the water reads turquoise.',
  },
  {
    id: 'food',
    keywords: ['breakfast', 'food', 'eat', 'lunch', 'dinner', 'seafood', 'restaurant', 'café', 'cafe', '맛집', '음식', '朝食', '料理'],
    slot: 'who-food',
    title: 'At the table',
    angle: 'Close-up, 45° or straight down',
    steps: [
      'Fill the frame with one real dish you serve.',
      'Add hands reaching in or serving — it shows the meal being enjoyed.',
      'Keep the background simple; wipe plate edges.',
    ],
    lighting: 'Window light or open shade — never the flash.',
  },
  {
    id: 'eco',
    keywords: ['eco', 'sustainab', 'certified', 'conservation', 'reef-safe'],
    slot: 'howitworks-ocean-texture',
    title: 'Proof of your eco promise',
    angle: 'Detail close-up, then a wide context shot',
    steps: [
      'Photograph the real evidence — the certificate, a reef-safe station, a clean-up.',
      'Pair it with a wide of the healthy reef or beach it protects.',
      'Only show what you actually do; it’s a claim guests can check.',
    ],
    lighting: 'Soft daylight; avoid glare on certificates or signs.',
  },
  {
    id: 'island-view',
    keywords: ['island', 'lagoon', 'sandbar', 'aerial', 'drone', 'cliff'],
    slot: 'cta-aerial-ocean',
    title: 'The island from above',
    angle: 'Top-down or 45° from above',
    steps: [
      'Use a drone only where allowed — or shoot from a hillside or viewpoint.',
      'Leave open water around the island so its shape stands out.',
      'Tilt to 45° to show the island against the sea and sky.',
    ],
    lighting: 'Around midday, when the shallows are brightest.',
  },
  {
    id: 'waterfall',
    keywords: ['waterfall', 'falls', 'canyon', 'kawasan', '폭포', '滝'],
    slot: 'who-adventure',
    title: 'The falls',
    angle: 'Low, from the pool’s edge, looking up',
    steps: [
      'Get low near the water and tilt up so the falls feel tall.',
      'Include a swimmer for scale.',
      'Wipe spray off the lens between shots.',
    ],
    lighting: 'Overcast or early morning, so the pool isn’t blown out.',
  },
  {
    id: 'heritage',
    keywords: ['temple', 'church', 'heritage', 'history', 'old town', 'basilica', '사원', '寺', '歴史'],
    slot: 'price-taoist-temple',
    title: 'The landmark',
    angle: 'Low angle, looking slightly up',
    steps: [
      'Crouch and tilt up a little, keeping the building’s sides from leaning.',
      'Add a detail shot — a carving, a door — as a second frame.',
      'Follow the site’s photo rules and dress code.',
    ],
    lighting: 'Early morning: soft light and fewer crowds.',
  },
  {
    id: 'festival',
    keywords: ['sinulog', 'festival', 'fiesta', 'parade', '축제', '祭り'],
    slot: 'who-partner-community',
    title: 'The festival',
    angle: 'Medium shot, at the dancers’ eye level',
    steps: [
      'Get close to the action rather than shooting over the crowd.',
      'Use burst mode to freeze movement.',
      'Ask before photographing people up close, especially children.',
    ],
    lighting: 'Bright daylight; keep the sun behind you.',
  },
];

const FALLBACK: ShotIdea = IDEAS.find((i) => i.id === 'shoreline') as ShotIdea;

/** The clause around a match: the caption's own words for this shot. */
function quoteAround(caption: string, at: number, length: number): string {
  const stops = /[.!?\n—–;,|#]/;
  let start = at;
  let end = at + length;
  while (start > 0 && !stops.test(caption[start - 1])) start -= 1;
  while (end < caption.length && !stops.test(caption[end])) end += 1;
  let quote = caption.slice(start, end).trim();
  if (quote.length > 70) {
    const from = Math.max(0, at - start - 25);
    quote = `…${quote.slice(from, from + 64).trim()}…`;
  }
  return quote;
}

/**
 * Latin-script keywords match at the start of a word, so stems still work
 * ("snorkel" → "snorkeling") but "eat" no longer fires inside "beneath" or
 * "sea" inside "season". Hangul, kana and emoji have no such boundaries and
 * match anywhere.
 */
function firstMatch(text: string, keywords: string[]): { at: number; length: number } | null {
  let best: { at: number; length: number } | null = null;
  for (const k of keywords) {
    const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(/^[a-z]/i.test(k) ? `(?<![\\p{L}\\p{N}])${escaped}` : escaped, 'iu');
    const m = re.exec(text);
    if (m && (!best || m.index < best.at)) best = { at: m.index, length: k.length };
  }
  return best;
}

/** The library photo that best fits a piece of text — for AI shots and guide lines. */
export function slotFor(text: string): ImageSlot {
  let best: { idea: ShotIdea; at: number } | null = null;
  for (const idea of IDEAS) {
    const m = firstMatch(text, idea.keywords);
    if (m && (!best || m.at < best.at)) best = { idea, at: m.at };
  }
  return (best?.idea ?? FALLBACK).slot;
}

/**
 * A name and its short forms — captions say "Sunset Cove" for "Sunset Cove
 * Beach Resort". Leading runs of two or more words only, so a single generic
 * word ("Sunset") is never blanked out of the caption.
 */
function nameForms(name: string): string[] {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return words.length ? [words[0]] : [];
  return Array.from({ length: words.length - 1 }, (_, i) => words.slice(0, words.length - i).join(' '));
}

/** Blanks out each name (same length, so indexes still line up with the original). */
function mask(text: string, names: string[]): string {
  let out = text;
  for (const n of names.flatMap(nameForms)) {
    if (n.length < 3) continue;
    const re = new RegExp(n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    out = out.replace(re, (m) => ' '.repeat(m.length));
  }
  return out;
}

/**
 * Four shots for this caption: its own moments, in the order it mentions them,
 * then the platform's AI guide lines. Empty with no caption.
 *
 * `ignore` is the business's own name: "Sunset Cove Beach Resort" is not a
 * sunset, a beach shot and a room shot.
 */
export function slidesFromCaption(caption: string, guide: string[] = [], ignore: string[] = []): ShotSlide[] {
  const body = caption.split(/\n\s*#/)[0]; // ignore the hashtag block
  if (!body.trim()) return [];
  const searchable = mask(body, ignore);
  const matched = IDEAS.map((idea) => ({ idea, m: firstMatch(searchable, idea.keywords) }))
    .filter((x): x is { idea: ShotIdea; m: { at: number; length: number } } => x.m != null)
    .sort((a, b) => a.m.at - b.m.at)
    .slice(0, SLIDE_COUNT);

  const slides: ShotSlide[] = matched.map(({ idea, m }) => ({
    id: idea.id,
    source: 'caption',
    title: idea.title,
    quote: quoteAround(body, m.at, m.length),
    angle: idea.angle,
    steps: idea.steps,
    lighting: idea.lighting,
    slot: idea.slot,
  }));

  for (const [i, line] of guide.entries()) {
    if (slides.length >= SLIDE_COUNT) break;
    slides.push({ id: `guide-${i}`, source: 'guide', title: 'From your platform guide', steps: [line], slot: slotFor(line) });
  }
  if (slides.length < SLIDE_COUNT && !slides.some((s) => s.id === FALLBACK.id)) {
    slides.push({
      id: FALLBACK.id,
      source: 'caption',
      title: 'Set the scene',
      angle: FALLBACK.angle,
      steps: FALLBACK.steps,
      lighting: FALLBACK.lighting,
      slot: FALLBACK.slot,
    });
  }
  return slides.slice(0, SLIDE_COUNT);
}

/** The AI shot list as slides — the better source, once it exists. */
export function slidesFromDirection(direction: CreativeDirection | null): ShotSlide[] {
  return (direction?.shots ?? []).slice(0, SLIDE_COUNT).map((shot, i) => {
    const steps = [shot.placement, shot.action, shot.context].filter((s): s is string => Boolean(s));
    return {
      id: `ai-${i}`,
      source: 'ai',
      title: shot.subject ?? shot.label,
      angle: shot.shotType,
      steps: steps.length ? steps : [shot.description],
      lighting: shot.lighting,
      slot: slotFor(`${shot.label} ${shot.subject ?? ''} ${shot.description}`),
    };
  });
}

// ─── Market tips (sample guidance) ─────────────────────────────────────────

const DEFAULT_TIPS = [
  'Show clear, authentic, high-quality visuals',
  'Include people to make the experience feel real',
  'Use bright, natural lighting',
  'Keep the image clean — avoid heavy text overlays',
];

const MARKET_TIPS: Record<string, string[]> = {
  japan: [
    'Calm, uncrowded scenes and natural landscapes',
    'Clean, tidy, well-kept spaces',
    'Bright, natural lighting — not too dark',
    'Candid people over posed shots',
    'Avoid heavy text overlays',
  ],
  'south korea': [
    'Bright, polished, trend-friendly visuals',
    '“Healing” moments — slow mornings, ocean views, rest',
    'Photo-worthy spots people want to recreate',
    'Fresh colours; vertical framing for Reels and Shorts',
  ],
  'united states': [
    'Lead with the adventure — what you can do here',
    'Real people, active and having fun',
    'Bucket-list scenery that justifies a long trip',
    'Let one subject lead each image',
  ],
};

/** Sample tips for the market; general ones for markets without their own. */
export function tipsFor(marketName: string | undefined): string[] {
  return MARKET_TIPS[(marketName ?? '').toLowerCase()] ?? DEFAULT_TIPS;
}
