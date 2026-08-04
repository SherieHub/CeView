import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api, ApiError, setUnauthorizedHandler } from '../../services/apiClient';
import { TOKEN_KEY } from '../../services/authStorage';

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

describe('apiClient auth header + 401 handling', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
    setUnauthorizedHandler(null);
  });

  it('attaches the Authorization header when a token exists in localStorage', async () => {
    localStorage.setItem(TOKEN_KEY, 'test-jwt-token');
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ markets: [] }),
    });

    await api.listMarkets();

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer test-jwt-token' }),
      }),
    );
  });

  it('does not attach an Authorization header when no token is stored', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ markets: [] }),
    });

    await api.listMarkets();

    const call = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    const headers = call[1].headers as Record<string, string>;
    expect(headers).not.toHaveProperty('Authorization');
  });

  it('invokes the registered unauthorized handler on a 401 response, and still throws ApiError', async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);

    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      headers: { get: () => null },
      text: async () => JSON.stringify({ code: 'AUTH_INVALID_TOKEN', message: 'expired' }),
    });

    await expect(api.listMarkets()).rejects.toMatchObject<Partial<ApiError>>({
      code: 'AUTH_INVALID_TOKEN',
      status: 401,
    });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('loadProfile and saveProfile no longer send an operatorId query param', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    await api.loadProfile();
    expect(fetch).toHaveBeenLastCalledWith(
      expect.stringMatching(/\/api\/v1\/business-profile$/),
      expect.anything(),
    );

    await api.saveProfile({
      businessProfileId: null,
      businessName: 'Test',
      categories: [],
      coreServices: [],
      description: '',
      uvp: '',
      imagePreview: null,
      uniquenessScore: null,
    });
    expect(fetch).toHaveBeenLastCalledWith(
      expect.stringMatching(/\/api\/v1\/business-profile$/),
      expect.objectContaining({ method: 'PUT' }),
    );
  });
});
