import React, { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend,
} from 'recharts';
import { Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import { COLORS } from '../../../../constants';
import { api, ApiError } from '../../../../services/apiClient';
import type { CampaignSnapshot } from '../../../../types';

interface CampaignMetricsTrendProps {
  weeks: 4 | 8;
}

interface ChartPoint {
  label: string;
  CTR: number | null;
  CR: number | null;
  ROAS: number | null;
  CPC: number | null;
  CAC: number | null;
}

function shortDate(dateStr: string | null, idx: number): string {
  if (!dateStr) return `Wk ${idx + 1}`;
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const PERF_LINES = [
  { key: 'ROAS', color: COLORS.NAVY,       label: 'ROAS (×)',  unit: '×' },
  { key: 'CTR',  color: COLORS.GOLD,        label: 'CTR (%)',   unit: '%' },
  { key: 'CR',   color: '#10B981',           label: 'CR (%)',    unit: '%' },
] as const;

const COST_LINES = [
  { key: 'CPC', color: '#F59E0B', label: 'CPC (₱)', unit: '₱' },
  { key: 'CAC', color: COLORS.RED_ORANGE, label: 'CAC (₱)', unit: '₱' },
] as const;

const CustomerJourneyFunnel: React.FC<CampaignMetricsTrendProps> = ({ weeks }) => {
  const [data, setData]     = useState<ChartPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    api.analyticsHistory(weeks)
      .then(r => {
        if (cancelled) return;
        setData(
          r.snapshots.map((s: CampaignSnapshot, i: number) => ({
            label: shortDate(s.periodStart, i),
            CTR:   s.ctr   != null ? Math.round(s.ctr   * 100) / 100 : null,
            CR:    s.convRate != null ? Math.round(s.convRate * 100) / 100 : null,
            ROAS:  s.roas  != null ? Math.round(s.roas  * 100) / 100 : null,
            CPC:   s.cpc   != null ? Math.round(s.cpc   * 100) / 100 : null,
            CAC:   s.cac   != null ? Math.round(s.cac   * 100) / 100 : null,
          }))
        );
      })
      .catch(e => {
        if (cancelled) return;
        const msg = e instanceof ApiError
          ? `Campaign history unavailable [${e.code}]`
          : 'Campaign history unavailable.';
        setError(msg);
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [weeks]);

  const hasData = !loading && !error && data.length > 0;

  const commonXAxis = (
    <XAxis
      dataKey="label"
      tick={{ fill: COLORS.TEXT_MUTED, fontSize: 11, fontWeight: 600 }}
      axisLine={false}
      tickLine={false}
    />
  );

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mt-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6">
        <div>
          <h3 className="text-lg font-semibold" style={{ color: COLORS.NAVY }}>
            Campaign Metrics Trend
          </h3>
          <p className="text-xs mt-0.5" style={{ color: COLORS.TEXT_MUTED }}>
            Last {weeks} weeks of submitted campaign records
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs font-medium" style={{ color: COLORS.TEXT_MUTED }}>
          <span className="flex items-center gap-1">
            <TrendingUp size={13} style={{ color: '#10B981' }} /> Performance
          </span>
          <span className="flex items-center gap-1">
            <TrendingDown size={13} style={{ color: COLORS.RED_ORANGE }} /> Cost
          </span>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center min-h-[260px]">
          <Loader2 size={28} className="animate-spin" style={{ color: COLORS.NAVY }} />
        </div>
      )}

      {error && !loading && (
        <div className="flex items-center justify-center min-h-[260px]">
          <p className="text-sm font-medium" style={{ color: COLORS.TEXT_MUTED }}>
            {error} — Submit campaign data to populate this chart.
          </p>
        </div>
      )}

      {!loading && !error && data.length === 0 && (
        <div className="flex items-center justify-center min-h-[260px]">
          <p className="text-sm" style={{ color: COLORS.TEXT_MUTED }}>
            No campaign records yet. Submit weekly data to build the trend.
          </p>
        </div>
      )}

      {hasData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ── Performance metrics: ROAS, CTR, CR ─────────────────────── */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: COLORS.TEXT_MUTED }}>
              Efficiency Metrics
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data} margin={{ top: 4, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                {commonXAxis}
                <YAxis
                  tick={{ fill: COLORS.TEXT_MUTED, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => v.toFixed(1)}
                />
                <Tooltip
                  cursor={{ stroke: '#E2E8F0', strokeWidth: 1 }}
                  contentStyle={{ borderRadius: '10px', border: '1px solid #E2E8F0', fontSize: 12 }}
                  formatter={(value: unknown, name: string) => {
                    const line = PERF_LINES.find(l => l.key === name);
                    return [`${value}${line?.unit ?? ''}`, line?.label ?? name];
                  }}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                  formatter={(value) => PERF_LINES.find(l => l.key === value)?.label ?? value}
                />
                {PERF_LINES.map(l => (
                  <Line
                    key={l.key}
                    type="monotone"
                    dataKey={l.key}
                    stroke={l.color}
                    strokeWidth={2}
                    dot={{ r: 4, fill: l.color, stroke: '#fff', strokeWidth: 1.5 }}
                    activeDot={{ r: 6 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* ── Cost metrics: CPC, CAC ──────────────────────────────────── */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: COLORS.TEXT_MUTED }}>
              Cost Metrics (₱)
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data} margin={{ top: 4, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                {commonXAxis}
                <YAxis
                  tick={{ fill: COLORS.TEXT_MUTED, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => `₱${v}`}
                />
                <Tooltip
                  cursor={{ stroke: '#E2E8F0', strokeWidth: 1 }}
                  contentStyle={{ borderRadius: '10px', border: '1px solid #E2E8F0', fontSize: 12 }}
                  formatter={(value: unknown, name: string) => {
                    const line = COST_LINES.find(l => l.key === name);
                    return [`₱${value}`, line?.label ?? name];
                  }}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                  formatter={(value) => COST_LINES.find(l => l.key === value)?.label ?? value}
                />
                {COST_LINES.map(l => (
                  <Line
                    key={l.key}
                    type="monotone"
                    dataKey={l.key}
                    stroke={l.color}
                    strokeWidth={2}
                    dot={{ r: 4, fill: l.color, stroke: '#fff', strokeWidth: 1.5 }}
                    activeDot={{ r: 6 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

        </div>
      )}
    </div>
  );
};

export default CustomerJourneyFunnel;
