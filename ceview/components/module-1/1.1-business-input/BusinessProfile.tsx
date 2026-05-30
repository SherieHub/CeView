import React, { useState, useRef } from 'react';
import {
  Upload, Sparkles, CheckCircle,
  Shield, X as XIcon, Edit2, Plus, User, Link2
} from 'lucide-react';
import { COLORS, BUSINESS_CATEGORIES } from '../../../constants';
import { api } from '../../../services/apiClient';
import { OPERATOR_ID } from '../../../services/identity';
import { ProfileData, ProfileSetters } from '../../../App';
import ServerErrorBanner from '../../shared/ServerErrorBanner';

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

const DESC_MIN_WORDS = 50;
const UVP_MIN_WORDS  = 30;

const countWords = (text: string): number =>
  text.trim() ? text.trim().split(/\s+/).length : 0;

const BusinessProfile: React.FC<BusinessProfileProps> = ({ profile, setters }) => {
  const [isSaved, setIsSaved] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const { businessProfileId, businessName, categories, coreServices, description, uvp, imagePreview, uniquenessScore } = profile;
  const {
    setBusinessProfileId, setBusinessName, setCategories, setCoreServices,
    setDescription, setUvp, setImagePreview, setUniquenessScore,
  } = setters;

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [tempBusinessName, setTempBusinessName] = useState('');
  const [tempCategories, setTempCategories] = useState<string[]>([]);
  const [tempCoreServices, setTempCoreServices] = useState<string[]>([]);
  const [tempDescription, setTempDescription] = useState('');
  const [tempUvp, setTempUvp] = useState('');
  const [tempImagePreview, setTempImagePreview] = useState<string | null>(null);
  const [coreServiceDraft, setCoreServiceDraft] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [platforms, setPlatforms] = useState<Platform[]>([
    { id: 'instagram', name: 'Instagram', icon: <img src="/assets/instagram.svg" alt="Instagram" className="w-5 h-5 object-contain" />, color: '#0F2854', isConnected: true },
    { id: 'facebook', name: 'Facebook', icon: <img src="/assets/facebook.svg" alt="Facebook" className="w-5 h-5 object-contain" />, color: '#0F2854', isConnected: false },
    { id: 'tiktok', name: 'TikTok', icon: <img src="/assets/tiktok.svg" alt="TikTok" className="w-5 h-5 object-contain" />, color: '#0F2854', isConnected: false },
  ]);

  const [modalOpen, setModalOpen] = useState(false);
  const [activePlatform, setActivePlatform] = useState<Platform | null>(null);
  const [authStep, setAuthStep] = useState<'loading' | 'permission'>('loading');

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = () => setTempImagePreview(reader.result as string);
      reader.readAsDataURL(e.target.files[0]);
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
    setServerError(null);
    setTimeout(() => setIsSaved(false), 3000);

    api.saveProfile(OPERATOR_ID, {
      businessProfileId,
      businessName: tempBusinessName,
      categories: tempCategories,
      coreServices: tempCoreServices,
      description: tempDescription,
      uvp: tempUvp,
      imagePreview: tempImagePreview,
      uniquenessScore,
    })
      .then(saved => {
        setBusinessProfileId(saved.businessProfileId);
        setUniquenessScore(saved.uniquenessScore);
      })
      .catch(e => {
        console.error('saveProfile failed', e);
        setServerError('Profile could not be saved. Backend sync failed.');
      });
  };

  const handleConnectClick = (platform: Platform) => {
    if (platform.isConnected) {
      setPlatforms(prev => prev.map(p => p.id === platform.id ? { ...p, isConnected: false } : p));
    } else {
      setActivePlatform(platform);
      setModalOpen(true);
      setAuthStep('loading');
      setTimeout(() => setAuthStep('permission'), 1500);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-8 animate-fade-in" style={{ backgroundColor: COLORS.CREAM, minHeight: '100vh' }}>

      {serverError && <ServerErrorBanner message={serverError} onDismiss={() => setServerError(null)} />}

      {/* ══ HEADER ══ */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
           <h1 className="text-2xl md:text-3xl font-black tracking-tight leading-none" style={{ color: COLORS.NAVY }}>Executive Profile</h1>
           <p className="text-sm font-medium mt-1.5" style={{ color: COLORS.TEXT_MUTED }}>
             Manage your verified business identity, operational footprint, and social API assets.
           </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 shrink-0">
            {uniquenessScore != null && (
                <div className="flex items-center gap-2 font-black text-xs uppercase tracking-wider px-4 py-2.5 rounded-xl border" style={{ backgroundColor: COLORS.GOLD_LIGHT, borderColor: `${COLORS.GOLD}40`, color: COLORS.NAVY }}>
                    <Sparkles size={14} /> Uniqueness {Math.round(uniquenessScore)}
                </div>
            )}
            {isSaved && (
                <div className="flex items-center gap-2 font-black text-xs uppercase tracking-wider px-4 py-2.5 rounded-xl border animate-fade-in" style={{ backgroundColor: COLORS.GREEN_LIGHT, borderColor: `${COLORS.GREEN}30`, color: COLORS.GREEN }}>
                    <CheckCircle size={14} /> Saved Successfully
                </div>
            )}
            <button onClick={openEditModal} className="flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-wider shadow-md hover:opacity-90 transition-all" style={{ backgroundColor: COLORS.NAVY, color: COLORS.WHITE }}>
                <Edit2 size={14} /> Edit Identity
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 items-start">

        {/* ══ LEFT: IDENTITY CARD ══ */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
           <div className="h-48 bg-slate-100 relative border-b border-slate-100">
              {imagePreview ? <img src={imagePreview} className="w-full h-full object-cover" alt="Cover" /> : <div className="absolute inset-0 flex items-center justify-center"><Upload className="opacity-20" size={32}/></div>}
           </div>

           <div className="p-4 md:p-8">
              <div className="flex items-end gap-4 -mt-16 mb-8 relative z-10">
                 <div className="w-20 h-20 md:w-24 md:h-24 bg-white rounded-2xl shadow-lg border border-slate-100 flex items-center justify-center shrink-0">
                     <User size={36} style={{ color: COLORS.NAVY }} />
                 </div>
                 <div className="pb-2">
                     <h2 className="text-xl md:text-2xl font-black leading-tight" style={{ color: COLORS.NAVY }}>{businessName || 'Unnamed Entity'}</h2>
                     <div className="flex items-center gap-1.5 mt-1">
                       <Shield size={12} style={{ color: COLORS.GREEN }} />
                       <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Verified Identity</p>
                     </div>
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                 <section>
                   <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Executive Overview</label>
                   <div className="text-sm leading-relaxed text-slate-700 bg-slate-50/50 p-4 rounded-xl border border-slate-100 min-h-[120px]">
                     {description || <span className="italic text-slate-400">Profile description is pending calibration...</span>}
                   </div>
                 </section>
                 <section>
                   <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Unique Value Proposition</label>
                   <div className="text-sm font-medium leading-relaxed p-4 rounded-xl border min-h-[120px]" style={{ backgroundColor: COLORS.GOLD_LIGHT, borderColor: `${COLORS.GOLD}30`, color: COLORS.NAVY }}>
                     {uvp || <span className="italic opacity-60">Value proposition not established...</span>}
                   </div>
                 </section>
              </div>

           </div>
        </div>

        {/* ══ RIGHT: OPERATIONS & SOCIAL ══ */}
        <div className="space-y-6">

           <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
             <h3 className="text-xs font-black uppercase tracking-widest mb-4" style={{ color: COLORS.NAVY }}>Operational Domains</h3>
             <div className="flex flex-wrap gap-2">
                {categories.length > 0 ? categories.map((cat, i) => (
                  <span key={i} className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border shadow-sm" style={{ backgroundColor: COLORS.NAVY, color: COLORS.WHITE, borderColor: COLORS.NAVY }}>
                     {cat}
                  </span>
                )) : <span className="text-xs italic text-slate-400">No categories inferred.</span>}
             </div>
           </div>

           <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
             <h3 className="text-xs font-black uppercase tracking-widest mb-4" style={{ color: COLORS.NAVY }}>Service Topology</h3>
             <div className="flex flex-col gap-2">
                {coreServices.length > 0 ? coreServices.map((svc, i) => (
                  <div key={i} className="px-3 py-2.5 rounded-lg text-xs font-bold border border-slate-100 bg-slate-50 text-slate-700 flex items-center before:content-[''] before:w-1.5 before:h-1.5 before:bg-teal-500 before:rounded-full before:mr-2.5 shadow-2xs">
                     {svc}
                  </div>
                )) : <span className="text-xs italic text-slate-400">No core services defined.</span>}
             </div>
           </div>

           <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
             <h3 className="text-xs font-black uppercase tracking-widest mb-4 flex items-center gap-2" style={{ color: COLORS.NAVY }}>
                <Link2 size={14} style={{ color: COLORS.TEAL }} /> API Social Hub
             </h3>
             <div className="space-y-3">
                {platforms.map(platform => (
                  <div key={platform.id} className="flex items-center justify-between p-3 rounded-lg border transition-all" style={{ backgroundColor: platform.isConnected ? '#F0FDF4' : COLORS.OFF_WHITE, borderColor: platform.isConnected ? '#BBF7D0' : COLORS.LIGHT_GREY }}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 flex items-center justify-center bg-white rounded-md border border-slate-200 shadow-2xs">
                         {platform.icon}
                      </div>
                      <div>
                         <p className="text-xs font-bold text-slate-700">{platform.name}</p>
                         <p className="text-[9px] font-black uppercase tracking-wider" style={{ color: platform.isConnected ? COLORS.GREEN : COLORS.TEXT_MUTED }}>{platform.isConnected ? 'Connected' : 'Pending'}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleConnectClick(platform)}
                      className="text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-md transition-all shadow-sm"
                      style={{ backgroundColor: platform.isConnected ? COLORS.WHITE : COLORS.NAVY, color: platform.isConnected ? COLORS.TEXT_MUTED : COLORS.WHITE, border: platform.isConnected ? '1px solid #E2E8F0' : 'none' }}>
                      {platform.isConnected ? 'Disconnect' : 'Connect'}
                    </button>
                  </div>
                ))}
             </div>
           </div>

        </div>
      </div>

      {/* ══ EDIT IDENTITY MODAL ══ */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-xs p-0 sm:p-4 animate-fade-in">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl overflow-hidden flex flex-col max-h-[95vh] sm:max-h-[90vh] border" style={{ borderColor: COLORS.LIGHT_GREY }}>
            <div className="p-5 border-b flex justify-between items-center bg-slate-50" style={{ borderColor: COLORS.LIGHT_GREY }}>
               <div className="flex items-center gap-2 font-black text-base" style={{ color: COLORS.NAVY }}><Edit2 size={16} /> Modify Profile Framework</div>
               <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-600"><XIcon size={20} /></button>
            </div>

            <div className="p-4 md:p-8 overflow-y-auto space-y-6">
                <div>
                  <label className="text-xs font-black uppercase tracking-wider block mb-2" style={{ color: COLORS.TEXT_MUTED }}>Identity Cover Asset</label>
                  <div onClick={() => fileInputRef.current?.click()} className="h-44 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer overflow-hidden relative group" style={{ backgroundColor: COLORS.CREAM, borderColor: COLORS.LIGHT_GREY }}>
                    {tempImagePreview ? (
                      <><img src={tempImagePreview} alt="Preview" className="w-full h-full object-cover opacity-70 group-hover:opacity-40" />
                        <span className="absolute bg-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider shadow-sm" style={{ color: COLORS.NAVY }}>Change Image</span></>
                    ) : (
                      <><div className="p-3 bg-white rounded-xl mb-2 shadow-2xs"><Upload size={18} style={{ color: COLORS.TEAL }} /></div>
                        <p className="text-xs font-black uppercase tracking-wider" style={{ color: COLORS.TEAL }}>Upload Asset</p></>
                    )}
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-black uppercase tracking-wider block mb-1.5" style={{ color: COLORS.TEXT_MUTED }}>Business Entity Label</label>
                      <input type="text" value={tempBusinessName} onChange={(e) => setTempBusinessName(e.target.value)} className="w-full p-3 rounded-xl border text-sm font-semibold focus:outline-none" style={{ borderColor: COLORS.LIGHT_GREY, color: COLORS.TEXT_MAIN }} />
                    </div>
                    <div>
                      <label className="text-xs font-black uppercase tracking-wider block mb-1.5" style={{ color: COLORS.TEXT_MUTED }}>Domain Classifications</label>
                      <div className="flex flex-wrap gap-1.5 p-2 rounded-xl border bg-white min-h-[46px]" style={{ borderColor: COLORS.LIGHT_GREY }}>
                         {BUSINESS_CATEGORIES.map(cat => {
                             const active = tempCategories.includes(cat);
                             return (
                               <button key={cat} onClick={() => setTempCategories(prev => active ? prev.filter(c => c !== cat) : [...prev, cat])} className="px-2.5 py-1 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all border" style={{ backgroundColor: active ? COLORS.NAVY : COLORS.WHITE, color: active ? COLORS.WHITE : COLORS.TEXT_MUTED, borderColor: active ? COLORS.NAVY : COLORS.LIGHT_GREY }}>
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
                        {tempCoreServices.map(svc => (
                           <span key={svc} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-black uppercase tracking-wider border" style={{ backgroundColor: COLORS.NAVY, color: COLORS.WHITE, borderColor: COLORS.NAVY }}>
                              • {svc} <button type="button" onClick={() => setTempCoreServices(prev => prev.filter(s => s !== svc))} className="hover:opacity-70"><XIcon size={11} /></button>
                           </span>
                        ))}
                     </div>
                     <div className="flex gap-2 pt-1.5 border-t" style={{ borderColor: COLORS.LIGHT_GREY }}>
                        <input type="text" value={coreServiceDraft} onChange={(e) => setCoreServiceDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if(coreServiceDraft) { setTempCoreServices(prev=>[...prev, coreServiceDraft]); setCoreServiceDraft('');} } }} placeholder="Add a service offering..." className="flex-1 px-3 py-1.5 rounded-lg border text-xs font-semibold focus:outline-none" style={{ borderColor: COLORS.LIGHT_GREY, color: COLORS.TEXT_MAIN }} />
                        <button type="button" onClick={() => { if(coreServiceDraft) { setTempCoreServices(prev=>[...prev, coreServiceDraft]); setCoreServiceDraft(''); } }} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-colors" style={{ backgroundColor: COLORS.TEAL, color: COLORS.WHITE }}><Plus size={12} /> Add</button>
                     </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-black uppercase tracking-wider block mb-1.5" style={{ color: COLORS.TEXT_MUTED }}>Marketing Profile Description</label>
                  <textarea
                    value={tempDescription}
                    onChange={(e) => setTempDescription(e.target.value)}
                    className="w-full h-32 p-4 rounded-xl border font-medium text-sm leading-relaxed resize-none focus:outline-none"
                    style={{
                      borderColor: tempDescription.trim() && countWords(tempDescription) < DESC_MIN_WORDS ? '#EF4444' : countWords(tempDescription) >= DESC_MIN_WORDS ? '#10B981' : COLORS.LIGHT_GREY,
                      color: COLORS.TEXT_MAIN,
                    }}
                  />
                  <p className="text-[11px] font-bold mt-1 text-right" style={{ color: countWords(tempDescription) >= DESC_MIN_WORDS ? '#10B981' : tempDescription.trim() ? '#EF4444' : COLORS.TEXT_MUTED }}>
                    {countWords(tempDescription)} / {DESC_MIN_WORDS} words {countWords(tempDescription) >= DESC_MIN_WORDS ? '✓' : `(${DESC_MIN_WORDS - countWords(tempDescription)} more needed)`}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-black uppercase tracking-wider block mb-1.5" style={{ color: COLORS.TEXT_MUTED }}>Unique Value Proposition</label>
                  <textarea
                    value={tempUvp}
                    onChange={(e) => setTempUvp(e.target.value)}
                    className="w-full h-28 p-4 rounded-xl border font-medium text-sm leading-relaxed resize-none focus:outline-none"
                    style={{
                      borderColor: tempUvp.trim() && countWords(tempUvp) < UVP_MIN_WORDS ? '#EF4444' : countWords(tempUvp) >= UVP_MIN_WORDS ? '#10B981' : COLORS.LIGHT_GREY,
                      color: COLORS.TEXT_MAIN,
                    }}
                  />
                  <p className="text-[11px] font-bold mt-1 text-right" style={{ color: countWords(tempUvp) >= UVP_MIN_WORDS ? '#10B981' : tempUvp.trim() ? '#EF4444' : COLORS.TEXT_MUTED }}>
                    {countWords(tempUvp)} / {UVP_MIN_WORDS} words {countWords(tempUvp) >= UVP_MIN_WORDS ? '✓' : `(${UVP_MIN_WORDS - countWords(tempUvp)} more needed)`}
                  </p>
                </div>
            </div>

            <div className="p-5 border-t bg-slate-50 flex justify-end gap-3" style={{ borderColor: COLORS.LIGHT_GREY }}>
               <button onClick={() => setIsEditModalOpen(false)} className="px-5 py-2.5 rounded-xl border text-xs font-black uppercase tracking-wider bg-white transition-colors" style={{ color: COLORS.TEXT_MUTED, borderColor: COLORS.LIGHT_GREY }}>Dismiss</button>
               <button
                 onClick={handleSaveProfile}
                 disabled={countWords(tempDescription) < DESC_MIN_WORDS || countWords(tempUvp) < UVP_MIN_WORDS}
                 title={countWords(tempDescription) < DESC_MIN_WORDS || countWords(tempUvp) < UVP_MIN_WORDS ? `Description needs ${DESC_MIN_WORDS} words and UVP needs ${UVP_MIN_WORDS} words.` : undefined}
                 className="px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                 style={{ backgroundColor: COLORS.GOLD, color: COLORS.WHITE }}
               >
                 Commit Profile Data
               </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ OAUTH AUTHORIZATION MODAL ══ */}
      {modalOpen && activePlatform && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-xs p-0 sm:p-4 animate-fade-in">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-sm overflow-hidden flex flex-col max-h-[95vh] sm:max-h-[90vh] border" style={{ borderColor: COLORS.LIGHT_GREY }}>
            <div className="p-4 border-b flex justify-between items-center bg-slate-50" style={{ borderColor: COLORS.LIGHT_GREY }}>
               <div className="text-xs font-black uppercase tracking-wider" style={{ color: COLORS.TEXT_MUTED }}>{authStep === 'permission' ? `OAuth 2.0 Client Redirect` : 'Handshaking...'}</div>
               <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600"><XIcon size={18} /></button>
            </div>

            <div className="p-6 text-center flex-1 flex flex-col items-center justify-center min-h-[260px]">
               {authStep === 'loading' && (
                 <div className="space-y-3"><div className="w-10 h-10 rounded-full border-4 border-slate-100 animate-spin mx-auto" style={{ borderTopColor: COLORS.NAVY }}></div><p className="text-xs font-bold" style={{ color: COLORS.TEXT_MUTED }}>Resolving callback token indices...</p></div>
               )}
               {authStep === 'permission' && (
                 <div className="w-full text-left space-y-4 animate-fade-in">
                    <div className="flex items-center gap-3 justify-center mb-4">
                       <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500 border" style={{ borderColor: COLORS.LIGHT_GREY }}><Shield size={18} /></div>
                       <div className="h-0.5 w-6 bg-slate-200"></div>
                       <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white border" style={{ borderColor: COLORS.NAVY }}>{activePlatform.icon}</div>
                    </div>
                    <div className="text-center mb-4"><h3 className="text-base font-black" style={{ color: COLORS.NAVY }}>Scope Access Requests</h3><p className="text-xs font-medium mt-0.5" style={{ color: COLORS.TEXT_MUTED }}>CeView is asking to negotiate secure tokens.</p></div>
                    <div className="space-y-2">
                       <div className="flex items-start gap-2.5 p-3 rounded-xl border bg-slate-50/50"><CheckCircle size={15} className="mt-0.5 shrink-0" style={{ color: COLORS.GREEN }} /><div><p className="text-xs font-black" style={{ color: COLORS.TEXT_MAIN }}>Automated Asset Publishing</p><p className="text-[11px] font-medium" style={{ color: COLORS.TEXT_MUTED }}>Enables scheduled layout dispatching to the platform feed.</p></div></div>
                       <div className="flex items-start gap-2.5 p-3 rounded-xl border bg-slate-50/50"><CheckCircle size={15} className="mt-0.5 shrink-0" style={{ color: COLORS.GREEN }} /><div><p className="text-xs font-black" style={{ color: COLORS.TEXT_MAIN }}>Telemetry & Metrics Querying</p><p className="text-[11px] font-medium" style={{ color: COLORS.TEXT_MUTED }}>Pulls aggregated impression logs for Phase 5 reporting loops.</p></div></div>
                    </div>
                 </div>
               )}
            </div>
            {authStep === 'permission' && (
              <div className="p-4 border-t bg-slate-50 flex gap-3" style={{ borderColor: COLORS.LIGHT_GREY }}>
                 <button onClick={() => setModalOpen(false)} className="flex-1 py-2.5 rounded-xl border text-xs font-black uppercase tracking-wider bg-white" style={{ color: COLORS.TEXT_MUTED, borderColor: COLORS.LIGHT_GREY }}>Cancel</button>
                 <button onClick={() => { setPlatforms(prev => prev.map(p => p.id === activePlatform.id ? { ...p, isConnected: true } : p)); setModalOpen(false); setActivePlatform(null); }} className="flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all shadow-md hover:opacity-90" style={{ backgroundColor: COLORS.NAVY }}>Grant Scope</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default BusinessProfile;
