/**
 * CARD — Market Radar Drawer: Directive & Demand Chart
 * Prototype reference: renderRadar() — ui-ux-prototype.html:2521-2793
 *
 * `chartData` is 24 points: 12 history (history set, forecast null) then 12
 * forecast (the reverse), with the current week carrying both so the two lines
 * meet instead of leaving a gap. The timeframe slices the FORECAST half only —
 * history is always shown, since the point of the chart is reading the
 * projection against what actually happened.
 */
import {
  Area,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ChartDataPoint } from '../../../services/fixtures/markets';
import type { Timeframe } from './radarTypes';

interface DemandForecastChartProps {
  data: ChartDataPoint[];
  timeframe: Timeframe;
}

export default function DemandForecastChart({ data, timeframe }: DemandForecastChartProps) {
  const history = data.filter((d) => d.history !== null);
  const forecast = data.filter((d) => d.forecast !== null && d.history === null);
  const shown = [...history, ...forecast.slice(0, timeframe === '4WK' ? 4 : 12)];

  // Anchor the forecast series to the last OBSERVED value so the two lines meet.
  // The fixture sets the current week's `forecast` to the first projected value,
  // which is a different number from that week's `history` — rendered as-is the
  // dashed line starts mid-air above where the area ends, and the chart reads as
  // broken. Nothing is lost: that first projected value is also Wk +1's, so it
  // is still on the chart, one step to the right where it belongs.
  const joinIndex = history.length - 1;
  const series = shown.map((d, i) =>
    i === joinIndex ? { ...d, forecast: d.history } : d,
  );

  return (
    <div className="chart-frame">
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={series} margin={{ top: 8, right: 10, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="demandFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-mint-primary)" stopOpacity={0.32} />
              <stop offset="100%" stopColor="var(--color-mint-primary)" stopOpacity={0} />
            </linearGradient>
          </defs>

          <XAxis
            dataKey="week"
            tick={{ fontSize: 10, fill: 'var(--color-text-body)' }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            domain={[0, 100]}
            ticks={[0, 30, 70, 100]}
            tick={{ fontSize: 10, fill: 'var(--color-text-body)' }}
            tickLine={false}
            axisLine={false}
            width={34}
          />

          {/* The zone boundaries the legend below explains. */}
          <ReferenceLine y={30} stroke="var(--color-gray-light)" strokeDasharray="3 3" />
          <ReferenceLine y={70} stroke="var(--color-gray-light)" strokeDasharray="3 3" />

          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: 'none',
              boxShadow: 'var(--shadow-card-hover)',
              fontFamily: 'var(--font-body)',
              fontSize: 13,
            }}
            formatter={(value) => [Math.round(Number(value)), 'Demand'] as [number, string]}
          />

          <Area
            type="monotone"
            dataKey="history"
            name="Observed"
            stroke="var(--color-teal-accent)"
            strokeWidth={2}
            fill="url(#demandFill)"
            connectNulls
            dot={false}
          />
          {/* Dashed so a projection is never mistaken for a measurement. */}
          <Line
            type="monotone"
            dataKey="forecast"
            name="Forecast"
            stroke="var(--color-cyan-deep)"
            strokeWidth={2}
            strokeDasharray="5 4"
            connectNulls
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
