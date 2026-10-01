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
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiClient } from '../../../services/apiClient';
import { isProfileNotReady } from '../../../services/apiError';
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
  /** Non-null when the initial load failed; render <ApiErrorPanel error={error} />. */
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
  /** Re-runs only the initial load (ensure + alerts + health) — never the
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

function matchesFilter(alert: DemandAlert, filter: FeedFilter, read: Set<string>): boolean {
  if (filter === 'unread') return !read.has(alert.id);
  if (filter === 'surge') return isSurge(alert);
  return true;
}

export function useDashboardState({ forceMode }: Options = {}): DashboardState {
  const { profile } = useProfile();

  const [status, setStatus] = useState<'loading' | 'ready'>('loading');
  const [alerts, setAlerts] = useState<DemandAlert[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [aiServiceDown, setAiServiceDown] = useState(false);

  // Shared cancellation guard: every imperative loader below (mount effects
  // AND refresh()/retry()'s explicit reloads) checks this before writing
  // state, so an unmount mid-request never produces a React warning or a
  // stale write — one mechanism instead of a per-effect `cancelled` local.
  const mountedRef = useRef(true);
  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    [],
  );
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [feedFilter, setFeedFilter] = useState<FeedFilter>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<unknown | null>(null);

  /**
   * The initial load: ensure a fresh forecast, then read alerts + health.
   * Shared by the mount effect and `retry` (Step 17, C-19/C-20) — Retry must
   * re-run exactly this, never the forecast pipeline (that's `refresh`, the
   * Refresh button's job, below).
   */
  const loadDashboard = useCallback(async () => {
    // Step 16 (C-07/C-08/C-09): ensure a fresh forecast BEFORE reading
    // alerts, so a new or stale-data operator sees real alerts on this very
    // load instead of an empty feed until they press Refresh. Cheap when
    // data is already fresh (ForecastingService.ensureFreshForecast is a DB
    // read in that case) and this call's own failure must never block the
    // fallback read below — the only outcome that changes this screen's
    // flow is "onboarding incomplete", which ApiErrorPanel already renders
    // as its own dedicated panel via isProfileNotReady().
    try {
      await apiClient.forecast.ensure();
    } catch (err) {
      if (!mountedRef.current) return;
      if (isProfileNotReady(err)) {
        setError(err);
        setStatus('ready');
        return;
      }
      // AI down, no market data yet, etc. — not fatal here; the health
      // probe below already drives the ai-down state, and whatever alerts
      // are already persisted are still worth showing.
    }
    if (!mountedRef.current) return;

    // allSettled, not all: a health-check failure must never be able to
    // discard a successfully-fetched alert list. See Task 12.
    const [listResult, healthResult] = await Promise.allSettled([
      apiClient.notifications.list() as Promise<DemandAlert[]>,
      apiClient.forecast.status() as Promise<{ available: boolean }>,
    ]);
    if (!mountedRef.current) return;

    if (listResult.status === 'fulfilled') {
      setAlerts(listResult.value);
      // Seed read state from the server's view once, then own it locally.
      setReadIds(new Set(listResult.value.filter((a) => a.isRead).map((a) => a.id)));
      // A successful retry after a previous failure must clear that failure —
      // otherwise ApiErrorPanel would keep showing a stale error over data
      // that just loaded fine.
      setError(null);
    } else {
      // A failed alert load IS worth surfacing — unlike the health probe,
      // there is no honest degraded fallback for "we don't know what your
      // alerts are".
      setError(listResult.reason);
    }

    // A failed health probe means "assume degraded", never "assume no
    // alerts" — that would silently blank a successful alert load above.
    setAiServiceDown(healthResult.status !== 'fulfilled' || !healthResult.value.available);

    setStatus('ready');
  }, []);

  useEffect(() => {
    // Note the fetch runs even under forceMode: the `normal` and `ai-down`
    // previews need real fixture alerts to render. forceMode only overrides the
    // derived `mode` below, and `loading`/`empty` render their own states
    // regardless of what was loaded.
    void loadDashboard();
  }, [loadDashboard]);

  /** ApiErrorPanel's Retry action. Re-runs the initial load only — see
   *  loadDashboard's doc comment for why this must never call refresh(). */
  const retry = useCallback(async () => {
    await loadDashboard();
  }, [loadDashboard]);

  /**
   * Keyword-trend alerts are held in their OWN state rather than merged into
   * `alerts`, because both loads are independent effects that would otherwise
   * race on one setter: if this resolved first, the primary load's
   * `setAlerts(listResult.value)` would overwrite it.
   *
   * Both are now DB reads, but they remain separate because the scheduled
   * keyword producer may update its rows independently of demand alerts.
   */
  const [keywordAlerts, setKeywordAlerts] = useState<DemandAlert[]>([]);

  /** Shared by the mount effect and refresh() (Step 17) — a pipeline run can
   *  change which keyword trends are current, so refresh must reload this
   *  explicitly rather than lean on an incidental re-render. */
  const loadKeywordAlerts = useCallback(async () => {
    try {
      const extra = await apiClient.notifications.keywordTrends();
      if (mountedRef.current) setKeywordAlerts(extra);
    } catch {
      // A slow or failing keyword-trend fetch must never blank the feed or
      // surface as a dashboard error — the demand alerts are the primary data.
      // This is a deliberate swallow, not the silent-catch bug fixed elsewhere:
      // nothing the operator would otherwise see is lost.
    }
  }, []);

  useEffect(() => {
    void loadKeywordAlerts();
  }, [loadKeywordAlerts]);

  /** Primary alerts plus keyword trends, de-duplicated by id. */
  const allAlerts = useMemo(() => {
    if (keywordAlerts.length === 0) return alerts;
    const seen = new Set(alerts.map((a) => a.id));
    return [...alerts, ...keywordAlerts.filter((a) => !seen.has(a.id))];
  }, [alerts, keywordAlerts]);

  const isRead = useCallback((id: string) => readIds.has(id), [readIds]);

  // The category scoping IS Module 2's (category, market) signal grid — there
  // is no undifferentiated "all alerts" feed in the real system either.
  // ui-ux-prototype.html:2376.
  const myAlerts = useMemo(
    // Legacy alerts can have no category. Keep them visible rather than
    // silently treating an incomplete historical row as another tenant's data.
    () => allAlerts.filter((a) => a.category === null || profile.categories.includes(a.category)),
    [allAlerts, profile.categories],
  );

  const unreadCount = useMemo(
    () => myAlerts.filter((a) => !readIds.has(a.id)).length,
    [myAlerts, readIds],
  );

  const surgeCount = useMemo(() => myAlerts.filter(isSurge).length, [myAlerts]);

  // The sidebar's Dashboard badge shows this same figure. Published rather than
  // re-fetched so independently refreshed keyword rows cannot create conflicting
  // client-side counts. Null while loading avoids a stale or invented badge.
  const { setUnreadCount } = useUnreadAlerts();
  useEffect(() => {
    setUnreadCount(status === 'loading' ? null : unreadCount);
  }, [status, unreadCount, setUnreadCount]);

  const visibleAlerts = useMemo(
    () => myAlerts.filter((a) => matchesFilter(a, feedFilter, readIds)),
    [myAlerts, feedFilter, readIds],
  );

  // Resolved against myAlerts, never alerts: if the operator's categories
  // changed since the pick, a stale selection must not render a markets column.
  // ui-ux-prototype.html:2382-2383.
  const selectedAlert = useMemo(
    () => (selectedAlertId ? myAlerts.find((a) => a.id === selectedAlertId) ?? null : null),
    [selectedAlertId, myAlerts],
  );

  const [rankedMarkets, setRankedMarkets] = useState<Market[]>([]);

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

  /** Shared by the active-category effect and refresh() (Step 17/18) — a
   *  pipeline run can change the ranking for whichever category is active. */
  const loadRankedMarketsForCategory = useCallback(async (category: string | null) => {
    if (!category) {
      setRankedMarkets([]);
      return;
    }
    try {
      const list = await apiClient.markets.forCategory(category);
      if (mountedRef.current) setRankedMarkets(list as Market[]);
    } catch (e) {
      if (mountedRef.current) setError(e);
    }
  }, []);

  useEffect(() => {
    void loadRankedMarketsForCategory(activeCategory);
  }, [activeCategory, loadRankedMarketsForCategory]);

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
   */
  const [topMarket, setTopMarket] = useState<{
    id: string;
    name: string;
    matchScore: number;
    category: string;
    dataStale: boolean;
    dataAsOf: string | null;
    dataStaleCause: string | null;
  } | null>(null);

  /** Shared by the mount-scoped effect and refresh() (Step 17) — a pipeline
   *  run can change which market leads each category, so refresh must reload
   *  this explicitly rather than lean on an incidental re-render. */
  const loadTopMarket = useCallback(async () => {
    if (profile.categories.length === 0) {
      if (mountedRef.current) setTopMarket(null);
      return;
    }
    // allSettled, not all: these are N independent per-category requests, and
    // one failing category must not blank a leader the others did return.
    // Same reasoning as the alert/health decoupling above.
    const results = await Promise.allSettled(
      profile.categories.map((category) =>
        apiClient.markets
          .forCategory(category)
          .then((list) => ({ category, leader: (list as Market[])[0] ?? null })),
      ),
    );
    if (!mountedRef.current) return;

    let best: {
      id: string;
      name: string;
      matchScore: number;
      category: string;
      dataStale: boolean;
      dataAsOf: string | null;
      dataStaleCause: string | null;
    } | null = null;
    let firstFailure: unknown = null;

    for (const result of results) {
      if (result.status === 'rejected') {
        firstFailure ??= result.reason;
        continue;
      }
      const { category, leader } = result.value;
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

    setTopMarket(best);
    // Surface a failure only when it cost us the answer entirely — a partial
    // result is still a usable top market, not an error state.
    if (best === null && firstFailure !== null) setError(firstFailure);
  }, [profile.categories]);

  useEffect(() => {
    void loadTopMarket();
  }, [loadTopMarket]);

  const mode: DashMode = useMemo(() => {
    if (forceMode) return forceMode;
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
      setReadIds((prev) => {
        if (prev.has(id)) return prev;
        // Viewing an alert's forecast is what marks it read — not a separate
        // action. Optimistic; a failed write is not worth surfacing.
        void apiClient.notifications.markRead(id).catch(() => {});
        return new Set(prev).add(id);
      });
    },
    [selectedAlertId],
  );

  /**
   * Runs the full forecast pipeline (the Refresh button's job — never what
   * ApiErrorPanel's Retry calls, see `retry` above). Step 17 (C-19/C-20):
   * previously had no catch at all, so a failed analyze() call was an
   * unhandled rejection with no toast and no error UI; now it routes the
   * structured error body into `error` (ApiErrorPanel) and always clears
   * `isRefreshing`, success or failure.
   *
   * Reloads topMarket, keyword alerts and rankedMarkets explicitly on success
   * rather than relying on the incidental re-render a new `selectedAlert`
   * object reference used to produce — a pipeline run can change any of the
   * three, and nothing about calling analyze() naturally re-triggers them.
   */
  const refresh = useCallback(async (): Promise<MarketsResponse | null> => {
    setIsRefreshing(true);
    try {
      const result = (await apiClient.forecast.analyze()) as MarketsResponse;
      const list = (await apiClient.notifications.list()) as DemandAlert[];
      if (mountedRef.current) {
        setAlerts(list);
        setError(null);
      }
      await Promise.allSettled([
        loadTopMarket(),
        loadKeywordAlerts(),
        loadRankedMarketsForCategory(activeCategory),
      ]);
      return result;
    } catch (err) {
      if (mountedRef.current) setError(err);
      return null;
    } finally {
      if (mountedRef.current) setIsRefreshing(false);
    }
  }, [loadTopMarket, loadKeywordAlerts, loadRankedMarketsForCategory, activeCategory]);

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
    isRefreshing,
    error,
    selectAlert,
    pinCategory,
    setFeedFilter,
    refresh,
    retry,
  };
}
