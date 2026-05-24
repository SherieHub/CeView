import React, { useEffect, useState } from 'react';
import { ArrowLeft, MapPin, Navigation, Plane } from 'lucide-react';
import { COLORS, MOCK_MARKETS } from '../../../constants';
import { api } from '../../../services/apiClient';
import type { Market } from '../../../types';

import MarketRankCard from '../../composites/module-2/MarketRankCard';
import MetricHighlight from '../../composites/module-2/MetricHighlight';
import LiveAlertBanner from '../../modules/module-2/LiveAlertBanner';
import StrategicDirectivePanel from '../../modules/module-2/StrategicDirectivePanel';
import DemandForecastChart from '../../modules/module-2/DemandForecastChart';
import EconomicInsightsBoard from '../../modules/module-2/EconomicInsightsBoard';

interface MarketRadarViewProps {
  onBack?: () => void;
  initialMarketId?: string;
  onNavigateToContent?: () => void;
}

const MarketRadarView: React.FC<MarketRadarViewProps> = ({ onBack, initialMarketId, onNavigateToContent }) => {
  const [markets, setMarkets] = useState<Market[]>(MOCK_MARKETS);
  const [selectedMarketId, setSelectedMarketId] = useState<string>(initialMarketId ?? MOCK_MARKETS[0].id);

  useEffect(() => {
    api.listMarkets()
      .then(r => { if (r.markets?.length) setMarkets(r.markets); })
      .catch(e => console.warn('listMarkets failed, using mock', e));
  }, []);

  const selectedMarket = markets.find((m) => m.id === selectedMarketId) || markets[0];

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6" style={{ backgroundColor: COLORS.CREAM, minHeight: '100vh' }}>
      
      {/* Header */}
      {onBack && (
        <button onClick={onBack} className="flex items-center text-slate-500 hover:text-slate-800 mb-2 font-medium transition-colors">
          <ArrowLeft size={18} className="mr-2" /> Back to Home
        </button>
      )}

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight leading-none" style={{ color: COLORS.NAVY }}>Market Radar</h1>
          <p className="text-sm font-medium mt-0.5 mb-2" style={{ color: COLORS.TEXT_MUTED }}>Cebu Tourism Forecast — Where Visitors Are Coming From</p>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold border shadow-sm mt-2" style={{ backgroundColor: COLORS.WHITE, color: COLORS.TEXT_MAIN, borderColor: COLORS.LIGHT_GREY }}>
            <MapPin size={15} style={{ color: COLORS.RED_ORANGE }} /> Profile: Eco-Tourism / Beach
          </div>
        </div>
      </div>

      {/* Top Ranked Markets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {markets.map((market) => (
          <MarketRankCard 
            key={market.id}
            market={market}
            isSelected={market.id === selectedMarketId}
            onClick={() => setSelectedMarketId(market.id)}
          />
        ))}
      </div>

      {/* Live Alert Banner */}
      <LiveAlertBanner market={selectedMarket} />

      {/* Deep Dive Dashboard Container */}
      <div className="rounded-2xl shadow-xl overflow-hidden" style={{ backgroundColor: COLORS.WHITE, border: `1px solid ${COLORS.LIGHT_GREY}` }}>
        
        <StrategicDirectivePanel 
          directive={selectedMarket.directive} 
          onNavigateToContent={onNavigateToContent} 
        />

        <div className="grid grid-cols-2 divide-x border-b" style={{ borderColor: COLORS.LIGHT_GREY, backgroundColor: COLORS.OFF_WHITE }}>
          <MetricHighlight icon={<Navigation size={16} />} label="Distance to Cebu" value={`${selectedMarket.distanceKm.toLocaleString()} km`} color={COLORS.SKYBLUE} />
          <MetricHighlight icon={<Plane size={16} />} label="Route Type" value={selectedMarket.directFlight ? 'Direct Flights' : 'Via Manila'} color={selectedMarket.directFlight ? COLORS.GREEN : COLORS.GOLD} />
        </div>

        {/* Charting & Insights Organisms */}
        <DemandForecastChart chartData={selectedMarket.chartData} />
        <EconomicInsightsBoard market={selectedMarket} />
        
      </div>
    </div>
  );
};

export default MarketRadarView;