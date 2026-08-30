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
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiClient } from '../../../services/apiClient';
import { useProfile } from '../../../services/profileContext';
import { isSurge } from '@/types';
import type { Market } from '@/types';
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
  topMarket: { id: string; name: string; matchScore: number; category: string } | null;
  feedFilter: FeedFilter;
  isRefreshing: boolean;
  /** Non-null when the initial load failed; render <ApiErrorPanel error={error} />. */
  error: unknown | null;
  selectAlert: (id: string) => void;
  setFeedFilter: (filter: FeedFilter) => void;
  refresh: () => Promise<void>;
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
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [feedFilter, setFeedFilter] = useState<FeedFilter>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<unknown | null>(null);

  useEffect(() => {
    // Note the fetch runs even under forceMode: the `normal` and `ai-down`
    // previews need real fixture alerts to render. forceMode only overrides the
    // derived `mode` below, and `loading`/`empty` render their own states
    // regardless of what was loaded.
    let cancelled = false;
    (async () => {
      // allSettled, not all: a health-check failure must never be able to
      // discard a successfully-fetched alert list. See Task 12.
      const [listResult, healthResult] = await Promise.allSettled([
        apiClient.notifications.list() as Promise<DemandAlert[]>,
        apiClient.forecast.status() as Promise<{ available: boolean }>,
      ]);
      if (cancelled) return;

      if (listResult.status === 'fulfilled') {
        setAlerts(listResult.value);
        // Seed read state from the server's view once, then own it locally.
        setReadIds(new Set(listResult.value.filter((a) => a.isRead).map((a) => a.id)));
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
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Keyword-trend alerts are held in their OWN state rather than merged into
   * `alerts`, because both loads are independent effects that would otherwise
   * race on one setter: if this resolved first, the primary load's
   * `setAlerts(listResult.value)` would overwrite it.
   *
   * Today that ordering is practically unreachable (this hop is ~9s of
   * PyTrends, the primary read is ~0.15s) — but the known next improvement is
   * to cache rank-markets server-side, which would make this fast and the race
   * live. Separate state removes the failure mode instead of relying on timing.
   */
  const [keywordAlerts, setKeywordAlerts] = useState<DemandAlert[]>([]);

  useEffect(() => {
    let cancelled = false;
    apiClient.notifications
      .keywordTrends()
      .then((extra) => {
        if (!cancelled) setKeywordAlerts(extra);
      })
      // A slow or failing keyword-trend fetch must never blank the feed or
      // surface as a dashboard error — the demand alerts are the primary data.
      // This is a deliberate swallow, not the silent-catch bug fixed elsewhere:
      // nothing the operator would otherwise see is lost.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

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
    () => allAlerts.filter((a) => profile.categories.includes(a.category)),
    [allAlerts, profile.categories],
  );

  const unreadCount = useMemo(
    () => myAlerts.filter((a) => !readIds.has(a.id)).length,
    [myAlerts, readIds],
  );

  const surgeCount = useMemo(() => myAlerts.filter(isSurge).length, [myAlerts]);

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

  useEffect(() => {
    if (!selectedAlert) {
      setRankedMarkets([]);
      return;
    }
    let cancelled = false;
    apiClient.markets
      .forCategory(selectedAlert.category)
      .then((list) => {
        if (!cancelled) setRankedMarkets(list as Market[]);
      })
      .catch((e) => {
        if (!cancelled) setError(e);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedAlert]);

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
  } | null>(null);

  useEffect(() => {
    if (profile.categories.length === 0) {
      setTopMarket(null);
      return;
    }
    let cancelled = false;
    // allSettled, not all: these are N independent per-category requests, and
    // one failing category must not blank a leader the others did return.
    // Same reasoning as the alert/health decoupling above.
    Promise.allSettled(
      profile.categories.map((category) =>
        apiClient.markets
          .forCategory(category)
          .then((list) => ({ category, leader: (list as Market[])[0] ?? null })),
      ),
    ).then((results) => {
      if (cancelled) return;
      let best: { id: string; name: string; matchScore: number; category: string } | null = null;
      let firstFailure: unknown = null;

      for (const result of results) {
        if (result.status === 'rejected') {
          firstFailure ??= result.reason;
          continue;
        }
        const { category, leader } = result.value;
        if (leader && (!best || leader.matchScore > best.matchScore)) {
          best = { id: leader.id, name: leader.name, matchScore: leader.matchScore, category };
        }
      }

      setTopMarket(best);
      // Surface a failure only when it cost us the answer entirely — a partial
      // result is still a usable top market, not an error state.
      if (best === null && firstFailure !== null) setError(firstFailure);
    });
    return () => {
      cancelled = true;
    };
  }, [profile.categories]);

  const mode: DashMode = useMemo(() => {
    if (forceMode) return forceMode;
    if (status === 'loading') return 'loading';
    // Degraded is checked BEFORE empty, and the order matters: a failed load
    // also leaves `alerts` empty, so checking empty first would tell an
    // operator they have no alerts when the request simply never arrived.
    // "Your data may be stale" is honest; "you have nothing" is not.
    if (aiServiceDown) return 'ai-down';
    // `empty` means no forecast has ever run — distinct from "your categories
    // match nothing right now", which the feed renders from myAlerts.length.
    // Different copy, different remedy.
    if (alerts.length === 0) return 'empty';
    return 'normal';
  }, [forceMode, status, alerts.length, aiServiceDown]);

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

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await apiClient.forecast.analyze();
      const list = (await apiClient.notifications.list()) as DemandAlert[];
      setAlerts(list);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

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
    setFeedFilter,
    refresh,
  };
}
