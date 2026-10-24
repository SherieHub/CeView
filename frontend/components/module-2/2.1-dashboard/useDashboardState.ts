/**
 * CARD — Foundation: Dashboard & Radar Shell
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/03-module-2.md
 * Screen doc: docs/module-2/screens/dashboard.md
 *
 * The dashboard's whole state machine. Ports `setDashMode`, `selectAlert` and
 * `refreshForecast` from ui-ux-prototype.html:2352-2528.
 *
 * SCOPE NOTE: 03-module-2.md lists this hook as living inside DashboardView.tsx.
 * It is extracted here because the hook is the testable surface named in that
 * card's Definition of Done, and keeping it separate lets DashboardView stay
 * purely presentational.
 *
 * The forecast DATA (alerts, keyword trends, per-category markets, AI health, read state) no
 * longer lives here: it is held by the forecast store (services/forecastStore.tsx) so it survives
 * navigating away and back. This hook keeps the screen's own state — the selected alert, the feed
 * filter, the pinned category — and derives everything the view renders from the store's snapshot.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  alertsForCategories,
  mergeAlerts,
  useForecastEngine,
  useOptionalForecastStore,
} from '../../../services/forecastStore';
import { useProfile } from '../../../services/profileContext';
import { useUnreadAlerts } from '../../../services/unreadAlertsStore';
import { isSurge } from '@/types';
import type { Market, MarketsResponse } from '@/types';
import type { DemandAlert } from '@/types';

export type DashMode = 'loading' | 'empty' | 'normal' | 'ai-down';
export type FeedFilter = 'all' | 'unread' | 'surge';

export interface DashboardState {
  mode: DashMode;
  /** Alerts matching the operator's own categories — what the feed renders. */
  myAlerts: DemandAlert[];
  /** myAlerts after the active feed filter. */
  visibleAlerts: DemandAlert[];
  unreadCount: number;
  surgeCount: number;
  isRead: (id: string) => boolean;
  selectedAlertId: string | null;
  selectedAlert: DemandAlert | null;
  /** Markets re-ranked for the selected alert's category; empty when none. */
  rankedMarkets: Market[];
  showMarkets: boolean;
  surgeMarkets: string[];
  topMarket: {
    id: string;
    name: string;
    matchScore: number;
    category: string;
    dataStale: boolean;
    dataAsOf: string | null;
    dataStaleCause: string | null;
  } | null;
  feedFilter: FeedFilter;
  isRefreshing: boolean;
  /** A background sync is running while data is already on screen. */
  syncing: boolean;
  /** When the forecast was generated (ISO-8601, from the backend); null when not known. */
  generatedAt: string | null;
  /** When the data on screen was last read from the server (ms since epoch); null before any read. */
  fetchedAt: number | null;
  /** The last sync failed but the data on screen is still good. */
  refreshError: unknown | null;
  /** Non-null when there is nothing to show; render <ApiErrorPanel error={error} />. */
  error: unknown | null;
  selectAlert: (id: string) => void;
  /** Loads rankedMarkets for this category with no alert selected — what
   *  "Top market now" calls before navigating so the drawer opens populated
   *  instead of looking up its id in an empty list (Step 18). */
  pinCategory: (category: string) => void;
  setFeedFilter: (filter: FeedFilter) => void;
  /** Runs the full forecast pipeline — what the Refresh button calls. Reloads
   *  alerts, topMarket, keyword alerts and rankedMarkets on success; sets
   *  `error` and returns null on failure rather than throwing, so a caller
   *  never mistakes a failed run for a successful zero-market one. */
  refresh: () => Promise<MarketsResponse | null>;
  /** Re-runs only the initial load (alerts + health + markets) — never the
   *  forecast pipeline. What ApiErrorPanel's Retry action calls. */
  retry: () => Promise<void>;
}

interface Options {
  /**
   * Dev-preview override — pins the machine to one mode so every state can be
   * reached without a backend. The React equivalent of the prototype's
   * `setDashMode()` switcher. Never set by the authenticated app.
   */
  forceMode?: DashMode;
}

function matchesFilter(alert: DemandAlert, filter: FeedFilter, read: { has: (id: string) => boolean }): boolean {
  if (filter === 'unread') return !read.has(alert.id);
  if (filter === 'surge') return isSurge(alert);
  return true;
}

export function useDashboardState({ forceMode }: Options = {}): DashboardState {
  const { profile } = useProfile();

  // The forecast data lives in the shared store (kept across navigation, cached per profile). A
  // screen rendered without the provider — unit tests, the dev preview routes — runs its own
  // un-persisted engine through the same hook, so both paths behave identically.
  const shared = useOptionalForecastStore();
  const local = useForecastEngine({ persist: false, disabled: shared !== null });
  const engine = shared ?? local;
  const { snapshot, status, isRead, markRead, loadCategory } = engine;

  // Coming back to the dashboard shows what is cached at once; this only refreshes it quietly
  // when it has gone stale. (A sync that is already running is never started twice.)
  const revalidate = shared?.revalidateIfStale;
  useEffect(() => {
    revalidate?.();
  }, [revalidate]);

  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [feedFilter, setFeedFilter] = useState<FeedFilter>('all');

  const aiServiceDown = snapshot?.aiServiceDown ?? false;

  /** Primary alerts plus keyword trends, de-duplicated by id. */
  const allAlerts = useMemo(
    () => mergeAlerts(snapshot?.alerts ?? [], snapshot?.keywordAlerts ?? []),
    [snapshot?.alerts, snapshot?.keywordAlerts],
  );

  // The category scoping IS Module 2's (category, market) signal grid — there
  // is no undifferentiated "all alerts" feed in the real system either.
  // ui-ux-prototype.html:2376.
  const myAlerts = useMemo(
    // Legacy alerts can have no category. Keep them visible rather than
    // silently treating an incomplete historical row as another tenant's data.
    () => alertsForCategories(allAlerts, profile.categories),
    [allAlerts, profile.categories],
  );

  const unreadCount = useMemo(() => myAlerts.filter((a) => !isRead(a.id)).length, [myAlerts, isRead]);

  const surgeCount = useMemo(() => myAlerts.filter(isSurge).length, [myAlerts]);

  // The sidebar's Dashboard badge shows this same figure. With the shared store mounted, the store
  // publishes it (so the badge is right on every route); a standalone screen publishes its own.
  // Null while loading avoids a stale or invented badge.
  const { setUnreadCount } = useUnreadAlerts();
  useEffect(() => {
    if (shared) return;
    setUnreadCount(status === 'loading' ? null : unreadCount);
  }, [shared, status, unreadCount, setUnreadCount]);

  const visibleAlerts = useMemo(
    () => myAlerts.filter((a) => matchesFilter(a, feedFilter, { has: isRead })),
    [myAlerts, feedFilter, isRead],
  );

  // Resolved against myAlerts, never alerts: if the operator's categories
  // changed since the pick, a stale selection must not render a markets column.
  // ui-ux-prototype.html:2382-2383.
  const selectedAlert = useMemo(
    () => (selectedAlertId ? myAlerts.find((a) => a.id === selectedAlertId) ?? null : null),
    [selectedAlertId, myAlerts],
  );

  /**
   * Step 18 (C-21/C-22/C-23): "Top market now" opened `?market=<id>` but the
   * drawer only ever looked the id up in `rankedMarkets`, which stays empty
   * until an alert is selected — so from a cold dashboard the drawer silently
   * never opened. Trade-off picked here over passing the drawer a second,
   * separately-loaded markets list: `pinnedCategory` lets "Top market now"
   * drive the SAME rankedMarkets state/loader an alert selection already
   * uses, so there is one fetch path and the drawer keeps a single markets
   * prop — at the cost of rankedMarkets no longer meaning only "the selected
   * alert's category". An alert selection still wins whenever one exists
   * (see activeCategory below), so this never fights a real alert pick.
   */
  const [pinnedCategory, setPinnedCategory] = useState<string | null>(null);
  const activeCategory = selectedAlert?.category ?? pinnedCategory;

  // The store already holds the ranking for each of the operator's categories, so this is
  // instant; it only fetches for a category it has not read (a no-op otherwise).
  useEffect(() => {
    if (activeCategory) void loadCategory(activeCategory);
  }, [activeCategory, loadCategory]);

  const rankedMarkets = useMemo<Market[]>(
    () => (activeCategory ? snapshot?.marketsByCategory[activeCategory] ?? [] : []),
    [activeCategory, snapshot?.marketsByCategory],
  );

  /** "Top market now" pins its category so rankedMarkets loads for it even
   *  with no alert selected — see the trade-off note above pinnedCategory. */
  const pinCategory = useCallback((category: string) => {
    setPinnedCategory(category);
  }, []);

  /** Markets named by the confirmed-surge alerts, de-duplicated, for the summary. */
  const surgeMarkets = useMemo(
    () => [...new Set(myAlerts.filter(isSurge).map((a) => a.market))],
    [myAlerts],
  );

  /**
   * The single best-scoring market across every category the operator covers.
   * Answers "where should I be pointing right now" without first picking an
   * alert — the question the prototype's dashboard could not answer at a glance.
   * Read from the cached per-category rankings: one category missing (still loading, or it
   * failed) never blanks a leader the others did return.
   */
  const topMarket = useMemo<DashboardState['topMarket']>(() => {
    let best: DashboardState['topMarket'] = null;
    for (const category of profile.categories) {
      const leader = snapshot?.marketsByCategory[category]?.[0];
      if (leader && (!best || leader.matchScore > best.matchScore)) {
        best = {
          id: leader.id,
          name: leader.name,
          matchScore: leader.matchScore,
          category,
          // Step 18 (C-21/C-22/C-23): carried through so the stale banner can
          // be evaluated from topMarket, not only from an alert's rankedMarkets
          // (which stays empty until an alert is selected).
          dataStale: leader.dataStale,
          dataAsOf: leader.dataAsOf,
          dataStaleCause: leader.dataStaleCause,
        };
      }
    }
    return best;
  }, [profile.categories, snapshot?.marketsByCategory]);

  const mode: DashMode = useMemo(() => {
    if (forceMode) return forceMode;
    // Only while there is nothing at all to show: a cached or already-loaded snapshot goes
    // straight to its real state, however long the background refresh takes.
    if (status === 'loading') return 'loading';
    // Degraded is checked BEFORE empty, and the order matters: a failed load
    // also leaves `alerts` empty, so checking empty first would tell an
    // operator they have no alerts when the request simply never arrived.
    // "Your data may be stale" is honest; "you have nothing" is not.
    if (aiServiceDown) return 'ai-down';
    // `empty` means nothing has been loaded at all — distinct from "your
    // categories match nothing right now", which the feed renders from
    // myAlerts.length. Different copy, different remedy.
    //
    // Counted over allAlerts, not `alerts`: keyword-trend alerts arrive on
    // their own hop and are already counted by unreadCount/surgeCount below.
    // Deriving `empty` from the demand-alert list alone let the feed render
    // "No notifications yet" while the tiles above it counted keyword alerts
    // the operator had no way to reach. One list decides both.
    if (allAlerts.length === 0) return 'empty';
    return 'normal';
  }, [forceMode, status, allAlerts.length, aiServiceDown]);

  const showMarkets = (mode === 'normal' || mode === 'ai-down') && selectedAlert != null;

  const selectAlert = useCallback(
    (id: string) => {
      // Re-clicking the open alert collapses it. Read state is not undone.
      if (id === selectedAlertId) {
        setSelectedAlertId(null);
        return;
      }
      setSelectedAlertId(id);
      // Viewing an alert's forecast is what marks it read — not a separate action.
      markRead(id);
    },
    [selectedAlertId, markRead],
  );

  return {
    mode,
    myAlerts,
    visibleAlerts,
    unreadCount,
    surgeCount,
    isRead,
    selectedAlertId,
    selectedAlert,
    rankedMarkets,
    showMarkets,
    surgeMarkets,
    topMarket,
    feedFilter,
    isRefreshing: engine.isRefreshing,
    syncing: engine.syncing,
    generatedAt: snapshot?.generatedAt ?? null,
    fetchedAt: snapshot && snapshot.fetchedAt > 0 ? snapshot.fetchedAt : null,
    refreshError: engine.refreshError,
    error: engine.error,
    selectAlert,
    pinCategory,
    setFeedFilter,
    // Runs the full forecast pipeline (the Refresh button's job — never what the error panel's
    // Retry calls). On failure it sets `error` and returns null rather than throwing, so a caller
    // never mistakes a failed run for a successful zero-market one.
    refresh: engine.refreshForecast,
    // Re-runs only the load — never the forecast pipeline.
    retry: engine.reload,
  };
}
