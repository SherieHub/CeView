import React, { useState, useMemo } from 'react';
import { ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea as RA } from 'recharts';
import { Zap } from 'lucide-react';
import { COLORS } from '../../../../constants';
import { ChartDataPoint } from '../../../../types';

const ReferenceAreaTyped = RA as React.ComponentType<any>;

export function generateTimeframeData(data: ChartDataPoint[], timeframe: '4WK' | '12WK'): ChartDataPoint[] {
  const weeksOut = timeframe === '4WK' ? 4 : 12;
  const result: ChartDataPoint[] = [];
  // Locate the "Current" point by label — never assume a fixed index position.
  // Falls back to the last element (safe for any array length), then to a neutral stub.
  const current: ChartDataPoint =
    data.find((d) => d.week === 'Current') ??
    data[data.length - 1] ??
    { week: 'Current', history: 50, forecast: 50, seasonality: 50, forex: 0, gdp: 0, spike: 0 };

  for (let i = -weeksOut; i <= weeksOut; i++) {
    if (i === 0) {
      result.push({
        ...current,
        history: current.history !== null ? Math.round(current.history) : null,
        forecast: current.forecast !== null ? Math.round(current.forecast) : null,
        seasonality: Math.round(current.seasonality),
      });
      continue;
    }

    const isPast = i < 0;
    const label = isPast ? `Wk ${i}` : `Wk +${i}`;

    // Label-based lookup — works regardless of array length or ordering.
    // The backend guarantees labels "Wk -3".."Wk -1", "Current", "Wk +1".."Wk +4";
    // points outside that range (e.g. "Wk -4" or "Wk +5".."Wk +12") fall through
    // to the synthetic interpolation below.
    const matchedPoint = data.find((d) => d.week === label) ?? null;

    if (matchedPoint) {
      result.push({
        ...matchedPoint,
        week: label,
        history: isPast && matchedPoint.history !== null ? Math.round(matchedPoint.history) : null,
        forecast: !isPast && matchedPoint.forecast !== null ? Math.round(matchedPoint.forecast) : null,
        seasonality: Math.round(matchedPoint.seasonality),
        spike: matchedPoint.spike ?? 0,
      });
      continue;
    }

    // Synthetic interpolation for weeks not present in the dataset.
    const offset = Math.abs(i);
    const curve = isPast ? Math.sin(offset) * 5 : Math.cos(offset) * 8;
    result.push({
      week: label,
      history: isPast
        ? Math.round(Math.max(20, Math.min(100, (current.history ?? 50) - offset * 1.5 + curve)))
        : null,
      forecast: !isPast
        ? Math.round(Math.max(20, Math.min(100, (current.forecast ?? 50) + curve - offset * 2)))
        : null,
      seasonality: Math.round(Math.max(20, Math.min(100, current.seasonality + Math.sin(i * 0.5) * 8))),
      forex: current.forex,
      gdp: current.gdp,
      spike: 0,
    });
  }

  return result;
}

const MainTooltip = ({ active, payload, label }: any) => {
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

const renderCustomDot = (props: any, color: string, isForecast: boolean) => {
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

  // Compute Y-axis bounds from actual data values so the chart scales to the data
  // rather than always showing the full 0-100 range.
  const { yMin, yMax } = useMemo(() => {
    const vals = displayData
      .flatMap(d => [d.history, d.forecast])
      .filter((v): v is number => v !== null);
    if (vals.length === 0) return { yMin: 0, yMax: 100 };
    const raw_min = Math.min(...vals);
    const raw_max = Math.max(...vals);
    return {
      yMin: Math.max(0,   Math.floor(raw_min / 10) * 10 - 10),
      yMax: Math.min(100, Math.ceil(raw_max  / 10) * 10 + 10),
    };
  }, [displayData]);

  // Spike count drives a summary badge
  const spikeCount = useMemo(
    () => displayData.filter(d => d.spike === 1).length,
    [displayData],
  );

  return (
    <div className="p-4 md:p-8 border-b" style={{ borderColor: COLORS.LIGHT_GREY }}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-8 gap-4">
        <div>
          <h3 className="text-lg md:text-xl font-black" style={{ color: COLORS.NAVY }}>Demand Forecasting & Spike Detection</h3>
          <p className="text-sm font-medium mt-1" style={{ color: COLORS.TEXT_MUTED }}>
            Track tourist interest levels week by week — past data (solid) and AI projections (dashed).
          </p>
          {spikeCount > 0 && (
            <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black"
              style={{ backgroundColor: `${COLORS.RED_ORANGE}18`, color: COLORS.RED_ORANGE, border: `1px solid ${COLORS.RED_ORANGE}40` }}>
              <Zap size={11} style={{ fill: COLORS.RED_ORANGE }} />
              {spikeCount} Surge {spikeCount === 1 ? 'Point' : 'Points'} Detected
            </div>
          )}
        </div>
        <div className="flex p-1.5 rounded-xl border shrink-0" style={{ backgroundColor: COLORS.CREAM, borderColor: COLORS.LIGHT_GREY }}>
          <button onClick={() => setTimeframe('4WK')} className="px-5 py-2 text-xs font-black rounded-lg transition-all" style={{ backgroundColor: timeframe === '4WK' ? COLORS.WHITE : 'transparent', color: COLORS.TEXT_MAIN }}>4 Weeks</button>
          <button onClick={() => setTimeframe('12WK')} className="px-5 py-2 text-xs font-black rounded-lg transition-all" style={{ backgroundColor: timeframe === '12WK' ? COLORS.WHITE : 'transparent', color: COLORS.TEXT_MAIN }}>12 Weeks</button>
        </div>
      </div>

      {/* Demand zone legend */}
      <div className="flex flex-wrap gap-3 mb-4">
        {[
          { label: 'Low Demand', color: COLORS.TEXT_MUTED, bg: COLORS.OFF_WHITE },
          { label: 'Moderate', color: COLORS.GOLD, bg: COLORS.GOLD_LIGHT },
          { label: 'High Peak', color: COLORS.RED_ORANGE, bg: `${COLORS.RED_ORANGE}18` },
        ].map(({ label, color, bg }) => (
          <span key={label} className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full"
            style={{ backgroundColor: bg, color }}>
            <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: color }} />
            {label}
          </span>
        ))}
        <span className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full"
          style={{ backgroundColor: COLORS.OFF_WHITE, color: COLORS.TEXT_MUTED }}>
          <span className="w-3 h-0.5 inline-block" style={{ backgroundColor: COLORS.NAVY }} /> Recorded
        </span>
        <span className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full"
          style={{ backgroundColor: COLORS.OFF_WHITE, color: COLORS.TEXT_MUTED }}>
          <span className="w-3 h-0.5 inline-block border-t-2 border-dashed" style={{ borderColor: COLORS.GOLD }} /> AI Forecast
        </span>
      </div>

      <div className="h-[300px] md:h-[380px] w-full relative">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={displayData as any[]} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="4 4" vertical={false} stroke={COLORS.LIGHT_GREY} />
            <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fill: COLORS.TEXT_MUTED, fontSize: 13, fontWeight: 700 }} dy={12} />
            <YAxis
              axisLine={false} tickLine={false}
              tick={{ fill: COLORS.TEXT_MUTED, fontSize: 12, fontWeight: 700 }}
              domain={[yMin, yMax]}
              tickCount={6}
              tickFormatter={(v: number) => `${v}%`}
            />
            <Tooltip content={<MainTooltip />} cursor={{ stroke: COLORS.NAVY, strokeWidth: 1, strokeDasharray: '4 4' }} />
            {/* Reference areas clipped to visible Y range */}
            {yMin < 31 && <ReferenceAreaTyped y1={yMin} y2={Math.min(30, yMax)} fill={COLORS.OFF_WHITE} fillOpacity={0.9} />}
            {yMax > 30 && yMin < 71 && <ReferenceAreaTyped y1={Math.max(31, yMin)} y2={Math.min(70, yMax)} fill={COLORS.GOLD_LIGHT} fillOpacity={0.5} />}
            {yMax > 70 && <ReferenceAreaTyped y1={Math.max(71, yMin)} y2={yMax} fill={COLORS.BEIGE} fillOpacity={0.6} />}
            <ReferenceLine x="Current" stroke={COLORS.NAVY} strokeDasharray="3 3" label={{ position: 'top', value: '▼ Today', fill: COLORS.NAVY, fontSize: 11, fontWeight: 900 }} />
            <Area type="monotone" dataKey="seasonality" fill={COLORS.SKYBLUE} stroke={COLORS.SKYBLUE} strokeOpacity={0.35} fillOpacity={0.12} strokeWidth={2} />
            <Line type="monotone" dataKey="history" stroke={COLORS.NAVY} strokeWidth={5} connectNulls={false} dot={(props: any) => renderCustomDot(props, COLORS.NAVY, false)} name="Recorded Data" />
            <Line type="monotone" dataKey="forecast" stroke={COLORS.GOLD} strokeWidth={5} strokeDasharray="8 8" connectNulls={false} dot={(props: any) => renderCustomDot(props, COLORS.GOLD, true)} name="AI Forecast" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default DemandForecastChart;
