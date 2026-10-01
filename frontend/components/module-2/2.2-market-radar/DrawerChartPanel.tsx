/**
 * CARD — Market Radar Drawer: Directive & Demand Chart
 * Prototype reference: renderRadar() — ui-ux-prototype.html:2521-2793
 *
 * Surge banner, AI strategic directive, and the demand chart with its
 * timeframe toggle and zone key. One of two independent slot-fillers inside
 * the drawer shell; the shell owns the timeframe so switching insight tabs
 * cannot reset it.
 */
import { AlertTriangle, CloudOff, Sparkles, Zap } from 'lucide-react';
import DemandForecastChart from './DemandForecastChart';
import type { DrawerChartSlotProps, Timeframe } from './radarTypes';
import { marketSurgeState } from '@/types';

const TIMEFRAMES: Timeframe[] = ['4WK', '12WK'];

/** Each band carries the pricing action it implies, per the screen doc. */
const ZONES = [
  { label: 'Low', range: '0–30', action: 'Discount to fill', tone: 'low' },
  { label: 'Moderate', range: '31–70', action: 'Hold rates', tone: 'mid' },
  { label: 'High peak', range: '71–100', action: 'Raise rates early', tone: 'high' },
];

/**
 * Step 19 (C-14; M2-ST-036): 0.70 mirrors the "Moderate" seasonality band's
 * own threshold elsewhere in this drawer (SeasonalPatternsTab) — there is no
 * separate documented forecast-confidence cutoff, so this reuses the one
 * threshold already established in this codebase rather than inventing a
 * second, different number.
 */
const LOW_CONFIDENCE_THRESHOLD = 0.7;

/** Never let the UI imply a trained model produced the line when it didn't. */
function engineLabel(source: string): string {
  if (source === 'stub') return 'deterministic placeholder (not a trained model)';
  if (source === 'groq') return 'Groq';
  if (source === 'bilstm') return 'BiLSTM + Transformer';
  return source;
}

export default function DrawerChartPanel({
  market,
  timeframe,
  onTimeframeChange,
}: DrawerChartSlotProps) {
  const surgeState = marketSurgeState(market);
  const yoyRatio = market.yoyRatio;

  return (
    <section className="radar-section" aria-label="Demand forecast">
      {/* Tabbed cards: the label straddles the top edge rather than leading the
          sentence, so the two states are told apart at a glance instead of by
          reading the first three words. */}
      {surgeState === 'critical' ? (
        <div className="info-card" data-tone="critical" role="status">
          <span className="info-tab">Surge confirmed</span>
          <div className="info-body">
            <span className="info-glyph">
              <Zap size={16} strokeWidth={2} aria-hidden="true" />
            </span>
            <p className="body-sm">
              {yoyRatio !== null
                ? `The demand window is confirmed by a year-on-year comparison (ratio ${yoyRatio.toFixed(2)}).`
                : 'The demand window is critical, but a year-on-year comparison is not available yet.'}
            </p>
          </div>
        </div>
      ) : surgeState === 'warning' ? (
        <div className="info-card" data-tone="accent" role="status">
          <span className="info-tab">Active demand window</span>
          <div className="info-body">
            <span className="info-glyph">
              <Zap size={16} strokeWidth={2} aria-hidden="true" />
            </span>
            <p className="body-sm">
              {market.upliftPct !== null
                ? `The 4-week forecast is ${market.upliftPct.toFixed(1)}% above its rolling baseline.`
                : 'The forecast has crossed the rolling-baseline demand threshold.'}
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

      {/* Step 19 (C-14; M2-ST-036): with the stub engine in place, the UI must
          never let this line read as coming from a trained, validated model. */}
      {(market.lowConfidence || market.forecastConfidence < LOW_CONFIDENCE_THRESHOLD) && (
        <div className="info-card" data-tone="attention" role="status">
          <span className="info-tab">Unvalidated forecast</span>
          <div className="info-body">
            <span className="info-glyph">
              <AlertTriangle size={16} strokeWidth={2} aria-hidden="true" />
            </span>
            <p className="body-sm">
              This forecast has not been validated against real outcomes yet (confidence{' '}
              {Math.round(market.forecastConfidence * 100)}%). Treat it as a planning signal, not a
              committed number.
            </p>
          </div>
        </div>
      )}

      <DemandForecastChart data={market.chartData} timeframe={timeframe} />
      <p className="text-meta mt-1">Forecast engine: {engineLabel(market.forecastSource)}</p>

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
