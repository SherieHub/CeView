import React, { useEffect, useState } from 'react';
import { AlertTriangle, X, Info } from 'lucide-react';
import TrendAlertCard from './components/TrendAlertCard';
import TrendAlertCardSkeleton from './components/TrendAlertCardSkeleton';
import MarketRadarView from '../2.2-market-radar/MarketRadarView';
import { COLORS } from '../../../constants';
import { Notification } from '../../../types';
import { api, ApiError } from '../../../services/apiClient';
import ServerErrorBanner from '../../shared/ServerErrorBanner';

interface HomeViewProps {
  businessProfileId?: string | null;
  businessName?: string;
  categories?: string[];
  onNavigateToContent?: () => void;
}

const HomeView: React.FC<HomeViewProps> = ({ businessProfileId, businessName, categories, onNavigateToContent }) => {
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [serverError, setServerError] = useState<string | null>(null);
  const [aiError, setAiError] = useState<{ reason: string; code: string } | null>(null);

  useEffect(() => {
    setIsLoading(true);
    setServerError(null);
    setAiError(null);

    // Load cached alerts from DB — always works even when Gemini is down
    api.listNotifications(businessProfileId)
      .then(r => setNotifications(r.notifications ?? []))
      .catch((err) => {
        const ae = err instanceof ApiError ? err : null;
        const detail = ae?.message ?? 'Please try again later.';
        setServerError(`Notification service unavailable: ${detail}`);
      })
      .finally(() => setIsLoading(false));

    // Fire-and-forget: probe the AI forecast service to detect Gemini failures.
    // We don't block the notification list on this — it only drives the warning banner.
    api.listMarkets(businessProfileId)
      .catch((err) => {
        const ae = err instanceof ApiError ? err : null;
        if (ae && ae.status >= 500) {
          setAiError({
            reason: ae.message ?? 'The AI forecast service may be unavailable.',
            code: ae.code ?? 'UNKNOWN',
          });
        }

      });
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
          : notifications.length > 0
            ? notifications.map((notif) => (
                <TrendAlertCard
                  key={notif.id}
                  notif={notif}
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
