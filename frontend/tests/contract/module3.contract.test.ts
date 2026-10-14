import { expect, it } from 'vitest';
import { api, isBackendUp, describeIfBackend, expectPopulatedOrUnavailable } from './backendProbe';

const up = await isBackendUp();

const GENERATE_BODY = {
  market: 'korea',
  businessName: 'Moalboal FreeDive Cebu',
  description: 'Freediving courses and guided sardine-run dives in Moalboal, Cebu.',
  categories: ['Coastal & Island'],
  trend: 'surging',
};

describeIfBackend(up, 'module 3 endpoints', () => {
  /**
   * Previously asserted only `status !== 404`, so a 500 crash passed. The route
   * must answer with captions or a structured unavailability error (e.g. the
   * caption agent's MOD31_* codes) — never an unstructured failure.
   */
  it('POST /api/content/generate returns captions or a structured unavailability error', async () => {
    const res = await api('/api/content/generate', {
      method: 'POST', body: JSON.stringify(GENERATE_BODY),
    });
    await expectPopulatedOrUnavailable(res, (body) => {
      expect(body).toHaveProperty('captions');
      expect(body.market).toMatchObject({ country: expect.any(String) });
    });
  }, 240000);

  it('POST /api/compliance/omcs-analyze rejects a blank caption with 4xx, not 500', async () => {
    const res = await api('/api/compliance/omcs-analyze', {
      method: 'POST',
      body: JSON.stringify({ caption: '   ', imageUrl: 'https://example.invalid/x.jpg' }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  }, 60000);

  /**
   * Live response (verified Tasks 22-24) is {visualGuide, shots, moodboard} —
   * not the plan's assumed shotListRecommendations/visualRecommendations/
   * lightingSuggestions/moodboardReferences shape. types.ts's CreativeDirection
   * matches what's asserted here.
   */
  it('POST /api/creative-direction/generate works with only a JWT', async () => {
    const res = await api('/api/creative-direction/generate', { method: 'POST' });
    await expectPopulatedOrUnavailable(res, (body) => {
      expect(Array.isArray(body.visualGuide)).toBe(true);
      expect(Array.isArray(body.shots)).toBe(true);
      expect(body.moodboard).toMatchObject({ palette: expect.any(String) });
    });
  }, 120000);
});
