/**
 * CARD — Performance: Trend Charts
 * Depends on: Foundation — Performance Shell & Ingestion (M4-F)
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/05-module-4.md (M4-4)
 *
 * CPC/CAC over time, sharing the shell's `window` slice.
 *
 * Per pseudocode/module-4/trend-charts.ts: identical shape to
 * EfficiencyTrendChart, takes only `window` — only PesTrendChart owns the
 * weeks/onWeeksChange toggle.
 */
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { CampaignHistoryEntry } from '@/types';
import type { TrendSlotProps } from './campaignTypes';

function formatPeriodLabel(entry: CampaignHistoryEntry): string {
  const format = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  return `${format(entry.periodStart)}–${format(entry.periodEnd)}`;
}

export default function CostTrendChart({ window }: Pick<TrendSlotProps, 'window'>) {
  const data = window.map((entry) => ({
    period: formatPeriodLabel(entry),
    cpc: entry.cpc,
    cac: entry.cac,
  }));

  return (
    <div className="card flex flex-col gap-4">
      <div>
        <h3 className="heading-sm">Cost Trend</h3>
        <p className="body-xs">Cost per click and customer acquisition cost over the selected window.</p>
      </div>

      <div data-testid="cost-trend-chart" data-point-count={data.length} className="h-[280px] w-full">
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
              dataKey="cpc"
              name="CPC (₱)"
              stroke="var(--color-navy-primary)"
              strokeWidth={2.5}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="cac"
              name="CAC (₱)"
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
