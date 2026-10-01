/**
 * Shared unread-alert count, so the sidebar's Dashboard badge shows the same
 * number the dashboard itself derives.
 *
 * The rail used to carry a literal `badge: 2` in layout/nav.ts — a placeholder
 * that survived into the authenticated app and told every operator they had two
 * unread alerts regardless of their data (it read "2" on a profile whose feed
 * said "No notifications yet"). The count has exactly one source now:
 * useDashboardState, which publishes into this store.
 *
 * `null` means "not known yet" — no dashboard has reported since this session
 * mounted — and renders no badge at all. That is deliberately different from
 * `0` ("known, and there is nothing unread"), which also renders no badge but
 * for a reason we can state. Never invent a number for either.
 *
 * Provider/hook shape mirrors services/targetSelectionStore.tsx, with one
 * difference: the hook does NOT throw without a provider. The dashboard hook
 * publishes into it from deep inside the tree and is unit-tested standalone;
 * a missing provider must degrade to "nobody is listening", not crash a screen.
 */
import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

export interface UnreadAlertsStore {
  /** Unread alerts for the operator's own categories; null until known. */
  unreadCount: number | null;
  setUnreadCount(count: number | null): void;
}

const NOOP_STORE: UnreadAlertsStore = { unreadCount: null, setUnreadCount: () => {} };

const UnreadAlertsContext = createContext<UnreadAlertsStore>(NOOP_STORE);

export function UnreadAlertsProvider({ children }: { children: ReactNode }) {
  const [unreadCount, setUnreadCount] = useState<number | null>(null);

  const value = useMemo<UnreadAlertsStore>(() => ({ unreadCount, setUnreadCount }), [unreadCount]);

  return <UnreadAlertsContext.Provider value={value}>{children}</UnreadAlertsContext.Provider>;
}

export function useUnreadAlerts(): UnreadAlertsStore {
  return useContext(UnreadAlertsContext);
}
