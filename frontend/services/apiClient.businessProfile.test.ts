import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BusinessProfileDto } from '../types';

// Real-fetch mode (not fixtures) — covers apiClient.businessProfile.save against
// the actual Spring Boot endpoint (PUT /api/business-profile).
vi.stubEnv('VITE_USE_FIXTURES', 'false');

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status }));
}

const SAMPLE_DTO: BusinessProfileDto = {
  businessProfileId: 'bp-1',
  businessName: 'Moalboal FreeDive Cebu',
  categories: ['Coastal & Island'],
  coreServices: ['freediving lessons', 'guided dives'],
  description: 'Freediving courses and guided sardine-run dives in Moalboal, Cebu.',
  uvp: 'Small-group freediving with certified local guides.',
  imagePreview: null,
  uniquenessScore: 0.74,
};

describe('apiClient.businessProfile.save (real-fetch mode)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('PUTs the profile to /api/business-profile and returns the saved DTO', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockReturnValue(jsonResponse(SAMPLE_DTO));
    const { apiClient } = await import('./apiClient');

    const res = await apiClient.businessProfile.save(SAMPLE_DTO);

    expect(res).toEqual(SAMPLE_DTO);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/business-profile'),
      expect.objectContaining({ method: 'PUT', body: JSON.stringify(SAMPLE_DTO) }),
    );
  });
});
