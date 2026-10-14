import { describe, expect, it } from 'vitest';
import { auditRecommendations } from './auditRecommendations';
import type { ContentResponse } from '../../../types';

const META = {
  core_business_context: 'reef shop',
  market_cultural_localization: 'Hangul',
  psychological_elements: 'FOMO',
  creative_tone_atmosphere: 'calm',
  algorithmic_platform_architecture: 'hook first',
};

const content = {
  market: { country: 'South Korea', flag: '🇰🇷', city: 'Seoul' },
  framework: 'SOR',
  source: 'groq',
  captions: {
    instagram: { options: ['a', 'b'], optionNames: ['A', 'B'], optionMetadata: [META, { ...META, creative_tone_atmosphere: 'bold' }], guide: ['warm light', '4:5'] },
    tiktok: { options: [], optionNames: [], optionMetadata: [], guide: [] },
  },
} as unknown as ContentResponse;

describe('auditRecommendations', () => {
  it('a staged option contributes its own metadata plus the platform guide', () => {
    expect(auditRecommendations(content, 'instagram', 1)).toEqual({
      ...META, creative_tone_atmosphere: 'bold', visual_guide: ['warm light', '4:5'],
    });
  });

  it('a caption the operator typed still gets the platform guide', () => {
    expect(auditRecommendations(content, 'instagram', null)).toEqual({ visual_guide: ['warm light', '4:5'] });
  });

  it('is null when nothing has been generated for the platform', () => {
    expect(auditRecommendations(null, 'instagram', null)).toBeNull();
    expect(auditRecommendations(content, 'facebook', null)).toBeNull();
  });

  it('is null for a platform whose generated content carries no guidance at all', () => {
    expect(auditRecommendations(content, 'tiktok', null)).toBeNull();
  });
});
