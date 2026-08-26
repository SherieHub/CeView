/**
 * CARD — Market Radar Drawer: Economic & Seasonal Insights Tabs
 *
 * "Purchasing power" — four KPI tiles, the AI economic insight, and the forex
 * 12-month and GDP 5-year mini trend charts.
 *
 * Tiles reuse the Dashboard's .stat-tile structure so a metric reads the same
 * way on both screens.
 */
import { Line, LineChart, ResponsiveContainer, Tooltip, YAxis } from 'recharts';
import { Banknote, Compass, Plane, Sparkles, TrendingUp } from 'lucide-react';
import type { Market } from '../../../services/fixtures/markets';

function MiniTrend({
  data,
  label,
  format = (v: number) => String(v),
}: {
  data: { value: number }[];
  label: string;
  format?: (value: number) => string;
}) {
  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const latest = values[values.length - 1];
  const rising = latest >= values[0];

  return (
    <div className="card">
      {/* A sparkline with no scale is decoration — you can see the shape but
          not whether it moved 1% or 30%. Latest value leads, with the range it
          moved through underneath. */}
      <div className="trend-head">
        <p className="eyebrow">{label}</p>
        <div className="trend-now">
          <b className="num">{format(latest)}</b>
          <span className="text-meta">
            {rising ? '▲' : '▼'} {format(min)}–{format(max)}
          </span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={90}>
        <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
          {/* Domain is the data's own range, not [0, max] — these are trends
              where the shape is the point, and a zero baseline would flatten a
              forex series that only ever moves a few percent. */}
          <YAxis domain={['dataMin', 'dataMax']} hide />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: 'none',
              boxShadow: 'var(--shadow-card-hover)',
              fontFamily: 'var(--font-body)',
              fontSize: 13,
            }}
          />
          <Line
            type="monotone"
            dataKey="value"
            name={label}
            stroke="var(--color-teal-accent)"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function PurchasingPowerTab({ market }: { market: Market }) {
  const tiles = [
    {
      icon: Banknote,
      label: market.forexLabel,
      value: market.forexValue.toFixed(2),
      foot: market.currency,
    },
    { icon: TrendingUp, label: 'GDP growth', value: `${market.gdpValue}%`, foot: 'Year on year' },
    { icon: Plane, label: 'Avg flight price', value: market.avgFlightPrice, foot: 'Round trip' },
    {
      icon: Compass,
      label: 'Accessibility',
      value: `${market.accessibilityScore}/10`,
      foot: `${market.flightFrequency}x weekly`,
    },
  ];

  return (
    <>
      <div className="radar-kpis">
        {tiles.map(({ icon: Icon, label, value, foot }) => (
          <div key={label} className="stat-tile">
            <span className="stat-icon">
              <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
            </span>
            <div className="stat-head">
              <span className="stat-label">{label}</span>
              <b className="stat-value num">{value}</b>
            </div>
            <div className="stat-foot">{foot}</div>
          </div>
        ))}
      </div>

      <div className="info-card" data-tone="accent">
        <span className="info-tab">What this means</span>
        <div className="info-body">
          <span className="info-glyph">
            <Sparkles size={16} strokeWidth={2} aria-hidden="true" />
          </span>
          <p className="body-sm">{market.economyInsight}</p>
        </div>
      </div>

      <div className="radar-trends">
        <MiniTrend
          data={market.forexTrend}
          label={`${market.forexLabel} · 12 months`}
          format={(v) => v.toFixed(2)}
        />
        <MiniTrend
          data={market.gdpTrend}
          label="GDP growth · 5 years"
          format={(v) => `${v}%`}
        />
      </div>
    </>
  );
}
