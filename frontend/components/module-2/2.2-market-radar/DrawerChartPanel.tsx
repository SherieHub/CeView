/**
 * CARD — Market Radar Drawer: Directive & Demand Chart
 * Prototype reference: renderRadar() — ui-ux-prototype.html:2521-2793
 *
 * Surge banner, AI strategic directive, and the demand chart with its
 * timeframe toggle and zone key. One of two independent slot-fillers inside
 * the drawer shell; the shell owns the timeframe so switching insight tabs
 * cannot reset it.
 */
import { CloudOff, Sparkles, Zap } from 'lucide-react';
import DemandForecastChart from './DemandForecastChart';
import type { DrawerChartSlotProps, Timeframe } from './radarTypes';

const TIMEFRAMES: Timeframe[] = ['4WK', '12WK'];

/** Each band carries the pricing action it implies, per the screen doc. */
const ZONES = [
  { label: 'Low', range: '0–30', action: 'Discount to fill', tone: 'low' },
  { label: 'Moderate', range: '31–70', action: 'Hold rates', tone: 'mid' },
  { label: 'High peak', range: '71–100', action: 'Raise rates early', tone: 'high' },
];

export default function DrawerChartPanel({
  market,
  timeframe,
  onTimeframeChange,
}: DrawerChartSlotProps) {
  return (
    <section className="radar-section" aria-label="Demand forecast">
      {/* Tabbed cards: the label straddles the top edge rather than leading the
          sentence, so the two states are told apart at a glance instead of by
          reading the first three words. */}
      {market.spikeIndicator ? (
        <div className="info-card" data-tone="critical" role="status">
          <span className="info-tab">Surge confirmed</span>
          <div className="info-body">
            <span className="info-glyph">
              <Zap size={16} strokeWidth={2} aria-hidden="true" />
            </span>
            <p className="body-sm">
              Demand has broken the 2σ threshold and the pattern repeats year on year — this is a
              seasonal inflection, not a one-off.
            </p>
          </div>
        </div>
      ) : (
        <div className="info-card" data-tone="calm" role="status">
          <span className="info-tab">No active surge</span>
          <div className="info-body">
            <span className="info-glyph">
              <CloudOff size={16} strokeWidth={2} aria-hidden="true" />
            </span>
            <p className="body-sm">
              Demand is tracking its normal range for this market. Treat the forecast below as a
              planning signal rather than a deadline.
            </p>
          </div>
        </div>
      )}

      <div className="info-card" data-tone="accent">
        <span className="info-tab">Strategic directive</span>
        <div className="info-body">
          <span className="info-glyph">
            <Sparkles size={16} strokeWidth={2} aria-hidden="true" />
          </span>
          <p className="body-sm">{market.directive}</p>
        </div>
      </div>

      <div className="feed-head">
        <h3 className="heading-md">Demand Forecast</h3>
        <div className="seg" role="group" aria-label="Forecast timeframe">
          {TIMEFRAMES.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={timeframe === t}
              onClick={() => onTimeframeChange(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <DemandForecastChart data={market.chartData} timeframe={timeframe} />

      <ul className="zone-key">
        {ZONES.map((z) => (
          <li key={z.label} data-tone={z.tone}>
            <span className="zone-swatch" aria-hidden="true" />
            <div>
              <b>
                {z.label} <span className="num">{z.range}</span>
              </b>
              <span>{z.action}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
