import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from './apiClient';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function calledPath(): string {
  return String(fetchMock.mock.calls[0][0]);
}

function calledInit(): RequestInit {
  return fetchMock.mock.calls[0][1] as RequestInit;
}

describe('apiClient.attributionLinks', () => {
  it('lists the authenticated operator links', async () => {
    await apiClient.attributionLinks.list();
    expect(calledPath()).toContain('/api/attribution/links');
  });

  it('patches the selected destination', async () => {
    await apiClient.attributionLinks.setDestination('link-1', 'https://operator.example/book');
    expect(calledPath()).toContain('/api/attribution/links/link-1');
    expect(calledInit().method).toBe('PATCH');
    expect(calledInit().body).toBe(JSON.stringify({ destinationUrl: 'https://operator.example/book' }));
  });

  it('requests the per-creative performance path', async () => {
    await apiClient.attributionLinks.performance('link-1');
    expect(calledPath()).toContain('/api/attribution/links/link-1/creatives');
  });

  it('URL-encodes the unconverted-click range', async () => {
    const from = '2026-09-01T00:00:00+08:00';
    const to = '2026-09-14T23:59:59+08:00';
    await apiClient.attributionLinks.unconvertedClicks(from, to);
    expect(calledPath()).toContain(`from=${encodeURIComponent(from)}`);
    expect(calledPath()).toContain(`to=${encodeURIComponent(to)}`);
  });
});
