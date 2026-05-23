import React, { useState } from 'react';
import {
  Calendar,
  DollarSign,
  MapPin,
  ArrowLeft,
  Zap,
  Plane,
  Clock,
  CheckCircle,
  Navigation,
} from 'lucide-react';
import {
  ComposedChart,
  LineChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea
} from 'recharts';

import {COLORS} from '../constants';
import {MOCK_MARKETS} from '../constants';
import {Market} from '../types';
import {ChartDataPoint} from '../types';

import { ReferenceArea as RA } from 'recharts';

const ReferenceAreaTyped = RA as React.ComponentType<any>;

export function generateTimeframeData(data: ChartDataPoint[], timeframe: '4WK' | '12WK'): ChartDataPoint[] {
  const weeksOut = timeframe === '4WK' ? 4 : 12;
  const result: ChartDataPoint[] = [];
  const current = data.find((d) => d.week === 'Current') || data[4];

  for (let i = -weeksOut; i <= weeksOut; i++) {
    if (i === 0) {
      result.push({
        ...current,
        history: current.history !== null ? Math.round(current.history) : null,
        forecast: current.forecast !== null ? Math.round(current.forecast) : null,
        seasonality: Math.round(current.seasonality)
      });
      continue;
    }

    const isPast = i < 0;
    const label = isPast ? `Wk ${i}` : `Wk +${i}`;

    let matchedPoint = null;
    if (i === -4) matchedPoint = data[0];
    if (i === -3) matchedPoint = data[1];
    if (i === -2) matchedPoint = data[2];
    if (i === -1) matchedPoint = data[3];
    if (i === 1) matchedPoint = data[5];
    if (i === 2) matchedPoint = data[6];
    if (i === 12) matchedPoint = data[7];

    if (matchedPoint) {
      result.push({
        ...matchedPoint,
        week: label,
        history: isPast && matchedPoint.history !== null ? Math.round(matchedPoint.history) : null,
        forecast: !isPast && matchedPoint.forecast !== null ? Math.round(matchedPoint.forecast) : null,
        seasonality: Math.round(matchedPoint.seasonality),
        spike: 0,
      });
      continue;
    }

    const offset = Math.abs(i);
    const curve = isPast ? Math.sin(offset) * 5 : Math.cos(offset) * 8;

    result.push({
      week: label,
      history: isPast ? Math.round(Math.max(20, Math.min(100, (current.history || 50) - offset * 1.5 + curve))) : null,
      forecast: !isPast ? Math.round(Math.max(20, Math.min(100, (current.forecast || 50) + curve - offset * 2))) : null,
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
    const data = payload[0].payload;
    const value = data.history !== null ? data.history : data.forecast;
    const isForecast = data.history === null;

    let peakLabel = 'Low Demand';
    let peakColor: string = COLORS.TEXT_MUTED;
    let peakDesc = 'Normal traffic expected. Hold current pricing.';
    if (value > 70) {
      peakLabel = 'HIGH PEAK';
      peakColor = COLORS.RED_ORANGE;
      peakDesc = 'Surge territory. Raise prices & launch flash promos now.';
    } else if (value > 30) {
      peakLabel = 'MODERATE';
      peakColor = COLORS.GOLD;
      peakDesc = 'Good booking volume. Run value-add promotions.';
    }

    return (
      <div className="p-4 shadow-2xl rounded-xl min-w-[260px]" style={{ backgroundColor: COLORS.WHITE, border: `1.5px solid ${COLORS.LIGHT_GREY}` }}>
        <p className="font-bold mb-3 text-base pb-2 border-b" style={{ color: COLORS.NAVY, borderColor: COLORS.LIGHT_GREY }}>
          {label}
        </p>
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm font-semibold" style={{ color: COLORS.TEXT_MUTED }}>Demand Score</span>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-black" style={{ color: peakColor }}>{value}%</span>
            <span className="text-xs font-black px-2 py-1 rounded-md" style={{ backgroundColor: `${peakColor}18`, color: peakColor }}>
              {peakLabel}
            </span>
          </div>
        </div>
        <p className="text-xs font-medium mb-3 leading-relaxed" style={{ color: COLORS.TEXT_MUTED }}>{peakDesc}</p>
        <div className="flex justify-between text-xs">
          <span style={{ color: COLORS.TEXT_MUTED }}>Data Type</span>
          <span className="font-bold" style={{ color: isForecast ? COLORS.GOLD : COLORS.NAVY }}>
            {isForecast ? '📈 AI Forecast' : '📊 Recorded Data'}
          </span>
        </div>
        {data.spike === 1 && (
          <div className="mt-3 pt-3 border-t text-xs font-bold flex items-start gap-2" style={{ color: COLORS.RED_ORANGE, borderColor: COLORS.LIGHT_GREY }}>
            <Zap size={14} className="shrink-0 mt-0.5" style={{ fill: COLORS.RED_ORANGE, color: COLORS.RED_ORANGE }} />
            <span>Demand Surge — Act within 48 hrs for maximum revenue impact.</span>
          </div>
        )}
      </div>
    );
  }
  return null;
};

const renderCustomDot = (props: any, color: string, isForecast: boolean) => {
  const { cx, cy, payload } = props;
  const value = isForecast ? payload.forecast : payload.history;
  
  if (value === null) return null;
  if (!isForecast && payload.week === 'Current' && payload.forecast !== null) return null;

  if (payload.spike === 1) {
    return (
      <g transform={`translate(${cx},${cy})`}>
        <circle cx={0} cy={0} r={6} fill={color} stroke={COLORS.WHITE} strokeWidth={3} />
        <g transform={`translate(-16, -28)`}>
           <circle cx={16} cy={16} r={16} fill={COLORS.RED_ORANGE} stroke={COLORS.WHITE} strokeWidth={2} />
           <svg x="6" y="6" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
             <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="white" />
           </svg>
        </g>
      </g>
    );
  }
  return <circle cx={cx} cy={cy} r={6} fill={color} stroke={COLORS.WHITE} strokeWidth={3} />;
};

const SpikeAlertBanner = ({ market }: { market: Market }) => {
  const hasSpikeNow = market.chartData.some((d) => d.history !== null && d.spike === 1);
  const hasSpikeAhead = market.chartData.some((d) => d.forecast !== null && d.spike === 1);

  if (!hasSpikeNow && !hasSpikeAhead) return null;

  const bgColor = hasSpikeNow ? COLORS.RED_ORANGE : COLORS.GOLD;
  const lightBg = hasSpikeNow ? COLORS.BEIGE : COLORS.GOLD_LIGHT;
  const spikeWeek = market.chartData.find((d) => d.spike === 1)?.week || '';

  return (
    <div className="rounded-2xl overflow-hidden shadow-lg" style={{ border: `2px solid ${bgColor}` }}>
      <div className="flex items-center gap-3 px-6 py-4" style={{ backgroundColor: bgColor }}>
        <div className="p-2 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.25)' }}>
          <Zap size={20} color={COLORS.WHITE} style={{ fill: COLORS.WHITE }} />
        </div>
        <div>
          <p className="font-black text-sm uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.75)' }}>
            {hasSpikeNow ? 'Live Alert — Right Now' : `Upcoming Surge Detected — ${spikeWeek}`}
          </p>
          <p className="font-black text-lg leading-tight" style={{ color: COLORS.WHITE }}>
            {hasSpikeNow ? `Demand Surge Active: ${market.name} tourists are searching Cebu heavily right now` : `Demand Surge Incoming: ${market.name} interest projected to spike in ${spikeWeek}`}
          </p>
        </div>
      </div>
      <div className="px-6 py-5" style={{ backgroundColor: lightBg }}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-xs font-black uppercase tracking-wider mb-2" style={{ color: bgColor }}>What This Means for Your Business</p>
            <p className="text-sm leading-relaxed font-medium" style={{ color: COLORS.TEXT_MAIN }}>
              {hasSpikeNow ? `Tourist interest from ${market.name} has jumped well above the normal baseline. You have a 48–72 hour window where visitors are actively booking.` : `Our AI model forecasts an above-normal surge from ${market.name} around ${spikeWeek}. Prepare your inventory and promotions now.`}
            </p>
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-wider mb-2" style={{ color: bgColor }}>Your Action Checklist</p>
            <div className="space-y-2">
              {[
                hasSpikeNow ? 'Post targeted social content in Korean/Japanese NOW' : 'Schedule social content for this market 2 weeks ahead',
                'Raise premium room & package rates by 10–15%',
                'Alert your tour operators and guides to increase availability',
                hasSpikeNow ? 'Enable flash booking discounts to close hesitant buyers' : 'Prepare limited "early-bird" deals to lock in bookings early',
              ].map((action, i) => (
                <div key={i} className="flex items-start gap-2">
                  <CheckCircle size={15} className="shrink-0 mt-0.5" style={{ color: bgColor }} />
                  <span className="text-xs font-semibold leading-relaxed" style={{ color: COLORS.TEXT_MAIN }}>{action}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const EconomyPanel = ({ market }: { market: Market }) => (
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
);

const SeasonalityPanel = ({ market }: { market: Market }) => {
  const allMonths = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return (
    <div className="animate-fade-in">
      <div className="mb-5">
        <h4 className="font-black text-lg" style={{ color: COLORS.NAVY }}>Annual Travel Pattern — {market.name}</h4>
        <p className="text-sm font-medium mt-1" style={{ color: COLORS.TEXT_MUTED }}>Recurring travel cycles based on historical data patterns.</p>
      </div>
      <div className="mb-5">
        <p className="text-xs font-black uppercase tracking-wider mb-3" style={{ color: COLORS.TEXT_MUTED }}>Monthly Demand Calendar</p>
        <div className="grid grid-cols-12 gap-1">
          {allMonths.map((month) => {
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
  );
};

export default function MarketPrediction({ onBack, initialMarketId, onNavigateToContent }: { onBack?: () => void, initialMarketId?: string, onNavigateToContent?: () => void }) {
  const [selectedMarketId, setSelectedMarketId] = useState<string>(initialMarketId ?? MOCK_MARKETS[0].id);
  const [timeframe, setTimeframe] = useState<'4WK' | '12WK'>('4WK');
  const [activeDriver, setActiveDriver] = useState<'economy' | 'seasonality'>('economy');

  const selectedMarket = MOCK_MARKETS.find((m) => m.id === selectedMarketId) || MOCK_MARKETS[0];
  const hasSpike = selectedMarket.chartData.some((d) => d.spike === 1);
  const displayData = React.useMemo(() => generateTimeframeData(selectedMarket.chartData, timeframe), [selectedMarket, timeframe]);

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6" style={{ backgroundColor: COLORS.CREAM, minHeight: '100vh' }}>
      
      {onBack && (
        <button onClick={onBack} className="flex items-center text-slate-500 hover:text-slate-800 mb-2 font-medium transition-colors">
          <ArrowLeft size={18} className="mr-2" /> Back to Home
        </button>
      )}

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight leading-none" style={{ color: COLORS.NAVY }}>Market Radar</h1>
          <p className="text-sm font-medium mt-0.5 mb-2" style={{ color: COLORS.TEXT_MUTED }}>Cebu Tourism Forecast — Where Visitors Are Coming From</p>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold border shadow-sm mt-2" style={{ backgroundColor: COLORS.WHITE, color: COLORS.TEXT_MAIN, borderColor: COLORS.LIGHT_GREY }}>
            <MapPin size={15} style={{ color: COLORS.RED_ORANGE }} /> Profile: Eco-Tourism / Beach
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {MOCK_MARKETS.map((market) => {
          const isSelected = market.id === selectedMarketId;
          const hasThisSpike = market.chartData.some((d) => d.spike === 1);

          return (
            <button
              key={market.id}
              onClick={() => setSelectedMarketId(market.id)}
              className={`relative flex flex-col items-start p-5 rounded-2xl border transition-all duration-300 text-left ${isSelected ? 'shadow-xl scale-[1.02]' : 'hover:shadow-md hover:bg-white'}`}
              style={{ backgroundColor: isSelected ? COLORS.WHITE : 'rgba(253,251,247,0.7)', borderColor: isSelected ? COLORS.NAVY : COLORS.LIGHT_GREY, zIndex: isSelected ? 10 : 1 }}
            >
              {hasThisSpike && (
                <div className="absolute -top-2 -right-2 flex items-center gap-1 px-2 py-1 rounded-full text-xs font-black shadow-md" style={{ backgroundColor: COLORS.RED_ORANGE, color: COLORS.WHITE }}>
                  <Zap size={10} color={COLORS.WHITE} style={{ fill: COLORS.WHITE }} /> SURGE
                </div>
              )}
              <div className="flex items-center gap-3 mb-4 w-full">
                <span className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black shrink-0" style={{ backgroundColor: isSelected ? COLORS.NAVY : COLORS.LIGHT_GREY, color: isSelected ? COLORS.WHITE : COLORS.TEXT_DARK }}>
                  #{market.rank}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-lg leading-tight" style={{ color: COLORS.NAVY }}>{market.name}</span>
                  </div>
                  <p className="text-xs font-medium mt-0.5" style={{ color: COLORS.TEXT_MUTED }}>{market.city} · {market.distanceKm.toLocaleString()} km</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 mb-4">
                <Plane size={13} style={{ color: market.directFlight ? COLORS.GREEN : COLORS.GOLD }} />
                <span className="text-xs font-bold" style={{ color: market.directFlight ? COLORS.GREEN : COLORS.GOLD }}>{market.directFlight ? 'Direct Flight Available' : 'Connecting Flight'}</span>
              </div>
              <div className="w-full space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold uppercase tracking-wider" style={{ color: COLORS.TEXT_MUTED }}>Market Potential</span>
                  <span className="font-black text-sm" style={{ color: COLORS.NAVY }}>{market.matchScore}/100</span>
                </div>
                <div className="h-2 w-full rounded-full overflow-hidden" style={{ backgroundColor: COLORS.OFF_WHITE }}>
                  <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${market.matchScore}%`, backgroundColor: market.matchScore > 85 ? COLORS.RED_ORANGE : market.matchScore > 75 ? COLORS.GOLD : COLORS.NAVY }} />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <SpikeAlertBanner market={selectedMarket} />

      <div className="rounded-2xl shadow-xl overflow-hidden" style={{ backgroundColor: COLORS.WHITE, border: `1px solid ${COLORS.LIGHT_GREY}` }}>
        <div className="p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6" style={{ backgroundColor: COLORS.NAVY }}>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Zap size={16} color={COLORS.GOLD} style={{ fill: COLORS.GOLD }} />
              <h2 className="text-xs font-black uppercase tracking-widest" style={{ color: COLORS.LIGHT_GOLD }}>AI Strategic Directive</h2>
            </div>
            <p className="text-xl md:text-xl font-medium leading-relaxed" style={{ color: COLORS.WHITE }}>{selectedMarket.directive}</p>
          </div>
          {/* Linked Prop Callback Function Here */}
          <button 
            onClick={onNavigateToContent}
            className="shrink-0 px-6 py-4 rounded-xl text-md font-black transition-all hover:scale-105 shadow-lg w-full md:w-auto text-center hover:opacity-90" 
            style={{ backgroundColor: COLORS.GOLD, color: COLORS.WHITE }}
          >
            Generate Content
          </button>
        </div>

        <div className="grid grid-cols-2 divide-x border-b" style={{ borderColor: COLORS.LIGHT_GREY, backgroundColor: COLORS.OFF_WHITE }}>
          {[
            { icon: <Navigation size={16} />, label: 'Distance to Cebu', value: `${selectedMarket.distanceKm.toLocaleString()} km`, color: COLORS.SKYBLUE },
            { icon: <Plane size={16} />, label: 'Route Type', value: selectedMarket.directFlight ? 'Direct Flights' : 'Via Manila', color: selectedMarket.directFlight ? COLORS.GREEN : COLORS.GOLD },
          ].map((item, i) => (
            <div key={i} className="flex flex-col p-4 md:p-5">
              <div className="flex items-center gap-1.5 mb-1.5" style={{ color: item.color }}>
                {item.icon}
                <span className="text-xs font-black uppercase tracking-wider">{item.label}</span>
              </div>
              <span className="text-base font-black leading-tight" style={{ color: COLORS.NAVY }}>{item.value}</span>
            </div>
          ))}
        </div>

        <div className="p-6 md:p-8 border-b" style={{ borderColor: COLORS.LIGHT_GREY }}>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <div>
              <h3 className="text-xl font-black" style={{ color: COLORS.NAVY }}>Demand Forecasting & Spike Detection</h3>
              <p className="text-sm font-medium mt-1" style={{ color: COLORS.TEXT_MUTED }}>Track tourist interest levels week by week — past data (solid) and AI projections (dashed).</p>
            </div>
            <div className="flex p-1.5 rounded-xl border shrink-0" style={{ backgroundColor: COLORS.CREAM, borderColor: COLORS.LIGHT_GREY }}>
              <button onClick={() => setTimeframe('4WK')} className="px-5 py-2 text-xs font-black rounded-lg transition-all" style={{ backgroundColor: timeframe === '4WK' ? COLORS.WHITE : 'transparent', color: COLORS.TEXT_MAIN }}>
                4 Weeks
              </button>
              <button onClick={() => setTimeframe('12WK')} className="px-5 py-2 text-xs font-black rounded-lg transition-all" style={{ backgroundColor: timeframe === '12WK' ? COLORS.WHITE : 'transparent', color: COLORS.TEXT_MAIN }}>
                12 Weeks
              </button>
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

        <div style={{ backgroundColor: COLORS.OFF_WHITE }}>
          <div className="p-6 md:p-8">
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
            <div className="p-6 rounded-2xl border shadow-sm" style={{ backgroundColor: COLORS.WHITE, borderColor: COLORS.LIGHT_GREY }}>
              {activeDriver === 'economy' && <EconomyPanel market={selectedMarket} />}
              {activeDriver === 'seasonality' && <SeasonalityPanel market={selectedMarket} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}