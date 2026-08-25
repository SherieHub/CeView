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
import { marketsForCategory, CATEGORY_MARKET_SCORES } from '../../../services/fixtures/markets';
import type { Market } from '../../../services/fixtures/markets';
import type { DemandAlert } from '../../../services/fixtures/notifications';

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
  if (filter === 'surge') return alert.alertLevel === 'WARNING';
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

  useEffect(() => {
    // Note the fetch runs even under forceMode: the `normal` and `ai-down`
    // previews need real fixture alerts to render. forceMode only overrides the
    // derived `mode` below, and `loading`/`empty` render their own states
    // regardless of what was loaded.
    let cancelled = false;
    (async () => {
      try {
        const [list, health] = await Promise.all([
          apiClient.notifications.list() as Promise<DemandAlert[]>,
          apiClient.forecast.status() as Promise<{ available: boolean }>,
        ]);
        if (cancelled) return;
        setAlerts(list);
        // Seed read state from the server's view once, then own it locally.
        setReadIds(new Set(list.filter((a) => a.isRead).map((a) => a.id)));
        setAiServiceDown(!health.available);
      } catch {
        // A failed load is not an empty forecast run — but with no error state
        // in the screen spec, degraded mode is the honest fallback: it tells the
        // operator the data may be stale rather than that nothing exists.
        if (!cancelled) setAiServiceDown(true);
      } finally {
        if (!cancelled) setStatus('ready');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const isRead = useCallback((id: string) => readIds.has(id), [readIds]);

  // The category scoping IS Module 2's (category, market) signal grid — there
  // is no undifferentiated "all alerts" feed in the real system either.
  // ui-ux-prototype.html:2376.
  const myAlerts = useMemo(
    () => alerts.filter((a) => profile.categories.includes(a.category)),
    [alerts, profile.categories],
  );

  const unreadCount = useMemo(
    () => myAlerts.filter((a) => !readIds.has(a.id)).length,
    [myAlerts, readIds],
  );

  const surgeCount = useMemo(
    () => myAlerts.filter((a) => a.alertLevel === 'WARNING').length,
    [myAlerts],
  );

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

  const rankedMarkets = useMemo(
    () => (selectedAlert ? marketsForCategory(selectedAlert.category) : []),
    [selectedAlert],
  );

  /** Markets named by the confirmed-surge alerts, de-duplicated, for the summary. */
  const surgeMarkets = useMemo(
    () => [...new Set(myAlerts.filter((a) => a.alertLevel === 'WARNING').map((a) => a.market))],
    [myAlerts],
  );

  /**
   * The single best-scoring market across every category the operator covers.
   * Answers "where should I be pointing right now" without first picking an
   * alert — the question the prototype's dashboard could not answer at a glance.
   */
  const topMarket = useMemo(() => {
    let best: { id: string; name: string; matchScore: number; category: string } | null = null;
    for (const category of profile.categories) {
      // Skip categories with no ranking data. marketsForCategory falls back to
      // each market's default score for an unknown category, which is the right
      // call for the reveal panel but would make this tile claim a top market
      // *for* a category the system has never scored — a number presented as a
      // measurement when nothing was measured.
      if (!(category in CATEGORY_MARKET_SCORES)) continue;
      const leader = marketsForCategory(category)[0];
      if (leader && (!best || leader.matchScore > best.matchScore)) {
        best = { id: leader.id, name: leader.name, matchScore: leader.matchScore, category };
      }
    }
    return best;
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
    selectAlert,
    setFeedFilter,
    refresh,
  };
}
