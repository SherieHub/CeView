
import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area 
} from 'recharts';
import { 
  TrendingUp, TrendingDown, RefreshCw, AlertCircle, CheckCircle, Lightbulb, 
  BarChart2, Users, MousePointer, ArrowLeft, ChevronRight, Activity
} from 'lucide-react';
import { MOCK_PERFORMANCE_REPORTS, COLORS } from '../constants';
import { generatePerformanceAnalysis } from '../services/geminiService';
import { PerformanceAnalysis, PerformanceReport } from '../types';

const PerformanceReports: React.FC = () => {
  const [selectedReport, setSelectedReport] = useState<PerformanceReport | null>(null);
  const [analysis, setAnalysis] = useState<PerformanceAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Reset analysis when view changes
  useEffect(() => {
    setAnalysis(null);
  }, [selectedReport]);

  const handleAnalyze = async (reportData: any) => {
    setIsLoading(true);
    try {
      const result = await generatePerformanceAnalysis(reportData);
      setAnalysis(result);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  // 1. LIST VIEW
  if (!selectedReport) {
    return (
      <div className="max-w-4xl mx-auto animate-fade-in space-y-8">
        <div>
          <h2 className="text-3xl font-bold text-[#007892]">Performance Reports</h2>
          <p className="text-slate-500 mt-1">Weekly retrospective on content efficacy and ROI.</p>
        </div>

        <div className="space-y-4">
          {MOCK_PERFORMANCE_REPORTS.map((report) => (
            <div 
              key={report.id}
              onClick={() => setSelectedReport(report)}
              className="bg-white p-6 rounded-xl shadow-sm border border-[#F5E5D1] hover:shadow-md transition-all cursor-pointer group relative overflow-hidden"
            >
               {!report.isRead && (
                 <div className="absolute top-6 right-6 w-3 h-3 bg-[#D6A539] rounded-full animate-pulse"></div>
               )}
               
               <div className="flex items-start gap-4">
                 <div className="p-3 rounded-full bg-[#E0F7FA] text-[#007892]">
                   <BarChart2 size={24} />
                 </div>
                 <div className="flex-1">
                   <p className="text-xs font-bold text-[#506E53] uppercase tracking-wide mb-1">{report.weekLabel}</p>
                   <h3 className="text-xl font-bold text-slate-800 group-hover:text-[#007892] transition-colors">
                     {report.title}
                   </h3>
                   
                   {/* Quick Stats Row */}
                   <div className="grid grid-cols-3 gap-4 mt-4 max-w-lg">
                      <div>
                        <p className="text-xs text-slate-400 uppercase font-semibold">Avg. Engagement</p>
                        <p className={`font-bold ${report.summaryStats.avgEngagement > 5 ? 'text-[#007892]' : 'text-slate-600'}`}>
                          {report.summaryStats.avgEngagement}%
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 uppercase font-semibold">Total Reach</p>
                        <p className="font-bold text-slate-600">
                          {report.summaryStats.totalReach.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 uppercase font-semibold">Best Platform</p>
                        <p className="font-bold text-slate-600">
                          {report.summaryStats.topPlatform}
                        </p>
                      </div>
                   </div>

                   <div className="mt-4 flex items-center text-sm font-bold text-[#007892]">
                     View Full Analysis <ChevronRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform" />
                   </div>
                 </div>
               </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 2. DETAIL VIEW (The Dashboard)
  const reportData = selectedReport.data;
  const totalReach = reportData.reduce((acc, curr) => acc + curr.reach, 0);
  const totalEngagement = reportData.reduce((acc, curr) => acc + curr.likes + curr.comments + curr.shares, 0);
  const avgEngagementRate = (reportData.reduce((acc, curr) => acc + curr.engagementRate, 0) / reportData.length).toFixed(1);

  return (
    <div className="animate-fade-in space-y-8 pb-12">
      <button 
        onClick={() => setSelectedReport(null)}
        className="flex items-center text-slate-500 hover:text-[#007892] mb-2 font-medium transition-colors"
      >
        <ArrowLeft size={18} className="mr-2" />
        Back to Reports List
      </button>

      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-[#007892]">{selectedReport.weekLabel}</h2>
          <p className="text-slate-500 mt-1">Deep dive analysis for {selectedReport.dateRange}.</p>
        </div>
        <button 
          onClick={() => handleAnalyze(reportData)}
          disabled={isLoading}
          className="px-6 py-3 rounded-xl text-white font-bold flex items-center gap-2 hover:opacity-90 shadow-lg transition-all"
          style={{ backgroundColor: COLORS.TEAL }}
        >
          {isLoading ? <RefreshCw className="animate-spin" size={20} /> : <SparklesIcon />}
          <span>{analysis ? 'Refresh Analysis' : 'Analyze Weekly Data'}</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <KPICard 
          icon={<Users size={32} color={COLORS.TEAL} />}
          label="Total Reach"
          value={totalReach.toLocaleString()}
          trend="Unique Viewers"
          isPositive={true}
        />
        <KPICard 
          icon={<MousePointer size={32} color={COLORS.GOLD} />}
          label="Total Interactions"
          value={totalEngagement.toLocaleString()}
          trend="Likes + Comments + Shares"
          isPositive={true}
        />
        <KPICard 
          icon={<Activity size={32} color={COLORS.GREEN} />}
          label="Avg. Engagement Rate"
          value={`${avgEngagementRate}%`}
          trend="Efficiency Score"
          isPositive={parseFloat(avgEngagementRate) > 5}
        />
      </div>

      {/* Engagement Chart */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#F5E5D1]">
        <h3 className="text-lg font-semibold text-[#007892] mb-6">Engagement Trends ({selectedReport.dateRange})</h3>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={[...reportData].reverse()} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.TEAL} stopOpacity={0.2}/>
                  <stop offset="95%" stopColor={COLORS.TEAL} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{fontSize: 12}} tickFormatter={(val) => val.slice(5)} />
              <YAxis />
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
              />
              <Area 
                type="monotone" 
                dataKey="engagementRate" 
                name="Engagement Rate %"
                stroke={COLORS.TEAL} 
                fillOpacity={1} 
                fill="url(#colorRate)" 
                strokeWidth={3}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: Data Table */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#F5E5D1]">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Post Breakdown</h3>
          <div className="space-y-4">
            {reportData.map((post) => (
              <div key={post.id} className="p-4 rounded-xl border border-slate-100 hover:border-[#62D2E0] transition-colors flex justify-between items-start bg-[#FDFBF7]">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                      post.platform === 'Instagram' ? 'bg-pink-100 text-pink-700' :
                      post.platform === 'TikTok' ? 'bg-black text-white' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {post.platform}
                    </span>
                    <span className="text-xs text-slate-400">{post.date}</span>
                  </div>
                  <p className="text-sm font-medium text-slate-700 line-clamp-2">{post.contentSnippet}</p>
                </div>
                
                <div className="text-right pl-4">
                  <div className="flex items-center gap-1 justify-end">
                    <span className={`text-lg font-bold ${
                      post.engagementRate > 10 ? 'text-[#506E53]' : 
                      post.engagementRate < 5 ? 'text-red-500' : 'text-[#D6A539]'
                    }`}>
                      {post.engagementRate}%
                    </span>
                    {post.engagementRate > 10 && <TrendingUp size={16} className="text-[#506E53]" />}
                    {post.engagementRate < 5 && <TrendingDown size={16} className="text-red-500" />}
                  </div>
                  <p className="text-xs text-slate-400">Eng. Rate</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: AI Analysis Panel */}
        <div className="rounded-2xl shadow-sm border border-[#F5E5D1] overflow-hidden flex flex-col" style={{ backgroundColor: COLORS.OFF_WHITE }}>
           <div className="p-6 text-white relative" style={{ backgroundColor: COLORS.TEAL }}>
             <div className="absolute right-0 top-0 opacity-10 p-4">
                <Lightbulb size={100} />
             </div>
             <h3 className="text-xl font-bold relative z-10">Strategic Calibration</h3>
             <p className="text-white/70 text-sm relative z-10">AI-driven insights to optimize next week's spend and effort.</p>
           </div>
           
           <div className="p-6 flex-1 relative min-h-[400px]">
             {!analysis && !isLoading && (
               <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 opacity-60">
                 <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mb-4">
                   <BarChart2 size={32} className="text-slate-400" />
                 </div>
                 <p className="text-slate-500 font-medium">Click "Analyze Weekly Data" to generate AI insights based on the metrics to the left.</p>
               </div>
             )}

             {isLoading && (
               <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/50 backdrop-blur-sm z-20">
                 <RefreshCw className="animate-spin text-[#007892] mb-3" size={32} />
                 <p className="text-[#007892] font-bold animate-pulse">Analyzing Performance Patterns...</p>
               </div>
             )}

             {analysis && (
               <div className="space-y-6 animate-fade-in">
                 <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                    <h4 className="font-bold text-[#007892] mb-2 text-sm uppercase tracking-wide">Weekly Summary</h4>
                    <p className="text-slate-700 text-sm leading-relaxed">
                      {analysis.summary}
                    </p>
                 </div>

                 <div>
                   <h4 className="flex items-center gap-2 font-bold text-[#506E53] mb-3 text-sm">
                     <CheckCircle size={16} /> What Worked (Keep Doing)
                   </h4>
                   <ul className="space-y-2">
                     {analysis.strengths.map((item, i) => (
                       <li key={i} className="text-sm text-slate-600 pl-6 relative">
                         <span className="absolute left-0 top-1.5 w-1.5 h-1.5 bg-[#506E53] rounded-full"></span>
                         {item}
                       </li>
                     ))}
                   </ul>
                 </div>

                 <div>
                   <h4 className="flex items-center gap-2 font-bold text-red-500 mb-3 text-sm">
                     <AlertCircle size={16} /> What Didn't Work (Stop/Pivot)
                   </h4>
                   <ul className="space-y-2">
                     {analysis.weaknesses.map((item, i) => (
                       <li key={i} className="text-sm text-slate-600 pl-6 relative">
                         <span className="absolute left-0 top-1.5 w-1.5 h-1.5 bg-red-400 rounded-full"></span>
                         {item}
                       </li>
                     ))}
                   </ul>
                 </div>

                 <div className="pt-4 border-t border-slate-200">
                   <h4 className="flex items-center gap-2 font-bold text-[#D6A539] mb-3 text-sm">
                     <Lightbulb size={16} /> Actionable Suggestions
                   </h4>
                   <div className="grid gap-3">
                     {analysis.recommendations.map((rec, i) => (
                       <div key={i} className="bg-[#FEF9C3] p-3 rounded-lg border border-[#FDE047] text-sm text-slate-800 shadow-sm">
                          {rec}
                       </div>
                     ))}
                   </div>
                 </div>
               </div>
             )}
           </div>
        </div>
      </div>
    </div>
  );
};

// Sub-component for Top Cards
const KPICard = ({ icon, label, value, trend, isPositive }: any) => (
  <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#F5E5D1] flex items-center justify-between">
    <div>
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <h3 className="text-2xl font-bold mt-1 text-slate-800">{value}</h3>
      <div className={`flex items-center mt-2 text-xs font-bold ${isPositive ? 'text-[#506E53]' : 'text-slate-400'}`}>
        <span>{trend}</span>
      </div>
    </div>
    <div className="p-3 rounded-full bg-[#FDFBF7] border border-[#F5E5D1]">
      {icon}
    </div>
  </div>
);

const SparklesIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2L14.39 9.26L22 12L14.39 14.74L12 22L9.61 14.74L2 12L9.61 9.26L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export default PerformanceReports;
