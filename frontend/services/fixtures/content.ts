/**
 * Module 3 AI copywriting matrix fixture — transcribed from
 * ui-ux-prototype.html:1093–1391 (ContentResponseDTO / CaptionsByPlatform).
 */

import type { CaptionMetadata, PlatformCaptions, ContentResponse } from '../../types';

export type { CaptionMetadata, PlatformCaptions, ContentResponse };

export const ARCHETYPES = [
  'Witty, Trend-Conscious & High-Energy',
  'Formal, Educational & Value-Driven',
  'Storytelling, Immersive & Emotional',
];

export const ARCHETYPE_SUB = ['Gen Z / Younger Demographic', 'Mature Planners / Family', 'Aspirational / Experiential'];

function meta(
  a: string,
  b: string,
  c: string,
  d: string,
  e: string
): CaptionMetadata {
  return {
    core_business_context: a,
    market_cultural_localization: b,
    psychological_elements: c,
    creative_tone_atmosphere: d,
    algorithmic_platform_architecture: e,
  };
}

export const MOCK_CONTENT: ContentResponse = {
  market: { country: 'South Korea', city: 'Seoul', flag: 'KR' },
  framework: 'SOR — Stimulus-Organism-Response',
  source: 'groq',
  captions: {
    instagram: {
      optionNames: ARCHETYPES,
      options: [
        'POV: you booked the 호캉스 you kept postponing 🌴 Sunset Cove, Moalboal — sardine run at sunrise, hammock by noon, zero notifications all day. Your 힐링여행 starts the moment the boat cuts the engine. Link in bio 🔗\n\n#세부여행 #호캉스 #힐링여행 #모알보알 #세부자유여행 #스노클링 #südsee #CebuTravel #IslandLife #SardineRun',
        'Sunset Cove Beach Resort — Moalboal, Cebu.\n\n📍 Direct access to the Moalboal sardine run, a phenomenon visible year-round within 30 metres of our shoreline.\n🐢 Certified marine biologist on site; every guided dive is briefed and logged.\n📅 Peak Korean season: July–August and December–January. Booking six weeks ahead secures the best rates.\n\nWe are the only eco-certified resort on this stretch of coast. Details and rates via the link in bio.\n\n#세부여행 #모알보알 #다이빙 #에코리조트 #CebuDiving',
        'The water goes quiet first.\n\nThen the light shifts, and a wall of silver turns beneath you — a million sardines moving as one body, close enough to touch, thirty metres from where you had breakfast.\n\nYou surface. Nobody says anything for a while.\n\nThat is the moment people fly to Moalboal for. 힐링은 그렇게 시작됩니다.\n\nSunset Cove — link in bio 🌊\n\n#힐링여행 #세부여행 #모알보알 #사딘런 #OceanHealing',
      ],
      optionMetadata: [
        meta(
          "Leads with the sardine run and the 30-metre shoreline proximity — the resort's single most defensible differentiator — and pairs it with the hammock/no-notifications rest promise from the UVP.",
          '호캉스 (hotel + vacation) and 힐링여행 are embedded naturally rather than translated, matching how Korean Gen Z actually search. Hashtags mix Hangul search terms with English discovery tags.',
          "FOMO through the 'kept postponing' framing, social proof through POV convention, and urgency through the immediacy of 'starts the moment'.",
          'Playful, punchy, second-person. High emoji density and short fragment sentences matching Gen Z Instagram register.',
          "2,200-char limit; hook lands inside the first 125 characters before the fold. 'Link in bio' only — Instagram captions do not carry clickable URLs. 10 hashtags at the bottom, native-language-first."
        ),
        meta(
          'Foregrounds verifiable operational facts: year-round sardine run access, on-site certified marine biologist, eco-certification, and the booking-lead-time guidance drawn from the seasonality insight.',
          '존댓말-equivalent formal register in English with Hangul category hashtags. Cites the Korean peak-season months explicitly because mature Korean planners plan around school calendars.',
          "Exclusivity ('only eco-certified resort on this stretch'), value certainty (rate guidance), and security (certified, briefed, logged).",
          'Respectful and authoritative. Minimal emoji, used as structural markers (📍 🐢 📅) rather than decoration.',
          '2,200-char limit; scannable line-broken structure survives the 125-char truncation. Link in bio. 5 hashtags, restrained to match the formal tone.'
        ),
        meta(
          "Renders the sardine run and the resort's stillness as lived sensory experience rather than as features, drawing on the UVP's rest-and-restoration positioning.",
          "Closes with a single Hangul line (힐링은 그렇게 시작됩니다 — 'healing begins that way') so the emotional payoff lands in the reader's own language.",
          'Escapism and tropical healing via a tension → threshold → release arc: quiet, then the turn, then the silence after.',
          'Cinematic and sensory. Short paragraphs, deliberate white space, moderate emoji. Present tense throughout.',
          '2,200-char limit; the first line is a complete hook well inside 125 characters. Link in bio. 5 hashtags, native-language-first.'
        ),
      ],
      guide: [
        'Aesthetic mood shot — open the balcony doors to the sea, shoot from inside looking out so the frame reads as an invitation.',
        'Apply a warm, low-contrast golden filter. Korean feeds skew toward soft, desaturated warmth; avoid heavy saturation.',
        'Use a 4:5 portrait ratio to claim maximum vertical feed real estate.',
        'Include one human element — a hand, a silhouette, a towel left on a chair — so the viewer can project themselves in.',
        'Underwater sardine-run footage is your strongest asset. Lead the carousel with it, not with the room.',
      ],
    },
    tiktok: {
      optionNames: ARCHETYPES,
      options: [
        'no thoughts. just sardines. 🐟🌊 30m from breakfast, Moalboal #세부여행 #힐링여행 #TravelTok #SardineRun #모알보알',
        'Moalboal, Cebu: the sardine run is visible year-round, 30m offshore. Certified marine biologist on every dive. Peak KR season Jul–Aug. #세부여행 #다이빙 #모알보알',
        'The water goes quiet. Then a million fish turn at once. Nobody talks after. 🌊 #힐링여행 #세부여행 #모알보알 #OceanHealing',
      ],
      optionMetadata: [
        meta(
          'Compresses the single strongest differentiator — sardine run 30m from the resort — into a scroll-stopping fragment.',
          'Korean search hashtags carry the localisation; the caption itself stays language-agnostic so the video does the work.',
          "FOMO and excitement through radical brevity and the implied 'you are not there'.",
          'Lowercase, deadpan, meme-literate. Two emoji maximum.',
          '300-char optimal target; the entire caption is the hook because TikTok shows no fold. Exactly 5 hashtags. Link in bio only.'
        ),
        meta(
          'Delivers the three verifiable facts a planner needs — access, credential, timing — in one pass.',
          'Hangul category hashtags for Korean discovery; the factual register mirrors Korean travel-blog conventions.',
          'Value certainty and security; removes doubt rather than creating desire.',
          'Flat, informational, zero embellishment. No emoji.',
          '300-char optimal target; front-loaded facts. 3 hashtags. Link in bio only.'
        ),
        meta(
          'Uses the sardine run as narrative rather than as a feature list.',
          'Ends on the healing frame that Korean travellers search for directly.',
          'Escapism and awe via the tension → turn → silence arc.',
          'Cinematic in three sentences. One emoji.',
          '300-char optimal target; the whole caption is the hook. 4 hashtags. Link in bio only.'
        ),
      ],
      guide: [
        '9:16 vertical, full-bleed. Never letterbox — TikTok penalises reframed 16:9 footage.',
        'Hook inside the first 0.8 seconds: open underwater, mid-shoal, no establishing shot.',
        'Cut on the beat. Chill / lo-fi audio performs best for the Korean healing-travel audience.',
        'Burn one line of on-screen text in the first second — most viewers watch muted.',
      ],
    },
    facebook: {
      optionNames: ARCHETYPES,
      options: [
        '호캉스 yet? 🌴 Sunset Cove sits 30 metres from the Moalboal sardine run — sunrise snorkel, hammock by noon, nothing else on the schedule. Rates and dates → sunsetcove.ph/kr\n\n#세부여행 #호캉스',
        'Sunset Cove Beach Resort — Moalboal, Cebu\n\nDirect shoreline access to the Moalboal sardine run, visible year-round roughly 30 metres offshore. Every guided dive is led and logged by our on-site certified marine biologist, and we remain the only eco-certified property on this stretch of coast.\n\nPeak Korean season runs July–August and December–January; booking around six weeks ahead secures the best available rates.\n\nFull rates, dive schedules and transfer details: sunsetcove.ph/kr\n\n#세부여행 #에코리조트',
        'The water goes quiet first. Then the light shifts and a wall of silver turns beneath you — a million sardines moving as one body, thirty metres from where you had breakfast. You surface, and nobody says anything for a while.\n\nThat is the moment people fly to Moalboal for.\n\nSunset Cove — sunsetcove.ph/kr\n\n#힐링여행 #세부여행',
      ],
      optionMetadata: [
        meta(
          'Sardine-run proximity plus the unstructured-day rest promise, compressed for a conversational feed.',
          '호캉스 opens the caption in Hangul so Korean readers self-identify immediately.',
          'FOMO through the direct question opener; urgency through the immediate CTA.',
          'Casual and conversational. Moderate emoji.',
          '500-char practical target; hook inside ~250 chars. Facebook renders clickable URLs, so the link is embedded directly. 2 hashtags — Facebook rewards restraint.'
        ),
        meta(
          'Full operational brief: access, credential, exclusivity claim, seasonal timing, booking lead time.',
          'Formal register with Hangul category hashtags; matches how Korean family planners read.',
          'Exclusivity, value certainty, security.',
          'Authoritative and complete. No emoji.',
          '500-char practical target; paragraph-broken for scanning. Clickable URL embedded. 2 hashtags.'
        ),
        meta(
          'The sardine run rendered as a scene, then named as the reason to fly.',
          'Closes in the healing frame Korean travellers search for.',
          'Escapism and awe; tension → turn → release.',
          'Cinematic, unhurried, present tense.',
          '500-char practical target; the opening sentence is the hook. Clickable URL embedded. 2 hashtags.'
        ),
      ],
      guide: [
        "16:9 or 1:1 — Facebook's feed favours horizontal and square over tall.",
        'Lead with a 6–10 second silent-readable video; Facebook autoplays muted.',
        "Put the offer in the first two lines, above the 'See more' fold.",
        'Link previews outperform bare URLs — post the link so the card renders.',
      ],
    },
  },
};
