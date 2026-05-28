import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { Loader2 } from 'lucide-react';
import ScoreGauge from './ScoreGauge';
import QualitativeLabel from './QualitativeLabel';
import { COLORS } from '../../../../constants';
import { api, ApiError } from '../../../../services/apiClient';
import type { PesResponse } from '../../../../types';

interface PESComputationBoardProps {
  weeks: 4 | 8;
  /** PES computed from the submitted form data. When provided, skips the API fetch. */
  pesData: PesResponse | null;
}

const BAR_FILLS = [COLORS.NAVY, COLORS.GOLD, COLORS.RED_ORANGE, COLORS.GREEN, COLORS.NAVY_LIGHT];

const PESComputationBoard: React.FC<PESComputationBoardProps> = ({ weeks, pesData: submittedPes }) => {
  const [fetchedPes, setFetchedPes] = useState<PesResponse | null>(null);
  const [loading, setLoading]       = useState(!submittedPes);
  const [error, setError]           = useState<string | null>(null);

  useEffect(() => {
    if (submittedPes) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    api.analyticsPes('default', weeks)
      .then(r => { if (!cancelled) setFetchedPes(r); })
      .catch(e => {
        if (cancelled) return;
        const msg = e instanceof ApiError ? `PES service unavailable [${e.code}]` : 'PES service unavailable.';
        console.warn('[Module 4] analyticsPes failed', e);
        setError(msg);
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [weeks, submittedPes]);

  const pesData = submittedPes ?? fetchedPes;

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in mt-12">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center justify-center min-h-[220px] md:col-span-3">
          <Loader2 size={28} className="animate-spin mb-3" style={{ color: COLORS.NAVY }} />
          <p className="text-sm font-bold" style={{ color: COLORS.TEXT_MUTED }}>Computing PES score…</p>
        </div>
      </div>
    );
  }

  if (error || !pesData) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in mt-12">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-red-100 flex flex-col items-center justify-center min-h-[220px] md:col-span-3">
          <p className="text-sm font-bold text-red-600">{error ?? 'PES data unavailable.'}</p>
        </div>
      </div>
    );
  }

  const breakdownData = pesData.breakdown.map((item, i) => ({
    ...item,
    fill: BAR_FILLS[i] ?? COLORS.TEXT_MUTED,
  }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in mt-12">
      {/* ── Overall PES gauge ──────────────────────────────────────────── */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center justify-center">
        <h3 className="text-lg font-semibold mb-4 w-full text-left" style={{ color: COLORS.NAVY }}>
          Overall Score (PES)
        </h3>
        <ScoreGauge score={pesData.overallScore} />
        <QualitativeLabel label={pesData.label} />
      </div>

      {/* ── Metric weight contribution breakdown ───────────────────────── */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 md:col-span-2 flex flex-col">
        <h3 className="text-lg font-semibold mb-2" style={{ color: COLORS.NAVY }}>
          Metric Weight Contribution
        </h3>
        <div className="h-[180px] w-full flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              layout="vertical"
              data={breakdownData}
              margin={{ top: 10, right: 30, left: 10, bottom: 0 }}
            >
              <XAxis type="number" domain={[0, 0.4]} hide />
              <YAxis
                dataKey="metric"
                type="category"
                interval={0}
                width={90}
                axisLine={false}
                tickLine={false}
                tick={{ fill: COLORS.TEXT_MUTED, fontSize: 12, fontWeight: 600 }}
              />
              <Tooltip
                cursor={{ fill: '#F8FAFC' }}
                formatter={(value) => (typeof value === 'number' ? value.toFixed(2) : '')}
                labelStyle={{ color: COLORS.TEXT_MAIN, fontWeight: 'bold' }}
              />
              <Bar dataKey="contribution" radius={[0, 4, 4, 0]} barSize={20}>
                {breakdownData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
                <LabelList
                  dataKey="weight"
                  position="right"
                  style={{ fill: COLORS.TEXT_MUTED, fontSize: 12 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 pt-4 border-t border-slate-100 text-center">
          <code
            className="text-[11px] font-mono bg-slate-50 px-3 py-2 rounded-lg"
            style={{ color: COLORS.TEXT_MUTED }}
          >
            PES = (ROAS × 0.35) + (Conv. Rate × 0.30) + (CAC_inv × 0.15) + (CTR × 0.15) + (CPC_inv × 0.05)
          </code>
        </div>
      </div>
    </div>
  );
};

export default PESComputationBoard;
