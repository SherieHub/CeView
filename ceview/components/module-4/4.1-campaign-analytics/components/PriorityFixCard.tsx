import React from 'react';
import { AlertTriangle, ArrowRight, TrendingDown, CheckCircle2 } from 'lucide-react';
import { COLORS } from '../../../../constants';
import type { FunnelDiagnostic, RankedRecommendation } from '../../../../types';

// ── Rank colour config ───────────────────────────────────────────────────────
const RANK_CONFIG: Record<
  FunnelDiagnostic['rank'],
  { bg: string; border: string; badge: string; badgeText: string; icon: React.ReactNode; label: string }
> = {
  Weakest: {
    bg: '#FEF2F2', border: '#FECACA',
    badge: '#DC2626', badgeText: '#FFFFFF',
    icon: <AlertTriangle size={16} />,
    label: 'Weakest',
  },
  Moderate: {
    bg: '#FFFBEB', border: '#FDE68A',
    badge: '#D97706', badgeText: '#FFFFFF',
    icon: <TrendingDown size={16} />,
    label: 'Moderate',
  },
  Alright: {
    bg: '#F0FDF4', border: '#BBF7D0',
    badge: '#16A34A', badgeText: '#FFFFFF',
    icon: <CheckCircle2 size={16} />,
    label: 'Alright',
  },
};

// ── Urgency colour config ────────────────────────────────────────────────────
const URGENCY_CONFIG: Record<
  RankedRecommendation['urgency'],
  { bg: string; text: string; border: string }
> = {
  'Most Urgent': { bg: '#FEE2E2', text: '#991B1B', border: '#FECACA' },
  'Urgent':      { bg: '#FEF3C7', text: '#92400E', border: '#FDE68A' },
  'Not Very Urgent': { bg: '#DCFCE7', text: '#166534', border: '#BBF7D0' },
};

interface PriorityFixCardProps {
  funnelDiagnostics: FunnelDiagnostic[];
  recommendations: RankedRecommendation[];
}

const PriorityFixCard: React.FC<PriorityFixCardProps> = ({
  funnelDiagnostics,
  recommendations,
}) => {
  // Build a lookup from stage → recommendation for O(1) pairing
  const recMap = new Map(recommendations.map(r => [r.stage, r]));

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
        <div
          className="p-2 rounded-lg"
          style={{ backgroundColor: '#FEE2E2', color: '#DC2626' }}
        >
          <AlertTriangle size={20} />
        </div>
        <div>
          <h3 className="text-base font-bold leading-tight" style={{ color: COLORS.TEXT_MAIN }}>
            Funnel Diagnostics
          </h3>
          <p className="text-xs font-medium" style={{ color: COLORS.TEXT_MUTED }}>
            All stages ranked by business impact
          </p>
        </div>
      </div>

      {/* ── Ranked stages ───────────────────────────────────────────────── */}
      <div className="divide-y divide-slate-100 flex-1">
        {funnelDiagnostics.map((diag) => {
          const cfg  = RANK_CONFIG[diag.rank] ?? RANK_CONFIG['Alright'];
          const rec  = recMap.get(diag.stage);
          const urgCfg = rec ? (URGENCY_CONFIG[rec.urgency] ?? URGENCY_CONFIG['Not Very Urgent']) : null;

          return (
            <div key={diag.stage} className="p-5" style={{ backgroundColor: cfg.bg }}>
              {/* Stage header row */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  {/* Rank badge */}
                  <span
                    className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0"
                    style={{ backgroundColor: cfg.badge, color: cfg.badgeText }}
                  >
                    {cfg.icon}
                    {cfg.label}
                  </span>
                  <span className="text-sm font-bold truncate" style={{ color: COLORS.NAVY }}>
                    {diag.stage}
                  </span>
                </div>
                {/* Drop rate pill */}
                <span
                  className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full border shrink-0"
                  style={{ backgroundColor: cfg.border, color: COLORS.NAVY, borderColor: cfg.border }}
                >
                  <ArrowRight size={11} />
                  {diag.dropRate} Drop
                </span>
              </div>

              {/* AI insight */}
              <p className="text-xs leading-relaxed mb-3" style={{ color: '#374151' }}>
                {diag.insight}
              </p>

              {/* Paired recommendation */}
              {rec && urgCfg && (
                <div
                  className="rounded-xl border p-3"
                  style={{ backgroundColor: urgCfg.bg, borderColor: urgCfg.border }}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span
                      className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: urgCfg.text, color: '#FFFFFF' }}
                    >
                      {rec.urgency}
                    </span>
                    <span className="text-xs font-bold" style={{ color: urgCfg.text }}>
                      {rec.title}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: urgCfg.text }}>
                    {rec.action}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PriorityFixCard;
