import React, { useState } from 'react';
import { DollarSign, Calendar } from 'lucide-react';
import { ComposedChart, LineChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Market } from '../../../types';
import { COLORS } from '../../../constants';

interface EconomicInsightsBoardProps {
  market: Market;
}

const EconomicInsightsBoard: React.FC<EconomicInsightsBoardProps> = ({ market }) => {
  const [activeDriver, setActiveDriver] = useState<'economy' | 'seasonality'>('economy');

  return (
    <div style={{ backgroundColor: COLORS.OFF_WHITE }}>
      <div className="p-6 md:p-8">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {[
            { key: 'economy' as const, icon: <DollarSign size={15} />, label: 'Economic Purchasing Power' },
            { key: 'seasonality' as const, icon: <Calendar size={15} />, label: 'Seasonal Travel Patterns' },
          ].map(({ key, icon, label }) => {
            const active = activeDriver === key;
            return (
              <button
                key={key}
                onClick={() => setActiveDriver(key)}
                className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-black transition-all border"
                style={{ backgroundColor: active ? COLORS.WHITE : 'transparent', color: active ? COLORS.NAVY : COLORS.TEXT_MUTED, borderColor: active ? COLORS.LIGHT_GREY : 'transparent' }}
              >
                {icon} {label}
              </button>
            );
          })}
        </div>
        
        {/* Render Active Panel */}
        <div className="p-6 rounded-2xl border shadow-sm" style={{ backgroundColor: COLORS.WHITE, borderColor: COLORS.LIGHT_GREY }}>
          {activeDriver === 'economy' && (
            <div className="animate-fade-in">
              <div className="flex flex-col md:flex-row justify-between mb-5 gap-4 items-start">
                <div>
                  <h4 className="font-black text-lg" style={{ color: COLORS.NAVY }}>Purchasing Power of {market.name} Visitors</h4>
                  <p className="text-sm font-medium mt-1" style={{ color: COLORS.TEXT_MUTED }}>Forex & GDP trends show spending capability in Cebu.</p>
                </div>
                <div className="flex gap-4 shrink-0">
                  <div className="text-right border-r pr-4" style={{ borderColor: COLORS.LIGHT_GREY }}>
                    <div className="text-xs font-black uppercase tracking-wider" style={{ color: COLORS.GOLD }}>Exchange Rate</div>
                    <div className="font-black text-xl" style={{ color: COLORS.NAVY }}>{market.chartData[4].forex}</div>
                    <div className="text-xs" style={{ color: COLORS.TEXT_MUTED }}>vs PHP</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-black uppercase tracking-wider" style={{ color: COLORS.RED_ORANGE }}>GDP Growth</div>
                    <div className="font-black text-xl" style={{ color: COLORS.NAVY }}>{market.chartData[4].gdp}%</div>
                    <div className="text-xs" style={{ color: COLORS.TEXT_MUTED }}>Annual</div>
                  </div>
                </div>
              </div>
              <div className="mb-5 p-4 rounded-xl border-l-4" style={{ backgroundColor: COLORS.GOLD_LIGHT, borderLeftColor: COLORS.GOLD }}>
                <p className="text-xs font-black uppercase tracking-wider mb-1" style={{ color: COLORS.GOLD }}>What This Means for Your Business</p>
                <p className="text-sm font-medium leading-relaxed" style={{ color: COLORS.TEXT_MAIN }}>{market.economyInsight}</p>
              </div>
              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={market.chartData as any[]} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={COLORS.LIGHT_GREY} />
                    <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fill: COLORS.TEXT_MUTED, fontSize: 12 }} dy={10} />
                    <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: COLORS.TEXT_MUTED, fontSize: 12 }} />
                    <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fill: COLORS.TEXT_MUTED, fontSize: 12 }} />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: `1px solid ${COLORS.LIGHT_GREY}` }} />
                    <Line yAxisId="left" type="monotone" dataKey="forex" stroke={COLORS.GOLD} strokeWidth={3} dot={{ r: 4 }} name="forex" />
                    <Line yAxisId="right" type="monotone" dataKey="gdp" stroke={COLORS.RED_ORANGE} strokeWidth={3} dot={{ r: 4 }} name="gdp" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {activeDriver === 'seasonality' && (
            <div className="animate-fade-in">
              <div className="mb-5">
                <h4 className="font-black text-lg" style={{ color: COLORS.NAVY }}>Annual Travel Pattern — {market.name}</h4>
                <p className="text-sm font-medium mt-1" style={{ color: COLORS.TEXT_MUTED }}>Recurring travel cycles based on historical data patterns.</p>
              </div>
              <div className="mb-5">
                <p className="text-xs font-black uppercase tracking-wider mb-3" style={{ color: COLORS.TEXT_MUTED }}>Monthly Demand Calendar</p>
                <div className="grid grid-cols-12 gap-1">
                  {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((month) => {
                    const isPeak = market.peakMonths.includes(month);
                    return (
                      <div key={month} className="flex flex-col items-center py-2 rounded-lg" style={{ backgroundColor: isPeak ? COLORS.RED_ORANGE : COLORS.OFF_WHITE, border: `1px solid ${isPeak ? COLORS.RED_ORANGE : COLORS.LIGHT_GREY}` }}>
                        <span className="text-xs font-black" style={{ color: isPeak ? COLORS.WHITE : COLORS.TEXT_MUTED }}>{month}</span>
                        {isPeak && <div className="mt-1 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COLORS.WHITE }} />}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="mb-5 p-4 rounded-xl border-l-4" style={{ backgroundColor: COLORS.BEIGE, borderLeftColor: COLORS.RED_ORANGE }}>
                <p className="text-xs font-black uppercase tracking-wider mb-1" style={{ color: COLORS.RED_ORANGE }}>What This Means for Your Business</p>
                <p className="text-sm font-medium leading-relaxed" style={{ color: COLORS.TEXT_MAIN }}>{market.seasonalityInsight}</p>
              </div>
              <div className="h-[180px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={market.chartData as any[]} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={COLORS.LIGHT_GREY} />
                    <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fill: COLORS.TEXT_MUTED, fontSize: 12 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: COLORS.TEXT_MUTED, fontSize: 12 }} domain={[0, 100]} />
                    <Tooltip />
                    <Area type="monotone" dataKey="seasonality" fill={COLORS.SKYBLUE} fillOpacity={0.2} stroke={COLORS.SKYBLUE} strokeWidth={3} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EconomicInsightsBoard;