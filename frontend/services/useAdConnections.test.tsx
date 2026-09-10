/**
 * The hook is deliberately not a context provider: only two components need
 * this data and neither shares state with the other, so each fetches its own.
 */
import { renderHook, waitFor, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAdConnections } from './useAdConnections';
import type { AdConnection } from '../types';

const listMock = vi.fn();
const disconnectMock = vi.fn();

vi.mock('./apiClient', () => ({
  apiClient: {
    adConnections: {
      list: () => listMock(),
      disconnect: (...args: unknown[]) => disconnectMock(...args),
    },
  },
}));

const META_ACTIVE: AdConnection = {
  provider: 'meta',
  configured: true,
  status: 'ACTIVE',
  accountName: 'Cebu Dive Co. Ads',
  currency: 'PHP',
  connectedAt: '2026-08-20T02:14:00Z',
  lastSyncedAt: null,
};

const TIKTOK_OFF: AdConnection = {
  provider: 'tiktok',
  configured: false,
  status: 'DISCONNECTED',
  accountName: null,
  currency: null,
  connectedAt: null,
  lastSyncedAt: null,
};

beforeEach(() => {
  listMock.mockReset();
  disconnectMock.mockReset();
  listMock.mockResolvedValue([META_ACTIVE, TIKTOK_OFF]);
  disconnectMock.mockResolvedValue({ ok: true });
});

describe('useAdConnections', () => {
  it('starts null then loads the connections', async () => {
    const { result } = renderHook(() => useAdConnections());
    expect(result.current.connections).toBeNull();
    await waitFor(() => expect(result.current.connections).toHaveLength(2));
  });

  it('reports whether any provider is active', async () => {
    const { result } = renderHook(() => useAdConnections());
    await waitFor(() => expect(result.current.hasActive).toBe(true));
  });

  it('reports no active provider when none is connected', async () => {
    listMock.mockResolvedValue([TIKTOK_OFF]);
    const { result } = renderHook(() => useAdConnections());
    await waitFor(() => expect(result.current.connections).toHaveLength(1));
    expect(result.current.hasActive).toBe(false);
  });

  it('finds one provider by key', async () => {
    const { result } = renderHook(() => useAdConnections());
    await waitFor(() => expect(result.current.connections).toHaveLength(2));
    expect(result.current.forProvider('meta')?.accountName).toBe('Cebu Dive Co. Ads');
  });

  it('disconnecting refetches the list', async () => {
    const { result } = renderHook(() => useAdConnections());
    await waitFor(() => expect(result.current.connections).toHaveLength(2));

    await act(async () => {
      await result.current.disconnect('meta');
    });

    expect(disconnectMock).toHaveBeenCalledWith('meta');
    expect(listMock).toHaveBeenCalledTimes(2);
  });

  it('surfaces a load failure instead of hanging on null', async () => {
    listMock.mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => useAdConnections());
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.connections).toEqual([]);
  });
});
