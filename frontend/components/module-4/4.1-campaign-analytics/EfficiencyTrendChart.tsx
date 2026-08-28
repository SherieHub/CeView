/**
 * CARD — Performance: Trend Charts
 * Depends on: Foundation — Performance Shell & Ingestion (M4-F)
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/05-module-4.md (M4-4)
 *
 * ROAS/CTR/conversion-rate over time, sharing the shell's `window` slice.
 *
 * Per pseudocode/module-4/trend-charts.ts: takes only `window`, not the full
 * TrendSlotProps — only PesTrendChart owns the weeks/onWeeksChange toggle.
 */
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { CampaignHistoryEntry } from '../../../services/fixtures/campaign';
import type { TrendSlotProps } from './campaignTypes';

function formatPeriodLabel(entry: CampaignHistoryEntry): string {
  const format = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  return `${format(entry.periodStart)}–${format(entry.periodEnd)}`;
}

export default function EfficiencyTrendChart({ window }: Pick<TrendSlotProps, 'window'>) {
  const data = window.map((entry) => ({
    period: formatPeriodLabel(entry),
    roas: entry.roas,
    ctr: entry.ctr,
    convRate: entry.convRate,
  }));

  return (
    <div className="card flex flex-col gap-4">
      <div>
        <h3 className="heading-sm">Efficiency Trend</h3>
        <p className="body-xs">ROAS, CTR and conversion rate over the selected window.</p>
      </div>

      <div data-testid="efficiency-trend-chart" data-point-count={data.length} className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="4 4" stroke="var(--color-gray-light)" vertical={false} />
            <XAxis
              dataKey="period"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }}
            />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 12, color: 'var(--color-text-muted)' }} />
            <Line
              type="monotone"
              dataKey="roas"
              name="ROAS"
              stroke="var(--color-mint-primary)"
              strokeWidth={2.5}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="ctr"
              name="CTR"
              stroke="var(--color-teal-accent)"
              strokeWidth={2.5}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="convRate"
              name="Conversion rate"
              stroke="var(--color-coral-cta)"
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
