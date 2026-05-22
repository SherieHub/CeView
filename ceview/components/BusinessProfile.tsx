import React, { useState, useRef } from 'react';
import {
  Upload, Sparkles, RefreshCw, CheckCircle,
  Shield, X as XIcon, Edit2, Info, Plus
} from 'lucide-react';
import { COLORS, BUSINESS_CATEGORIES, PLACEHOLDER_IMAGE } from '../constants';
import { generateOptimizedKeywords } from '../services/geminiService';
import { ProfileData, ProfileSetters } from '../App';

interface Platform {
  id: string;
  name: string;
  icon: React.ReactNode;
  color: string;
  isConnected: boolean;
}

interface BusinessProfileProps {
  profile: ProfileData;
  setters: ProfileSetters;
}

const BusinessProfile: React.FC<BusinessProfileProps> = ({ profile, setters }) => {
  const [isSaved, setIsSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Real State (sourced from shared App-level state via props)
  const { businessName, categories, coreServices, description, uvp, imagePreview } = profile;
  const { setBusinessName, setCategories, setCoreServices, setDescription, setUvp, setImagePreview } = setters;

  const [keywords, setKeywords] = useState<string[]>([]);

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [tempBusinessName, setTempBusinessName] = useState('');
  const [tempCategories, setTempCategories] = useState<string[]>([]);
  const [tempCoreServices, setTempCoreServices] = useState<string[]>([]);
  const [tempDescription, setTempDescription] = useState('');
  const [tempUvp, setTempUvp] = useState('');
  const [tempImagePreview, setTempImagePreview] = useState<string | null>(null);
  const [coreServiceDraft, setCoreServiceDraft] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Unified Local Image Assets for Social Connection Hooks
  const [platforms, setPlatforms] = useState<Platform[]>([
    { id: 'instagram', name: 'Instagram', icon: <img src="/assets/instagram.svg" alt="Instagram" className="w-8 h-8 block mx-auto object-contain" />, color: '#0F2854', isConnected: true },
    { id: 'facebook', name: 'Facebook Page', icon: <img src="/assets/facebook.svg" alt="Facebook" className="w-8 h-8 block mx-auto object-contain" />, color: '#0F2854', isConnected: false },
    { id: 'tiktok', name: 'TikTok', icon: <img src="/assets/tiktok.svg" alt="TikTok" className="w-8 h-8 block mx-auto object-contain" />, color: '#0F2854', isConnected: false },
    { id: 'naver', name: 'Naver Blog', icon: <img src="/assets/naver.svg" alt="Naver Blog" className="w-8 h-8 block mx-auto object-contain" />, color: '#0F2854', isConnected: false },
  ]);
  
  const [modalOpen, setModalOpen] = useState(false);
  const [activePlatform, setActivePlatform] = useState<Platform | null>(null);
  const [authStep, setAuthStep] = useState<'loading' | 'permission'>('loading');

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = () => setTempImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleGenerateKeywords = async () => {
    if (!description || categories.length === 0) return;
    setIsLoading(true);
    try {
        const generated = await generateOptimizedKeywords(description, categories.join(', '), businessName);
        setKeywords(generated);
    } catch (error) {
        console.error(error);
    } finally {
        setIsLoading(false);
    }
  };

  const openEditModal = () => {
    setTempBusinessName(businessName);
    setTempCategories([...categories]);
    setTempCoreServices([...coreServices]);
    setTempDescription(description);
    setTempUvp(uvp);
    setTempImagePreview(imagePreview);
    setCoreServiceDraft('');
    setIsEditModalOpen(true);
  };

  const handleSaveProfile = () => {
    setBusinessName(tempBusinessName);
    setCategories(tempCategories);
    setCoreServices(tempCoreServices);
    setDescription(tempDescription);
    setUvp(tempUvp);
    setImagePreview(tempImagePreview);
    setIsEditModalOpen(false);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const toggleCategory = (cat: string) => {
    if (tempCategories.includes(cat)) {
      setTempCategories(prev => prev.filter(c => c !== cat));
    } else {
      setTempCategories(prev => [...prev, cat]);
    }
  };

  const addCoreService = () => {
    const value = coreServiceDraft.trim();
    if (!value || tempCoreServices.includes(value)) {
      setCoreServiceDraft('');
      return;
    }
    setTempCoreServices(prev => [...prev, value]);
    setCoreServiceDraft('');
  };

  const removeCoreService = (svc: string) => {
    setTempCoreServices(prev => prev.filter(s => s !== svc));
  };

  const handleConnectClick = (platform: Platform) => {
    if (platform.isConnected) {
      setPlatforms(prev => prev.map(p => p.id === platform.id ? { ...p, isConnected: false } : p));
    } else {
      setActivePlatform(platform);
      setModalOpen(true);
      setAuthStep('loading');
      setTimeout(() => {
        setAuthStep('permission');
      }, 1500);
    }
  };

  const confirmConnection = () => {
    if (activePlatform) {
      setPlatforms(prev => prev.map(p => p.id === activePlatform.id ? { ...p, isConnected: true } : p));
      setModalOpen(false);
      setActivePlatform(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6" style={{ backgroundColor: COLORS.CREAM, minHeight: '100vh' }}>
      
      {/* ══ CORE HEADER BLOCK ══ */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
           <h1 className="text-3xl font-black tracking-tight leading-none" style={{ color: COLORS.NAVY }}>Business Profile</h1>
           <p className="text-sm font-medium mt-1.5" style={{ color: COLORS.TEXT_MUTED }}>
             Setup your digital twin and connect social accounts to allow CeView to calibrate target opportunities.
           </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
            {isSaved && (
                <div className="flex items-center gap-2 font-black text-xs uppercase tracking-wider px-4 py-2.5 rounded-xl border animate-fade-in" style={{ backgroundColor: COLORS.GREEN_LIGHT, borderColor: `${COLORS.GREEN}30`, color: COLORS.GREEN }}>
                    <CheckCircle size={14} />
                    Changes Saved Successfully
                </div>
            )}
            <button 
                onClick={openEditModal}
                className="flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all hover:scale-105 shadow-md hover:opacity-90"
                style={{ backgroundColor: COLORS.NAVY, color: COLORS.WHITE }}
            >
                <Edit2 size={14} />
                Edit Profile
            </button>
        </div>
      </div>

      {/* ══ PROFILE DATA BOX ══ */}
      <div className="rounded-2xl shadow-sm border overflow-hidden p-6 md:p-8" style={{ backgroundColor: COLORS.WHITE, borderColor: COLORS.LIGHT_GREY }}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Left Frame: Cover Art Visuals */}
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-wider block" style={{ color: COLORS.TEXT_MUTED }}>Cover Photo / Identity Asset</label>
              <div className="h-72 rounded-2xl overflow-hidden border shadow-inner bg-slate-50" style={{ borderColor: COLORS.LIGHT_GREY }}>
                {imagePreview ? (
                   <img src={imagePreview} alt="Preview" className="w-full h-full object-cover block" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-center p-4">
                    <p className="text-sm font-bold" style={{ color: COLORS.TEXT_MUTED }}>No Image Attached</p>
                  </div>
                )}
              </div>
            </div>
            
            {/* Right Frame: Active Parameters */}
            <div className="space-y-5">
              <div>
                <label className="text-xs font-black uppercase tracking-wider block mb-1.5" style={{ color: COLORS.TEXT_MUTED }}>Business Name</label>
                <div className="w-full p-4 rounded-xl font-black text-lg border" style={{ backgroundColor: COLORS.CREAM, borderColor: COLORS.LIGHT_GREY, color: COLORS.NAVY }}>
                    {businessName}
                </div>
              </div>

              <div>
                <label className="text-xs font-black uppercase tracking-wider block mb-1.5" style={{ color: COLORS.TEXT_MUTED }}>Active Operational Categories</label>
                <div className="w-full p-3.5 rounded-xl border flex flex-wrap gap-2" style={{ backgroundColor: COLORS.CREAM, borderColor: COLORS.LIGHT_GREY }}>
                    {categories.length > 0 ? (
                        categories.map(cat => (
                            <span key={cat} className="px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider border" style={{ backgroundColor: COLORS.WHITE, borderColor: COLORS.LIGHT_GREY, color: COLORS.TEAL }}>
                                {cat}
                            </span>
                        ))
                    ) : (
                        <span className="text-xs font-bold italic" style={{ color: COLORS.TEXT_MUTED }}>No operational domains specified</span>
                    )}
                </div>
              </div>

              <div>
                <label className="text-xs font-black uppercase tracking-wider block mb-1.5" style={{ color: COLORS.TEXT_MUTED }}>Core Service Offerings</label>
                <div className="w-full p-3.5 rounded-xl border flex flex-wrap gap-2" style={{ backgroundColor: COLORS.CREAM, borderColor: COLORS.LIGHT_GREY }}>
                    {coreServices.length > 0 ? (
                        coreServices.map((service, i) => (
                            <span key={i} className="px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider border" style={{ backgroundColor: COLORS.WHITE, borderColor: COLORS.LIGHT_GREY, color: COLORS.TEAL }}>
                                • {service}
                            </span>
                        ))
                    ) : (
                        <span className="text-xs font-bold italic" style={{ color: COLORS.TEXT_MUTED }}>No core services specified</span>
                    )}
                </div>
              </div>

            </div>
          </div>

          {/* Full Description + UVP — full-width 2-column row below the top grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8 items-stretch">
            <div className="flex flex-col">
              <label className="text-xs font-black uppercase tracking-wider block mb-1.5" style={{ color: COLORS.TEXT_MUTED }}>Full Description</label>
              <div className="flex-1 w-full p-4 rounded-xl border text-sm font-medium leading-relaxed min-h-[120px]" style={{ backgroundColor: COLORS.CREAM, borderColor: COLORS.LIGHT_GREY, color: COLORS.TEXT_MAIN }}>
                  {description || <span className="italic" style={{ color: COLORS.TEXT_MUTED }}>No description provided</span>}
              </div>
            </div>

            <div className="flex flex-col">
              <label className="text-xs font-black uppercase tracking-wider block mb-1.5" style={{ color: COLORS.TEXT_MUTED }}>Unique Value Proposition</label>
              <div className="flex-1 w-full p-4 rounded-xl border text-sm font-medium leading-relaxed min-h-[120px]" style={{ backgroundColor: COLORS.CREAM, borderColor: COLORS.LIGHT_GREY, color: COLORS.TEXT_MAIN }}>
                  {uvp || <span className="italic" style={{ color: COLORS.TEXT_MUTED }}>No value proposition defined</span>}
              </div>
            </div>
          </div>

          {/* 🧠 ASSOCIATED AI KEYWORDS LAYER */}
          <div className="mt-8 pt-6 border-t" style={{ borderColor: COLORS.LIGHT_GREY }}>
             <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                   <label className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5" style={{ color: COLORS.NAVY }}>
                       <Sparkles size={14} style={{ color: COLORS.GOLD, fill: COLORS.GOLD }} />
                       Associated Search Keywords (AI Generated)
                   </label>
                   <p className="text-xs font-medium mt-0.5" style={{ color: COLORS.TEXT_MUTED }}>These identifiers sync your profile data directly with regional market demand vectors.</p>
                </div>
                <button 
                  onClick={handleGenerateKeywords}
                  disabled={!description || isLoading}
                  className="text-xs font-black uppercase tracking-wider transition-colors flex items-center gap-1.5 disabled:opacity-40 shrink-0 self-start sm:self-center"
                  style={{ color: COLORS.TEAL }}
                >
                  {isLoading ? <RefreshCw className="animate-spin" size={14}/> : <><RefreshCw size={14} /> Recalibrate Keywords</>}
                </button>
             </div>

             <div className="p-4 rounded-xl border min-h-[76px] flex flex-wrap gap-2 items-center" style={{ backgroundColor: COLORS.CREAM, borderColor: COLORS.LIGHT_GREY }}>
                 {keywords.length === 0 && !isLoading && (
                     <span className="text-xs font-bold italic" style={{ color: COLORS.TEXT_MUTED }}>Input descriptive parameters and execute keyword assignment above...</span>
                 )}
                 {keywords.map((kw, i) => (
                     <span key={i} className="px-3 py-1.5 bg-white border rounded-full text-xs font-black uppercase tracking-wider shadow-2xs animate-fade-in" style={{ borderColor: COLORS.LIGHT_GREY, color: COLORS.NAVY }}>
                         #{kw}
                     </span>
                 ))}
             </div>
          </div>
      </div>

      {/* ══ SOCIAL NETWORK HUB ══ */}
      <div className="rounded-2xl shadow-sm border overflow-hidden p-6 md:p-8" style={{ backgroundColor: COLORS.WHITE, borderColor: COLORS.LIGHT_GREY }}>
         <div className="mb-6">
            <h2 className="text-base font-black leading-tight" style={{ color: COLORS.NAVY }}>Social Platform Connections</h2>
            <p className="text-xs font-bold uppercase tracking-wider mt-0.5" style={{ color: COLORS.TEXT_MUTED }}>OAuth Authorization Matrix</p>
         </div>

         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {platforms.map(platform => (
              <div 
                key={platform.id} 
                className="p-5 rounded-2xl border text-center transition-all duration-300 relative flex flex-col items-center min-h-[220px]"
                style={{
                  borderColor: platform.isConnected ? COLORS.NAVY : COLORS.LIGHT_GREY,
                  backgroundColor: platform.isConnected ? 'rgba(15,40,84,0.03)' : COLORS.CREAM,
                  boxShadow: platform.isConnected ? `0 4px 16px ${COLORS.NAVY}15` : 'none',
                }}
              >
                 {platform.isConnected && (
                   <div className="absolute top-3 right-3 text-[#506E53] animate-fade-in">
                     <CheckCircle size={18} style={{ fill: COLORS.GREEN, color: COLORS.WHITE }} />
                   </div>
                 )}

                 <div className="mb-4 p-4 rounded-xl bg-white border flex items-center justify-center h-16 w-16" style={{ borderColor: COLORS.LIGHT_GREY }}>
                    {platform.icon}
                 </div>
                 
                 <p className="text-sm font-black mb-0.5" style={{ color: COLORS.NAVY }}>{platform.name}</p>
                 <p className="text-[10px] font-black uppercase tracking-wider mb-5" style={{ color: platform.isConnected ? COLORS.GREEN : COLORS.TEXT_MUTED }}>
                   {platform.isConnected ? 'Sync Active' : 'Disconnected'}
                 </p>

                 <button
                   onClick={() => handleConnectClick(platform)}
                   className="w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all mt-auto"
                   style={{ 
                     backgroundColor: platform.isConnected ? COLORS.CREAM : COLORS.NAVY, 
                     color: platform.isConnected ? COLORS.TEXT_DARK : COLORS.WHITE,
                     border: platform.isConnected ? `1.5px solid ${COLORS.LIGHT_GREY}` : 'none'
                   }}
                 >
                   {platform.isConnected ? 'Disconnect' : 'Authorize Link'}
                 </button>
              </div>
            ))}
         </div>

         {/* Security Architecture Box */}
         <div className="mt-6 p-4 rounded-xl border flex items-start gap-3.5" style={{ backgroundColor: COLORS.GOLD_LIGHT, borderColor: `${COLORS.GOLD}30` }}>
            <div className="p-2 bg-white rounded-xl shadow-2xs shrink-0" style={{ color: COLORS.NAVY }}>
              <Shield size={18} />
            </div>
            <div>
              <h4 className="font-black text-xs uppercase tracking-wider mb-1" style={{ color: COLORS.TEXT_MAIN }}>Secure API Ingestion & Guardrails</h4>
              <p className="text-xs font-medium leading-relaxed" style={{ color: COLORS.TEXT_MUTED }}>
                CeView aggregates high-level platform analytics logs via strict read/write authorization bounds. Automated posts are queued strictly within manual confirmation flows. Opaque data profiling and third-party consumer exposure matrices are completely blocked.
              </p>
            </div>
         </div>
      </div>

      {/* ══ BACKSTAGE INTERACTION MODAL (EDIT MODAL) ══ */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] border" style={{ borderColor: COLORS.LIGHT_GREY }}>
            
            {/* Header */}
            <div className="p-5 border-b flex justify-between items-center bg-slate-50" style={{ borderColor: COLORS.LIGHT_GREY }}>
               <div className="flex items-center gap-2 font-black text-base" style={{ color: COLORS.NAVY }}>
                  <Edit2 size={16} />
                  Modify Profile Framework
               </div>
               <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                 <XIcon size={20} />
               </button>
            </div>

            {/* Content Core */}
            <div className="p-6 md:p-8 overflow-y-auto space-y-6">
                  <div>
                    <label className="text-xs font-black uppercase tracking-wider block mb-2" style={{ color: COLORS.TEXT_MUTED }}>Identity Cover Asset</label>
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="h-44 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden relative group"
                      style={{ backgroundColor: COLORS.CREAM, borderColor: COLORS.LIGHT_GREY }}
                    >
                      {tempImagePreview ? (
                        <>
                           <img src={tempImagePreview} alt="Preview" className="w-full h-full object-cover opacity-70 group-hover:opacity-40 transition-opacity" />
                           <div className="absolute inset-0 flex items-center justify-center">
                             <span className="bg-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider shadow-sm" style={{ color: COLORS.NAVY }}>Change Resource Photo</span>
                           </div>
                        </>
                      ) : (
                        <>
                          <div className="p-3 bg-white rounded-xl mb-2 shadow-2xs">
                            <Upload size={18} style={{ color: COLORS.TEAL }} />
                          </div>
                          <p className="text-xs font-black uppercase tracking-wider" style={{ color: COLORS.TEAL }}>Stream Asset Stream</p>
                        </>
                      )}
                      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-black uppercase tracking-wider block mb-1.5" style={{ color: COLORS.TEXT_MUTED }}>Business Entity Label</label>
                        <input 
                          type="text" 
                          value={tempBusinessName}
                          onChange={(e) => setTempBusinessName(e.target.value)}
                          className="w-full p-3 rounded-xl border text-sm font-semibold focus:outline-none"
                          style={{ borderColor: COLORS.LIGHT_GREY, color: COLORS.TEXT_MAIN }}
                        />
                      </div>

                      <div>
                        <label className="text-xs font-black uppercase tracking-wider block mb-1.5" style={{ color: COLORS.TEXT_MUTED }}>Domain Classifications</label>
                        <div className="flex flex-wrap gap-1.5 p-2 rounded-xl border bg-white min-h-[46px]" style={{ borderColor: COLORS.LIGHT_GREY }}>
                           {BUSINESS_CATEGORIES.map(cat => {
                               const active = tempCategories.includes(cat);
                               return (
                                 <button
                                    key={cat}
                                    onClick={() => toggleCategory(cat)}
                                    className="px-2.5 py-1 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all border"
                                    style={{
                                       backgroundColor: active ? COLORS.NAVY : COLORS.WHITE,
                                       color: active ? COLORS.WHITE : COLORS.TEXT_MUTED,
                                       borderColor: active ? COLORS.NAVY : COLORS.LIGHT_GREY
                                    }}
                                 >
                                    {cat}
                                 </button>
                               );
                           })}
                        </div>
                      </div>
                  </div>

                  <div>
                    <label className="text-xs font-black uppercase tracking-wider block mb-1.5" style={{ color: COLORS.TEXT_MUTED }}>Core Service Offerings</label>
                    <div className="p-2 rounded-xl border bg-white space-y-2" style={{ borderColor: COLORS.LIGHT_GREY }}>
                       <div className="flex flex-wrap gap-1.5 min-h-[34px]">
                          {tempCoreServices.length === 0 && (
                             <span className="text-xs font-bold italic px-1 py-1" style={{ color: COLORS.TEXT_MUTED }}>No core services added yet</span>
                          )}
                          {tempCoreServices.map(svc => (
                             <span key={svc} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-black uppercase tracking-wider border" style={{ backgroundColor: COLORS.NAVY, color: COLORS.WHITE, borderColor: COLORS.NAVY }}>
                                • {svc}
                                <button type="button" onClick={() => removeCoreService(svc)} className="hover:opacity-70">
                                   <XIcon size={11} />
                                </button>
                             </span>
                          ))}
                       </div>
                       <div className="flex gap-2 pt-1.5 border-t" style={{ borderColor: COLORS.LIGHT_GREY }}>
                          <input
                            type="text"
                            value={coreServiceDraft}
                            onChange={(e) => setCoreServiceDraft(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCoreService(); } }}
                            placeholder="Add a service offering..."
                            className="flex-1 px-3 py-1.5 rounded-lg border text-xs font-semibold focus:outline-none"
                            style={{ borderColor: COLORS.LIGHT_GREY, color: COLORS.TEXT_MAIN }}
                          />
                          <button
                            type="button"
                            onClick={addCoreService}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-colors"
                            style={{ backgroundColor: COLORS.TEAL, color: COLORS.WHITE }}
                          >
                            <Plus size={12} />
                            Add
                          </button>
                       </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-black uppercase tracking-wider block mb-1.5" style={{ color: COLORS.TEXT_MUTED }}>Marketing Profile Description</label>
                    <textarea
                      value={tempDescription}
                      onChange={(e) => setTempDescription(e.target.value)}
                      className="w-full h-32 p-4 rounded-xl border font-medium text-sm leading-relaxed resize-none focus:outline-none"
                      style={{ borderColor: COLORS.LIGHT_GREY, color: COLORS.TEXT_MAIN }}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-black uppercase tracking-wider block mb-1.5" style={{ color: COLORS.TEXT_MUTED }}>Unique Value Proposition</label>
                    <textarea
                      value={tempUvp}
                      onChange={(e) => setTempUvp(e.target.value)}
                      className="w-full h-28 p-4 rounded-xl border font-medium text-sm leading-relaxed resize-none focus:outline-none"
                      style={{ borderColor: COLORS.LIGHT_GREY, color: COLORS.TEXT_MAIN }}
                    />
                  </div>
            </div>

            {/* Footer */}
            <div className="p-5 border-t bg-slate-50 flex justify-end gap-3" style={{ borderColor: COLORS.LIGHT_GREY }}>
               <button 
                 onClick={() => setIsEditModalOpen(false)}
                 className="px-5 py-2.5 rounded-xl border text-xs font-black uppercase tracking-wider bg-white transition-colors"
                 style={{ color: COLORS.TEXT_MUTED, borderColor: COLORS.LIGHT_GREY }}
               >
                 Dismiss
               </button>
               <button 
                 onClick={handleSaveProfile}
                 className="px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md hover:opacity-90"
                 style={{ backgroundColor: COLORS.GOLD, color: COLORS.WHITE }}
               >
                 Commit Profile Data
               </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ SECURE DATA AUTHORIZATION STAGE MODAL (OAUTH PREVIEW) ══ */}
      {modalOpen && activePlatform && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col max-h-[90vh] border" style={{ borderColor: COLORS.LIGHT_GREY }}>
            
            <div className="p-4 border-b flex justify-between items-center bg-slate-50" style={{ borderColor: COLORS.LIGHT_GREY }}>
               <div className="text-xs font-black uppercase tracking-wider" style={{ color: COLORS.TEXT_MUTED }}>
                  {authStep === 'permission' ? `OAuth 2.0 Client Redirect` : 'Handshaking...'}
               </div>
               <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                 <XIcon size={18} />
               </button>
            </div>

            <div className="p-6 text-center flex-1 flex flex-col items-center justify-center min-h-[260px]">
               {authStep === 'loading' && (
                 <div className="space-y-3">
                    <div className="w-10 h-10 rounded-full border-4 border-slate-100 animate-spin mx-auto" style={{ borderTopColor: COLORS.NAVY }}></div>
                    <p className="text-xs font-bold" style={{ color: COLORS.TEXT_MUTED }}>Resolving callback token indices...</p>
                 </div>
               )}

               {authStep === 'permission' && (
                 <div className="w-full text-left space-y-4 animate-fade-in">
                    <div className="flex items-center gap-3 justify-center mb-4">
                       <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500 border" style={{ borderColor: COLORS.LIGHT_GREY }}>
                         <Shield size={18} />
                       </div>
                       <div className="h-0.5 w-6 bg-slate-200"></div>
                       <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white border" style={{ borderColor: COLORS.NAVY }}>
                         {activePlatform.icon}
                       </div>
                    </div>

                    <div className="text-center mb-4">
                       <h3 className="text-base font-black" style={{ color: COLORS.NAVY }}>Scope Access Requests</h3>
                       <p className="text-xs font-medium mt-0.5" style={{ color: COLORS.TEXT_MUTED }}>CeView is asking to negotiate secure tokens.</p>
                    </div>

                    <div className="space-y-2">
                       <div className="flex items-start gap-2.5 p-3 rounded-xl border bg-slate-50/50">
                          <CheckCircle size={15} className="mt-0.5 shrink-0" style={{ color: COLORS.GREEN }} />
                          <div>
                             <p className="text-xs font-black" style={{ color: COLORS.TEXT_MAIN }}>Automated Asset Publishing</p>
                             <p className="text-[11px] font-medium" style={{ color: COLORS.TEXT_MUTED }}>Enables scheduled layout dispatching to the platform feed.</p>
                          </div>
                       </div>
                       <div className="flex items-start gap-2.5 p-3 rounded-xl border bg-slate-50/50">
                          <CheckCircle size={15} className="mt-0.5 shrink-0" style={{ color: COLORS.GREEN }} />
                          <div>
                             <p className="text-xs font-black" style={{ color: COLORS.TEXT_MAIN }}>Telemetry & Metrics Querying</p>
                             <p className="text-[11px] font-medium" style={{ color: COLORS.TEXT_MUTED }}>Pulls aggregated impression logs for Phase 5 reporting loops.</p>
                          </div>
                       </div>
                    </div>
                 </div>
               )}
            </div>

            {authStep === 'permission' && (
              <div className="p-4 border-t bg-slate-50 flex gap-3" style={{ borderColor: COLORS.LIGHT_GREY }}>
                 <button 
                   onClick={() => setModalOpen(false)}
                   className="flex-1 py-2.5 rounded-xl border text-xs font-black uppercase tracking-wider bg-white"
                   style={{ color: COLORS.TEXT_MUTED, borderColor: COLORS.LIGHT_GREY }}
                 >
                   Cancel
                 </button>
                 <button 
                   onClick={confirmConnection}
                   className="flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all shadow-md hover:opacity-90"
                   style={{ backgroundColor: COLORS.NAVY }}
                 >
                   Grant Scope
                 </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default BusinessProfile;