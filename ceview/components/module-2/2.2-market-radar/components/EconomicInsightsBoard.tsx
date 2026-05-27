import React, { useState } from 'react';
import { DollarSign, Calendar } from 'lucide-react';
import { ComposedChart, LineChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Market } from '../../../../types';
import { COLORS } from '../../../../constants';

const MARKET_CURRENCY: Record<string, { code: string; label: string }> = {
  korea: { code: 'KRW', label: 'PHP → KRW' },
  japan: { code: 'JPY', label: 'PHP → JPY' },
  usa:   { code: 'USD', label: 'PHP → USD' },
};

interface EconomicInsightsBoardProps {
  market: Market;
}

const EconomicInsightsBoard: React.FC<EconomicInsightsBoardProps> = ({ market }) => {
  const [activeDriver, setActiveDriver] = useState<'economy' | 'seasonality'>('economy');

  // Dynamically resolve the "Current" chart point rather than assuming it is always
  // at index 4.  Falls back to the last point in the array for safety.
  const currentPoint = market.chartData.find((d) => d.week === 'Current')
    ?? market.chartData[market.chartData.length - 1]
    ?? { forex: 0, gdp: 0, seasonality: 0 };

  return (
    <div style={{ backgroundColor: COLORS.OFF_WHITE }}>
      <div className="p-4 md:p-8">
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
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-black transition-all border"
                style={{ backgroundColor: active ? COLORS.WHITE : 'transparent', color: active ? COLORS.NAVY : COLORS.TEXT_MUTED, borderColor: active ? COLORS.LIGHT_GREY : 'transparent' }}
              >
                {icon} {label}
              </button>
            );
          })}
        </div>

        <div className="p-4 md:p-6 rounded-2xl border shadow-sm" style={{ backgroundColor: COLORS.WHITE, borderColor: COLORS.LIGHT_GREY }}>
          {activeDriver === 'economy' && (() => {
            const currency = MARKET_CURRENCY[market.id] ?? { code: '?', label: 'vs PHP' };
            // Use rich trend arrays when available, fall back to weekly signal records
            const forexChartData = market.forexTrend && market.forexTrend.length > 0
              ? market.forexTrend.map(p => ({ label: p.date.slice(0, 7), value: p.value }))
              : market.chartData.map(p => ({ label: p.week, value: p.forex }));
            const gdpChartData = market.gdpTrend && market.gdpTrend.length > 0
              ? market.gdpTrend.map(p => ({ label: String(p.year), value: p.value }))
              : market.chartData.map(p => ({ label: p.week, value: p.gdp }));
            const latestForex = forexChartData[forexChartData.length - 1]?.value ?? currentPoint.forex;
            const latestGdp   = gdpChartData[gdpChartData.length - 1]?.value ?? currentPoint.gdp;
            return (
              <div className="animate-fade-in">
                <div className="flex flex-col md:flex-row justify-between mb-5 gap-4 items-start">
                  <div>
                    <h4 className="font-black text-lg" style={{ color: COLORS.NAVY }}>Purchasing Power of {market.name} Visitors</h4>
                    <p className="text-sm font-medium mt-1" style={{ color: COLORS.TEXT_MUTED }}>Forex & GDP trends show spending capability in Cebu.</p>
                  </div>
                  <div className="flex gap-4 shrink-0">
                    <div className="text-right border-r pr-4" style={{ borderColor: COLORS.LIGHT_GREY }}>
                      <div className="text-xs font-black uppercase tracking-wider" style={{ color: COLORS.GOLD }}>Exchange Rate</div>
                      <div className="font-black text-xl" style={{ color: COLORS.NAVY }}>
                        {typeof latestForex === 'number' ? latestForex.toFixed(2) : latestForex}
                      </div>
                      <div className="text-xs" style={{ color: COLORS.TEXT_MUTED }}>{currency.label}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-black uppercase tracking-wider" style={{ color: COLORS.RED_ORANGE }}>GDP Growth</div>
                      <div className="font-black text-xl" style={{ color: COLORS.NAVY }}>
                        {typeof latestGdp === 'number' ? latestGdp.toFixed(1) : latestGdp}%
                      </div>
                      <div className="text-xs" style={{ color: COLORS.TEXT_MUTED }}>Annual</div>
                    </div>
                  </div>
                </div>
                <div className="mb-5 p-4 rounded-xl border-l-4" style={{ backgroundColor: COLORS.GOLD_LIGHT, borderLeftColor: COLORS.GOLD }}>
                  <p className="text-xs font-black uppercase tracking-wider mb-1" style={{ color: COLORS.GOLD }}>What This Means for Your Business</p>
                  <p className="text-sm font-medium leading-relaxed" style={{ color: COLORS.TEXT_MAIN }}>{market.economyInsight}</p>
                </div>
                {/* Two stacked mini-charts: forex trend (top) + GDP trend (bottom) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider mb-2" style={{ color: COLORS.GOLD }}>
                      {currency.code} Exchange Rate Trend
                    </p>
                    <div className="h-[160px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={forexChartData as any[]} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={COLORS.LIGHT_GREY} />
                          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: COLORS.TEXT_MUTED, fontSize: 10 }} dy={8} interval="preserveStartEnd" />
                          <YAxis axisLine={false} tickLine={false} tick={{ fill: COLORS.TEXT_MUTED, fontSize: 10 }} tickFormatter={(v: number) => v.toFixed(1)} />
                          <Tooltip contentStyle={{ borderRadius: '10px', border: `1px solid ${COLORS.LIGHT_GREY}`, fontSize: 12 }} formatter={(v: any) => [`${Number(v).toFixed(2)} ${currency.code}`, 'Rate']} />
                          <Line type="monotone" dataKey="value" stroke={COLORS.GOLD} strokeWidth={2.5} dot={{ r: 3, fill: COLORS.GOLD }} name={`${currency.code}/PHP`} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider mb-2" style={{ color: COLORS.RED_ORANGE }}>
                      GDP Growth (%)
                    </p>
                    <div className="h-[160px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={gdpChartData as any[]} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={COLORS.LIGHT_GREY} />
                          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: COLORS.TEXT_MUTED, fontSize: 10 }} dy={8} interval="preserveStartEnd" />
                          <YAxis axisLine={false} tickLine={false} tick={{ fill: COLORS.TEXT_MUTED, fontSize: 10 }} tickFormatter={(v: number) => `${v.toFixed(1)}%`} />
                          <Tooltip contentStyle={{ borderRadius: '10px', border: `1px solid ${COLORS.LIGHT_GREY}`, fontSize: 12 }} formatter={(v: any) => [`${Number(v).toFixed(2)}%`, 'GDP Growth']} />
                          <Line type="monotone" dataKey="value" stroke={COLORS.RED_ORANGE} strokeWidth={2.5} dot={{ r: 3, fill: COLORS.RED_ORANGE }} name="GDP Growth" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {activeDriver === 'seasonality' && (
            <div className="animate-fade-in">
              <div className="mb-5">
                <h4 className="font-black text-lg" style={{ color: COLORS.NAVY }}>Annual Travel Pattern — {market.name}</h4>
                <p className="text-sm font-medium mt-1" style={{ color: COLORS.TEXT_MUTED }}>Recurring travel cycles based on historical data patterns.</p>
              </div>
              <div className="mb-5">
                <p className="text-xs font-black uppercase tracking-wider mb-3" style={{ color: COLORS.TEXT_MUTED }}>Monthly Demand Calendar</p>
                <div className="grid grid-cols-6 sm:grid-cols-12 gap-1">
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
