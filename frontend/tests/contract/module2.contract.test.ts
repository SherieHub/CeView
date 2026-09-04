/**
 * Live contract test — module 2 endpoints.
 * Requires the Docker stack: cd backend && docker compose up -d
 */
import { expect, it } from 'vitest';
import { api, isBackendUp, describeIfBackend } from './backendProbe';

const up = await isBackendUp();

describeIfBackend(up, 'module 2 endpoints', () => {
  it('GET /api/notifications returns an envelope of alerts', async () => {
    const res = await api('/api/notifications');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('notifications');
    expect(Array.isArray(body.notifications)).toBe(true);
    if (body.notifications.length > 0) {
      expect(body.notifications[0]).toMatchObject({
        id: expect.any(String),
        category: expect.any(String),
        alertLevel: expect.stringMatching(/^(INFO|WARNING|CRITICAL)$/),
        alertMessage: expect.any(String),
      });
    }
  });

  it('GET /api/forecasting/status reports AI availability', async () => {
    const res = await api('/api/forecasting/status');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('available');
    expect(typeof body.available).toBe('boolean');
  });

  it('GET /api/forecasting/markets returns fully-populated markets', async () => {
    const res = await api('/api/forecasting/markets');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.markets)).toBe(true);
    if (body.markets.length > 0) {
      // Every field the radar drawer reads — a regression here renders undefined/NaN.
      expect(body.markets[0]).toMatchObject({
        id: expect.any(String),
        flag: expect.any(String),
        currency: expect.any(String),
        forexLabel: expect.any(String),
        gdpValue: expect.any(Number),
        forexValue: expect.any(Number),
        seasonalityScore: expect.any(Number),
        spikeIndicator: expect.any(Boolean),
      });
      expect(body.markets[0]).toHaveProperty('chartData');
    }
  });

  it('GET /api/forecasting/markets?category= filters by category', async () => {
    const mine = await api('/api/forecasting/markets?category=' + encodeURIComponent('Coastal & Island'));
    expect(mine.status).toBe(200);
    expect(Array.isArray((await mine.json()).markets)).toBe(true);

    // A category this operator does not have must yield an empty list, not everything.
    const other = await api('/api/forecasting/markets?category=' + encodeURIComponent('Urban & City'));
    expect(other.status).toBe(200);
    expect((await other.json()).markets).toEqual([]);
  });

  it('POST /api/forecasting/analyze works with only a JWT', async () => {
    const res = await api('/api/forecasting/analyze', { method: 'POST' });
    // 503 is expected while the FastAPI services are down; 404 means the route is missing.
    expect([200, 409, 503]).toContain(res.status);
    expect(res.status).not.toBe(404);
    // The DNS-resolution failure against the down fastapi-transformer host takes
    // ~5s on its own before the 503 comes back — past vitest's default 5000ms.
    // Raised from 15000: with the AI services actually up (Task 7a), this
    // endpoint genuinely takes ~27s end-to-end instead of failing fast.
  }, 60000);
});
