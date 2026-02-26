import React, { useState, useRef } from 'react';
import { Bell, ChevronRight, TrendingUp, ArrowLeft, Users, Globe, ArrowUpRight, Lightbulb, Search, Copy, CheckCircle, Video, Image as ImageIcon, Send, Upload, X } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { MOCK_NOTIFICATIONS, COLORS } from '../constants';
import { Notification } from '../types';

const LandingPage: React.FC = () => {
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [postCaption, setPostCaption] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [isPosted, setIsPosted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const togglePlatform = (platform: string) => {
    if (selectedPlatforms.includes(platform)) {
      setSelectedPlatforms(selectedPlatforms.filter(p => p !== platform));
    } else {
      setSelectedPlatforms([...selectedPlatforms, platform]);
    }
  };

  const handleMediaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setMediaFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeFile = (index: number) => {
    setMediaFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handlePost = () => {
    setIsPosted(true);
    setTimeout(() => {
        setIsPosted(false);
        setPostCaption('');
        setMediaFiles([]);
        setSelectedPlatforms([]);
    }, 3000);
  };

  // Detail View (Summary of Changes - Market Analyzer Format)
  if (selectedNotification) {
    const { details } = selectedNotification;
    
    return (
      <div className="animate-fade-in pb-12 space-y-8">
        <button 
          onClick={() => setSelectedNotification(null)}
          className="flex items-center text-slate-500 hover:text-[#007892] mb-2 font-medium transition-colors"
        >
          <ArrowLeft size={18} className="mr-2" />
          Back to Home
        </button>

        <div className="flex justify-between items-end">
          <div>
            <h2 className="text-2xl font-bold text-[#007892]">Weekly Market Report</h2>
            <p className="text-slate-500 mt-1">{selectedNotification.title} • {selectedNotification.date}</p>
          </div>
          <div className="flex gap-2">
             <span className="px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 text-[#506E53] bg-[#FDFBF7] border border-[#506E53]">
               <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: COLORS.GREEN }}></div>
               Google Trends API or PyTrends
             </span>
          </div>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Metric 1: Potential Arrivals */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#F5E5D1] relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Users size={64} color={COLORS.TEAL} />
            </div>
            <p className="text-sm font-medium text-slate-500">Potential Arrivals (Next 30 Days)</p>
            <h3 className="text-3xl font-bold mt-2 text-[#007892]">{details.projectedArrivals.toLocaleString()}</h3>
            <div className="flex items-center mt-4 text-[#506E53] text-sm font-medium">
              <TrendingUp size={16} className="mr-1" />
              <span>+{details.arrivalGrowth}% vs Last Year</span>
            </div>
          </div>

          {/* Metric 2: Rising Market with Interests */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#F5E5D1] relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Globe size={64} color={COLORS.GOLD} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Top Rising Country Market</p>
              <h3 className="text-3xl font-bold mt-1 text-[#007892]">{selectedNotification.market}</h3>
              <div className="flex items-center mt-1 text-[#D6A539] text-sm font-bold">
                <ArrowUpRight size={16} className="mr-1" />
                <span>Rising Interest: {selectedNotification.trend}</span>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-[#F5E5D1]">
               <p className="text-[10px] uppercase tracking-wider font-bold text-[#506E53] mb-3">Top Interests</p>
               <ul className="space-y-2">
                  {details.topInterests.map((interest, idx) => (
                    <li key={idx} className="flex items-center justify-between text-sm">
                      <span className="text-slate-600 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#62D2E0]"></span>
                          {interest.name}
                      </span>
                      <span className="font-bold text-[#007892]">{interest.score}/100</span>
                    </li>
                  ))}
               </ul>
            </div>
          </div>

          {/* Metric 3: Segments */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#F5E5D1] relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-10">
              <TrendingUp size={64} color={COLORS.GREEN} />
            </div>
            <p className="text-sm font-medium text-slate-500 mb-3">High-Potential Traveler Segments</p>
            <div className="space-y-3">
               {details.segments.map((segment, idx) => (
                  <div key={idx} className="bg-[#E6EEF1] p-2.5 rounded-lg text-xs font-medium text-slate-700 leading-tight border border-transparent hover:border-[#62D2E0] transition-colors">
                     {segment}
                  </div>
               ))}
            </div>
          </div>
        </div>

        {/* Strategic Insight Panel */}
        <div className="rounded-2xl p-6 text-white shadow-md relative overflow-hidden" style={{ backgroundColor: COLORS.TEAL }}>
          <div className="absolute -right-10 -top-10 opacity-10">
            <TrendingUp size={200} />
          </div>
          
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2 rounded-lg backdrop-blur-sm" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
                <Lightbulb size={24} color={COLORS.GOLD} />
              </div>
              <div>
                <h3 className="text-xl font-bold">Strategic Insight</h3>
                <p className="text-white/70 text-sm">AI analysis identifies this market as the highest immediate ROI opportunity.</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-4 rounded-xl backdrop-blur-sm border border-white/10 bg-white/5">
                <h4 className="font-bold mb-2 text-xs uppercase tracking-wider" style={{ color: COLORS.CYAN }}>Trend Alignment</h4>
                <p className="text-sm leading-relaxed text-white/90">{details.strategicInsights.trendAlignment}</p>
              </div>
              
              <div className="p-4 rounded-xl backdrop-blur-sm border border-white/10 bg-white/5">
                <h4 className="font-bold mb-2 text-xs uppercase tracking-wider" style={{ color: COLORS.CYAN }}>Connectivity</h4>
                <p className="text-sm leading-relaxed text-white/90">{details.strategicInsights.connectivity}</p>
              </div>
               
              <div className="p-4 rounded-xl backdrop-blur-sm border border-white/10 bg-white/5">
                <h4 className="font-bold mb-2 text-xs uppercase tracking-wider" style={{ color: COLORS.CYAN }}>Economic Value</h4>
                <p className="text-sm leading-relaxed text-white/90">{details.strategicInsights.economicValue}</p>
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
               <p className="text-sm font-bold text-[#007892]">Google Trends API or PyTrends</p>
            </div>
          </div>
          
          <div className="h-[400px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={details.keywordData}
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
                  {details.keywordData.map((entry, index) => (
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

        {/* Automated Promotion Section */}
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-[#F5E5D1]">
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-[#007892] flex items-center gap-2">
                        Automated Promotion
                    </h2>
                    <p className="text-slate-500 mt-1">AI-generated content tailored for {selectedNotification.market}.</p>
                </div>
                <button className="px-4 py-2 bg-[#007892] text-white rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm hover:bg-[#006075] transition-colors">
                    <CheckCircle size={16} />
                    Generate Content for {selectedNotification.market}
                </button>
            </div>

            {/* Recommendation Banner */}
            <div className="bg-[#E0F7FA] border-l-4 border-[#007892] p-4 rounded-r-lg mb-8 flex items-start gap-3">
                <div className="p-1 bg-white rounded-full">
                    <TrendingUp size={16} color={COLORS.TEAL} />
                </div>
                <div>
                    <p className="font-bold text-[#007892] text-sm">Post Here First!</p>
                    <p className="text-sm text-[#007892]/80 mt-1">
                        For {selectedNotification.market}, the AI recommends prioritizing <strong className="text-[#007892]">{details.contentStrategy.platformRecommendation}</strong> for the best reach.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Captions Column */}
                <div>
                    <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-[#E0F7FA] flex items-center justify-center text-[#007892]">
                           <Copy size={14} />
                        </span>
                        AI-Generated Captions
                    </h3>
                    <div className="space-y-4">
                        {details.contentStrategy.generatedCaptions.map((item, idx) => (
                            <div key={idx} className="p-4 border border-[#F5E5D1] rounded-xl bg-[#FDFBF7] hover:border-[#62D2E0] transition-colors group cursor-pointer" onClick={() => setPostCaption(item.text + ' ' + item.hashtags.join(' '))}>
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs font-bold text-[#506E53] uppercase">{item.platform}</span>
                                    <Copy size={14} className="text-slate-300 group-hover:text-[#007892]" />
                                </div>
                                <p className="text-sm text-slate-700 leading-relaxed mb-3">
                                    {item.text}
                                </p>
                                <div className="flex flex-wrap gap-1">
                                    {item.hashtags.map((tag, tIdx) => (
                                        <span key={tIdx} className="text-[10px] text-[#007892] font-medium bg-white px-1.5 py-0.5 rounded-md border border-[#E0F7FA]">
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Visual Directions Column */}
                <div>
                    <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-[#E0F7FA] flex items-center justify-center text-[#007892]">
                           <Video size={14} />
                        </span>
                        Visual Content Directions
                    </h3>
                    <div className="space-y-4">
                        {details.contentStrategy.visualDirections.map((item, idx) => (
                            <div key={idx} className="p-4 border border-dashed border-[#506E53]/30 rounded-xl bg-white">
                                <span className="text-xs font-bold text-[#506E53] uppercase mb-1 block">{item.platform} {item.platform === 'Instagram' ? 'Photo/Reel' : 'Video'}</span>
                                <p className="text-sm text-slate-600 leading-relaxed">
                                    {item.direction}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>

        {/* Publish Your Post Section */}
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-[#F5E5D1]">
            <div className="flex justify-between items-center mb-6">
                 <h2 className="text-2xl font-bold text-[#007892]">Publish Your Post</h2>
                 {isPosted && (
                     <span className="text-sm font-bold text-[#506E53] flex items-center gap-1 animate-fade-in">
                         <CheckCircle size={16} /> Posted Successfully!
                     </span>
                 )}
            </div>
            
            <div className="space-y-6">
                {/* Caption Input */}
                <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Caption</label>
                    <textarea 
                        value={postCaption}
                        onChange={(e) => setPostCaption(e.target.value)}
                        placeholder="Write your caption or select one from above..."
                        className="w-full h-32 p-4 rounded-xl border-none focus:ring-2 focus:ring-[#62D2E0] focus:outline-none resize-none placeholder-[#FDFBF7]/50 text-base shadow-inner transition-all"
                        style={{ backgroundColor: COLORS.TEAL, color: COLORS.OFF_WHITE }} 
                    />
                </div>

                {/* Media Upload */}
                <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Promotional Media (Pubmat)</label>
                    <div className="space-y-3">
                      {mediaFiles.length > 0 && (
                        <div className="grid grid-cols-2 gap-3">
                          {mediaFiles.map((file, idx) => (
                             <div key={idx} className="relative p-3 bg-[#FDFBF7] border border-[#F5E5D1] rounded-lg flex items-center gap-2 group">
                                <div className="p-2 bg-white rounded-md text-[#007892]">
                                   {file.type.startsWith('video') ? <Video size={20} /> : <ImageIcon size={20} />}
                                </div>
                                <div className="flex-1 min-w-0">
                                   <p className="text-sm font-medium text-slate-700 truncate">{file.name}</p>
                                   <p className="text-xs text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                </div>
                                <button 
                                  onClick={() => removeFile(idx)}
                                  className="p-1 hover:bg-red-100 text-slate-400 hover:text-red-500 rounded transition-colors"
                                >
                                  <X size={16} />
                                </button>
                             </div>
                          ))}
                        </div>
                      )}
                      
                      <div 
                          onClick={() => fileInputRef.current?.click()}
                          className="h-24 border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-[#62D2E0] transition-all bg-white"
                          style={{ borderColor: COLORS.GOLD }}
                      >
                          <div className="flex items-center gap-2 text-[#007892] font-medium">
                              <Upload size={20} />
                              <span>{mediaFiles.length > 0 ? 'Add more files' : 'Upload photos or videos'}</span>
                          </div>
                          <p className="text-xs text-slate-400 mt-1">PNG, JPG, MP4</p>
                          <input 
                              type="file" 
                              ref={fileInputRef} 
                              className="hidden" 
                              multiple 
                              accept="image/*,video/*"
                              onChange={handleMediaUpload} 
                          />
                      </div>
                    </div>
                </div>

                {/* Platform Selection */}
                <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Select Platforms</label>
                    <div className="flex gap-3">
                        {['Facebook', 'Instagram', 'TikTok'].map(platform => (
                            <button
                                key={platform}
                                onClick={() => togglePlatform(platform)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                                    selectedPlatforms.includes(platform)
                                    ? 'bg-[#007892] text-white border-[#007892]'
                                    : 'bg-white text-slate-500 border-slate-200 hover:border-[#007892]'
                                }`}
                            >
                                {platform}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Post Button */}
                <button 
                    onClick={handlePost}
                    disabled={!postCaption || selectedPlatforms.length === 0 || isPosted}
                    className="w-full py-4 rounded-xl text-white font-bold text-lg flex items-center justify-center gap-2 hover:opacity-90 transition-opacity shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundColor: '#4F46E5' }} 
                >
                    <Send size={20} />
                    <span>{isPosted ? 'Posted!' : 'Post Now (Simulated)'}</span>
                </button>
            </div>
        </div>
      </div>
    );
  }

  // Main Feed View
  return (
    <div className="max-w-4xl mx-auto animate-fade-in space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-[#007892]">Home</h2>
        <p className="text-slate-500 mt-1">Weekly trend updates and market signals.</p>
      </div>

      <div className="space-y-4">
        {MOCK_NOTIFICATIONS.map((notif) => (
          <div 
            key={notif.id}
            onClick={() => setSelectedNotification(notif)}
            className="bg-white p-6 rounded-xl shadow-sm border border-[#F5E5D1] hover:shadow-md transition-all cursor-pointer group relative overflow-hidden"
          >
             {!notif.isRead && (
               <div className="absolute top-6 right-6 w-3 h-3 bg-[#D6A539] rounded-full animate-pulse"></div>
             )}
             
             <div className="flex items-start gap-4">
               <div className="p-3 rounded-full bg-[#E0F7FA] text-[#007892]">
                 <Bell size={24} />
               </div>
               <div className="flex-1">
                 <p className="text-xs font-bold text-[#506E53] uppercase tracking-wide mb-1">{notif.date}</p>
                 <h3 className="text-xl font-bold text-slate-800 group-hover:text-[#007892] transition-colors">
                   {notif.title}
                 </h3>
                 <p className="text-slate-500 mt-1">
                   New data detected for <span className="font-semibold text-slate-700">{notif.market}</span> showing rising interest in <span className="font-semibold text-slate-700">{notif.trend}</span>.
                 </p>
                 <div className="mt-4 flex items-center text-sm font-bold text-[#007892]">
                   View Weekly Report <ChevronRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform" />
                 </div>
               </div>
             </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LandingPage;