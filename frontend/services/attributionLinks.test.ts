import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from './apiClient';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ([]),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function calledPath(): string {
  if (fetchMock.mock.calls.length === 0) return '';
  return String(fetchMock.mock.calls[0][0]);
}

describe('apiClient.attributionLinks', () => {
  it('requests unconverted clicks using ISO dates with timezone offsets properly encoded', async () => {
    const from = '2026-10-19T00:00:00+08:00';
    const to = '2026-10-26T00:00:00+08:00';

    await apiClient.attributionLinks.unconvertedClicks(from, to);

    // Like the other apiClient tests, this needs VITE_USE_FIXTURES off; in fixture
    // mode fetch is never called and this fails rather than passing vacuously.
    const url = calledPath();
    expect(url).toContain('/api/attribution/clicks/unconverted?');
    expect(url).toContain('from=2026-10-19T00%3A00%3A00%2B08%3A00');
    expect(url).toContain('to=2026-10-26T00%3A00%3A00%2B08%3A00');
  });
});
