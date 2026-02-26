import React, { useState, useRef } from 'react';
import { Upload, Sparkles, RefreshCw, Save, CheckCircle, Facebook, Instagram, Video, Linkedin, Youtube, Link2, Shield, X as XIcon, Edit2 } from 'lucide-react';
import { COLORS, BUSINESS_CATEGORIES, PLACEHOLDER_IMAGE } from '../constants';
import { generateOptimizedKeywords } from '../services/geminiService';

// X (Twitter) Logo
const XLogo = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4l11.733 16h4.267l-11.733 -16z" />
    <path d="M4 20l6.768 -6.768m2.46 -2.46l6.772 -6.772" />
  </svg>
);

interface Platform {
  id: string;
  name: string;
  icon: React.ReactNode;
  color: string;
  isConnected: boolean;
}

const BusinessProfile: React.FC = () => {
  const [isSaved, setIsSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Real State (Source of Truth)
  const [businessName, setBusinessName] = useState('Prime Properties Beach Resort & Spa');
  const [categories, setCategories] = useState<string[]>(['Beach Resort']);
  const [description, setDescription] = useState('Experience the epitome of luxury at Prime Properties. Nestled on a pristine white sand beach, our resort features overwater villas, a world-class spa, and breathtaking ocean views. Perfect for romantic getaways and luxury seekers looking for a tropical paradise.');
  const [imagePreview, setImagePreview] = useState<string | null>(PLACEHOLDER_IMAGE);
  const [keywords, setKeywords] = useState<string[]>(['Luxury Resort', 'Beachfront', 'Spa Retreat', 'Maldives Style']);
  
  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [tempBusinessName, setTempBusinessName] = useState('');
  const [tempCategories, setTempCategories] = useState<string[]>([]);
  const [tempDescription, setTempDescription] = useState('');
  const [tempImagePreview, setTempImagePreview] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Social Connect State
  const [platforms, setPlatforms] = useState<Platform[]>([
    { id: 'instagram', name: 'Instagram', icon: <Instagram size={32} />, color: '#E1306C', isConnected: true },
    { id: 'facebook', name: 'Facebook Page', icon: <Facebook size={32} />, color: '#1877F2', isConnected: false },
    { id: 'tiktok', name: 'TikTok', icon: <Video size={32} />, color: '#000000', isConnected: false },
    { id: 'twitter', name: 'X (Twitter)', icon: <XLogo />, color: '#14171A', isConnected: false },
    { id: 'linkedin', name: 'LinkedIn', icon: <Linkedin size={32} />, color: '#0A66C2', isConnected: false },
    { id: 'youtube', name: 'YouTube', icon: <Youtube size={32} />, color: '#FF0000', isConnected: false },
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
    setTempDescription(description);
    setTempImagePreview(imagePreview);
    setIsEditModalOpen(true);
  };

  const handleSaveProfile = () => {
    setBusinessName(tempBusinessName);
    setCategories(tempCategories);
    setDescription(tempDescription);
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

  // Social Connect Handlers
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
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-12">
      <div className="flex justify-between items-end mb-4">
        <div>
           <h2 className="text-2xl font-bold text-[#007892]">Business Profile</h2>
           <p className="text-slate-500 mt-1">Setup your digital twin and connect social accounts to allow CeView to calibrate opportunities.</p>
        </div>
        <div className="flex items-center gap-3">
            {isSaved && (
                <div className="flex items-center gap-2 text-[#506E53] font-bold bg-[#E6EEF1] px-4 py-2 rounded-full animate-fade-in">
                    <CheckCircle size={18} />
                    Saved Successfully
                </div>
            )}
            <button 
                onClick={openEditModal}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#007892] text-white rounded-lg font-bold shadow-sm hover:bg-[#006075] transition-colors"
            >
                <Edit2 size={18} />
                Edit Profile
            </button>
        </div>
      </div>

      <div className="bg-white p-8 rounded-2xl shadow-sm border border-[#F5E5D1]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Left Column: Visuals (Read-Only) */}
            <div className="space-y-4">
              <label className="block text-sm font-semibold text-slate-700">Cover Photo</label>
              <div 
                className="h-64 rounded-xl overflow-hidden border border-[#F5E5D1] bg-[#FDFBF7]"
              >
                {imagePreview ? (
                   <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400">
                    No Image
                  </div>
                )}
              </div>
            </div>
            
            {/* Right Column: Business Details (Read-Only) */}
            <div className="space-y-5">
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Business Name</label>
                <div className="w-full p-3 rounded-lg border border-transparent bg-[#FDFBF7] text-slate-800 font-medium text-lg">
                    {businessName}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Categories</label>
                <div className="w-full p-3 rounded-lg border border-transparent bg-[#FDFBF7] text-slate-800 flex flex-wrap gap-2">
                    {categories.length > 0 ? (
                        categories.map(cat => (
                            <span key={cat} className="px-2 py-1 bg-white border border-[#F5E5D1] rounded-md text-sm font-medium text-[#007892]">
                                {cat}
                            </span>
                        ))
                    ) : (
                        <span className="text-slate-400 italic">No categories selected</span>
                    )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">What do you offer?</label>
                <div 
                  className="w-full p-4 rounded-xl border border-transparent bg-[#FDFBF7] text-slate-700 leading-relaxed min-h-[128px]"
                >
                    {description}
                </div>
              </div>
            </div>
          </div>

          {/* AI Keywords Section */}
          <div className="mt-8 pt-6 border-t border-[#F5E5D1]">
             <div className="flex justify-between items-center mb-4">
                <div>
                   <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                       <Sparkles size={16} color={COLORS.GOLD} />
                       Associated Keywords (AI Generated)
                   </label>
                   <p className="text-xs text-slate-500 mt-1">We align your profile with real-time Google Trends.</p>
                </div>
                <button 
                  onClick={handleGenerateKeywords}
                  disabled={!description || isLoading}
                  className="text-sm font-bold text-[#007892] hover:text-[#62D2E0] flex items-center gap-1 disabled:opacity-50"
                >
                  {isLoading ? <RefreshCw className="animate-spin" size={16}/> : 'Generate Keywords'}
                </button>
             </div>

             <div className="p-4 rounded-xl bg-[#FDFBF7] border border-[#F5E5D1] min-h-[80px] flex flex-wrap gap-2 items-center">
                 {keywords.length === 0 && !isLoading && (
                     <span className="text-slate-400 text-sm italic">Enter a description and click generate to see aligned keywords...</span>
                 )}
                 {keywords.map((kw, i) => (
                     <span key={i} className="px-3 py-1 bg-white border border-[#62D2E0] text-[#007892] rounded-full text-sm font-medium shadow-sm animate-fade-in">
                         {kw}
                     </span>
                 ))}
             </div>
          </div>

          {/* SOCIAL CONNECTIONS SECTION - Merged Here */}
          <div className="mt-12 pt-8 border-t border-[#F5E5D1]">
             <div className="mb-6">
                <h3 className="text-lg font-bold text-[#007892]">Social Connections</h3>
                <p className="text-slate-500 text-sm mt-1">Connect your brand's accounts to enable automated posting and AI aggregation.</p>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {platforms.map(platform => (
                  <div 
                    key={platform.id} 
                    className={`p-6 rounded-2xl border transition-all duration-300 relative group ${
                      platform.isConnected 
                        ? 'bg-white border-[#506E53] shadow-md' 
                        : 'bg-white border-slate-200 hover:border-[#62D2E0] hover:shadow-sm'
                    }`}
                  >
                     {platform.isConnected && (
                       <div className="absolute top-4 right-4 text-[#506E53] animate-fade-in">
                         <CheckCircle size={20} fill="#E6F4EA" />
                       </div>
                     )}

                     <div className="mb-6 inline-flex p-4 rounded-full bg-slate-50" style={{ color: platform.color }}>
                        {platform.icon}
                     </div>
                     
                     <h3 className="text-lg font-bold text-slate-800 mb-1">{platform.name}</h3>
                     <p className="text-xs text-slate-400 mb-6">
                       {platform.isConnected ? 'Active & Syncing' : 'Not Connected'}
                     </p>

                     <button
                       onClick={() => handleConnectClick(platform)}
                       className={`w-full py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors ${
                         platform.isConnected 
                           ? 'bg-slate-100 text-slate-500 hover:bg-red-50 hover:text-red-500' 
                           : 'bg-slate-800 text-white hover:opacity-90'
               }`}
                     >
                       {platform.isConnected ? 'Disconnect' : 'Connect'}
                     </button>
                  </div>
                ))}
             </div>

             {/* Safety Note */}
             <div className="mt-8 bg-[#E0F7FA] border border-[#007892]/20 rounded-xl p-6 flex items-start gap-4">
                <div className="p-2 bg-white rounded-full text-[#007892]">
                  <Shield size={24} />
                </div>
                <div>
                  <h4 className="font-bold text-[#007892] text-sm uppercase tracking-wide mb-1">Transparency & Safety</h4>
                  <p className="text-slate-700 text-sm leading-relaxed">
                    We only post content you explicitly approve in the campaign wizard. We do not read your private messages or access personal data. You can disconnect any platform at any time.
                  </p>
                </div>
             </div>
          </div>
          
      </div>

      {/* EDIT MODAL */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
               <div className="flex items-center gap-2 font-bold text-slate-700 text-lg">
                  <Edit2 size={20} className="text-[#007892]" />
                  Edit Profile
               </div>
               <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                 <XIcon size={24} />
               </button>
            </div>

            {/* Modal Body */}
            <div className="p-8 overflow-y-auto">
               <div className="space-y-6">
                  {/* Image Upload in Modal */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Cover Photo</label>
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="h-48 border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-[#62D2E0] transition-all overflow-hidden group relative"
                      style={{ backgroundColor: '#FDFBF7', borderColor: COLORS.GOLD }}
                    >
                      {tempImagePreview ? (
                        <>
                           <img src={tempImagePreview} alt="Preview" className="w-full h-full object-cover opacity-60 group-hover:opacity-40 transition-opacity" />
                           <div className="absolute inset-0 flex items-center justify-center">
                             <span className="bg-white/80 px-4 py-2 rounded-full font-bold text-slate-700 shadow-sm">Change Photo</span>
                           </div>
                        </>
                      ) : (
                        <>
                          <div className="p-3 bg-white rounded-full mb-3 shadow-md">
                            <Upload size={24} color={COLORS.TEAL} />
                          </div>
                          <p className="text-[#007892] font-medium">Upload Cover Photo</p>
                        </>
                      )}
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept="image/*"
                        onChange={handleImageUpload}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Business Name</label>
                        <input 
                          type="text" 
                          value={tempBusinessName}
                          onChange={(e) => setTempBusinessName(e.target.value)}
                          placeholder="e.g. Serenity Dive Resort"
                          className="w-full p-3 rounded-lg border border-[#F5E5D1] focus:ring-2 focus:ring-[#007892] focus:outline-none bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Categories (Can select multiple)</label>
                        <div className="flex flex-wrap gap-2 p-3 rounded-lg border border-[#F5E5D1] bg-white min-h-[50px]">
                           {BUSINESS_CATEGORIES.map(cat => (
                               <button
                                  key={cat}
                                  onClick={() => toggleCategory(cat)}
                                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                                     tempCategories.includes(cat)
                                       ? 'bg-[#007892] text-white border-[#007892] shadow-sm'
                                       : 'bg-white text-slate-500 border-slate-200 hover:border-[#007892] hover:text-[#007892]'
                                  }`}
                               >
                                  {cat}
                               </button>
                           ))}
                        </div>
                      </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">What do you offer?</label>
                    <textarea 
                      value={tempDescription}
                      onChange={(e) => setTempDescription(e.target.value)}
                      placeholder="Describe your unique selling points, amenities, and atmosphere..."
                      className="w-full h-40 p-4 rounded-xl border border-[#F5E5D1] focus:ring-2 focus:ring-[#007892] focus:outline-none resize-none placeholder-slate-400 text-slate-700 text-base bg-white"
                    />
                  </div>
               </div>
            </div>

            {/* Modal Footer */}
            <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
               <button 
                 onClick={() => setIsEditModalOpen(false)}
                 className="px-6 py-2.5 rounded-xl border border-slate-300 text-slate-600 font-bold hover:bg-white transition-colors"
               >
                 Cancel
               </button>
               <button 
                 onClick={handleSaveProfile}
                 className="px-8 py-2.5 rounded-xl text-white font-bold hover:opacity-90 shadow-md transition-all"
                 style={{ backgroundColor: COLORS.GOLD }}
               >
                 Save Changes
               </button>
            </div>
          </div>
        </div>
      )}

      {/* Mock OAuth Modal */}
      {modalOpen && activePlatform && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
               <div className="flex items-center gap-2 font-semibold text-slate-700">
                  {authStep === 'permission' ? `Login with ${activePlatform.name}` : 'Connecting...'}
               </div>
               <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                 <XIcon size={20} />
               </button>
            </div>

            {/* Modal Body */}
            <div className="p-8 text-center flex-1 flex flex-col items-center justify-center min-h-[300px]">
               {authStep === 'loading' && (
                 <div className="flex flex-col items-center space-y-4">
                    <div className="relative">
                       <div className="w-16 h-16 rounded-full border-4 border-slate-100 animate-spin" style={{ borderTopColor: activePlatform.color }}></div>
                       <div className="absolute inset-0 flex items-center justify-center text-slate-300">
                          <Link2 size={24} />
                       </div>
                    </div>
                    <p className="text-slate-500 text-sm font-medium">Contacting {activePlatform.name}...</p>
                 </div>
               )}

               {authStep === 'permission' && (
                 <div className="w-full text-left space-y-6 animate-fade-in">
                    <div className="flex items-center gap-4 justify-center mb-6">
                       <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500">
                         <Shield size={24} />
                       </div>
                       <div className="h-px w-8 bg-slate-300"></div>
                       <div className="w-12 h-12 rounded-lg flex items-center justify-center text-white" style={{ backgroundColor: activePlatform.color }}>
                         {activePlatform.icon}
                       </div>
                    </div>

                    <div className="text-center mb-6">
                       <h3 className="text-xl font-bold text-slate-800">CeView requests access</h3>
                       <p className="text-sm text-slate-500 mt-1">Review the permissions below.</p>
                    </div>

                    <div className="space-y-3">
                       <div className="flex items-start gap-3 p-3 rounded-lg border border-slate-100 bg-slate-50">
                          <CheckCircle size={18} className="text-[#506E53] mt-0.5" />
                          <div>
                             <p className="text-sm font-bold text-slate-700">Publish content</p>
                             <p className="text-xs text-slate-500">Create posts, reels, and stories on your behalf.</p>
                          </div>
                       </div>
                       <div className="flex items-start gap-3 p-3 rounded-lg border border-slate-100 bg-slate-50">
                          <CheckCircle size={18} className="text-[#506E53] mt-0.5" />
                          <div>
                             <p className="text-sm font-bold text-slate-700">Access media library</p>
                             <p className="text-xs text-slate-500">Upload photos and videos for campaigns.</p>
                          </div>
                       </div>
                    </div>
                 </div>
               )}
            </div>

            {/* Modal Footer */}
            {authStep === 'permission' && (
              <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-3">
                 <button 
                   onClick={() => setModalOpen(false)}
                   className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-white transition-colors"
                 >
                   Cancel
                 </button>
                 <button 
                   onClick={confirmConnection}
                   className="flex-1 py-3 rounded-xl text-white font-bold hover:opacity-90 shadow-md transition-all"
                   style={{ backgroundColor: activePlatform.color }}
                 >
                   Allow Access
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