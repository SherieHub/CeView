/**
 * CARD — Market Radar Drawer: Economic & Seasonal Insights Tabs
 *
 * "Seasonal patterns" — seasonality score and band, year-on-year confidence,
 * the 12-month peak calendar, the AI insight, and the full 24-week seasonality
 * index.
 */
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CalendarRange, Sparkles } from 'lucide-react';
import type { Market } from '../../../services/fixtures/markets';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Bands per the screen doc (market-radar-drawer.md). */
export function seasonalityBand(score: number): string {
  if (score >= 0.85) return 'Strong';
  if (score >= 0.7) return 'Moderate';
  if (score >= 0.4) return 'Weak — emerging';
  return 'No seasonal basis';
}

export default function SeasonalPatternsTab({ market }: { market: Market }) {
  const peaks = new Set(market.peakMonths);

  return (
    <>
      <div className="radar-kpis radar-kpis--pair">
        <div className="stat-tile">
          <span className="stat-icon">
            <CalendarRange size={18} strokeWidth={1.75} aria-hidden="true" />
          </span>
          <div className="stat-head">
            <span className="stat-label">Seasonality</span>
            <b className="stat-value num">{market.seasonalityScore.toFixed(2)}</b>
          </div>
          <div className="stat-foot">{seasonalityBand(market.seasonalityScore)}</div>
        </div>

        <div className="stat-tile">
          <span className="stat-icon">
            <Sparkles size={18} strokeWidth={1.75} aria-hidden="true" />
          </span>
          <div className="stat-head">
            <span className="stat-label">Year on year</span>
            {/* Null is a real state, not missing data: under 59 weeks of history
                there is no prior year to compare against, and printing a number
                would imply a confirmation that has not happened. */}
            <b className="stat-value num">
              {market.yoyRatio == null ? 'N/A' : market.yoyRatio.toFixed(2)}
            </b>
          </div>
          <div className="stat-foot">
            {market.yoyRatio == null
              ? 'Under 59 weeks of history — not yet comparable'
              : market.yoyRatio >= 1
                ? 'Pattern repeated last year'
                : 'Softer than last year'}
          </div>
        </div>
      </div>

      <div className="card mt-4">
        <p className="eyebrow mb-2">Peak months</p>
        <ul className="month-grid">
          {MONTHS.map((m) => (
            <li key={m} data-peak={peaks.has(m)}>
              {m}
            </li>
          ))}
        </ul>
      </div>

      <div className="info-card" data-tone="accent">
        <span className="info-tab">What this means</span>
        <div className="info-body">
          <span className="info-glyph">
            <Sparkles size={16} strokeWidth={2} aria-hidden="true" />
          </span>
          <p className="body-sm">{market.seasonalityInsight}</p>
        </div>
      </div>

      <div className="chart-frame">
        <p className="eyebrow mb-2">Seasonality index · 24 weeks</p>
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={market.chartData} margin={{ top: 8, right: 10, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="seasonFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-cyan-accent)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="var(--color-cyan-accent)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="week"
              tick={{ fontSize: 10, fill: 'var(--color-text-body)' }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              minTickGap={28}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: 'var(--color-text-body)' }}
              tickLine={false}
              axisLine={false}
              width={34}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: 'none',
                boxShadow: 'var(--shadow-card-hover)',
                fontFamily: 'var(--font-body)',
                fontSize: 13,
              }}
            />
            <Area
              type="monotone"
              dataKey="seasonality"
              name="Seasonality"
              stroke="var(--color-cyan-deep)"
              strokeWidth={2}
              fill="url(#seasonFill)"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}
