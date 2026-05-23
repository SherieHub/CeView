import React, { useEffect } from 'react';
import { RefreshCw, Calendar, MousePointer, DollarSign, Activity, Target, Users } from 'lucide-react';
import KpiMetricCard from '../../composites/module-4/KpiMetricCard';
import { COLORS } from '../../../constants';

interface EngagementMetricsBoardProps {
  mockMetrics: any;
  dateRange: { start: string, end: string };
  setDateRange: (range: any) => void;
  isRefreshing: boolean;
  setIsRefreshing: (state: boolean) => void;
}

const EngagementMetricsBoard: React.FC<EngagementMetricsBoardProps> = ({ mockMetrics, dateRange, setDateRange, isRefreshing, setIsRefreshing }) => {
  
  useEffect(() => {
    setIsRefreshing(true);
    const fetchNewData = setTimeout(() => setIsRefreshing(false), 800);
    return () => clearTimeout(fetchNewData);
  }, [dateRange, setIsRefreshing]);

  const handleDateChange = (value: string) => {
    setDateRange((prev: any) => ({ ...prev, start: value }));
  };

  return (
    <>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2" style={{ color: COLORS.NAVY }}>
            Campaign Engagement
            {isRefreshing && <RefreshCw size={16} className="animate-spin" style={{ color: COLORS.GOLD }} />}
          </h2>
          <p className="mt-1" style={{ color: COLORS.TEXT_MUTED }}>Marketing efficiency and funnel drop-off analysis.</p>
        </div>
        
        <div className="flex items-center p-1.5 bg-white rounded-xl shadow-sm border transition-all duration-300" style={{ borderColor: isRefreshing ? COLORS.GOLD : '#E2E8F0', boxShadow: isRefreshing ? `0 0 0 1px ${COLORS.GOLD}40` : '' }}>
          <div className="flex items-center justify-center pl-3 pr-2">
            <Calendar size={18} style={{ color: COLORS.NAVY }} />
          </div>
          <div className="flex items-center gap-1 bg-slate-50 rounded-lg p-1 border border-slate-100">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">Published:</span>
            <input 
              type="date" max={dateRange.end} value={dateRange.start} onChange={(e) => handleDateChange(e.target.value)} 
              className="text-sm font-semibold text-slate-600 bg-transparent border-none focus:bg-white focus:ring-2 focus:ring-slate-200 rounded-md px-2 py-1.5 cursor-pointer transition-colors hover:text-slate-900 outline-none" 
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <KpiMetricCard 
          title="CTR" data={mockMetrics.ctr} icon={<MousePointer size={20}/>} 
          tooltip={<div className="text-center px-2"><h3 className="text-sm font-black mb-1" style={{ color: COLORS.NAVY }}>Click-Through Rate:</h3><p className="text-xs opacity-90" style={{ color: COLORS.TEXT_MUTED }}>The percentage of people who saw your ad and decided to click on it.</p></div>}
        />
        <KpiMetricCard 
          title="CPC" data={mockMetrics.cpc} icon={<DollarSign size={20}/>} inverseLogic 
          tooltip={<div className="text-center px-2"><h3 className="text-sm font-black mb-1" style={{ color: COLORS.NAVY }}>Cost per Click:</h3><p className="text-xs opacity-90" style={{ color: COLORS.TEXT_MUTED }}>The exact amount you pay each time someone clicks on your ad.</p></div>}
        />
        <KpiMetricCard 
          title="ROAS" data={mockMetrics.roas} icon={<Activity size={20}/>} 
          tooltip={<div className="text-center px-2"><h3 className="text-sm font-black mb-1" style={{ color: COLORS.NAVY }}>Return on Ad Spend:</h3><p className="text-xs opacity-90" style={{ color: COLORS.TEXT_MUTED }}>How much revenue you earn back for every peso you spend.</p></div>}
        />
        <KpiMetricCard 
          title="CR" data={mockMetrics.convRate} icon={<Target size={20}/>} 
          tooltip={<div className="text-center px-2"><h3 className="text-sm font-black mb-1" style={{ color: COLORS.NAVY }}>Conversion Rate:</h3><p className="text-xs opacity-90" style={{ color: COLORS.TEXT_MUTED}}>The percentage of people who actually booked a stay after clicking.</p></div>}
        />
        <KpiMetricCard 
          title="CAC" data={mockMetrics.cac} icon={<Users size={20}/>} inverseLogic 
          tooltip={<div className="text-center px-2"><h3 className="font-black mb-1" style={{ color: COLORS.NAVY, fontSize: '0.782rem' }}>Customer Acquisition Cost:</h3><p className="text-xs opacity-90" style={{ color: COLORS.TEXT_MUTED}}>Total amount spent to secure one new paying customer.</p></div>}
        />
      </div>
    </>
  );
};

export default EngagementMetricsBoard;