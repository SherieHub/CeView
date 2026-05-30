import React from 'react';
import { AlertTriangle, TrendingDown, CheckCircle2 } from 'lucide-react';
import { COLORS } from '../../../../constants';
import type { PesRankedWeakness } from '../../../../types';

// ── Rank colour config (rank 1 = weakest / most urgent) ──────────────────────
const RANK_CONFIG: { bg: string; border: string; badge: string; badgeText: string; icon: React.ReactNode; label: string }[] = [
  // index 0 → rank 1
  {
    bg: '#FEF2F2', border: '#FECACA',
    badge: '#DC2626', badgeText: '#FFFFFF',
    icon: <AlertTriangle size={16} />,
    label: 'Weakest',
  },
  // index 1 → rank 2
  {
    bg: '#FFFBEB', border: '#FDE68A',
    badge: '#D97706', badgeText: '#FFFFFF',
    icon: <TrendingDown size={16} />,
    label: 'Moderate',
  },
  // index ≥2 → rank 3+
  {
    bg: '#F0FDF4', border: '#BBF7D0',
    badge: '#16A34A', badgeText: '#FFFFFF',
    icon: <CheckCircle2 size={16} />,
    label: 'Alright',
  },
];

const cfgForRank = (rank: number) => RANK_CONFIG[Math.min(Math.max(rank, 1), 3) - 1];

interface PriorityFixCardProps {
  weaknesses: PesRankedWeakness[];
}

const PriorityFixCard: React.FC<PriorityFixCardProps> = ({ weaknesses }) => {
  const ranked = [...weaknesses].sort((a, b) => a.rank - b.rank);

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
            All weaknesses ranked by business impact
          </p>
        </div>
      </div>

      {/* ── Ranked weaknesses ───────────────────────────────────────────── */}
      <div className="divide-y divide-slate-100 flex-1">
        {ranked.length === 0 && (
          <p className="p-6 text-sm" style={{ color: COLORS.TEXT_MUTED }}>
            No weaknesses to display.
          </p>
        )}
        {ranked.map((w) => {
          const cfg = cfgForRank(w.rank);
          return (
            <div key={`${w.metric_name}-${w.rank}`} className="p-5" style={{ backgroundColor: cfg.bg }}>
              {/* Metric header row */}
              <div className="flex items-center gap-2 mb-3 min-w-0">
                <span
                  className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0"
                  style={{ backgroundColor: cfg.badge, color: cfg.badgeText }}
                >
                  {cfg.icon}
                  Rank {w.rank}
                </span>
                <span className="text-sm font-bold truncate" style={{ color: COLORS.NAVY }}>
                  {w.metric_name}
                </span>
              </div>

              {/* Weakness meaning */}
              <p className="text-xs leading-relaxed" style={{ color: '#374151' }}>
                {w.weakness_meaning}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PriorityFixCard;
