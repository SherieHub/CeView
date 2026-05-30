import React, { useEffect, useState } from 'react';
import { AlertTriangle, X, Info } from 'lucide-react';
import TrendAlertCard from './components/TrendAlertCard';
import TrendAlertCardSkeleton from './components/TrendAlertCardSkeleton';
import MarketRadarView from '../2.2-market-radar/MarketRadarView';
import { COLORS } from '../../../constants';
import { Notification, Market } from '../../../types';
import { api, ApiError } from '../../../services/apiClient';
import ServerErrorBanner from '../../shared/ServerErrorBanner';

interface HomeViewProps {
  businessProfileId?: string | null;
  businessName?: string;
  categories?: string[];
  onNavigateToContent?: () => void;
}

/**
 * Derive trend-alert notifications from the forecasting markets response.
 * A market is a "caught trend" when its chart has a 2σ spike either in the
 * history portion (active surge now) or the forecast portion (upcoming surge).
 * Mirrors the spike-detection logic in LiveAlertBanner.
 */
const deriveTrendNotifications = (markets: Market[]): Notification[] => {
  const alerts: { notif: Notification; active: boolean }[] = [];

  for (const market of markets) {
    const chart = market.chartData ?? [];
    const hasSpikeNow = chart.some((d) => d.history !== null && d.spike === 1);
    const hasSpikeAhead = chart.some((d) => d.forecast !== null && d.spike === 1);
    if (!hasSpikeNow && !hasSpikeAhead) continue;

    const spikeWeek = chart.find((d) => d.spike === 1)?.week ?? '';
    const trend = market.peakMonths?.length
      ? `peak season (${market.peakMonths[0]})`
      : 'rising Cebu travel demand';

    alerts.push({
      active: hasSpikeNow,
      notif: {
        id: `market-trend-${market.id}`,
        marketId: market.id,
        market: market.name,
        title: hasSpikeNow
          ? `Demand Surge Active — ${market.name}`
          : `Upcoming Surge — ${market.name}`,
        date: hasSpikeNow ? 'Active now' : spikeWeek,
        trend,
        isRead: false,
      },
    });
  }

  // Active surges first, then upcoming
  return alerts
    .sort((a, b) => Number(b.active) - Number(a.active))
    .map((a) => a.notif);
};

const HomeView: React.FC<HomeViewProps> = ({ businessProfileId, businessName, categories, onNavigateToContent }) => {
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [marketAlerts, setMarketAlerts] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [serverError, setServerError] = useState<string | null>(null);
  const [aiError, setAiError] = useState<{ reason: string; code: string } | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setServerError(null);
      setAiError(null);

      // Run a live forecast first so every card below reflects fresh pipeline
      // output. The backend skips the heavy Gemini/XGBoost run when a recent
      // forecast already exists, so this is cheap on most visits. Derive the
      // "caught trend" surge cards from the markets it returns (live or cached).
      // Failures are non-fatal: we still fall through to the last persisted
      // alerts and only raise the warning banner on a genuine AI/server fault.
      if (businessProfileId) {
        try {
          const r = await api.ensureForecast(businessProfileId);
          if (!cancelled) setMarketAlerts(deriveTrendNotifications(r.markets ?? []));
        } catch (err) {
          const ae = err instanceof ApiError ? err : null;
          if (ae && ae.status >= 500) {
            setAiError({
              reason: ae.message ?? 'The AI forecast service may be unavailable.',
              code: ae.code ?? 'UNKNOWN',
            });
          }
          // 4xx (e.g. profile not ready) → degrade quietly to cached alerts.
        }
      }

      if (cancelled) return;

      // Read the demand alerts the forecast just produced. Always works even
      // when the live run above failed — these are the last persisted rows.
      try {
        const r = await api.listNotifications(businessProfileId);
        if (!cancelled) setNotifications(r.notifications ?? []);
      } catch (err) {
        if (cancelled) return;
        const ae = err instanceof ApiError ? err : null;
        const detail = ae?.message ?? 'Please try again later.';
        setServerError(`Notification service unavailable: ${detail}`);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [businessProfileId]);

  if (selectedNotification) {
    return (
      <div className="animate-fade-in">
        <MarketRadarView
          businessProfileId={businessProfileId}
          businessName={businessName}
          categories={categories}
          initialMarketId={selectedNotification.marketId}
          onBack={() => setSelectedNotification(null)}
          onNavigateToContent={onNavigateToContent}
        />
      </div>
    );
  }

  // Caught-trend cards (from /forecasting/markets) first, then /notifications cards
  const merged = [...marketAlerts, ...notifications];

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 animate-fade-in space-y-6 md:space-y-8 min-h-screen" style={{ backgroundColor: COLORS.CREAM }}>
      {serverError && <ServerErrorBanner message={serverError} onDismiss={() => setServerError(null)} />}

      {aiError && (
        <div
          className="flex items-start gap-3 p-4 rounded-xl border-l-4"
          style={{ backgroundColor: '#FFFBEB', borderLeftColor: COLORS.GOLD }}
        >
          <AlertTriangle size={18} className="shrink-0 mt-0.5" style={{ color: COLORS.GOLD }} />
          <div className="flex-1 space-y-1">
            <p className="text-sm font-bold" style={{ color: '#92400E' }}>
              AI Forecast Service Unavailable
            </p>
            <p className="text-sm" style={{ color: '#78350F' }}>
              {aiError.reason}
            </p>
            <div className="flex items-center gap-1.5 mt-2 pt-2 border-t" style={{ borderColor: '#FDE68A' }}>
              <Info size={13} style={{ color: COLORS.GOLD }} />
              <p className="text-xs font-medium" style={{ color: '#92400E' }}>
                The alerts below are from your last successful forecast run and may not reflect current market conditions.
              </p>
            </div>
          </div>
          <button
            onClick={() => setAiError(null)}
            className="shrink-0 transition-opacity hover:opacity-60"
            style={{ color: COLORS.GOLD }}
            aria-label="Dismiss"
          >
            <X size={16} />
          </button>
        </div>
      )}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold" style={{ color: COLORS.NAVY }}>Home</h2>
          <p className="mt-1" style={{ color: COLORS.TEXT_MUTED }}>Weekly trend updates and market signals.</p>
        </div>
      </div>

      <div className="space-y-4">
        {isLoading
          ? [0, 1, 2].map(i => <TrendAlertCardSkeleton key={i} />)
          : merged.length > 0
            ? merged.map((notif) => (
                <TrendAlertCard
                  key={notif.id}
                  notif={notif}
                  variant={notif.id.startsWith('market-trend-') ? 'surge' : 'default'}
                  onClick={() => setSelectedNotification(notif)}
                />
              ))
            : !serverError && (
                <p className="text-center py-12" style={{ color: COLORS.TEXT_MUTED }}>
                  No notifications yet. Market trend data will appear here once your profile is analysed.
                </p>
              )
        }
      </div>
    </div>
  );
};

export default HomeView;
