/**
 * Shared test-only fixture builder for module 3's content studio tests.
 *
 * ContentResponse.captions is a fixed three-platform object (instagram /
 * tiktok / facebook), not an open string-keyed map, so an empty `{}`
 * doesn't typecheck as a stand-in — every test that needs a ContentResponse
 * builds one through this helper instead.
 */
import type { CaptionMetadata, ContentResponse, ContentSource, PlatformCaptions } from '../../../types';

function metadata(): CaptionMetadata {
  return {
    core_business_context: 'context',
    market_cultural_localization: 'localisation',
    psychological_elements: 'psychology',
    creative_tone_atmosphere: 'tone',
    algorithmic_platform_architecture: 'platform fit',
  };
}

function platformCaptions(label: string): PlatformCaptions {
  return {
    optionNames: [`${label} option`],
    options: [`${label} caption text`],
    optionMetadata: [metadata()],
    guide: [`${label} shot 1`],
  };
}

export function buildContentResponse(source: ContentSource = 'groq'): ContentResponse {
  return {
    market: { country: 'South Korea', city: 'Seoul', flag: 'KR' },
    framework: 'SOR — Stimulus-Organism-Response',
    source,
    captions: {
      instagram: platformCaptions('Instagram'),
      tiktok: platformCaptions('TikTok'),
      facebook: platformCaptions('Facebook'),
    },
  };
}
