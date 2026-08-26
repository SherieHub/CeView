/**
 * CARD — Performance: Trend Charts
 * Depends on: Foundation — Performance Shell & Ingestion (M4-F)
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/05-module-4.md (M4-4)
 *
 * PES-over-time line chart with the three label-threshold dashed reference
 * lines (0.40/0.60/0.80) plus the 4WK/8WK toggle control. The shell (M4-F)
 * owns slicing `history` to the current `weeks` and re-renders this (and its
 * siblings) with the new `window` when the toggle fires `onWeeksChange` — this
 * component never re-slices `window` itself.
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
import type { CampaignHistoryEntry } from '../../../services/fixtures/campaign';
import type { TrendSlotProps } from './campaignTypes';

/** The label-threshold bands a PES score is qualitatively judged against. */
const PES_REFERENCE_LINES = [0.4, 0.6, 0.8];

const WEEK_OPTIONS: (4 | 8)[] = [4, 8];

function formatPeriodLabel(entry: CampaignHistoryEntry): string {
  const format = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  return `${format(entry.periodStart)}–${format(entry.periodEnd)}`;
}

export default function PesTrendChart({ window, weeks, onWeeksChange }: TrendSlotProps) {
  const data = window.map((entry) => ({ period: formatPeriodLabel(entry), pesScore: entry.pesScore }));

  return (
    <div className="card flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="heading-sm">PES Trend</h3>
          <p className="body-xs">Weekly Performance Efficiency Score against the label-threshold bands.</p>
        </div>
        <div role="group" aria-label="Trend window" className="inline-flex gap-1 rounded-pill bg-mint-pale p-1">
          {WEEK_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={weeks === option}
              onClick={() => onWeeksChange(option)}
              className={`rounded-pill px-4 py-1.5 text-sm font-semibold transition-colors ${
                weeks === option ? 'bg-mint-primary text-navy-dark' : 'text-navy-primary hover:text-cyan-deep'
              }`}
            >
              {option}WK
            </button>
          ))}
        </div>
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
