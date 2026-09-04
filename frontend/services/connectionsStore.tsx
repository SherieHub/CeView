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
import type { PlatformConnection, PlatformId } from '../types';
import { apiClient } from './apiClient';

export interface ConnectionsStore {
  connections: PlatformConnection[] | null;
  isConnected(platform: PlatformId): boolean;
  connect(platform: PlatformId, handle: string): Promise<void>;
  disconnect(platform: PlatformId): Promise<void>;
  onDisconnect(cb: (platform: PlatformId) => void): () => void;
}

function nowISO(): string {
  return new Date().toISOString();
}

const ConnectionsStoreContext = createContext<ConnectionsStore | null>(null);

export function ConnectionsStoreProvider({ children }: { children: ReactNode }) {
  const [connections, setConnections] = useState<PlatformConnection[] | null>(null);
  const listeners = useRef(new Set<(platform: PlatformId) => void>());

  useEffect(() => {
    apiClient.connections.list().then((list) => setConnections(list as PlatformConnection[]));
  }, []);

  function isConnected(platform: PlatformId): boolean {
    return connections?.find((c) => c.platform === platform)?.connected ?? false;
  }

  async function connect(platform: PlatformId, handle: string): Promise<void> {
    await apiClient.connections.connect(platform);
    setConnections((prev) =>
      (prev ?? []).map((c) =>
        c.platform === platform ? { ...c, connected: true, handle, connectedAt: nowISO() } : c
      )
    );
  }

  async function disconnect(platform: PlatformId): Promise<void> {
    await apiClient.connections.disconnect(platform);
    setConnections((prev) =>
      (prev ?? []).map((c) =>
        c.platform === platform ? { ...c, connected: false, handle: null, connectedAt: null } : c
      )
    );
    listeners.current.forEach((cb) => cb(platform));
  }

  function onDisconnect(cb: (platform: PlatformId) => void): () => void {
    listeners.current.add(cb);
    return () => listeners.current.delete(cb);
  }

  const value = useMemo<ConnectionsStore>(
    () => ({ connections, isConnected, connect, disconnect, onDisconnect }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [connections]
  );

  return <ConnectionsStoreContext.Provider value={value}>{children}</ConnectionsStoreContext.Provider>;
}

export function useConnections(): ConnectionsStore {
  const ctx = useContext(ConnectionsStoreContext);
  if (!ctx) throw new Error('useConnections must be used within a ConnectionsStoreProvider');
  return ctx;
}
