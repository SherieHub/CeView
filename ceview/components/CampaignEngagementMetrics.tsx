import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList 
} from 'recharts';
import { 
  TrendingUp, TrendingDown, MousePointer, DollarSign, Activity, Target, Users, Calendar, 
  PlusCircle, RefreshCw, Sparkles, Download, AlertTriangle, FileText, ListOrdered, Loader2, ArrowRight, ArrowLeft,
  ChevronDown, ChevronUp
} from 'lucide-react';
import { COLORS } from '../constants';

export default function CampaignEngagementMetrics() {
  // State Toggles
  const [hasData, setHasData] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Date Range State
  const [dateRange, setDateRange] = useState({ start: '2026-05-01', end: '2026-05-14' });

  // Manual Input Form State
  const [formData, setFormData] = useState({
    impressions: '', clicks: '', adSpend: '', revenue: '', conversions: '', bookings: '', newCustomers: ''
  });

  // Mock Data: 4.1 Metrics & Funnel
  const mockMetrics = {
    ctr: { value: 4.8, unit: '%', trend: 1.2, isPositive: true },
    cpc: { value: 60.25, unit: '₱', trend: -0.05, isPositive: true }, 
    roas: { value: 3.2, unit: 'x', trend: 0.4, isPositive: true },
    convRate: { value: 2.5, unit: '%', trend: -0.5, isPositive: false },
    cac: { value: 2520.00, unit: '₱', trend: 5.00, isPositive: false } 
  };

  const mockFunnelData = [
    { stage: 'Impressions', value: 150000, dropoff: null },
    { stage: 'Clicks', value: 7200, dropoff: '-95.2%' },
    { stage: 'Conversions', value: 850, dropoff: '-88.1%' },
    { stage: 'Bookings', value: 180, dropoff: '-78.8%' }
  ];

  // Triggers data recomputation when date changes
  useEffect(() => {
    if (hasData) {
      setIsRefreshing(true);
      const fetchNewData = setTimeout(() => setIsRefreshing(false), 800);
      return () => clearTimeout(fetchNewData);
    }
  }, [dateRange, hasData]);

  const handleDateChange = (field: 'start' | 'end', value: string) => {
    setDateRange(prev => {
      const newRange = { ...prev, [field]: value };
      if (newRange.start > newRange.end) return prev; 
      return newRange;
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSimulateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setHasData(true); 
  };

  // ==========================================
  // EMPTY STATE: MANUAL INPUT FORM
  // ==========================================
  if (!hasData) {
    return (
      <div className="max-w-3xl mx-auto animate-fade-in space-y-6 pb-12">
        <div className="text-center space-y-2 mb-8">
          <div 
            className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 shadow-sm"
            style={{ backgroundColor: COLORS.NAVY, color: COLORS.LIGHT_GOLD}}
          >
            <Activity size={32} />
          </div>
          <h2 className="text-3xl font-bold" style={{ color: COLORS.NAVY }}>No Campaign Data Found</h2>
          <p style={{ color: COLORS.TEXT_MUTED }}>Please enter simulated parameters to generate funnel metrics for this period.</p>
        </div>

        <form onSubmit={handleSimulateSubmit} className="bg-white p-8 rounded-2xl shadow-sm border border-slate-300 space-y-6">
          <h3 className="text-lg font-bold border-b border-slate-200 pb-4" style={{ color: COLORS.TEXT_MAIN }}>Manual Data Ingestion</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InputField label="Impressions" name="impressions" type="number" placeholder="e.g., 150000" onChange={handleInputChange} />
            <InputField label="Clicks" name="clicks" type="number" placeholder="e.g., 7200" onChange={handleInputChange} />
            <InputField label="Ad Spend (₱)" name="adSpend" type="number" placeholder="e.g., 5000" onChange={handleInputChange} />
            <InputField label="Revenue (₱)" name="revenue" type="number" placeholder="e.g., 1000" onChange={handleInputChange} />
            <InputField label="Conversions (Leads)" name="conversions" type="number" placeholder="e.g., 350" onChange={handleInputChange} />
            <InputField label="Bookings (Sales)" name="bookings" type="number" placeholder="e.g., 500" onChange={handleInputChange} />
            <div className="md:col-span-2">
              <InputField label="New Customers" name="newCustomers" type="number" placeholder="e.g., 80" onChange={handleInputChange} />
            </div>
          </div>
          <button type="submit" className="w-full mt-6 py-4 rounded-xl text-white font-bold flex items-center justify-center gap-2 hover:opacity-90 shadow-sm transition-all" style={{ backgroundColor: COLORS.NAVY }}>
            <PlusCircle size={20} /> Generate Campaign Analytics
          </button>
        </form>
      </div>
    );
  }

  // ==========================================
  // DASHBOARD VIEW (MODULE 4 FULL INTEGRATION)
  // ==========================================
  return (
    <div className="animate-fade-in space-y-12 pb-12 max-w-6xl mx-auto">
      
      {/* --- Dev Toggle --- */}
      <button 
          onClick={() => setHasData(false)}
          className="flex items-center text-slate-500 hover:text-slate-800 mb-2 font-medium transition-colors"
        >
          <ArrowLeft size={18} className="mr-2" />
          Back to Home
        </button>

      {/* --- 4.1: HEADER & DATE RANGE FILTER --- */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
  <div>
    <h2 className="text-2xl font-bold flex items-center gap-2" style={{ color: COLORS.NAVY }}>
      Campaign Engagement
      {isRefreshing && <RefreshCw size={16} className="animate-spin" style={{ color: COLORS.GOLD }} />}
    </h2>
    <p className="mt-1" style={{ color: COLORS.TEXT_MUTED }}>Marketing efficiency and funnel drop-off analysis.</p>
  </div>
  
  {/* Restyled Date Picker Container */}
  <div 
    className="flex items-center p-1.5 bg-white rounded-xl shadow-sm border transition-all duration-300"
    style={{ 
      borderColor: isRefreshing ? COLORS.GOLD : '#E2E8F0',
      boxShadow: isRefreshing ? `0 0 0 1px ${COLORS.GOLD}40` : '' 
    }}
  >
    {/* Icon Area */}
    <div className="flex items-center justify-center pl-3 pr-2">
      <Calendar size={18} style={{ color: COLORS.NAVY }} />
    </div>
    
    {/* Interactive Inputs Area */}
    <div className="flex items-center gap-1 bg-slate-50 rounded-lg p-1 border border-slate-100">
        <input 
          type="date" 
          max={dateRange.end} 
          value={dateRange.start} 
          onChange={(e) => handleDateChange('start', e.target.value)} 
          className="text-sm font-semibold text-slate-600 bg-transparent border-none focus:bg-white focus:ring-2 focus:ring-slate-200 rounded-md px-2 py-1.5 cursor-pointer transition-colors hover:text-slate-900 outline-none" 
        />
        
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
          to
        </span>
        
        <input 
          type="date" 
          min={dateRange.start} 
          value={dateRange.end} 
          onChange={(e) => handleDateChange('end', e.target.value)} 
          className="text-sm font-semibold text-slate-600 bg-transparent border-none focus:bg-white focus:ring-2 focus:ring-slate-200 rounded-md px-2 py-1.5 cursor-pointer transition-colors hover:text-slate-900 outline-none" 
        />
      </div>
    </div>
</div>

      {/* --- 4.1: METRIC CARD ROW --- */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <MetricCard 
          title="CTR" 
          data={mockMetrics.ctr} 
          icon={<MousePointer size={20}/>} 
          tooltip={
            <div className="text-center px-2">
              <h3 className="text-sm font-black mr-2 mb-1" style={{ color: COLORS.NAVY }}>
                Click-Through Rate:
              </h3>
              <p className="text-xs leading-relaxed opacity-90" style={{ color: COLORS.TEXT_MUTED }}>
                The percentage of people who saw your ad and decided to click on it.
              </p>
            </div>
          }
        />

        <MetricCard 
          title="CPC" 
          data={mockMetrics.cpc} 
          icon={<DollarSign size={20}/>} 
          tooltip={
            <div className="text-center px-2">
              <h3 className="text-sm font-black mr-2 mb-1" style={{ color: COLORS.NAVY }}>
                Cost per Click:
              </h3>
              <p className="text-xs leading-relaxed opacity-90" style={{ color: COLORS.TEXT_MUTED }}>
                The exact amount you pay each time someone clicks on your ad.
              </p>
            </div>
          }
          inverseLogic={true}
        />

        <MetricCard 
          title="ROAS" 
          description="% of ad viewers who clicked"
          data={mockMetrics.roas} 
          icon={<Activity size={20}/>} 
          tooltip={
            <div className="text-center px-2">
              <h3 className="text-sm font-black mr-2 mb-1" style={{ color: COLORS.NAVY }}>
                Return on Ad Spend:
              </h3>
              <p className="text-xs leading-relaxed opacity-90" style={{ color: COLORS.TEXT_MUTED }}>
                How much revenue you earn back for every peso you spend on this campaign.
              </p>
            </div>
          }
        />

        <MetricCard 
          title="CR" 
          data={mockMetrics.convRate} 
          icon={<Target size={20}/>} 
          tooltip={
            <div className="text-center px-2">
              <h3 className="text-sm font-black mr-2 mb-1" style={{ color: COLORS.NAVY }}>
                Conversion Rate:
              </h3>
              <p className="text-xs leading-relaxed opacity-90" style={{ color: COLORS.TEXT_MUTED}}>
                The percentage of people who actually booked a stay after clicking your ad.
              </p>
            </div>
          }
        />

        <MetricCard 
          title="CAC" 
          data={mockMetrics.cac} 
          icon={<Users size={20}/>} 
          tooltip={
            <div className="text-center px-2">
              <h3 className="font-black mr-2 mb-1" style={{ color: COLORS.NAVY, fontSize: '0.782rem' }}>
                Customer Acquisition Cost:
              </h3>
              <p className="text-xs leading-relaxed opacity-90" style={{ color: COLORS.TEXT_MUTED}}>
                The total amount of marketing money spent to secure one new paying customer.
              </p>
            </div>
          }
          inverseLogic={true}
        />

      </div>

      {/* --- 4.1: FUNNEL BAR CHART --- */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold" style={{ color: COLORS.NAVY }}>Customer Journey (Drop-off Analysis)</h3>
          <span className="text-xs font-bold text-slate-600 uppercase tracking-wider bg-slate-100 px-3 py-1 rounded-full">Impressions → Bookings</span>
        </div>
        <div className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart layout="vertical" data={mockFunnelData} margin={{ top: 20, right: 80, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#E2E8F0" />
              <XAxis type="number" hide />
              <YAxis dataKey="stage" type="category" axisLine={false} tickLine={false} tick={{ fill: COLORS.TEXT_MUTED, fontWeight: 600, fontSize: 14 }} width={100} />
              <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} formatter={(value: number) => value.toLocaleString()} />
              <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={40}>
                {mockFunnelData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={index === 0 ? COLORS.NAVY : index === 1 ? COLORS.GOLD : index === 2 ? COLORS.RED_ORANGE : COLORS.TEXT_LIGHT} 
                  />
                ))}
                <LabelList dataKey="value" position="right" formatter={(val: number) => val.toLocaleString()} style={{ fill: COLORS.TEXT_MAIN, fontWeight: 'bold', fontSize: 14 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-between items-center mt-4 px-[100px]">
          {mockFunnelData.map((stage, idx) => {
            if (idx === 0) return <div key={idx} className="w-10"></div>;
            return (
              <div key={idx} className="flex flex-col items-center animate-fade-in">
                <div className="w-px h-6 bg-red-200 mb-1"></div>
                <span className="text-xs font-bold bg-red-50 px-2 py-1 rounded border border-red-100" style={{ color: COLORS.RED_ORANGE }}>{stage.dropoff} Loss</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* --- 4.2: PROMOTIONAL EFFECTIVENESS SCORE (PES) --- */}
      <PESSection />

      {/* --- 4.3: AI-GENERATED PRESCRIPTIVE REPORT --- */}
      <PrescriptiveReport />

    </div>
  );
}

// ==========================================
// SUB-COMPONENTS
// ==========================================

const MetricCard = ({ title, data, icon, tooltip, inverseLogic = false }: any) => {
  const isPositiveTrend = inverseLogic ? !data.isPositive : data.isPositive;
  const TrendIcon = isPositiveTrend ? TrendingUp : TrendingDown;
  // Use a standard Emerald Green for positive metrics even in the Navy theme
  const trendColor = isPositiveTrend ? '#10B981' : COLORS.RED;
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div 
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="bg-white p-5 rounded-2xl shadow-sm border flex flex-col justify-between group relative hover:shadow-md transition-shadow" 
      style={{ 
        // Swap the border color when the mouse enters the card
        borderColor: isHovered ? COLORS.TEXT_MUTED : COLORS.LIGHT_GREY 
      }}
    > 
      <div className="absolute top-0 left-0 w-full h-full text-white text-xs p-3 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10 pointer-events-none text-center" style={{ backgroundColor: COLORS.WHITE}}>
        {tooltip}
      </div>
      <div className="flex justify-between items-start mb-2">
        <p className="text-sm font-bold" style={{ color: COLORS.TEXT_MUTED }}>{title}</p>
        <div 
          className="p-2 rounded-lg border"
          style={{ backgroundColor: COLORS.CREAM, color: COLORS.NAVY, borderColor: '#E2E8F0' }}
        >
          {icon}
        </div>
      </div>
      <div>
        <h3 className="text-2xl font-black" style={{ color: COLORS.TEXT_MAIN }}>
          {title === 'CPC' || title === 'CAC' ? data.unit : ''}{data.value}{title !== 'CPC' && title !== 'CAC' ? data.unit : ''}
        </h3>
        <div className="flex items-center mt-2 text-xs font-bold" style={{ color: trendColor }}>
          <TrendIcon size={14} className="mr-1" />
          <span>{data.trend > 0 ? '+' : ''}{data.trend}{data.unit} vs last period</span>
        </div>
      </div>
    </div>
  );
};

const InputField = ({ label, name, type, placeholder, onChange }: any) => (
  <div className="flex flex-col space-y-1">
    <label className="text-sm font-bold uppercase tracking-wide" style={{ color: COLORS.TEXT_MUTED }}>{label}</label>
    <input 
      type={type} 
      name={name} 
      placeholder={placeholder} 
      onChange={onChange} 
      required 
      className="p-3 border rounded-xl focus:ring-2 outline-none transition-all" 
      style={{ backgroundColor: COLORS.CREAM, borderColor: '#E2E8F0', outlineColor: COLORS.NAVY_LIGHT }}
    />
  </div>
);

// --- 4.2 PES Component ---
const PESSection = () => {
  const pesScore = 0.68; // Mock PES Score
  
  // Weights updated to new palette colors
  const breakdownData = [
    { metric: 'ROAS', weight: '35%', contribution: 0.28, fill: COLORS.NAVY },
    { metric: 'Conv. Rate', weight: '30%', contribution: 0.15, fill: COLORS.GOLD }, // Success Green
    { metric: 'CAC (Inv)', weight: '15%', contribution: 0.10, fill: COLORS.RED_ORANGE },
    { metric: 'CTR', weight: '15%', contribution: 0.12, fill: COLORS.GREEN },
    { metric: 'CPC (Inv)', weight: '5%', contribution: 0.03, fill: COLORS.NAVY_LIGHT } // Slate
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in">
      {/* Gauge Card */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center justify-center">
        <h3 className="text-lg font-semibold mb-4 w-full text-left" style={{ color: COLORS.NAVY }}>Overall Score (PES)</h3>
        
        <div className="relative w-48 h-24 overflow-hidden mb-4">
          {/* SVG Half-Circle Gauge */}
          <svg viewBox="0 0 100 50" className="w-full h-full transform">
            
            <defs>
              <linearGradient id="movingGradient" x1="0%" y1="0%" x2="200%" y2="0%">
                {/* --- FIRST LOOP --- */}
                <stop offset="0%" stopColor={COLORS.NAVY} />      
                <stop offset="16.66%" stopColor={COLORS.BLUE} /> 
                <stop offset="33.33%" stopColor={COLORS.SKYBLUE} />  

                {/* --- SECOND LOOP --- */}
                <stop offset="50%" stopColor={COLORS.NAVY} />     
                <stop offset="66.66%" stopColor={COLORS.BLUE} /> 
                <stop offset="83.33%" stopColor={COLORS.SKYBLUE} />  
                <stop offset="100%" stopColor={COLORS.WHITE} />    

                <animate attributeName="x1" values="0%;-100%" dur="4s" repeatCount="indefinite" />
                <animate attributeName="x2" values="200%;100%" dur="4s" repeatCount="indefinite" />
              </linearGradient>
            </defs>

            {/* Background Track */}
            <path 
              d="M 10 50 A 40 40 0 0 1 90 50" 
              fill="none" 
              stroke="#E2E8F0" 
              strokeWidth="12" 
              strokeLinecap="round" 
            />
            
            {/* Animated Gradient Fill */}
            <path 
              d="M 10 50 A 40 40 0 0 1 90 50" 
              fill="none" 
              stroke="url(#movingGradient)" 
              strokeWidth="12" 
              strokeLinecap="round" 
              strokeDasharray="125.6" 
              strokeDashoffset={125.6 - (125.6 * pesScore)} 
              className="transition-all duration-1000 ease-out" 
            />
          </svg>
          
          <div className="absolute bottom-0 left-0 w-full text-center">
            <span className="text-3xl font-black" style={{ color: COLORS.TEXT_MAIN }}>{pesScore}</span>
          </div>
        </div>
        
        <span 
          className="px-4 py-1 rounded-full font-bold text-sm uppercase tracking-wide border"
          style={{ backgroundColor: COLORS.LIGHT_GREY, color: COLORS.NAVY, borderColor: '#D2E1F3' }}
        >
          Good Performance
        </span>
      </div>

      {/* Breakdown Chart Card */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 md:col-span-2 flex flex-col">
        <h3 className="text-lg font-semibold mb-2" style={{ color: COLORS.NAVY }}>Metric Weight Contribution</h3>
        <div className="h-[180px] w-full flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart layout="vertical" data={breakdownData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
              <XAxis type="number" domain={[0, 0.4]} hide />
              <YAxis dataKey="metric" type="category" interval={0} width={90} axisLine={false} tickLine={false} tick={{ fill: COLORS.TEXT_MUTED, fontSize: 12, fontWeight: 600 }} />
              <Tooltip cursor={{fill: '#F8FAFC'}} formatter={(val: number) => val.toFixed(2)} labelStyle={{color: COLORS.TEXT_MAIN, fontWeight: 'bold'}} />
              <Bar dataKey="contribution" radius={[0, 4, 4, 0]} barSize={20}>
                {breakdownData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                <LabelList dataKey="weight" position="right" style={{ fill: COLORS.TEXT_MUTED, fontSize: 12 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        {/* PESFormulaFooter */}
        <div className="mt-4 pt-4 border-t border-slate-100 text-center">
          <code className="text-[11px] font-mono bg-slate-50 px-3 py-2 rounded-lg" style={{ color: COLORS.TEXT_MUTED }}>
            This score heavily prioritizes your Ad Return (35%) and Booking Rate (30%) to ensure maximum profitability.
          </code>
        </div>
      </div>
    </div>
  );
};

// --- 4.3 Prescriptive Report Component ---
// --- 4.3 Prescriptive Report Component ---
const PrescriptiveReport = () => {
  // 1. ALL states must be declared at the top of this specific component
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportData, setReportData] = useState<any>(null);
  const [showSecondaryLeaks, setShowSecondaryLeaks] = useState(false); // <-- Fixed!

  const handleGenerateReport = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setReportData({
        executiveSummary: "Over the selected period, the campaign successfully generated high top-of-funnel awareness within the Cebu metropolitan area. However, the overall Promotional Effectiveness Score (PES) indicates a significant efficiency leak mid-funnel. While cost-per-click (CPC) remains highly competitive for local MSME benchmarks, the traffic acquired is not converting into actionable leads at the expected rate.",
        weakestStage: { name: "Clicks → Conversions", dropoff: "-88.1%", diagnosis: "High traffic volume but low landing page engagement." },
        
        // Added mock secondary leaks so the dropdown actually populates and works!
        secondaryLeaks: [
          { name: "Impressions → Clicks", dropoff: "-95.2%" },
          { name: "Conversions → Bookings", dropoff: "-78.8%" }
        ],
        
        recommendations: [
          { title: "Realign Ad Copy with Landing Page Intent", explanation: "Ensure the headline on the destination page mirrors the localized Cebu promotional offer." },
          { title: "Implement High-Intent Audience Filtering", explanation: "Shift 20% of the ad spend away from broad awareness targeting." },
          { title: "Streamline the Conversion Form", explanation: "Reduce lead capture to Name and Phone Number only." }
        ]
      });
      setIsGenerating(false);
    }, 2000);
  };

  return (
    <div className="border-t-2 border-dashed border-slate-200 pt-12 animate-fade-in space-y-6">
      <div 
        className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-6 rounded-2xl border"
        style={{ backgroundColor: COLORS.CREAM, borderColor: '#E2E8F0' }}
      >
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2" style={{ color: COLORS.NAVY }}>
            <Sparkles size={24} style={{ color: COLORS.GOLD }} /> AI Action Plan
          </h2>
          <p className="mt-1 text-sm" style={{ color: COLORS.TEXT_MUTED }}>Clear, step-by-step advice to turn more of your ad views into paying customers.</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <button 
            onClick={handleGenerateReport} 
            disabled={isGenerating} 
            className="flex-1 md:flex-none px-6 py-3 rounded-xl text-white font-bold flex items-center justify-center gap-2 hover:opacity-90 shadow-sm transition-all" 
            style={{ backgroundColor: COLORS.NAVY }}
          >
            {isGenerating ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
            {isGenerating ? 'Analyzing...' : reportData ? 'Regenerate Analysis' : 'Generate AI Report'}
          </button>
          {reportData && (
            <button className="flex-1 md:flex-none px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 border border-slate-200 bg-red-700 hover:bg-red-600 text-white">
              <Download size={18} className="text-white" /> PDF
            </button>
          )}
        </div>
      </div>

      {!reportData && !isGenerating && (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center flex flex-col items-center justify-center min-h-[250px]">
          <div 
            className="w-16 h-16 border rounded-full flex items-center justify-center mb-4"
            style={{ backgroundColor: COLORS.CREAM, borderColor: '#E2E8F0', color: COLORS.GOLD }}
          >
            <Sparkles size={32} />
          </div>
          <h3 className="text-lg font-bold" style={{ color: COLORS.TEXT_MAIN }}>Ready for Strategic Calibration</h3>
          <p className="max-w-md mt-2" style={{ color: COLORS.TEXT_MUTED }}>Click generate to let our custom forecasting model analyze your current metrics.</p>
        </div>
      )}

      {isGenerating && (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center flex flex-col items-center justify-center min-h-[250px]">
          <Loader2 size={48} className="animate-spin mb-4" style={{ color: COLORS.NAVY }} />
          <h3 className="text-lg font-bold animate-pulse" style={{ color: COLORS.NAVY }}>Analyzing your campaign data...</h3>
        </div>
      )}

      {reportData && !isGenerating && (
      <div className="flex flex-col gap-6 animate-fade-in">
        
        {/* Row 1: Executive Summary (Full Width) */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col gap-4">
          <div className="flex items-center gap-2 mb-2 border-b border-slate-100 pb-4">
            <div 
              className="p-2 rounded-lg"
              style={{ backgroundColor: COLORS.TEXT_MUTED, color: COLORS.WHITE }}
            >
              <FileText size={20} />
            </div>
            <h3 className="text-lg font-bold" style={{ color: COLORS.TEXT_MAIN }}>Executive Summary</h3>
          </div>
          <p className="leading-relaxed text-sm flex-1" style={{ color: COLORS.GREY }}>
            {reportData.executiveSummary}
          </p>
        </div>

        {/* Row 2: 2-Column Split (Recommendations | Biggest Leak) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          
          {/* Column 1: Recommendations */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col">
            <div className="flex items-center gap-2 mb-6 border-b border-slate-100 pb-4">
              <div 
                className="p-2 rounded-lg border"
                style={{ backgroundColor: COLORS.GOLD_LIGHT, color: COLORS.GOLD, borderColor: '#FDE68A' }}
              >
                <ListOrdered size={20} />
              </div>
              <h3 className="text-lg font-bold" style={{ color: COLORS.TEXT_MAIN }}>Ranked Recommendations</h3>
            </div>
            
            <div className="flex flex-col gap-5">
              {reportData.recommendations.map((rec: any, index: number) => (
                <div key={index} className="bg-slate-50 border border-slate-100 p-5 rounded-xl transition-colors relative group hover:border-[#F4A216]">
                  <div 
                    className="absolute -left-3 -top-3 w-8 h-8 rounded-full flex items-center justify-center font-black shadow-sm border transition-colors group-hover:border-[#F4A216]"
                    style={{ backgroundColor: COLORS.CREAM, color: COLORS.GOLD, borderColor: '#E2E8F0' }}
                  >
                    {index + 1}
                  </div>
                  <h4 className="font-bold text-md mb-2" style={{ color: COLORS.TEXT_MAIN }}>{rec.title}</h4>
                  <p className="text-sm leading-relaxed" style={{ color: COLORS.TEXT_MUTED }}>{rec.explanation}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Column 2: Biggest Funnel Leak (Triage UX) */}
          <div className="flex flex-col h-full">
            {/* Primary Hero Warning */}
            <div 
              className="bg-[#FEF2F2] p-6 md:p-8 rounded-2xl shadow-sm border relative overflow-hidden flex flex-col items-center text-center flex-1" 
              style={{ borderColor: COLORS.RED_ORANGE }}
            >
              <div className="mb-4 p-3 bg-white rounded-full text-red-500 shadow-sm inline-flex">
                <AlertTriangle size={32} />
              </div>
              
              <div className="relative z-10 w-full flex flex-col items-center flex-1">
                <h3 className="text-sm font-bold text-red-800 uppercase tracking-wider mb-2">Highest Priority Fix</h3>
                <p className="text-xl font-black mb-3" style={{ color: COLORS.RED }}>
                  {reportData.weakestStage.name}
                </p>
                
                <div 
                  className="inline-flex items-center gap-1 bg-red-800 px-4 py-1.5 rounded-full border font-bold text-md mb-6 shadow-sm"
                  style={{ borderColor: '#FECACA', color: COLORS.WHITE }}
                >
                  <ArrowRight size={16} />{reportData.weakestStage.dropoff} Drop-off
                </div>

                {/* The Explanation Panel */}
                <div className="bg-white/60 p-5 rounded-xl border border-red-100 text-left backdrop-blur-sm w-full mb-2">
                  <h4 className="font-bold text-red-900 text-sm mb-1">What does this mean?</h4>
                  <p className="text-xs text-red-800/80 leading-relaxed mb-1">
                    Out of every 100 potential customers who reach this stage, <strong>{reportData.weakestStage.dropoff}</strong> are leaving without taking action. 
                  </p>
                </div>

                {/* Secondary Leaks (Dropdown INSIDE the card) */}
                {reportData.secondaryLeaks && reportData.secondaryLeaks.length > 0 && (
                  <div className="mt-2 w-full border border-red-200 rounded-xl bg-white overflow-hidden shadow-sm transition-all duration-200 text-left">
                    <div 
                      onClick={() => setShowSecondaryLeaks(!showSecondaryLeaks)}
                      className="p-4 bg-red-50/50 hover:bg-red-50 border-b border-red-100 flex items-center justify-between cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <h4 className="text-sm font-bold text-red-900">Other Areas for Improvement</h4>
                        <span className="text-xs font-bold text-red-700 bg-white px-2 py-1 rounded-md border border-red-200 shadow-sm">
                          {reportData.secondaryLeaks.length} Issues
                        </span>
                      </div>
                      <div className="text-red-400">
                        {showSecondaryLeaks ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </div>
                    </div>
                    
                    {/* Hidden List that appears on click */}
                    {showSecondaryLeaks && (
                      <div className="divide-y divide-red-50 animate-fade-in bg-white">
                        {reportData.secondaryLeaks.map((leak: any, idx: number) => (
                          <div key={idx} className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors">
                            <span className="text-sm font-medium text-red-700">{leak.name}</span>
                            <span className="text-sm font-bold text-red-800">{leak.dropoff} Drop-off</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

              </div>
            </div>
          </div>

            </div>
          </div>
        )}
    </div>
  );
};