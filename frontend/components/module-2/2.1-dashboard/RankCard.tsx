/**
 * CARD — Dashboard: Markets Reveal
 * Prototype reference: ui-ux-prototype.html:2424-2450
 *
 * One ranked market in the reveal column. Opens the Market Radar drawer.
 *
 * Rank 1 is marked with --gradient-accent on its number and bar, mirroring the
 * wizard's done/current .ob-dot rather than the prototype's gold — "leading"
 * then reads the same way everywhere in the app.
 */
import { CalendarClock, Plane, Zap } from 'lucide-react';
import type { Market } from '@/types';

interface RankCardProps {
  market: Market;
  onOpen: (marketId: string) => void;
}

export default function RankCard({ market, onOpen }: RankCardProps) {
  const isLead = market.rank === 1;
  const hasSpike = market.chartData.some((point) => point.spike === 1);

  return (
    <button type="button" className="rank-card" onClick={() => onOpen(market.id)}>
      <div className="rank-head">
        <span className="rank-no" data-lead={isLead}>
          {market.rank}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="heading-sm">{market.name}</h3>
          <p className="text-meta">
            {market.city} · {market.distanceKm.toLocaleString()} km to Cebu
          </p>
        </div>
        <div className="rank-score">
          <b className="num">{market.matchScore}</b>
          <span className="text-meta">Potential</span>
        </div>
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="eyebrow">Market potential</span>
          <span className="num text-xs font-bold">{market.matchScore}/100</span>
        </div>
        <div className={`bar ${isLead ? 'bar--lead' : ''}`}>
          <i style={{ width: `${market.matchScore}%` }} />
        </div>
      </div>

      <div className="rank-facts">
        <span className="rank-fact" data-direct={market.directFlight}>
          <Plane size={14} aria-hidden="true" />
          <b>{market.directFlight ? 'Direct' : 'Via Manila'}</b> · {market.flightHours}
        </span>
        <span className="rank-fact">
          <CalendarClock size={14} aria-hidden="true" />
          {market.flightFrequency}x / week
        </span>
        {hasSpike && (
          <span className="chip chip--critical ml-auto">
            <Zap aria-hidden="true" /> Surge active
          </span>
        )}
      </div>
    </button>
  );
}
