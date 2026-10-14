/**
 * Live contract test — module 4 endpoints.
 * Requires the Docker stack: cd backend && docker compose up -d
 *
 * These assert the SHAPES the frontend depends on, which is the check that
 * would have caught apiClient drifting to /api/campaigns/* — routes that never
 * existed on any backend.
 */
import { expect, it } from 'vitest';
import { api, isBackendUp, describeIfBackend, expectPopulatedOrUnavailable } from './backendProbe';

const up = await isBackendUp();

describeIfBackend(up, 'module 4 endpoints', () => {
  it('GET /api/analytics/history returns snapshots matching CampaignHistoryEntry', async () => {
    const res = await api('/api/analytics/history?weeks=4');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.snapshots)).toBe(true);
    // The seed operator has campaign records (V15), so an empty list is a failure,
    // not a reason to skip the shape check.
    expect(body.snapshots.length).toBeGreaterThan(0);
    {
      // Field-for-field match with the frontend type — no mapping layer exists,
      // so a rename on either side breaks the trend charts silently.
      expect(body.snapshots[0]).toMatchObject({
        periodStart: expect.any(String),
        periodEnd: expect.any(String),
        pesScore: expect.any(Number),
        pesLabel: expect.any(String),
        ctr: expect.any(Number),
        cpc: expect.any(Number),
        roas: expect.any(Number),
        convRate: expect.any(Number),
        cac: expect.any(Number),
      });
    }
  });

  it('GET /api/analytics/metrics is scoped to the authenticated operator', async () => {
    const res = await api('/api/analytics/metrics?weeks=4');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('metrics');
    // Task 13 replaced hardcoded demo numbers with the operator's real records.
    expect(body.metrics).toHaveProperty('ctr');
    expect(body.metrics).toHaveProperty('roas');
  });

  /**
   * Formerly "KNOWN GAP — see Task 15": this test accepted a 200 carrying `{}` and
   * checked the shape only when a body happened to arrive, so a blank report passed.
   * A report is now either populated or a structured unavailability error. The
   * empty-200 case FAILS — it is the defect (fastapi-sbert's report route returns
   * the {} that _generate_json produces on a model error), not an acceptable state.
   */
  it('POST /api/analytics/report returns a populated report or a structured unavailability error', async () => {
    const res = await api('/api/analytics/report', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    await expectPopulatedOrUnavailable(res, (body) => {
      expect(body).toMatchObject({
        executiveSummary: expect.any(String),
        recommendedPlatform: expect.any(String),
      });
      expect(Array.isArray(body.funnelDiagnostics)).toBe(true);
      expect(Array.isArray(body.recommendations)).toBe(true);
    });
  },
  // The report round-trips to FastAPI; a slow or failing hop can exceed
  // vitest's 5000ms default.
  15000);
});
