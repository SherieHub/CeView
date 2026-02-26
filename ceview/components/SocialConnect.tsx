import React, { useState } from 'react';
import { Facebook, Instagram, Video, Linkedin, Youtube, Link2, CheckCircle, Shield, AlertCircle, X as XIcon } from 'lucide-react';
import { COLORS } from '../constants';

// X (Twitter) Logo replacement since Lucide might not have the new X logo yet, or we use a generic placeholder
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

const SocialConnect: React.FC = () => {
  const [platforms, setPlatforms] = useState<Platform[]>([
    { id: 'instagram', name: 'Instagram', icon: <Instagram size={32} />, color: '#E1306C', isConnected: false },
    { id: 'facebook', name: 'Facebook Page', icon: <Facebook size={32} />, color: '#1877F2', isConnected: false },
    { id: 'tiktok', name: 'TikTok', icon: <Video size={32} />, color: '#000000', isConnected: false },
    { id: 'twitter', name: 'X (Twitter)', icon: <XLogo />, color: '#14171A', isConnected: false },
    { id: 'linkedin', name: 'LinkedIn', icon: <Linkedin size={32} />, color: '#0A66C2', isConnected: false },
    { id: 'youtube', name: 'YouTube', icon: <Youtube size={32} />, color: '#FF0000', isConnected: false },
  ]);

  const [modalOpen, setModalOpen] = useState(false);
  const [activePlatform, setActivePlatform] = useState<Platform | null>(null);
  const [authStep, setAuthStep] = useState<'loading' | 'permission'>('loading');

  const handleConnectClick = (platform: Platform) => {
    if (platform.isConnected) {
      // Disconnect Logic
      setPlatforms(prev => prev.map(p => p.id === platform.id ? { ...p, isConnected: false } : p));
    } else {
      // Connect Logic
      setActivePlatform(platform);
      setModalOpen(true);
      setAuthStep('loading');
      
      // Simulate network delay for "Connecting to..."
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
    <div className="max-w-4xl mx-auto animate-fade-in space-y-8 pb-12 relative">
      <div>
        <h2 className="text-3xl font-bold text-[#007892]">Connect Your Social Accounts</h2>
        <p className="text-slate-500 mt-1">To enable automated posting and AI-driven aggregation, link your brand's accounts.</p>
      </div>

      {/* Platforms Grid */}
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
      <div className="bg-[#E0F7FA] border border-[#007892]/20 rounded-xl p-6 flex items-start gap-4">
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
                       <h3 className="text-xl font-bold text-slate-800">CebView requests access</h3>
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

export default SocialConnect;