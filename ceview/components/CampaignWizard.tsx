import React, { useState, useRef } from 'react';
import { Upload, Sparkles, Globe, Clock, CheckCircle, RefreshCw, ChevronRight } from 'lucide-react';
import { COLORS, BUSINESS_CATEGORIES } from '../constants';
import { analyzeImageAndStrategy, generateCampaignContent, fileToGenerativePart } from '../services/geminiService';
import { AnalysisResult, GeneratedContent, Market } from '../types';

const CampaignWizard: React.FC = () => {
  const [step, setStep] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  
  // Step 1: Business Profile Inputs
  const [businessName, setBusinessName] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [keywords, setKeywords] = useState<string>('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [description, setDescription] = useState<string>(''); // "What they have to offer"
  
  // AI State
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null);
  const [selectedMarket, setSelectedMarket] = useState<Market>(Market.GLOBAL);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const runAnalysis = async () => {
    if (!imageFile || !description) return;
    setIsLoading(true);
    try {
      // Convert file for API
      const base64Data = await fileToGenerativePart(imageFile);
      // We pass the composite description including business context to the AI
      const fullContext = `Business Name: ${businessName}. Category: ${category}. Keywords: ${keywords}. Offerings: ${description}`;
      const result = await analyzeImageAndStrategy(base64Data, fullContext);
      setAnalysis(result);
      setSelectedMarket(result.suggestedMarket);
      setStep(2);
    } catch (e) {
      alert("Failed to analyze. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const runGeneration = async () => {
    if (!analysis) return;
    setIsLoading(true);
    try {
      const content = await generateCampaignContent(analysis, selectedMarket);
      setGeneratedContent(content);
      setStep(3);
    } catch (e) {
      alert("Failed to generate content.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-12">
      {/* Progress Stepper */}
      <div className="flex items-center justify-between px-10 py-6 bg-white rounded-2xl shadow-sm border border-[#F5E5D1]">
        {[
          { num: 1, label: "Business Profile" },
          { num: 2, label: "Strategy" },
          { num: 3, label: "Localization" },
          { num: 4, label: "Schedule" }
        ].map((s) => (
          <div key={s.num} className="flex flex-col items-center relative z-10">
            <div 
              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 ${
                step >= s.num ? 'text-white scale-110 shadow-lg' : 'text-slate-400 bg-slate-100'
              }`}
              style={{ backgroundColor: step >= s.num ? COLORS.TEAL : undefined }}
            >
              {step > s.num ? <CheckCircle size={20} /> : s.num}
            </div>
            <span className={`text-xs mt-2 font-medium ${step >= s.num ? 'text-[#007892]' : 'text-slate-400'}`}>
              {s.label}
            </span>
          </div>
        ))}
        {/* Connector Line */}
        <div className="absolute top-11 left-0 w-full h-0.5 bg-[#F5E5D1] -z-0" />
      </div>

      {/* Step 1: Business Profile & Ingestion */}
      {step === 1 && (
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-[#F5E5D1]">
          <h2 className="text-2xl font-bold text-[#007892] mb-6">Business Campaign Setup</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Left Column: Visuals */}
            <div className="space-y-4">
              <label className="block text-sm font-semibold text-slate-700">Cover Photo</label>
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="h-64 border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-[#62D2E0] transition-all overflow-hidden group relative"
                style={{ backgroundColor: '#FDFBF7', borderColor: COLORS.GOLD }}
              >
                {imagePreview ? (
                  <>
                     <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                     <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-medium">
                       Change Photo
                     </div>
                  </>
                ) : (
                  <>
                    <div className="p-4 bg-white rounded-full mb-3 shadow-md group-hover:scale-110 transition-transform">
                      <Upload size={24} color={COLORS.TEAL} />
                    </div>
                    <p className="text-[#007892] font-medium">Upload Cover Photo</p>
                    <p className="text-xs text-slate-400 mt-1">JPG, PNG up to 5MB</p>
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
            
            {/* Right Column: Business Details */}
            <div className="space-y-5">
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Business Name</label>
                <input 
                  type="text" 
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g. Serenity Dive Resort"
                  className="w-full p-3 rounded-lg border border-[#F5E5D1] focus:ring-2 focus:ring-[#007892] focus:outline-none bg-[#FDFBF7]"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Category</label>
                <select 
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full p-3 rounded-lg border border-[#F5E5D1] focus:ring-2 focus:ring-[#007892] focus:outline-none bg-[#FDFBF7]"
                >
                   <option value="">Select Category</option>
                   {BUSINESS_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Associated Keywords</label>
                <input 
                  type="text" 
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder="e.g. resort, cebu healing, filipino cuisine"
                  className="w-full p-3 rounded-lg border border-[#F5E5D1] focus:ring-2 focus:ring-[#007892] focus:outline-none bg-[#FDFBF7]"
                />
                <p className="text-xs text-slate-400 mt-1">Align these with Google Trends for better matching.</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">What do you offer?</label>
                <textarea 
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe your unique selling points, amenities, and atmosphere..."
                  className="w-full h-32 p-4 rounded-xl border-none focus:ring-2 focus:ring-[#62D2E0] focus:outline-none resize-none placeholder-[#FDFBF7]/50 text-base shadow-inner"
                  style={{ backgroundColor: COLORS.TEAL, color: COLORS.OFF_WHITE }} 
                />
              </div>
              
              <div className="pt-2">
                <button 
                  onClick={runAnalysis}
                  disabled={!imageFile || !description || !businessName || isLoading}
                  className="w-full py-4 rounded-xl text-white font-bold text-lg flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                  style={{ backgroundColor: COLORS.GOLD }}
                >
                  {isLoading ? (
                    <RefreshCw className="animate-spin" />
                  ) : (
                    <>
                      <Sparkles size={20} />
                      <span>Analyze with Gemini</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Strategy Match */}
      {step === 2 && analysis && (
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-[#F5E5D1]">
          <div className="flex items-center gap-3 mb-6">
             <div className="p-2 rounded-lg" style={{ backgroundColor: '#FDFBF7' }}>
               <Globe size={24} color={COLORS.TEAL} />
             </div>
             <h2 className="text-2xl font-bold text-[#007892]">Strategy Match</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div className="p-6 rounded-xl border border-[#F5E5D1]" style={{ backgroundColor: '#FDFBF7' }}>
              <h3 className="text-xs uppercase tracking-wider font-bold text-[#506E53] mb-4">Detected Selling Points</h3>
              <ul className="space-y-3">
                {analysis.sellingPoints.map((sp, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <CheckCircle size={18} color={COLORS.TEAL} className="mt-1 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-slate-800">{sp.point}</p>
                      <p className="text-sm text-slate-600">{sp.description}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="p-6 rounded-xl border border-[#D6A539] relative overflow-hidden text-white shadow-md" style={{ backgroundColor: COLORS.TEAL }}>
               <div className="absolute top-0 right-0 p-4 opacity-10">
                 <Globe size={100} color={COLORS.WHITE} />
               </div>
               <h3 className="text-xs uppercase tracking-wider font-bold text-[#62D2E0] mb-4">Recommended Market</h3>
               <div className="flex items-center gap-4 mb-4">
                 <div className="text-4xl font-bold text-[#F5E5D1]">{analysis.suggestedMarket}</div>
               </div>
               <div className="inline-block px-3 py-1 bg-[#D6A539] rounded-md text-white text-sm font-bold mb-3 shadow-sm">
                 Trending: {analysis.risingTrend}
               </div>
               <p className="text-white/80 text-sm italic">
                 "{analysis.marketReasoning}"
               </p>
            </div>
          </div>

          <div className="flex justify-end gap-4">
             <button 
               onClick={() => setStep(1)}
               className="px-6 py-3 rounded-xl border border-slate-200 text-slate-600 font-medium hover:bg-slate-50"
             >
               Back
             </button>
             <button 
               onClick={runGeneration}
               disabled={isLoading}
               className="px-6 py-3 rounded-xl text-white font-bold flex items-center gap-2 hover:opacity-90 shadow-lg"
               style={{ backgroundColor: COLORS.GOLD }}
             >
               {isLoading ? <RefreshCw className="animate-spin" /> : 'Generate Localized Content'}
             </button>
          </div>
        </div>
      )}

      {/* Step 3: Generative Localization */}
      {step === 3 && generatedContent && (
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-[#F5E5D1]">
           <div className="flex items-center gap-3 mb-6">
             <div className="p-2 rounded-lg" style={{ backgroundColor: '#FDFBF7' }}>
               <Sparkles size={24} color={COLORS.GOLD} />
             </div>
             <h2 className="text-2xl font-bold text-[#007892]">Generative Localization</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Preview Card */}
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-lg bg-white">
               <div className="p-3 border-b border-slate-100 flex items-center gap-2" style={{ backgroundColor: '#FDFBF7' }}>
                 <div className="w-8 h-8 rounded-full" style={{ backgroundColor: COLORS.TEAL }}></div>
                 <div className="h-4 w-24 bg-slate-200 rounded"></div>
               </div>
               {imagePreview && (
                 <div className="aspect-square w-full">
                    <img src={imagePreview} className="w-full h-full object-cover" />
                 </div>
               )}
               <div className="p-4 space-y-3">
                 <p className="text-slate-800 text-sm whitespace-pre-line">
                   {generatedContent.translation || generatedContent.caption}
                 </p>
                 <div className="flex flex-wrap gap-1">
                   {generatedContent.hashtags.map(tag => (
                     <span key={tag} className="text-xs font-medium" style={{ color: COLORS.TEAL }}>{tag} </span>
                   ))}
                 </div>
               </div>
            </div>

            {/* Details */}
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-slate-500 mb-2">English Original / Rationale</h3>
                <div className="p-4 rounded-lg text-slate-700 text-sm italic border border-[#F5E5D1]" style={{ backgroundColor: '#FDFBF7' }}>
                  "{generatedContent.caption}"
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-500 mb-2">Optimal Schedule (Predictive)</h3>
                <div className="p-4 rounded-lg border border-[#62D2E0] flex items-center gap-3" style={{ backgroundColor: '#E0F7FA' }}>
                   <Clock color={COLORS.TEAL} />
                   <div>
                     <p className="font-bold text-[#007892]">{generatedContent.suggestedTime}</p>
                     <p className="text-xs text-[#506E53]">Peak engagement window for {selectedMarket}</p>
                   </div>
                </div>
              </div>

              <div className="pt-8 flex flex-col gap-3">
                 <button 
                   onClick={() => setStep(4)}
                   className="w-full py-3 rounded-xl text-white font-bold hover:opacity-90 shadow-lg"
                   style={{ backgroundColor: COLORS.TEAL }}
                 >
                   Approve & Schedule
                 </button>
                 <button 
                   onClick={() => setStep(2)}
                   className="w-full py-3 rounded-xl text-slate-500 font-medium hover:bg-slate-50"
                 >
                   Regenerate
                 </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Completion */}
      {step === 4 && (
        <div className="bg-white p-12 rounded-2xl shadow-sm border border-[#F5E5D1] text-center">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6" style={{ backgroundColor: '#FDFBF7' }}>
            <CheckCircle size={40} color={COLORS.GREEN} />
          </div>
          <h2 className="text-3xl font-bold text-[#007892] mb-4">Campaign Scheduled!</h2>
          <p className="text-slate-500 max-w-md mx-auto mb-8">
            Your post has been queued for <strong>{generatedContent?.suggestedTime}</strong> targeting <strong>{selectedMarket}</strong>. 
            The Automated International Posting System will handle the dispatch.
          </p>
          <button 
            onClick={() => {
              setStep(1);
              setImageFile(null);
              setImagePreview(null);
              setDescription('');
              setBusinessName('');
              setCategory('');
              setKeywords('');
              setAnalysis(null);
              setGeneratedContent(null);
            }}
            className="px-8 py-3 rounded-xl text-white font-medium hover:opacity-90 shadow-lg"
            style={{ backgroundColor: COLORS.GOLD }}
          >
            Create Another Campaign
          </button>
        </div>
      )}
    </div>
  );
};

export default CampaignWizard;