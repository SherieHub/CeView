import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';
import { ConnectionsStoreProvider, useConnections } from './connectionsStore';
import type { ConnectionsStore } from './connectionsStore';
import type { PlatformConnection } from '../types';
import { ApiError } from './apiError';

const MOCK_CONNECTIONS: PlatformConnection[] = [
  { platform: 'instagram', connected: true, handle: '@cebu.dive', connectedAt: '2026-05-01T00:00:00Z', status: 'ACTIVE', configured: true },
  { platform: 'tiktok', connected: false, handle: null, connectedAt: null, status: 'DISCONNECTED', configured: true },
  { platform: 'facebook', connected: false, handle: null, connectedAt: null, status: 'NEEDS_PAGE', configured: true },
];

vi.mock('./apiClient', () => ({
  apiClient: {
    connections: {
      list: vi.fn(() => Promise.resolve(MOCK_CONNECTIONS)),
      tiktokAuthorize: vi.fn(() => Promise.resolve({ authorizeUrl: 'https://tiktok.example/auth' })),
      disconnect: vi.fn(() => Promise.resolve({ ok: true })),
    },
    adConnections: {
      authorize: vi.fn(() => Promise.resolve({ authorizeUrl: 'https://meta.example/auth' })),
    },
  },
}));

vi.mock('./navigation', () => ({ navigateTo: vi.fn() }));

import { apiClient } from './apiClient';
import { navigateTo } from './navigation';

let captured: ConnectionsStore | null = null;

function Probe() {
  captured = useConnections();
  return null;
}

function renderProbe() {
  captured = null;
  return render(
    <ConnectionsStoreProvider>
      <Probe />
    </ConnectionsStoreProvider>
  );
}

async function seeded() {
  renderProbe();
  await waitFor(() => expect(captured?.connections).not.toBeNull());
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(apiClient.connections.list).mockResolvedValue(MOCK_CONNECTIONS);
  vi.mocked(apiClient.connections.tiktokAuthorize).mockResolvedValue({ authorizeUrl: 'https://tiktok.example/auth' });
  vi.mocked(apiClient.adConnections.authorize).mockResolvedValue({ authorizeUrl: 'https://meta.example/auth' });
  vi.mocked(apiClient.connections.disconnect).mockResolvedValue({ ok: true });
});

describe('useConnections', () => {
  it('throws when called outside the provider', () => {
    function Bare() {
      useConnections();
      return null;
    }
    expect(() => render(<Bare />)).toThrow('useConnections must be used within a ConnectionsStoreProvider');
  });
});

describe('ConnectionsStoreProvider — seeding', () => {
  it('recovers availability after the endpoint becomes reachable', async () => {
    vi.mocked(apiClient.connections.list).mockRejectedValueOnce(new ApiError({ status: 404, path: '/api/social-connections', method: 'GET' }));
    await seeded();
    expect(captured!.available).toBe(false);
    await act(async () => { await captured!.refresh(); });
    expect(captured!.available).toBe(true);
    expect(captured!.connections).toEqual(MOCK_CONNECTIONS);
  });
  it('starts with connections=null then seeds from apiClient.connections.list()', async () => {
    renderProbe();
    expect(captured?.connections).toBeNull();

    await waitFor(() => expect(captured?.connections).not.toBeNull());
    expect(captured?.connections).toEqual(MOCK_CONNECTIONS);
  });

  it('falls back to an empty list (not an eternal null) when the initial fetch fails', async () => {
    // A rejected list() — a 401 from an expired session, a dropped connection,
    // a 500 — must not leave every Platforms-dependent screen (Settings,
    // Content Studio's publish picker) stuck on its loading skeleton forever
    // with no way to recover short of a hard refresh.
    vi.mocked(apiClient.connections.list).mockRejectedValue(new Error('network error'));

    renderProbe();

    await waitFor(() => expect(captured?.connections).not.toBeNull());
    expect(captured?.connections).toEqual([]);
    expect(captured?.available).toBe(true);
  });

  it('a 404 on the initial list marks the feature unavailable', async () => {
    vi.mocked(apiClient.connections.list).mockRejectedValue(
      new ApiError({ status: 404, method: 'GET', path: '/api/social-connections', body: null })
    );

    renderProbe();

    await waitFor(() => expect(captured?.connections).not.toBeNull());
    expect(captured!.available).toBe(false);
    expect(captured!.connections).toEqual([]);
  });

  it('isConnected() is true only for ACTIVE rows', async () => {
    await seeded();
    expect(captured!.isConnected('instagram')).toBe(true);
    expect(captured!.isConnected('tiktok')).toBe(false);
    expect(captured!.isConnected('facebook')).toBe(false);
  });

  it('statusOf() returns the row status, DISCONNECTED for an unknown platform', async () => {
    await seeded();
    expect(captured!.statusOf('instagram')).toBe('ACTIVE');
    expect(captured!.statusOf('facebook')).toBe('NEEDS_PAGE');

    vi.mocked(apiClient.connections.list).mockResolvedValue([]);
    await act(async () => {
      await captured!.refresh();
    });
    expect(captured!.statusOf('instagram')).toBe('DISCONNECTED');
  });
});

describe('ConnectionsStoreProvider — refresh()', () => {
  it('refetches the list', async () => {
    await seeded();
    expect(apiClient.connections.list).toHaveBeenCalledTimes(1);

    const updated: PlatformConnection[] = [
      { platform: 'facebook', connected: true, handle: 'Cebu Dive Co.', connectedAt: '2026-05-02T00:00:00Z', status: 'ACTIVE', configured: true },
    ];
    vi.mocked(apiClient.connections.list).mockResolvedValue(updated);
    await act(async () => {
      await captured!.refresh();
    });

    expect(apiClient.connections.list).toHaveBeenCalledTimes(2);
    expect(captured!.connections).toEqual(updated);
  });
});

describe('ConnectionsStoreProvider — refresh() races and failures', () => {
  it('a stale (out-of-order) response never overwrites a newer one', async () => {
    await seeded();

    const older: PlatformConnection[] = [
      { platform: 'facebook', connected: false, handle: null, connectedAt: null, status: 'NEEDS_PAGE', configured: true },
    ];
    const newer: PlatformConnection[] = [
      { platform: 'facebook', connected: true, handle: 'Cebu Dive Co.', connectedAt: '2026-05-02T00:00:00Z', status: 'ACTIVE', configured: true },
    ];
    let resolveOlder: (value: PlatformConnection[]) => void = () => {};
    vi.mocked(apiClient.connections.list)
      .mockImplementationOnce(() => new Promise((resolve) => { resolveOlder = resolve; }))
      .mockResolvedValueOnce(newer);

    let first!: Promise<void>;
    let second!: Promise<void>;
    await act(async () => {
      first = captured!.refresh();
      second = captured!.refresh();
      await second;
    });
    expect(captured!.connections).toEqual(newer);

    await act(async () => {
      resolveOlder(older);
      await first;
    });
    expect(captured!.connections).toEqual(newer);
  });

  it('a failed refresh keeps the previous list instead of replacing it with []', async () => {
    await seeded();
    vi.mocked(apiClient.connections.list).mockRejectedValue(new Error('network error'));

    await act(async () => {
      await captured!.refresh();
    });

    expect(captured!.connections).toEqual(MOCK_CONNECTIONS);
  });
});

describe('ConnectionsStoreProvider — connect()', () => {
  it('connect(tiktok) gets the TikTok authorize URL then navigates to it', async () => {
    await seeded();
    await act(async () => {
      await captured!.connect('tiktok');
    });
    expect(apiClient.connections.tiktokAuthorize).toHaveBeenCalledTimes(1);
    expect(navigateTo).toHaveBeenCalledWith('https://tiktok.example/auth');
  });

  it.each(['facebook', 'instagram'] as const)('connect(%s) uses the shared Meta login then navigates', async (platform) => {
    await seeded();
    await act(async () => {
      await captured!.connect(platform);
    });
    expect(apiClient.adConnections.authorize).toHaveBeenCalledWith('meta');
    expect(apiClient.connections.tiktokAuthorize).not.toHaveBeenCalled();
    expect(navigateTo).toHaveBeenCalledWith('https://meta.example/auth');
  });

  it('in fixture mode (# URL) connect(tiktok) does not navigate and marks TikTok connected locally', async () => {
    vi.mocked(apiClient.connections.tiktokAuthorize).mockResolvedValue({ authorizeUrl: '#fixture-no-oauth' });
    await seeded();
    await act(async () => {
      await captured!.connect('tiktok');
    });
    expect(navigateTo).not.toHaveBeenCalled();
    expect(captured!.isConnected('tiktok')).toBe(true);
    expect(captured!.statusOf('tiktok')).toBe('ACTIVE');
    expect(captured!.connections!.find((c) => c.platform === 'tiktok')?.connectedAt).toEqual(expect.any(String));
  });

  it('in fixture mode connect(facebook) marks both Facebook and Instagram connected locally', async () => {
    vi.mocked(apiClient.adConnections.authorize).mockResolvedValue({ authorizeUrl: '#fixture-no-oauth' });
    await seeded();
    await act(async () => {
      await captured!.connect('facebook');
    });
    expect(navigateTo).not.toHaveBeenCalled();
    expect(captured!.isConnected('facebook')).toBe(true);
    expect(captured!.isConnected('instagram')).toBe(true);
    expect(captured!.isConnected('tiktok')).toBe(false);
  });
});

describe('ConnectionsStoreProvider — disconnect() / onDisconnect()', () => {
  it('disconnect() calls the API, then refetches the list', async () => {
    await seeded();
    const after: PlatformConnection[] = MOCK_CONNECTIONS.map((c) =>
      c.platform === 'instagram'
        ? { ...c, connected: false, status: 'DISCONNECTED' as const, handle: null, connectedAt: null }
        : c
    );
    vi.mocked(apiClient.connections.list).mockResolvedValue(after);

    await act(async () => {
      await captured!.disconnect('instagram');
    });

    expect(apiClient.connections.disconnect).toHaveBeenCalledWith('instagram');
    expect(apiClient.connections.list).toHaveBeenCalledTimes(2);
    expect(captured!.isConnected('instagram')).toBe(false);
  });

  it('disconnect(facebook) fires every listener for both facebook and instagram', async () => {
    await seeded();

    const listenerA = vi.fn();
    const listenerB = vi.fn();
    act(() => {
      captured!.onDisconnect(listenerA);
      captured!.onDisconnect(listenerB);
    });

    await act(async () => {
      await captured!.disconnect('facebook');
    });

    for (const listener of [listenerA, listenerB]) {
      expect(listener).toHaveBeenCalledTimes(2);
      expect(listener).toHaveBeenCalledWith('facebook');
      expect(listener).toHaveBeenCalledWith('instagram');
    }
  });

  it('disconnect(tiktok) fires only the tiktok listener call', async () => {
    await seeded();
    const listener = vi.fn();
    act(() => {
      captured!.onDisconnect(listener);
    });

    await act(async () => {
      await captured!.disconnect('tiktok');
    });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith('tiktok');
  });

  it('an unsubscribed listener does not fire', async () => {
    await seeded();

    const listener = vi.fn();
    let unsubscribe: () => void = () => {};
    act(() => {
      unsubscribe = captured!.onDisconnect(listener);
    });
    act(() => unsubscribe());

    await act(async () => {
      await captured!.disconnect('facebook');
    });

    expect(listener).not.toHaveBeenCalled();
  });
});
