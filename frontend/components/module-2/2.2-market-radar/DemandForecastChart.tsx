/**
 * CARD — Market Radar Drawer: Directive & Demand Chart
 * Prototype reference: renderRadar() — ui-ux-prototype.html:2521-2793
 *
 * `chartData` contains only real history followed by forecast rows. The
 * timeframe slices the forecast half; history is always shown, so the
 * projection can be read against what actually happened.
 */
import {
  Area,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ChartDataPoint } from '@/types';
import type { Timeframe } from './radarTypes';

interface DemandForecastChartProps {
  data: ChartDataPoint[];
  timeframe: Timeframe;
}

/** "Wk -3" / "Current" / "Wk +2" -> weeks offset from the Current week. */
export function weekOffsetFromLabel(week: string): number {
  if (week === 'Current') return 0;
  const match = /^Wk ([+-])(\d+)$/.exec(week);
  if (!match) return 0;
  return (match[1] === '+' ? 1 : -1) * Number(match[2]);
}

/**
 * The exact Monday-through-Sunday calendar range for the tooltip header. The
 * backend emits the persisted ISO week start for every row; it is never
 * reconstructed from an arbitrary ingestion timestamp.
 */
export function formatWeekRange(weekStartDate: string | null): string | null {
  if (!weekStartDate) return null;
  const start = new Date(`${weekStartDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime())) return null;
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${fmt(start)}–${fmt(end)}`;
}

export interface DemandForecastTooltipProps {
  active?: boolean;
  label?: string;
  payload?: Array<{
    name?: string;
    value?: number | string;
    color?: string;
    payload?: Pick<ChartDataPoint, 'weekStartDate'>;
  }>;
}

/** Kept separate from Recharts so the required series labels are RTL-testable. */
export function DemandForecastTooltip({ active, label, payload = [] }: DemandForecastTooltipProps) {
  if (!active || !label || payload.length === 0) return null;
  const range = formatWeekRange(payload[0]?.payload?.weekStartDate ?? null);
  return (
    <div className="rounded-[var(--radius-sm)] bg-white px-3 py-2 text-xs shadow-[var(--shadow-card-hover)]">
      <p className="mb-1 font-semibold">{range ? `${label} (${range})` : label}</p>
      {payload.filter((entry) => entry.value != null).map((entry) => (
        <p key={entry.name} style={{ color: entry.color }}>
          {entry.name}: {Math.round(Number(entry.value))}
        </p>
      ))}
    </div>
  );
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

          <Tooltip content={(props) => <DemandForecastTooltip {...(props as DemandForecastTooltipProps)} />} />
          <Legend verticalAlign="top" height={28} wrapperStyle={{ fontSize: 12 }} />

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
      {/* Step 19 (C-14): the backend no longer pads short history with
          synthetic points, so the chart can genuinely start later than 12
          weeks back — this says so instead of leaving a shorter chart
          unexplained. */}
      <p className="text-meta mt-1">
        {history.length} week{history.length === 1 ? '' : 's'} of history
      </p>
    </div>
  );
}
