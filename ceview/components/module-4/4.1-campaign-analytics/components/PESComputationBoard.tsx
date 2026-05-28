import React, { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, Dot,
} from 'recharts';
import { Loader2 } from 'lucide-react';
import ScoreGauge from './ScoreGauge';
import QualitativeLabel from './QualitativeLabel';
import { COLORS } from '../../../../constants';
import { api, ApiError } from '../../../../services/apiClient';
import type { PesResponse, CampaignSnapshot } from '../../../../types';

interface PESComputationBoardProps {
  weeks: 4 | 8;
  pesData: PesResponse | null;
}

/** Colour a dot on the trend line by performance tier. */
function tierColor(score: number): string {
  if (score >= 0.80) return COLORS.GOLD;
  if (score >= 0.60) return COLORS.GREEN;
  if (score >= 0.40) return '#F59E0B';
  return COLORS.RED_ORANGE;
}

/** Format a period_start date string ("2026-03-09") to a short label ("Mar 9"). */
function shortDate(dateStr: string | null, idx: number): string {
  if (!dateStr) return `Wk ${idx + 1}`;
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface ChartPoint {
  label: string;
  pesScore: number;
  pesLabel: string;
  periodEnd: string | null;
}

const PESComputationBoard: React.FC<PESComputationBoardProps> = ({ weeks, pesData: submittedPes }) => {
  const [history, setHistory]   = useState<ChartPoint[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    api.analyticsHistory(weeks)
      .then(r => {
        if (cancelled) return;
        setHistory(
          r.snapshots.map((s: CampaignSnapshot, i: number) => ({
            label:     shortDate(s.periodStart, i),
            pesScore:  Math.round(s.pesScore * 100) / 100,
            pesLabel:  s.pesLabel,
            periodEnd: s.periodEnd,
          }))
        );
      })
      .catch(e => {
        if (cancelled) return;
        const msg = e instanceof ApiError
          ? `History unavailable [${e.code}]`
          : 'History unavailable.';
        console.warn('[Module 4] analyticsHistory failed', e);
        setError(msg);
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [weeks]);

  const currentScore = submittedPes?.overallScore ?? history[history.length - 1]?.pesScore ?? 0;
  const currentLabel = submittedPes?.label        ?? history[history.length - 1]?.pesLabel ?? '';

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in mt-12">

      {/* ── Overall PES gauge (current submission) ────────────────────────── */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center justify-center">
        <h3 className="text-lg font-semibold mb-4 w-full text-left" style={{ color: COLORS.NAVY }}>
          Overall Score (PES)
        </h3>
        <ScoreGauge score={currentScore} />
        <QualitativeLabel label={currentLabel} />
      </div>

      {/* ── Weekly PES trend line chart ────────────────────────────────────── */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 md:col-span-2 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold" style={{ color: COLORS.NAVY }}>
            PES Trend — Last {weeks} Weeks
          </h3>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-50 border border-slate-200"
            style={{ color: COLORS.TEXT_MUTED }}>
            PES = ROAS×0.35 + CR×0.30 + CAC⁻¹×0.15 + CTR×0.15 + CPC⁻¹×0.05
          </span>
        </div>

        {loading && (
          <div className="flex-1 flex items-center justify-center min-h-[180px]">
            <Loader2 size={24} className="animate-spin" style={{ color: COLORS.NAVY }} />
          </div>
        )}

        {error && !loading && (
          <div className="flex-1 flex items-center justify-center min-h-[180px]">
            <p className="text-sm font-medium text-red-500">{error}</p>
          </div>
        )}

        {!loading && !error && history.length === 0 && (
          <div className="flex-1 flex items-center justify-center min-h-[180px]">
            <p className="text-sm" style={{ color: COLORS.TEXT_MUTED }}>
              No campaign history yet. Submit weekly data to build the trend.
            </p>
          </div>
        )}

        {!loading && !error && history.length > 0 && (
          <div className="flex-1 min-h-[180px]">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={history} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>

                {/* Performance tier reference bands */}
                <ReferenceLine y={0.80} stroke="#D1FAE5" strokeDasharray="4 3" label={{ value: 'Excellent', position: 'insideTopRight', fontSize: 10, fill: '#059669' }} />
                <ReferenceLine y={0.60} stroke="#FEF3C7" strokeDasharray="4 3" label={{ value: 'Good',      position: 'insideTopRight', fontSize: 10, fill: '#D97706' }} />
                <ReferenceLine y={0.40} stroke="#FEE2E2" strokeDasharray="4 3" label={{ value: 'Fair',      position: 'insideTopRight', fontSize: 10, fill: '#DC2626' }} />

                <XAxis
                  dataKey="label"
                  tick={{ fill: COLORS.TEXT_MUTED, fontSize: 11, fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 1]}
                  tickFormatter={v => v.toFixed(1)}
                  tick={{ fill: COLORS.TEXT_MUTED, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  ticks={[0, 0.2, 0.4, 0.6, 0.8, 1.0]}
                />
                <Tooltip
                  cursor={{ stroke: '#E2E8F0', strokeWidth: 1 }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload as ChartPoint;
                    return (
                      <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-lg text-sm">
                        <p className="font-bold mb-1" style={{ color: COLORS.NAVY }}>
                          {label}{d.periodEnd ? ` – ${shortDate(d.periodEnd, 0)}` : ''}
                        </p>
                        <p style={{ color: COLORS.TEXT_MUTED }}>
                          PES Score: <span className="font-black" style={{ color: tierColor(d.pesScore) }}>
                            {d.pesScore.toFixed(2)}
                          </span>
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: COLORS.TEXT_MUTED }}>{d.pesLabel}</p>
                      </div>
                    );
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="pesScore"
                  stroke={COLORS.NAVY}
                  strokeWidth={2.5}
                  dot={(props) => {
                    const { cx, cy, payload } = props;
                    return (
                      <Dot
                        key={`dot-${cx}-${cy}`}
                        cx={cx} cy={cy} r={5}
                        fill={tierColor((payload as ChartPoint).pesScore)}
                        stroke="#fff"
                        strokeWidth={2}
                      />
                    );
                  }}
                  activeDot={{ r: 7, stroke: '#fff', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
};

export default PESComputationBoard;
