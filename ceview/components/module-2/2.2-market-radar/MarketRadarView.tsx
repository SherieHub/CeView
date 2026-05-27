import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, MapPin, Navigation, Plane, RefreshCw } from 'lucide-react';
import { COLORS } from '../../../constants';
import { api, ApiError } from '../../../services/apiClient';
import type { Market } from '../../../types';

import ServerErrorBanner from '../../shared/ServerErrorBanner';
import SkeletonBox from '../../shared/SkeletonBox';
import MarketRankCard from './components/MarketRankCard';
import MarketRankCardSkeleton from './components/MarketRankCardSkeleton';
import MetricHighlight from './components/MetricHighlight';
import LiveAlertBanner from './components/LiveAlertBanner';
import StrategicDirectivePanel from './components/StrategicDirectivePanel';
import DemandForecastChart from './components/DemandForecastChart';
import EconomicInsightsBoard from './components/EconomicInsightsBoard';

interface MarketRadarViewProps {
  businessProfileId?: string | null;
  businessName?: string;
  categories?: string[];
  onBack?: () => void;
  initialMarketId?: string;
  onNavigateToContent?: (marketId: string) => void;
  /** When true, automatically runs the full forecast pipeline on mount (e.g. from a notification click). */
  autoAnalyze?: boolean;
}

const MarketRadarView: React.FC<MarketRadarViewProps> = ({
  businessProfileId, businessName, categories, onBack, initialMarketId, onNavigateToContent, autoAnalyze,
}) => {
  const hasBusinessName = !!businessName?.trim();
  const hasCategories = (categories?.length ?? 0) > 0;
  const hasProfile = hasBusinessName || hasCategories;
  const subtitle = hasBusinessName
    ? `${businessName!.trim()} — Where Visitors Are Coming From`
    : 'Cebu Tourism Forecast — Where Visitors Are Coming From';
  const pillLabel = hasCategories
    ? `Profile: ${categories!.join(' · ')}`
    : 'Profile: Eco-Tourism / Beach';

  const [markets, setMarkets] = useState<Market[]>([]);
  const [selectedMarketId, setSelectedMarketId] = useState<string>(initialMarketId ?? '');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const loadMarkets = useCallback(() => {
    setIsLoading(true);
    api.listMarkets(businessProfileId ?? undefined)
      .then(r => {
        if (r.markets?.length) {
          setMarkets(r.markets);
          if (!selectedMarketId) setSelectedMarketId(r.markets[0].id);
        }
      })
      .catch((err) => {
        const ae = err instanceof ApiError ? err : null;
        const detail = ae?.message ?? 'Please try again later.';
        setServerError(`Market data unavailable: ${detail}`);
      })
      .finally(() => setIsLoading(false));
  }, [businessProfileId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefresh = async () => {
    if (!businessProfileId) return;
    setIsRefreshing(true);
    try {
      const r = await api.analyzeMarkets(businessProfileId);
      if (r.markets?.length) {
        setMarkets(r.markets);
        if (!selectedMarketId) setSelectedMarketId(r.markets[0].id);
      }
    } catch (err) {
      const ae = err instanceof ApiError ? err : null;
      const detail = ae?.code && !ae.code.startsWith('HTTP_')
        ? ae.message
        : ae?.message ?? 'The AI service may be unavailable.';
      setServerError(`Market analysis failed: ${detail}`);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadMarkets();
    if (autoAnalyze && businessProfileId) {
      handleRefresh();
    }
  }, [loadMarkets]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedMarket = markets.find((m) => m.id === selectedMarketId) || markets[0];

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6" style={{ backgroundColor: COLORS.CREAM, minHeight: '100vh' }}>

      {serverError && <ServerErrorBanner message={serverError} onDismiss={() => setServerError(null)} />}

      {onBack && (
        <button onClick={onBack} className="flex items-center text-slate-500 hover:text-slate-800 mb-2 font-medium transition-colors">
          <ArrowLeft size={18} className="mr-2" /> Back to Home
        </button>
      )}

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight leading-none" style={{ color: COLORS.NAVY }}>Market Radar</h1>
          <p className="text-sm font-medium mt-0.5 mb-2" style={{ color: COLORS.TEXT_MUTED }}>
            {subtitle}
            {!hasProfile && (
              <span className="ml-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: COLORS.GOLD }}>
                · demo profile
              </span>
            )}
          </p>
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold border shadow-sm mt-2"
            style={
              hasCategories
                ? { backgroundColor: COLORS.WHITE, color: COLORS.TEXT_MAIN, borderColor: COLORS.LIGHT_GREY }
                : { backgroundColor: COLORS.GOLD_LIGHT, color: COLORS.NAVY, borderColor: `${COLORS.GOLD}40` }
            }
            title={hasCategories ? undefined : 'No business profile saved — showing sample category'}
          >
            <MapPin size={15} style={{ color: COLORS.RED_ORANGE }} /> {pillLabel}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button
            onClick={handleRefresh}
            disabled={!businessProfileId || isRefreshing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: COLORS.NAVY, color: COLORS.WHITE }}
            title={businessProfileId ? 'Re-run forecast for your profile' : 'Save a business profile first'}
          >
            <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} />
            {isRefreshing ? 'Refreshing…' : 'Refresh Forecast'}
          </button>
        </div>
      </div>

      {/* Market rank cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {isLoading
          ? [0, 1, 2].map(i => <MarketRankCardSkeleton key={i} />)
          : markets.map((market) => (
              <MarketRankCard
                key={market.id}
                market={market}
                isSelected={market.id === selectedMarketId}
                onClick={() => setSelectedMarketId(market.id)}
              />
            ))
        }
      </div>

      {/* Detail panel */}
      {isLoading || !selectedMarket ? (
        <SkeletonBox style={{ height: 420, borderRadius: 16 }} />
      ) : (
        <>
          <LiveAlertBanner market={selectedMarket} />

          <div className="rounded-2xl shadow-xl overflow-hidden" style={{ backgroundColor: COLORS.WHITE, border: `1px solid ${COLORS.LIGHT_GREY}` }}>
            <StrategicDirectivePanel
              directive={selectedMarket.directive}
              onNavigateToContent={onNavigateToContent ? () => onNavigateToContent(selectedMarketId) : undefined}
            />

            <div className="grid grid-cols-2 divide-x border-b" style={{ borderColor: COLORS.LIGHT_GREY, backgroundColor: COLORS.OFF_WHITE }}>
              <MetricHighlight icon={<Navigation size={16} />} label="Distance to Cebu" value={`${selectedMarket.distanceKm.toLocaleString()} km`} color={COLORS.SKYBLUE} />
              <MetricHighlight icon={<Plane size={16} />} label="Route Type" value={selectedMarket.directFlight ? 'Direct Flights' : 'Via Manila'} color={selectedMarket.directFlight ? COLORS.GREEN : COLORS.GOLD} />
            </div>

            <DemandForecastChart chartData={selectedMarket.chartData} />
            <EconomicInsightsBoard market={selectedMarket} />
          </div>
        </>
      )}
    </div>
  );
};

export default MarketRadarView;
