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
import type { Market } from '@/types';
import { formatPhpRange } from './format';

/**
 * Step 18 (C-21/C-22/C-23; H-11): explains an empty trend series using the
 * provenance fields Step 6 added — a bare "no data" would be honest but
 * unhelpful; this says whether it's never been fetched at all or only a
 * stale last-known-good reading exists.
 */
function provenanceReason(source: string | null, asOf: string | null): string | null {
  if (!source) return 'this reading has never been fetched for this market';
  if (source === 'last_known_good') {
    const asOfText = asOf ? ` (as of ${new Date(asOf).toLocaleDateString()})` : '';
    return `only a last-known-good reading exists${asOfText}, with no history series behind it`;
  }
  return null;
}

function MiniTrend({
  data,
  label,
  emptyReason,
  format = (v: number) => String(v),
}: {
  data: { value: number }[];
  label: string;
  /** Why the series is empty, from provenance fields — see provenanceReason(). */
  emptyReason?: string | null;
  format?: (value: number) => string;
}) {
  const values = data.map((d) => d.value);

  // An empty series used to reach `values[values.length - 1]` -> undefined,
  // then `undefined.toFixed(2)` -> a render-crashing TypeError that took the
  // whole drawer down (H-11). A real empty state instead.
  if (values.length === 0) {
    return (
      <div className="card">
        <div className="trend-head">
          <p className="eyebrow">{label}</p>
        </div>
        <div className="empty" style={{ minHeight: 90 }}>
          <p className="body-sm text-meta">
            No trend data available{emptyReason ? ` — ${emptyReason}.` : '.'}
          </p>
        </div>
      </div>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const latest = values[values.length - 1];
  const rising = latest >= values[0];
  // A single point has no direction and no range — an arrow and a "X–X" range
  // both built from the same one number would imply a trend that isn't there.
  const singlePoint = values.length === 1;

  return (
    <div className="card">
      {/* A sparkline with no scale is decoration — you can see the shape but
          not whether it moved 1% or 30%. Latest value leads, with the range it
          moved through underneath. */}
      <div className="trend-head">
        <p className="eyebrow">{label}</p>
        <div className="trend-now">
          <b className="num">{format(latest)}</b>
          {!singlePoint && (
            <span className="text-meta">
              {rising ? '▲' : '▼'} {format(min)}–{format(max)}
            </span>
          )}
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
    {
      icon: Plane,
      label: 'Avg flight price',
      value: formatPhpRange(market.fareMinPhp, market.fareMaxPhp),
      foot: market.fareAsOf ? `Round trip · ref. ${market.fareAsOf}` : 'Round trip',
    },
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

      <p className="text-meta mt-2">
        Fare reference: {market.fareSource} · Effective: {market.fareAsOf ?? 'unknown'}
      </p>

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
        {/* Step 18 (H-11): the label used to hardcode "12 months"/"5 years"
            regardless of how many points actually came back (the seed has 4) —
            derived from the real series length instead. */}
        <MiniTrend
          data={market.forexTrend}
          label={`${market.forexLabel} · ${market.forexTrend.length} month${market.forexTrend.length === 1 ? '' : 's'}`}
          emptyReason={provenanceReason(market.forexSource, market.macroAsOf)}
          format={(v) => v.toFixed(2)}
        />
        <MiniTrend
          data={market.gdpTrend}
          label={`GDP growth · ${market.gdpTrend.length} year${market.gdpTrend.length === 1 ? '' : 's'}`}
          emptyReason={provenanceReason(market.gdpSource, market.macroAsOf)}
          format={(v) => `${v}%`}
        />
      </div>
    </>
  );
}
