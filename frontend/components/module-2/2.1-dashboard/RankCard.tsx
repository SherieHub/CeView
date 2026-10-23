/**
 * CARD — Dashboard: Markets Reveal
 * Prototype reference: ui-ux-prototype.html:2424-2450
 *
 * One ranked market in the reveal column, as a compact row: rank, flag,
 * name, a potential bar and the score. Opens the Market Radar drawer, which
 * carries the route, fare and flight detail this row no longer repeats.
 *
 * Rank 1 is marked on its number and bar, so "leading" reads at a glance.
 */
import { Zap } from 'lucide-react';
import { marketSurgeState } from '@/types';
import type { Market } from '@/types';
import MarketFlagIcon from './MarketFlagIcon';

interface RankCardProps {
  market: Market;
  onOpen: (marketId: string) => void;
}

export default function RankCard({ market, onOpen }: RankCardProps) {
  const isLead = market.rank === 1;
  const surgeState = marketSurgeState(market);

  return (
    <button
      type="button"
      className="rank-card"
      data-lead={isLead}
      onClick={() => onOpen(market.id)}
      title={`${market.city} · ${market.distanceKm.toLocaleString()} km to Cebu`}
    >
      <span className="rank-no" data-lead={isLead}>
        {market.rank}
      </span>
      <MarketFlagIcon name={market.name} />
      <span className="rank-name">
        <h3 className="heading-sm">{market.name}</h3>
        {surgeState !== 'none' && (
          <span className="rank-surge">
            <Zap aria-hidden="true" /> Surge active
          </span>
        )}
      </span>
      <span className={`bar ${isLead ? 'bar--lead' : ''}`} aria-hidden="true">
        <i style={{ width: `${market.matchScore}%` }} />
      </span>
      <b className="rank-pts num">
        {market.matchScore}
        <span className="sr">/100 market potential</span>
      </b>
    </button>
  );
}
