import React from 'react';
import { Plane } from 'lucide-react';
import SurgeBadge from './SurgeBadge';
import ProgressBar from './ProgressBar';
import { Market } from '../../../../types';
import { COLORS } from '../../../../constants';

interface MarketRankCardProps {
  market: Market;
  isSelected: boolean;
  onClick: () => void;
}

const MarketRankCard: React.FC<MarketRankCardProps> = ({ market, isSelected, onClick }) => {
  const hasSpike = market.chartData.some((d) => d.spike === 1);

  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-start p-5 rounded-2xl border transition-all duration-300 text-left ${isSelected ? 'shadow-xl scale-[1.02]' : 'hover:shadow-md hover:bg-white'}`}
      style={{
        backgroundColor: isSelected ? COLORS.WHITE : 'rgba(253,251,247,0.7)',
        borderColor: isSelected ? COLORS.NAVY : COLORS.LIGHT_GREY,
        zIndex: isSelected ? 10 : 1
      }}
    >
      {hasSpike && <SurgeBadge />}

      <div className="flex items-center gap-3 mb-4 w-full">
        <span className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black shrink-0" style={{ backgroundColor: isSelected ? COLORS.NAVY : COLORS.LIGHT_GREY, color: isSelected ? COLORS.WHITE : COLORS.TEXT_DARK }}>
          #{market.rank}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-black text-lg leading-tight" style={{ color: COLORS.NAVY }}>{market.name}</span>
          </div>
          <p className="text-xs font-medium mt-0.5" style={{ color: COLORS.TEXT_MUTED }}>{market.city} · {market.distanceKm.toLocaleString()} km</p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 mb-4">
        <Plane size={13} style={{ color: market.directFlight ? COLORS.GREEN : COLORS.GOLD }} />
        <span className="text-xs font-bold" style={{ color: market.directFlight ? COLORS.GREEN : COLORS.GOLD }}>{market.directFlight ? 'Direct Flight Available' : 'Connecting Flight'}</span>
      </div>

      <div className="w-full space-y-1.5">
        <div className="flex justify-between items-center text-xs">
          <span className="font-bold uppercase tracking-wider" style={{ color: COLORS.TEXT_MUTED }}>Market Potential</span>
          <span className="font-black text-sm" style={{ color: COLORS.NAVY }}>{market.matchScore}/100</span>
        </div>
        <ProgressBar score={market.matchScore} />
      </div>
    </button>
  );
};

export default MarketRankCard;
