/**
 * CARD — Market Radar Drawer: Economic & Seasonal Insights Tabs
 *
 * Route and carrier list, below the insights tabs. Sits outside the tabs
 * because it is true of the market regardless of which lens you are reading it
 * through.
 */
import { Plane } from 'lucide-react';
import type { Market } from '@/types';
import { formatPhpRange } from './format';

export default function RouteCarriers({ market }: { market: Market }) {
  return (
    <section className="radar-section" aria-label="Route and carriers">
      <h3 className="heading-md mb-3">Route &amp; Carriers</h3>

      <div className="card">
        <p className="text-meta">
          {market.nearestAirport} → {market.destinationAirport} ·{' '}
          {market.flightFrequency}x / week · {formatPhpRange(market.fareMinPhp, market.fareMaxPhp)}
        </p>
        <p className="text-meta mb-3">
          Route &amp; fare figures: {market.fareSource}
          {market.fareAsOf ? ` · valid from ${market.fareAsOf}` : ''}
        </p>

        <ul className="carrier-list">
          {market.airlines.map((a) => (
            <li key={a.code}>
              <span className="carrier-code num">{a.code}</span>
              <div className="min-w-0 flex-1">
                <b>{a.name}</b>
                <span className="text-meta">{a.frequency}</span>
              </div>
              <span className={`chip ${a.direct ? 'chip--success' : ''}`}>
                <Plane aria-hidden="true" /> {a.direct ? 'Direct' : 'Via Manila'}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
