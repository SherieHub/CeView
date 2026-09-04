/**
 * Live contract test — module 1 endpoints.
 * Requires the Docker stack with fastapi-sbert healthy.
 */
import { expect, it } from 'vitest';
import { api, isBackendUp, describeIfBackend } from './backendProbe';

const up = await isBackendUp();

const SAMPLE = {
  businessName: 'Moalboal FreeDive Cebu',
  description: 'Freediving courses and guided sardine-run dives in Moalboal, Cebu.',
  coreServices: ['freediving lessons', 'guided dives'],
  uvp: 'Small-group freediving with certified local guides.',
};

describeIfBackend(up, 'module 1 endpoints', () => {
  it('POST /api/classification/analyze returns category allocations', async () => {
    const res = await api('/api/classification/analyze', {
      method: 'POST',
      body: JSON.stringify(SAMPLE),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.categories)).toBe(true);
    // The field is `name`, not `category` — guard the shape the client maps.
    expect(body.categories[0]).toMatchObject({
      name: expect.any(String),
      percentage: expect.any(Number),
    });
  }, 60000);

  it('POST /api/classification/uniqueness returns a 0-100 overallScore', async () => {
    const res = await api('/api/classification/uniqueness', {
      method: 'POST',
      body: JSON.stringify({ ...SAMPLE, categories: ['Coastal & Island'] }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.overallScore).toBe('number');
    expect(body.overallScore).toBeGreaterThanOrEqual(0);
    expect(body.overallScore).toBeLessThanOrEqual(100);
  }, 60000);
});
