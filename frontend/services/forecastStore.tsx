/**
 * The dashboard's forecast data, held above the router so it survives navigating away and back.
 *
 * Until now useDashboardState kept all of this in local state, so every visit to /dashboard
 * started from skeletons and re-ran a load that waited on `forecast.ensure()` — which runs the
 * whole forecast pipeline when the stored forecast is stale. Now:
 *
 *  - The first render comes from the last snapshot: in memory if the operator has only navigated,
 *    or from localStorage (services/forecastCache.ts) after a reload or a return visit.
 *  - A sync reads alerts, keyword trends, AI health and the ranked markets for each of the
 *    operator's categories in parallel. `ensure` runs alongside, in the background; only when it
 *    reports that the pipeline ran are the reads repeated. Nothing waits on it.
 *  - A failed sync never blanks the screen: the snapshot stays and `refreshError` says it is old.
 *    `error` (the full error panel) is for "there is nothing to show" and an unfinished profile.
 *
 * `useForecastEngine` is all of the logic. `ForecastStoreProvider` mounts one for the signed-in
 * app (below ProfileGate, so it starts as soon as the operator lands anywhere after login) and
 * AuthGate unmounts it on logout. A screen rendered without the provider — unit tests, the dev
 * preview routes — runs its own un-persisted engine through the same hook.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { apiClient } from './apiClient';
import { isProfileNotReady } from './apiError';
import { categoriesKey, loadForecastCache, saveForecastCache } from './forecastCache';
import type { ForecastSnapshot } from './forecastCache';
import { useProfile } from './profileContext';
import { useUnreadAlerts } from './unreadAlertsStore';
import type { DemandAlert, EnsureForecastResult, Market, MarketsResponse } from '../types';

/** How old a snapshot may be before visiting the dashboard quietly refreshes it. */
export const STALE_AFTER_MS = 5 * 60 * 1000;

const EMPTY_SNAPSHOT: ForecastSnapshot = {
  alerts: [],
  keywordAlerts: [],
  marketsByCategory: {},
  aiServiceDown: false,
  readIds: [],
  fetchedAt: 0,
  generatedAt: null,
};

/** Demand alerts plus keyword-trend alerts, de-duplicated by id. */
export function mergeAlerts(alerts: DemandAlert[], keywordAlerts: DemandAlert[]): DemandAlert[] {
  if (keywordAlerts.length === 0) return alerts;
  const seen = new Set(alerts.map((a) => a.id));
  return [...alerts, ...keywordAlerts.filter((a) => !seen.has(a.id))];
}

/**
 * The alerts for the operator's own categories — there is no undifferentiated "all alerts" feed.
 * A legacy alert with no category stays visible rather than being treated as another tenant's.
 */
export function alertsForCategories(alerts: DemandAlert[], categories: string[]): DemandAlert[] {
  return alerts.filter((a) => a.category === null || categories.includes(a.category));
}

interface EnsureOutcome {
  refreshed: boolean;
  generatedAt: string | null;
  /** Set when the profile is not ready for forecasting (onboarding incomplete). */
  notReady: unknown | null;
}

export interface ForecastEngine {
  /** The last forecast read; null until the first read settles (and nothing was cached). */
  snapshot: ForecastSnapshot | null;
  /** `loading` only while there is nothing at all to show. */
  status: 'loading' | 'ready';
  /** A background sync (including `ensure`) is running. */
  syncing: boolean;
  /** The Refresh button's pipeline run is in progress. */
  isRefreshing: boolean;
  /** The full error panel: nothing to show, an unfinished profile, or a failed Refresh. */
  error: unknown | null;
  /** The last sync failed but the snapshot on screen is still good. */
  refreshError: unknown | null;
  isRead: (id: string) => boolean;
  /** Marks an alert read, here and on the server. */
  markRead: (id: string) => void;
  /** Loads a category's ranked markets if the snapshot does not already hold them. */
  loadCategory: (category: string) => Promise<void>;
  /** Re-runs the load only — never the forecast pipeline. What the error panel's Retry calls. */
  reload: () => Promise<void>;
  /** Runs the full forecast pipeline, then re-reads. What the Refresh button calls. */
  refreshForecast: () => Promise<MarketsResponse | null>;
  /** Syncs again when the snapshot is older than `maxAgeMs`; does nothing while one is running. */
  revalidateIfStale: (maxAgeMs?: number) => void;
}

interface EngineOptions {
  /** Keep the snapshot in localStorage so a reload shows it at once. */
  persist: boolean;
  /** Do nothing — for a screen that is reading from the provider instead. */
  disabled?: boolean;
}

export function useForecastEngine({ persist, disabled = false }: EngineOptions): ForecastEngine {
  const { profile } = useProfile();
  const profileId = profile.businessProfileId;
  const categories = profile.categories;
  const catKey = categoriesKey(categories);

  // The latest values, readable from callbacks that must keep a stable identity.
  const profileIdRef = useRef(profileId);
  const categoriesRef = useRef(categories);
  const persistRef = useRef(persist);
  profileIdRef.current = profileId;
  categoriesRef.current = categories;
  persistRef.current = persist;

  const hydrated = useRef<ForecastSnapshot | null | undefined>(undefined);
  if (hydrated.current === undefined) {
    hydrated.current = persist && !disabled && profileId ? loadForecastCache(profileId, categories) : null;
  }
  const [snapshot, setSnapshot] = useState<ForecastSnapshot | null>(hydrated.current);
  const snapshotRef = useRef<ForecastSnapshot | null>(hydrated.current);
  const [status, setStatus] = useState<'loading' | 'ready'>(hydrated.current ? 'ready' : 'loading');
  const [syncing, setSyncing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<unknown | null>(null);
  const [refreshError, setRefreshError] = useState<unknown | null>(null);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /** Newest read wins: bumped by a new sync, a Refresh, or a change of profile or categories. */
  const seq = useRef(0);
  const inFlight = useRef<Promise<void> | null>(null);
  const ensureRef = useRef<Promise<EnsureOutcome> | null>(null);
  const activeSyncs = useRef(0);

  const apply = useCallback((update: (prev: ForecastSnapshot | null) => ForecastSnapshot | null) => {
    const next = update(snapshotRef.current);
    snapshotRef.current = next;
    if (mountedRef.current) setSnapshot(next);
    // Only a snapshot that came from a successful read is worth keeping for next time.
    if (next && next.fetchedAt > 0 && persistRef.current && profileIdRef.current) {
      saveForecastCache(profileIdRef.current, categoriesRef.current, next);
    }
    return next;
  }, []);

  /**
   * Reads everything the dashboard shows and commits it. Returns the failure that mattered, or
   * null: a failed alert list, or every category failing. Keyword trends and the health probe are
   * best-effort — a probe that fails reads as "assume degraded", never "assume no alerts".
   */
  const readAndCommit = useCallback(
    async (mySeq: number): Promise<unknown | null> => {
      const cats = categoriesRef.current;
      const [[list, keywords, health], markets] = await Promise.all([
        Promise.allSettled([
          apiClient.notifications.list() as Promise<DemandAlert[]>,
          apiClient.notifications.keywordTrends() as Promise<DemandAlert[]>,
          apiClient.forecast.status() as Promise<{ available: boolean }>,
        ]),
        Promise.allSettled(cats.map((c) => apiClient.markets.forCategory(c) as Promise<Market[]>)),
      ]);
      if (!mountedRef.current || mySeq !== seq.current) return null;

      const listValue = list.status === 'fulfilled' ? list.value : null;
      const keywordValue = keywords.status === 'fulfilled' ? keywords.value : null;
      // A failed probe means "assume degraded", never "assume no alerts".
      const aiServiceDown = health.status !== 'fulfilled' || !health.value.available;

      let failure: unknown | null = null;
      if (list.status === 'rejected') failure = list.reason;
      else if (cats.length > 0 && markets.every((m) => m.status === 'rejected')) {
        failure = (markets[0] as PromiseRejectedResult).reason;
      }

      const hadSnapshot = (snapshotRef.current?.fetchedAt ?? 0) > 0;
      apply((prev) => {
        const base = prev ?? EMPTY_SNAPSHOT;
        const marketsByCategory = { ...base.marketsByCategory };
        markets.forEach((m, i) => {
          if (m.status === 'fulfilled') marketsByCategory[cats[i]] = m.value;
        });
        const serverRead = listValue ? listValue.filter((a) => a.isRead).map((a) => a.id) : [];
        return {
          alerts: listValue ?? base.alerts,
          keywordAlerts: keywordValue ?? base.keywordAlerts,
          marketsByCategory,
          aiServiceDown,
          // A union: reading again must never forget an alert the operator opened since.
          readIds: [...new Set([...base.readIds, ...serverRead])],
          fetchedAt: listValue ? Date.now() : base.fetchedAt,
          generatedAt: base.generatedAt,
        };
      });
      setStatus('ready');

      if (failure === null) {
        setError(null);
        setRefreshError(null);
      } else if (hadSnapshot) {
        // Keep showing what we have; just say it could not be refreshed.
        setRefreshError(failure);
      } else {
        setError(failure);
      }
      return failure;
    },
    [apply],
  );

  const runEnsure = useCallback(async (): Promise<EnsureOutcome> => {
    try {
      const result = (await apiClient.forecast.ensure()) as EnsureForecastResult | undefined;
      return {
        refreshed: result?.refreshed === true,
        generatedAt: typeof result?.generatedAt === 'string' ? result.generatedAt : null,
        notReady: null,
      };
    } catch (err) {
      // Anything but "onboarding incomplete" is not fatal here: the health probe already drives
      // the degraded state, and whatever alerts are persisted are still worth showing.
      return { refreshed: false, generatedAt: null, notReady: isProfileNotReady(err) ? err : null };
    }
  }, []);

  const sync = useCallback((): Promise<void> => {
    if (inFlight.current) return inFlight.current;

    const mySeq = ++seq.current;
    activeSyncs.current += 1;
    setSyncing(true);
    // In the background, alongside the reads: when the stored forecast is stale this is the
    // slow part, and nothing on screen should wait for it.
    const ensureP = runEnsure();
    ensureRef.current = ensureP;

    const run = (async () => {
      await readAndCommit(mySeq);
      const ensured = await ensureP;
      if (!mountedRef.current || mySeq !== seq.current) return;

      if (ensured.notReady !== null) {
        setError(ensured.notReady);
        setStatus('ready');
        return;
      }
      // The pipeline just ran, so what we read a moment ago is the old forecast.
      if (ensured.refreshed) await readAndCommit(mySeq);
      if (!mountedRef.current || mySeq !== seq.current) return;
      if (ensured.generatedAt !== null) {
        apply((prev) => (prev ? { ...prev, generatedAt: ensured.generatedAt } : prev));
      }
    })();

    const tracked: Promise<void> = run
      .catch(() => {})
      .finally(() => {
        if (inFlight.current === tracked) inFlight.current = null;
        activeSyncs.current -= 1;
        if (mountedRef.current) setSyncing(activeSyncs.current > 0);
      });
    inFlight.current = tracked;
    return tracked;
  }, [apply, readAndCommit, runEnsure]);

  // Sync when the engine starts, and again when the operator's profile or categories change.
  // Another PROFILE's forecast is never shown: the snapshot is dropped (for that profile's own
  // cache, if any). Changed CATEGORIES keep what is on screen and read the new ones behind it.
  const keyRef = useRef<{ profile: string; categories: string } | null>(null);
  useEffect(() => {
    if (disabled) return;
    const key = { profile: profileId ?? '', categories: catKey };
    const previous = keyRef.current;
    if (previous !== null && (previous.profile !== key.profile || previous.categories !== key.categories)) {
      // A sync already running was reading the old categories (or profile); do not reuse it.
      inFlight.current = null;
      seq.current += 1;
      if (previous.profile !== key.profile) {
        const cached = persist && profileId ? loadForecastCache(profileId, categoriesRef.current) : null;
        snapshotRef.current = cached;
        setSnapshot(cached);
        setStatus(cached ? 'ready' : 'loading');
        setError(null);
        setRefreshError(null);
      }
    }
    keyRef.current = key;
    void sync();
  }, [disabled, profileId, catKey, persist, sync]);

  const reload = useCallback(async () => {
    await sync();
  }, [sync]);

  const revalidateIfStale = useCallback(
    (maxAgeMs: number = STALE_AFTER_MS) => {
      if (inFlight.current) return;
      const current = snapshotRef.current;
      if (current && current.fetchedAt > 0 && Date.now() - current.fetchedAt < maxAgeMs) return;
      void sync();
    },
    [sync],
  );

  const refreshForecast = useCallback(async (): Promise<MarketsResponse | null> => {
    setIsRefreshing(true);
    try {
      // The pipeline may already be running for `ensure`; let it finish rather than race it.
      await ensureRef.current;
      const result = (await apiClient.forecast.analyze()) as MarketsResponse;
      const mySeq = ++seq.current;
      const failure = await readAndCommit(mySeq);
      if (failure !== null) throw failure;
      apply((prev) => (prev ? { ...prev, generatedAt: new Date().toISOString() } : prev));
      return result;
    } catch (err) {
      if (mountedRef.current) setError(err);
      return null;
    } finally {
      if (mountedRef.current) setIsRefreshing(false);
    }
  }, [apply, readAndCommit]);

  const loadCategory = useCallback(
    async (category: string) => {
      if (snapshotRef.current?.marketsByCategory[category]) return;
      try {
        const list = (await apiClient.markets.forCategory(category)) as Market[];
        if (!mountedRef.current) return;
        apply((prev) => {
          const base = prev ?? EMPTY_SNAPSHOT;
          return { ...base, marketsByCategory: { ...base.marketsByCategory, [category]: list } };
        });
      } catch (err) {
        if (mountedRef.current) setError(err);
      }
    },
    [apply],
  );

  const markRead = useCallback(
    (id: string) => {
      const current = snapshotRef.current;
      if (!current || current.readIds.includes(id)) return;
      // Optimistic: a failed write is not worth surfacing.
      void apiClient.notifications.markRead(id).catch(() => {});
      apply((prev) => (prev ? { ...prev, readIds: [...prev.readIds, id] } : prev));
    },
    [apply],
  );

  const readSet = useMemo(() => new Set(snapshot?.readIds ?? []), [snapshot?.readIds]);
  const isRead = useCallback((id: string) => readSet.has(id), [readSet]);

  return {
    snapshot,
    status,
    syncing,
    isRefreshing,
    error,
    refreshError,
    isRead,
    markRead,
    loadCategory,
    reload,
    refreshForecast,
    revalidateIfStale,
  };
}

const ForecastStoreContext = createContext<ForecastEngine | null>(null);

export function ForecastStoreProvider({ children }: { children: ReactNode }) {
  const engine = useForecastEngine({ persist: true });
  const { profile } = useProfile();
  const { setUnreadCount } = useUnreadAlerts();

  // The sidebar badge shows the same figure as the dashboard's own count, on every route.
  const { snapshot, status, isRead } = engine;
  const unread = useMemo(() => {
    if (!snapshot || status === 'loading') return null;
    const mine = alertsForCategories(mergeAlerts(snapshot.alerts, snapshot.keywordAlerts), profile.categories);
    return mine.filter((a) => !isRead(a.id)).length;
  }, [snapshot, status, isRead, profile.categories]);
  useEffect(() => {
    setUnreadCount(unread);
  }, [unread, setUnreadCount]);

  return <ForecastStoreContext.Provider value={engine}>{children}</ForecastStoreContext.Provider>;
}

/** The shared forecast store, or null when no provider is mounted (tests, preview routes). */
export function useOptionalForecastStore(): ForecastEngine | null {
  return useContext(ForecastStoreContext);
}
