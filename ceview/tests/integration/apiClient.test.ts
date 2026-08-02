import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api, ApiError } from '../../services/apiClient';

// Example integration-style test — pattern to copy: mock the global fetch
// boundary and assert apiClient builds the right request / parses the right
// response shape. This verifies the frontend<->backend contract without a
// real backend, complementing the Playwright E2E suite (which runs against
// the real stack) and the component-level unit tests.
describe('apiClient.listMarkets', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('requests the markets endpoint and returns the parsed body', async () => {
    const mockMarkets = { markets: [{ id: '1', name: 'Test Market' }] };
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => mockMarkets,
    });

    const result = await api.listMarkets('profile-123');

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/forecasting/markets?profileId=profile-123'),
      expect.objectContaining({ headers: expect.objectContaining({ 'Content-Type': 'application/json' }) }),
    );
    expect(result).toEqual(mockMarkets);
  });

  it('throws an ApiError with the backend error code on a non-OK response', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      headers: { get: () => null },
      text: async () => JSON.stringify({ code: 'MOD2_MARKETS_FAIL', message: 'boom' }),
    });

    await expect(api.listMarkets()).rejects.toMatchObject<Partial<ApiError>>({
      code: 'MOD2_MARKETS_FAIL',
      status: 500,
    });
  });
});
