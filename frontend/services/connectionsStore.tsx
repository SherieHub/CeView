/**
 * CARD — Foundation: Shared Stores
 * Depends on: Foundation — Fixture Data Layer
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/04-module-3.md
 * Pseudocode: pseudocode/module-3/foundation-shared-stores.ts
 *
 * Platform-connection state shared across Module 3 (Content Studio, Settings)
 * — one instance per app, seeded once. Provider/hook shape mirrors
 * services/profileContext.tsx.
 *
 * SCOPE NOTE: the card's milestone says both stores mount above AppShell in
 * App.tsx, but that file isn't in this card's file list — flagged as a gap,
 * not touched here (same discipline as every other card this session).
 *
 * Named .tsx (not .ts, despite the card text) since ConnectionsStoreProvider
 * renders JSX — same reasoning as obDraft.tsx in Module 1.
 */
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { PlatformConnection, PlatformId, SocialStatus } from '../types';
import { apiClient } from './apiClient';
import { isNotAvailable } from './apiError';
import { navigateTo } from './navigation';

export interface ConnectionsStore {
  connections: PlatformConnection[] | null;
  /** False when the backend has no publishing-connections feature (404). */
  available: boolean;
  isConnected(platform: PlatformId): boolean;
  statusOf(platform: PlatformId): SocialStatus;
  /**
   * Starts the platform's OAuth login by navigating away (Facebook/Instagram share Meta's
   * login). Resolves without navigating in fixture mode, marking the platform connected locally.
   */
  connect(platform: PlatformId): Promise<void>;
  disconnect(platform: PlatformId): Promise<void>;
  /** Re-reads the list from the server. */
  refresh(): Promise<void>;
  onDisconnect(cb: (platform: PlatformId) => void): () => void;
}

const ConnectionsStoreContext = createContext<ConnectionsStore | null>(null);

export function ConnectionsStoreProvider({ children }: { children: ReactNode }) {
  const [connections, setConnections] = useState<PlatformConnection[] | null>(null);
  const [available, setAvailable] = useState(true);
  const listeners = useRef(new Set<(platform: PlatformId) => void>());

  // Newest request wins: an older response that resolves late must not overwrite a newer one.
  const requestSeq = useRef(0);
  // Whether a list has ever loaded — a failed REFRESH keeps it rather than blanking the screen.
  const loadedRef = useRef(false);

  async function load(): Promise<void> {
    const seq = ++requestSeq.current;
    try {
      const list = (await apiClient.connections.list()) as PlatformConnection[];
      if (seq !== requestSeq.current) return;
      loadedRef.current = true;
      setAvailable(true);
      setConnections(list);
    } catch (error) {
      if (seq !== requestSeq.current) return;
      setAvailable(!isNotAvailable(error));
      if (loadedRef.current) return; // refresh failure: keep what we already know
      // A failed initial fetch (expired session, dropped connection, 500)
      // must not leave every screen that reads `connections` — Settings,
      // Content Studio's publish picker — stuck on its loading skeleton
      // forever with no way to recover short of a hard refresh. Falling
      // back to an empty list renders every platform as disconnected,
      // which is honest: nothing here is confirmed connected right now.
      setConnections([]);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function isConnected(platform: PlatformId): boolean {
    return connections?.find((c) => c.platform === platform)?.connected ?? false;
  }

  function statusOf(platform: PlatformId): SocialStatus {
    return connections?.find((c) => c.platform === platform)?.status ?? 'DISCONNECTED';
  }

  function markConnectedLocally(platforms: PlatformId[]) {
    setConnections((prev) =>
      (prev ?? []).map((c) =>
        platforms.includes(c.platform)
          ? { ...c, connected: true, status: 'ACTIVE', handle: c.handle ?? 'Demo account', connectedAt: new Date().toISOString() }
          : c
      )
    );
  }

  async function connect(platform: PlatformId): Promise<void> {
    const { authorizeUrl } =
      platform === 'tiktok'
        ? await apiClient.connections.tiktokAuthorize()
        : await apiClient.adConnections.authorize('meta');
    if (authorizeUrl.startsWith('#')) {
      // Fixture mode: no OAuth to run.
      markConnectedLocally(platform === 'tiktok' ? ['tiktok'] : ['facebook', 'instagram']);
      return;
    }
    navigateTo(authorizeUrl);
  }

  async function disconnect(platform: PlatformId): Promise<void> {
    await apiClient.connections.disconnect(platform);
    await load();
    // Facebook and Instagram are one grant: disconnecting either disconnects both.
    const affected: PlatformId[] = platform === 'tiktok' ? ['tiktok'] : ['facebook', 'instagram'];
    affected.forEach((p) => listeners.current.forEach((cb) => cb(p)));
  }

  function onDisconnect(cb: (platform: PlatformId) => void): () => void {
    listeners.current.add(cb);
    return () => listeners.current.delete(cb);
  }

  const value = useMemo<ConnectionsStore>(
    () => ({ connections, available, isConnected, statusOf, connect, disconnect, refresh: load, onDisconnect }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [connections, available]
  );

  return <ConnectionsStoreContext.Provider value={value}>{children}</ConnectionsStoreContext.Provider>;
}

export function useConnections(): ConnectionsStore {
  const ctx = useContext(ConnectionsStoreContext);
  if (!ctx) throw new Error('useConnections must be used within a ConnectionsStoreProvider');
  return ctx;
}
