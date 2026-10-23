import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetModules(); });

it('lists and redeems vouchers using the authenticated API transport', async () => {
  vi.stubEnv('VITE_USE_FIXTURES', 'false');
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [] });
  vi.stubGlobal('fetch', fetchMock);
  const { apiClient } = await import('./apiClient');
  await apiClient.vouchers.list();
  expect(fetchMock.mock.calls[0][0]).toMatch(/\/api\/attribution\/vouchers$/);
  await apiClient.vouchers.redeem('voucher-1', 250);
  expect(fetchMock.mock.calls[1][0]).toMatch(/\/api\/attribution\/vouchers\/voucher-1\/redeem$/);
  expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: 'POST', body: JSON.stringify({ grossRevenue: 250 }) });
});
