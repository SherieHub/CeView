import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';
import { ConnectionsStoreProvider, useConnections } from './connectionsStore';
import type { ConnectionsStore } from './connectionsStore';
import type { PlatformConnection } from '../types';

const MOCK_CONNECTIONS: PlatformConnection[] = [
  { platform: 'instagram', connected: true, handle: '@cebu.dive', connectedAt: '2026-05-01T00:00:00Z' },
  { platform: 'tiktok', connected: false, handle: null, connectedAt: null },
  { platform: 'facebook', connected: true, handle: 'Cebu Dive Co.', connectedAt: '2026-04-12T00:00:00Z' },
  { platform: 'naver', connected: false, handle: null, connectedAt: null },
];

vi.mock('./apiClient', () => ({
  apiClient: {
    connections: {
      list: vi.fn(() => Promise.resolve(MOCK_CONNECTIONS)),
      connect: vi.fn(() => Promise.resolve({ ok: true })),
      disconnect: vi.fn(() => Promise.resolve({ ok: true })),
    },
  },
}));

import { apiClient } from './apiClient';

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
  vi.mocked(apiClient.connections.connect).mockResolvedValue({ ok: true });
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
  it('starts with connections=null then seeds from apiClient.connections.list()', async () => {
    renderProbe();
    expect(captured?.connections).toBeNull();

    await waitFor(() => expect(captured?.connections).not.toBeNull());
    expect(captured?.connections).toEqual(MOCK_CONNECTIONS);
  });

  it('isConnected() reflects the seeded state per platform', async () => {
    await seeded();
    expect(captured!.isConnected('instagram')).toBe(true);
    expect(captured!.isConnected('tiktok')).toBe(false);
  });
});

describe('ConnectionsStoreProvider — connect()/disconnect()', () => {
  it('connect() marks the platform connected with the given handle', async () => {
    await seeded();

    await act(async () => {
      await captured!.connect('tiktok', '@newhandle');
    });

    expect(apiClient.connections.connect).toHaveBeenCalledWith('tiktok');
    expect(captured!.isConnected('tiktok')).toBe(true);
    const entry = captured!.connections!.find((c) => c.platform === 'tiktok');
    expect(entry?.handle).toBe('@newhandle');
    expect(entry?.connectedAt).toEqual(expect.any(String));
  });

  it('disconnect() marks the platform disconnected and clears handle/connectedAt', async () => {
    await seeded();

    await act(async () => {
      await captured!.disconnect('instagram');
    });

    expect(apiClient.connections.disconnect).toHaveBeenCalledWith('instagram');
    expect(captured!.isConnected('instagram')).toBe(false);
    const entry = captured!.connections!.find((c) => c.platform === 'instagram');
    expect(entry?.handle).toBeNull();
    expect(entry?.connectedAt).toBeNull();
  });
});

describe('ConnectionsStoreProvider — onDisconnect()', () => {
  it('fires every registered listener exactly once per disconnect() call', async () => {
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

    expect(listenerA).toHaveBeenCalledTimes(1);
    expect(listenerA).toHaveBeenCalledWith('facebook');
    expect(listenerB).toHaveBeenCalledTimes(1);
    expect(listenerB).toHaveBeenCalledWith('facebook');
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
