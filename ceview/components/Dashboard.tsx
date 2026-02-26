import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { TrendingUp, Users, ArrowUpRight, Globe, Lightbulb, Search } from 'lucide-react';
import { MOCK_KEYWORD_DATA, COLORS, TRAVELER_SEGMENTS } from '../constants';

const Dashboard: React.FC = () => {
  return (
    <div className="space-y-8 animate-fade-in pb-12">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-[#007892]">Predictive Market Analyzer</h2>
          <p className="text-slate-500 mt-1">Real-time tourism demand forecasting for Cebu.</p>
        </div>
        <div className="flex gap-2">
           <span className="px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 text-[#506E53] bg-[#FDFBF7] border border-[#506E53]">
             <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: COLORS.GREEN }}></div>
             Live Google Trends Data
           </span>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Metric 1 */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#F5E5D1] relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Users size={64} color={COLORS.TEAL} />
          </div>
          <p className="text-sm font-medium text-slate-500">Projected Arrivals (Next 30 Days)</p>
          <h3 className="text-3xl font-bold mt-2 text-[#007892]">124,500</h3>
          <div className="flex items-center mt-4 text-[#506E53] text-sm font-medium">
            <TrendingUp size={16} className="mr-1" />
            <span>+12.5% vs Last Year</span>
          </div>
        </div>

        {/* Metric 2: Rising Market with Detailed Interests */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#F5E5D1] relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Globe size={64} color={COLORS.GOLD} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Top Rising Market</p>
            <h3 className="text-3xl font-bold mt-1 text-[#007892]">South Korea</h3>
            <div className="flex items-center mt-1 text-[#D6A539] text-sm font-bold">
              <ArrowUpRight size={16} className="mr-1" />
              <span>+42% Search Volume</span>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-[#F5E5D1]">
             <p className="text-[10px] uppercase tracking-wider font-bold text-[#506E53] mb-3">Top Interests</p>
             <ul className="space-y-2">
                <li className="flex items-center justify-between text-sm">
                   <span className="text-slate-600 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#62D2E0]"></span>
                      Healing Travel
                   </span>
                   <span className="font-bold text-[#007892]">98/100</span>
                </li>
                <li className="flex items-center justify-between text-sm">
                   <span className="text-slate-600 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#62D2E0]"></span>
                      Eco-Resorts
                   </span>
                   <span className="font-bold text-[#007892]">85/100</span>
                </li>
                <li className="flex items-center justify-between text-sm">
                   <span className="text-slate-600 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#62D2E0]"></span>
                      Winter Golf
                   </span>
                   <span className="font-bold text-[#007892]">76/100</span>
                </li>
             </ul>
          </div>
        </div>

        {/* Metric 3: High-Potential Traveler Segments (Replaced Demand Stabilization Score) */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#F5E5D1] relative overflow-hidden">
           <div className="absolute top-0 right-0 p-4 opacity-10">
            <TrendingUp size={64} color={COLORS.GREEN} />
          </div>
          <p className="text-sm font-medium text-slate-500 mb-3">High-Potential Traveler Segments</p>
          <div className="space-y-3">
             {TRAVELER_SEGMENTS.map((segment, idx) => (
                <div key={idx} className="bg-[#E6EEF1] p-2.5 rounded-lg text-xs font-medium text-slate-700 leading-tight border border-transparent hover:border-[#62D2E0] transition-colors">
                   {segment}
                </div>
             ))}
          </div>
        </div>
      </div>

      {/* Strategic Insight Panel */}
      <div className="rounded-2xl p-6 text-white shadow-md relative overflow-hidden" style={{ backgroundColor: COLORS.TEAL }}>
        {/* Background Pattern */}
        <div className="absolute -right-10 -top-10 opacity-10">
          <TrendingUp size={200} />
        </div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 rounded-lg backdrop-blur-sm" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
              <Lightbulb size={24} color={COLORS.GOLD} />
            </div>
            <div>
              <h3 className="text-xl font-bold">Strategic Insight: Why Target South Korea Now?</h3>
              <p className="text-white/70 text-sm">AI analysis identifies this market as the highest immediate ROI opportunity.</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-4 rounded-xl backdrop-blur-sm border border-white/10 bg-white/5">
              <h4 className="font-bold mb-2 text-xs uppercase tracking-wider" style={{ color: COLORS.CYAN }}>Trend Alignment</h4>
              <p className="text-sm leading-relaxed text-white/90">
                Search traffic for <strong className="text-white">"Cebu Healing Trip"</strong> has spiked <strong>42%</strong> recently. This perfectly aligns with your current inventory's "Rustic/Nature" profile, filling the off-peak gap.
              </p>
            </div>
            
            <div className="p-4 rounded-xl backdrop-blur-sm border border-white/10 bg-white/5">
              <h4 className="font-bold mb-2 text-xs uppercase tracking-wider" style={{ color: COLORS.CYAN }}>Connectivity</h4>
              <p className="text-sm leading-relaxed text-white/90">
                <strong>MCIA Data</strong> indicates 5 daily direct flights from Incheon/Busan are operating at <strong>85% load factor</strong>, ensuring a consistent flow of independent travelers.
              </p>
            </div>
             
            <div className="p-4 rounded-xl backdrop-blur-sm border border-white/10 bg-white/5">
              <h4 className="font-bold mb-2 text-xs uppercase tracking-wider" style={{ color: COLORS.CYAN }}>Economic Value</h4>
              <p className="text-sm leading-relaxed text-white/90">
                This segment currently boasts the highest <strong>Average Daily Spend ($140)</strong> among Asian markets, with a high propensity for booking local tours and dining.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Keyword Trend Chart */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#F5E5D1]">
        <div className="flex justify-between items-center mb-2">
          <div>
            <h3 className="text-lg font-semibold text-[#007892] flex items-center gap-2">
              <Search size={20} />
              Global Search Trends (Demand Signals)
            </h3>
            <p className="text-slate-500 text-sm mt-1">Real-time keyword volume indicating emerging travel interests.</p>
          </div>
          <div className="text-right">
             <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Data Source</span>
             <p className="text-sm font-bold text-[#007892]">Google Trends API through PyTrends</p>
          </div>
        </div>
        
        <div className="h-[400px] w-full mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              layout="vertical"
              data={MOCK_KEYWORD_DATA}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              barCategoryGap="20%"
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
              <XAxis type="number" hide domain={[0, 120]} />
              <YAxis 
                dataKey="keyword" 
                type="category" 
                width={180} 
                tick={{fill: '#475569', fontSize: 13, fontWeight: 600}} 
                axisLine={false} 
                tickLine={false} 
              />
              <Tooltip 
                cursor={{fill: '#f1f5f9'}}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                formatter={(value: any, name: any, props: any) => {
                    return [`${value}/100 Volume`, "Search Interest"];
                }}
              />
              <Bar dataKey="volume" radius={[0, 6, 6, 0]} barSize={40}>
                {MOCK_KEYWORD_DATA.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={index === 0 ? COLORS.GOLD : COLORS.TEAL} />
                ))}
                <LabelList 
                    dataKey="growth" 
                    position="right" 
                    style={{ fill: COLORS.GREEN, fontWeight: 'bold', fontSize: '12px' }}
                    formatter={(val: number) => `+${val}% Growth`}
                />
                 <LabelList 
                    dataKey="market" 
                    position="insideRight" 
                    style={{ fill: '#fff', fontWeight: '500', fontSize: '11px', textShadow: '0px 0px 2px rgba(0,0,0,0.5)' }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;