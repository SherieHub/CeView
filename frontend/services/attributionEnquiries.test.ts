import { afterEach, expect, it, vi } from 'vitest';
import { attributionEnquiries } from './attributionEnquiries';
import { loadTokens } from './authStorage';

vi.mock('./authStorage', () => ({ loadTokens: vi.fn() }));
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetAllMocks(); });

it('keeps operator credentials off both public requests', async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ received: true }) });
  vi.stubGlobal('fetch', fetch);
  await attributionEnquiries.context('click');
  await attributionEnquiries.submit({ clickId: 'click', contactName: 'Alex', contactValue: 'contact' });
  expect(loadTokens).not.toHaveBeenCalled();
  expect(fetch.mock.calls[0][1].headers).toBeUndefined();
  expect(fetch.mock.calls[1][1].headers).toEqual({ 'Content-Type': 'application/json' });
});

it('sends the current operator token to the private list endpoint', async () => {
  vi.stubEnv('VITE_USE_FIXTURES', 'false');
  vi.mocked(loadTokens).mockReturnValue({ accessToken: 'operator-token' } as ReturnType<typeof loadTokens>);
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([]) });
  vi.stubGlobal('fetch', fetch);
  await attributionEnquiries.list();
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/attribution/enquiries'),
    expect.objectContaining({ cache: 'no-store', headers: { Authorization: 'Bearer operator-token' } }));
});
