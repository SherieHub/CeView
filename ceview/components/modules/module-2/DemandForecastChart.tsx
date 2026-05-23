import React, { useState, useMemo } from 'react';
import { ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea as RA } from 'recharts';
import { Zap } from 'lucide-react';
import { COLORS } from '../../../constants';
import { ChartDataPoint } from '../../../types';

const ReferenceAreaTyped = RA as React.ComponentType<any>;

// Helper functions (generateTimeframeData, MainTooltip, renderCustomDot) 
// copied exactly from MarketPrediction.tsx to remain self-contained.
export function generateTimeframeData(data: ChartDataPoint[], timeframe: '4WK' | '12WK'): ChartDataPoint[] {
   // ... (Paste exact generateTimeframeData function from your MarketPrediction file here)
   const weeksOut = timeframe === '4WK' ? 4 : 12;
   const result: ChartDataPoint[] = [];
   const current = data.find((d) => d.week === 'Current') || data[4];
   for (let i = -weeksOut; i <= weeksOut; i++) {
     if (i === 0) {
       result.push({ ...current, history: current.history !== null ? Math.round(current.history) : null, forecast: current.forecast !== null ? Math.round(current.forecast) : null, seasonality: Math.round(current.seasonality) });
       continue;
     }
     const isPast = i < 0;
     const label = isPast ? `Wk ${i}` : `Wk +${i}`;
     let matchedPoint = null;
     if (i === -4) matchedPoint = data[0]; if (i === -3) matchedPoint = data[1]; if (i === -2) matchedPoint = data[2]; if (i === -1) matchedPoint = data[3]; if (i === 1) matchedPoint = data[5]; if (i === 2) matchedPoint = data[6]; if (i === 12) matchedPoint = data[7];
     if (matchedPoint) {
       result.push({ ...matchedPoint, week: label, history: isPast && matchedPoint.history !== null ? Math.round(matchedPoint.history) : null, forecast: !isPast && matchedPoint.forecast !== null ? Math.round(matchedPoint.forecast) : null, seasonality: Math.round(matchedPoint.seasonality), spike: 0 });
       continue;
     }
     const offset = Math.abs(i);
     const curve = isPast ? Math.sin(offset) * 5 : Math.cos(offset) * 8;
     result.push({ week: label, history: isPast ? Math.round(Math.max(20, Math.min(100, (current.history || 50) - offset * 1.5 + curve))) : null, forecast: !isPast ? Math.round(Math.max(20, Math.min(100, (current.forecast || 50) + curve - offset * 2))) : null, seasonality: Math.round(Math.max(20, Math.min(100, current.seasonality + Math.sin(i * 0.5) * 8))), forex: current.forex, gdp: current.gdp, spike: 0 });
   }
   return result;
}

const MainTooltip = ({ active, payload, label }: any) => { /*... (Paste exact MainTooltip from original)...*/ 
  if (active && payload && payload.length) {
    const data = payload[0].payload; const value = data.history !== null ? data.history : data.forecast; const isForecast = data.history === null;
    let peakLabel = 'Low Demand'; let peakColor: string = COLORS.TEXT_MUTED; let peakDesc = 'Normal traffic expected. Hold current pricing.';
    if (value > 70) { peakLabel = 'HIGH PEAK'; peakColor = COLORS.RED_ORANGE; peakDesc = 'Surge territory. Raise prices & launch flash promos now.'; } else if (value > 30) { peakLabel = 'MODERATE'; peakColor = COLORS.GOLD; peakDesc = 'Good booking volume. Run value-add promotions.'; }
    return (
      <div className="p-4 shadow-2xl rounded-xl min-w-[260px]" style={{ backgroundColor: COLORS.WHITE, border: `1.5px solid ${COLORS.LIGHT_GREY}` }}>
        <p className="font-bold mb-3 text-base pb-2 border-b" style={{ color: COLORS.NAVY, borderColor: COLORS.LIGHT_GREY }}>{label}</p>
        <div className="flex justify-between items-center mb-3"><span className="text-sm font-semibold" style={{ color: COLORS.TEXT_MUTED }}>Demand Score</span><div className="flex items-center gap-2"><span className="text-2xl font-black" style={{ color: peakColor }}>{value}%</span><span className="text-xs font-black px-2 py-1 rounded-md" style={{ backgroundColor: `${peakColor}18`, color: peakColor }}>{peakLabel}</span></div></div>
        <p className="text-xs font-medium mb-3 leading-relaxed" style={{ color: COLORS.TEXT_MUTED }}>{peakDesc}</p>
        <div className="flex justify-between text-xs"><span style={{ color: COLORS.TEXT_MUTED }}>Data Type</span><span className="font-bold" style={{ color: isForecast ? COLORS.GOLD : COLORS.NAVY }}>{isForecast ? '📈 AI Forecast' : '📊 Recorded Data'}</span></div>
        {data.spike === 1 && (<div className="mt-3 pt-3 border-t text-xs font-bold flex items-start gap-2" style={{ color: COLORS.RED_ORANGE, borderColor: COLORS.LIGHT_GREY }}><Zap size={14} className="shrink-0 mt-0.5" style={{ fill: COLORS.RED_ORANGE, color: COLORS.RED_ORANGE }} /><span>Demand Surge — Act within 48 hrs for maximum revenue impact.</span></div>)}
      </div>
    );
  }
  return null;
};

const renderCustomDot = (props: any, color: string, isForecast: boolean) => { /*... (Paste exact custom dot logic)...*/
  const { cx, cy, payload } = props; const value = isForecast ? payload.forecast : payload.history;
  if (value === null) return null; if (!isForecast && payload.week === 'Current' && payload.forecast !== null) return null;
  if (payload.spike === 1) { return ( <g transform={`translate(${cx},${cy})`}><circle cx={0} cy={0} r={6} fill={color} stroke={COLORS.WHITE} strokeWidth={3} /><g transform={`translate(-16, -28)`}><circle cx={16} cy={16} r={16} fill={COLORS.RED_ORANGE} stroke={COLORS.WHITE} strokeWidth={2} /><svg x="6" y="6" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="white" /></svg></g></g> ); }
  return <circle cx={cx} cy={cy} r={6} fill={color} stroke={COLORS.WHITE} strokeWidth={3} />;
};

interface DemandForecastChartProps {
  chartData: ChartDataPoint[];
}

const DemandForecastChart: React.FC<DemandForecastChartProps> = ({ chartData }) => {
  const [timeframe, setTimeframe] = useState<'4WK' | '12WK'>('4WK');
  const displayData = useMemo(() => generateTimeframeData(chartData, timeframe), [chartData, timeframe]);

  return (
    <div className="p-6 md:p-8 border-b" style={{ borderColor: COLORS.LIGHT_GREY }}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h3 className="text-xl font-black" style={{ color: COLORS.NAVY }}>Demand Forecasting & Spike Detection</h3>
          <p className="text-sm font-medium mt-1" style={{ color: COLORS.TEXT_MUTED }}>Track tourist interest levels week by week — past data (solid) and AI projections (dashed).</p>
        </div>
        <div className="flex p-1.5 rounded-xl border shrink-0" style={{ backgroundColor: COLORS.CREAM, borderColor: COLORS.LIGHT_GREY }}>
          <button onClick={() => setTimeframe('4WK')} className="px-5 py-2 text-xs font-black rounded-lg transition-all" style={{ backgroundColor: timeframe === '4WK' ? COLORS.WHITE : 'transparent', color: COLORS.TEXT_MAIN }}>4 Weeks</button>
          <button onClick={() => setTimeframe('12WK')} className="px-5 py-2 text-xs font-black rounded-lg transition-all" style={{ backgroundColor: timeframe === '12WK' ? COLORS.WHITE : 'transparent', color: COLORS.TEXT_MAIN }}>12 Weeks</button>
        </div>
      </div>

      <div className="h-[380px] w-full relative">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={displayData as any[]} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="4 4" vertical={false} stroke={COLORS.LIGHT_GREY} />
            <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fill: COLORS.TEXT_MUTED, fontSize: 13, fontWeight: 700 }} dy={12} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: COLORS.TEXT_MUTED, fontSize: 12, fontWeight: 700 }} domain={[0, 100]} />
            <Tooltip content={<MainTooltip />} cursor={{ stroke: COLORS.NAVY, strokeWidth: 1, strokeDasharray: '4 4' }} />
            <ReferenceAreaTyped y1={0} y2={30} fill={COLORS.OFF_WHITE || '#FDFBF7'} fillOpacity={0.8} />
            <ReferenceAreaTyped y1={31} y2={70} fill={COLORS.GOLD_LIGHT || '#fff5dfff'} fillOpacity={0.4} />
            <ReferenceAreaTyped y1={71} y2={100} fill={COLORS.BEIGE || '#F5E5D1'} fillOpacity={0.4} />
            <ReferenceLine x="Current" stroke={COLORS.NAVY} strokeDasharray="3 3" label={{ position: 'top', value: '▼ Today', fill: COLORS.NAVY, fontSize: 11, fontWeight: 900 }} />
            <Area type="monotone" dataKey="seasonality" fill={COLORS.SKYBLUE} stroke={COLORS.SKYBLUE} strokeOpacity={0.35} fillOpacity={0.12} strokeWidth={2} />
            <Line type="monotone" dataKey="history" stroke={COLORS.NAVY} strokeWidth={5} dot={(props: any) => renderCustomDot(props, COLORS.NAVY, false)} name="Recorded Data" />
            <Line type="monotone" dataKey="forecast" stroke={COLORS.GOLD} strokeWidth={5} strokeDasharray="8 8" dot={(props: any) => renderCustomDot(props, COLORS.GOLD, true)} name="AI Forecast" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default DemandForecastChart;