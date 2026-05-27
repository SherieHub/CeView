import React, { useEffect } from 'react';
import { RefreshCw, MousePointer, DollarSign, Activity, Target, Users } from 'lucide-react';
import KpiMetricCard from './KpiMetricCard';
import { COLORS } from '../../../../constants';
import type { Metrics } from '../../../../types';

interface EngagementMetricsBoardProps {
  metrics: Metrics;
  weeks: 4 | 8;
  onWeeksChange: (w: 4 | 8) => void;
  isRefreshing: boolean;
}

const EngagementMetricsBoard: React.FC<EngagementMetricsBoardProps> = ({
  metrics,
  weeks,
  onWeeksChange,
  isRefreshing,
}) => {

  return (
    <>
      {/* ── Section header + 4W / 8W toggle ──────────────────────────────── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2" style={{ color: COLORS.NAVY }}>
            Campaign Engagement
            {isRefreshing && (
              <RefreshCw size={16} className="animate-spin" style={{ color: COLORS.GOLD }} />
            )}
          </h2>
          <p className="mt-1" style={{ color: COLORS.TEXT_MUTED }}>
            Marketing efficiency and funnel drop-off analysis.
          </p>
        </div>

        {/* ── 4W / 8W binary toggle ─────────────────────────────────────── */}
        <div
          className="inline-flex items-center p-1 rounded-xl border shadow-sm transition-all duration-300"
          style={{
            backgroundColor: COLORS.WHITE,
            borderColor: isRefreshing ? COLORS.GOLD : '#E2E8F0',
            boxShadow: isRefreshing ? `0 0 0 1px ${COLORS.GOLD}40` : undefined,
          }}
        >
          <span
            className="text-[11px] font-black uppercase tracking-widest px-3"
            style={{ color: COLORS.TEXT_MUTED }}
          >
            Window
          </span>
          {([4, 8] as const).map((w) => (
            <button
              key={w}
              onClick={() => onWeeksChange(w)}
              className="px-4 py-1.5 rounded-lg text-sm font-bold transition-all duration-200 select-none"
              style={
                weeks === w
                  ? { backgroundColor: COLORS.NAVY, color: COLORS.WHITE }
                  : { color: COLORS.TEXT_MUTED, backgroundColor: 'transparent' }
              }
            >
              {w}W
            </button>
          ))}
        </div>
      </div>

      {/* ── KPI metric cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KpiMetricCard
          title="CTR" data={metrics.ctr} icon={<MousePointer size={20} />}
          tooltip={
            <div className="text-center px-2">
              <h3 className="text-sm font-black mb-1" style={{ color: COLORS.NAVY }}>Click-Through Rate:</h3>
              <p className="text-xs opacity-90" style={{ color: COLORS.TEXT_MUTED }}>
                The percentage of people who saw your ad and decided to click on it.
              </p>
            </div>
          }
        />
        <KpiMetricCard
          title="CPC" data={metrics.cpc} icon={<DollarSign size={20} />} inverseLogic
          tooltip={
            <div className="text-center px-2">
              <h3 className="text-sm font-black mb-1" style={{ color: COLORS.NAVY }}>Cost per Click:</h3>
              <p className="text-xs opacity-90" style={{ color: COLORS.TEXT_MUTED }}>
                The exact amount you pay each time someone clicks on your ad.
              </p>
            </div>
          }
        />
        <KpiMetricCard
          title="ROAS" data={metrics.roas} icon={<Activity size={20} />}
          tooltip={
            <div className="text-center px-2">
              <h3 className="text-sm font-black mb-1" style={{ color: COLORS.NAVY }}>Return on Ad Spend:</h3>
              <p className="text-xs opacity-90" style={{ color: COLORS.TEXT_MUTED }}>
                How much revenue you earn back for every peso you spend.
              </p>
            </div>
          }
        />
        <KpiMetricCard
          title="CR" data={metrics.convRate} icon={<Target size={20} />}
          tooltip={
            <div className="text-center px-2">
              <h3 className="text-sm font-black mb-1" style={{ color: COLORS.NAVY }}>Conversion Rate:</h3>
              <p className="text-xs opacity-90" style={{ color: COLORS.TEXT_MUTED }}>
                The percentage of people who actually booked a stay after clicking.
              </p>
            </div>
          }
        />
        <KpiMetricCard
          title="CAC" data={metrics.cac} icon={<Users size={20} />} inverseLogic
          tooltip={
            <div className="text-center px-2">
              <h3 className="font-black mb-1" style={{ color: COLORS.NAVY, fontSize: '0.782rem' }}>
                Customer Acquisition Cost:
              </h3>
              <p className="text-xs opacity-90" style={{ color: COLORS.TEXT_MUTED }}>
                Total amount spent to secure one new paying customer.
              </p>
            </div>
          }
        />
      </div>
    </>
  );
};

export default EngagementMetricsBoard;
