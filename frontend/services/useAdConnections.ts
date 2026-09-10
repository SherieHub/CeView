/**
 * Ad-platform connection state for one component.
 *
 * Deliberately a plain hook rather than a context provider like
 * connectionsStore.tsx: only Settings and the Performance ingestion form need
 * this, they never render together, and neither mutates state the other reads.
 * A provider would add a mount point in App.tsx for no benefit.
 */
import { useCallback, useEffect, useState } from 'react';
import type { AdConnection, AdProvider } from '../types';
import { apiClient } from './apiClient';

export interface AdConnectionsState {
  /** null while loading; [] once loaded (or failed). */
  connections: AdConnection[] | null;
  error: unknown | null;
  hasActive: boolean;
  forProvider(provider: AdProvider): AdConnection | null;
  refresh(): Promise<void>;
  disconnect(provider: AdProvider): Promise<void>;
  selectCampaign(provider: AdProvider, campaignId: string | null): Promise<void>;
}

export function useAdConnections(): AdConnectionsState {
  const [connections, setConnections] = useState<AdConnection[] | null>(null);
  const [error, setError] = useState<unknown | null>(null);

  const refresh = useCallback(async () => {
    try {
      setConnections(await apiClient.adConnections.list());
      setError(null);
    } catch (err) {
      // An empty array rather than null: the UI renders "nothing connected"
      // plus the error, instead of a skeleton that never resolves.
      setConnections([]);
      setError(err);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const disconnect = useCallback(
    async (provider: AdProvider) => {
      await apiClient.adConnections.disconnect(provider);
      await refresh();
    },
    [refresh],
  );

  const selectCampaign = useCallback(
    async (provider: AdProvider, campaignId: string | null) => {
      await apiClient.adConnections.selectCampaign(provider, campaignId);
      await refresh();
    },
    [refresh],
  );

  const forProvider = useCallback(
    (provider: AdProvider) => connections?.find((c) => c.provider === provider) ?? null,
    [connections],
  );

  return {
    connections,
    error,
    hasActive: (connections ?? []).some((c) => c.status === 'ACTIVE'),
    forProvider,
    refresh,
    disconnect,
    selectCampaign,
  };
}
