/**
 * CARD — Performance: Trend Charts
 * Depends on: Foundation — Performance Shell & Ingestion (M4-F)
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/05-module-4.md (M4-4)
 *
 * PES-over-time line chart with the three label-threshold dashed reference
 * lines (0.40/0.60/0.80). The 4WK/8WK window control is a single shared
 * toggle in the shell (M4-F) that governs all three trend charts, so this
 * component just renders whatever `window` it is handed.
 */
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { CampaignHistoryEntry } from '@/types';
import type { TrendSlotProps } from './campaignTypes';

/** The label-threshold bands a PES score is qualitatively judged against. */
const PES_REFERENCE_LINES = [0.4, 0.6, 0.8];

function formatPeriodLabel(entry: CampaignHistoryEntry): string {
  const format = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  return `${format(entry.periodStart)}–${format(entry.periodEnd)}`;
}

export default function PesTrendChart({ window }: Pick<TrendSlotProps, 'window'>) {
  const data = window.map((entry) => ({ period: formatPeriodLabel(entry), pesScore: entry.pesScore }));

  return (
    <div className="card flex flex-col gap-4">
      <div>
        <h3 className="heading-sm">PES Trend</h3>
        <p className="body-xs">Weekly Performance Efficiency Score against the label-threshold bands.</p>
      </div>

      <div data-testid="pes-trend-chart" data-point-count={data.length} className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 24, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="4 4" stroke="var(--color-gray-light)" vertical={false} />
            <XAxis
              dataKey="period"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }}
            />
            <YAxis
              domain={[0, 1]}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }}
            />
            <Tooltip formatter={(value) => (typeof value === 'number' ? value.toFixed(2) : value)} />
            {PES_REFERENCE_LINES.map((threshold) => (
              <ReferenceLine
                key={threshold}
                y={threshold}
                stroke="var(--color-gray-light)"
                strokeDasharray="4 4"
                label={{
                  value: threshold.toFixed(2),
                  position: 'right',
                  fontSize: 11,
                  fill: 'var(--color-text-muted)',
                }}
              />
            ))}
            <Line
              type="monotone"
              dataKey="pesScore"
              name="PES score"
              stroke="var(--color-mint-primary)"
              strokeWidth={2.5}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
