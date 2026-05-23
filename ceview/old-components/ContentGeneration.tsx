import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  Copy, CheckCircle, AlertTriangle, UploadCloud, Share2,
  Sparkles, Eye, Zap, Hash, Check, X, Shield, ArrowLeft,
  ToggleLeft, ToggleRight
} from "lucide-react";
import { COLORS } from '../constants';

/* ─────────────────────────────────────────────
   MOCK DATA
───────────────────────────────────────────── */
const MOCK = {
  market:    { country: 'South Korea', flag: '🇰🇷', city: 'Seoul' },
  framework: 'SOR — Stimulus-Organism-Response',
  captions: {
    instagram: {
      options: [
        "Burned out? ☁️ Find your pause button in Cebu. Warm breeze, healing food, and time that moves slower. 🛌✨ You deserve this rest.\n\n#HealingTrip #Cebu #Wellness #RestAndRelax #CebuPhilippines #HealingVacation #TravelAesthetic",
        "The ultimate 'Me Time' hideaway. 🌿 Discovering Cebu's secret healing spots where the wifi is weak but the connection to nature is strong. 🍃✨\n\n#HealingTrip #Cebu #CebuTravel #NatureRetreat #MindfulTravel",
        "Nothing but blue skies and private pools. 💧 Escaping the Seoul rush hour for this slice of paradise. Who would you bring here? ✈️\n\n#CebuPhilippines #TravelAesthetic #RestAndRelax #LuxuryCebu #HealingJourney"
      ],
      guide: [
        "Aesthetic Mood Shot — open balcony doors, zero clutter, morning sunlight on tropical fruits beside a plunge pool.",
        "Apply warm, low-contrast golden filters (lightroom preset LUT recommended: 'Mango Sunrise').",
        "Recommended ratio: 4:5 portrait — maximizes feed real-estate on Korean Instagram feeds.",
        "Soft vignette, no text overlay. Let the image breathe completely.",
        "Cultural nuance: avoid showing other guests — solo 'me-space' framing resonates strongly with Korean healing-travel archetype.",
      ],
    },
    tiktok: {
      options: [
        "POV: You just woke up in paradise. 🌊 No alarms, just ocean sounds. This is your sign to book that healing trip. ✈️🇵🇭\n\n#TravelTok #Cebu #HealingVibes #Philippines #HealingTrip #POVTravel",
        "Stop scrolling and take a deep breath. 🌬️ This is what 6AM in Cebu looks like. Healing energy only. ☁️✨\n\n#HealingVibes #Cebu2025 #TravelTok #MorningRoutine #Philippines",
        "The Cebu aesthetic you didn't know you needed. 🥥 Wait for the sunset reveal at the end... 🌅\n\n#POVTravel #HealingTrip #Philippines #HiddenGem #Cebu"
      ],
      guide: [
        "Slow-motion first-person POV tracking shot. Start tight on a local delicacy (Pungko-Pungko or mango slicing).",
        "Pan smoothly upward to reveal a crisp ocean panorama — the 'reveal' moment is the hook.",
        "Keep ambient sound prominent; sync video rhythm to chill lo-fi acoustic track.",
        "Duration target: 18–27 seconds — optimal for Korean TikTok algorithm retention window.",
        "Add Korean subtitle overlay at bottom third. Font: rounded sans, white with soft shadow.",
      ],
    },
    facebook: {
      options: [
        "🌅 Imagine waking up to this every morning. Cebu is calling — are you ready to answer?\n\nPerfect for a healing retreat, reconnection journey, or simply the rest you've been postponing. Our Cebu Healing Coast Package is designed for you.\n\n📍 Cebu, Philippines  🌊 3D2N from ₩890,000\n\n#CebuTravel #HealingDestination #VisitCebu #PhilippinesTravel",
        "Looking for a quiet escape this weekend? 🌴 Swap your busy schedule for a slow morning in Cebu. Tag a friend who desperately needs a healing vacation! 👇\n\n📍 Cebu Healing Coast\n🌊 Book now and save 15% on early bird packages.\n\n#CebuTravel #VisitCebu #HealingDestination #BarkadaTrip",
      ],
      guide: [
        "Wide establishing shot of coastline at golden hour — captures the 'breath of relief' emotional entry point.",
        "Include a human element (silhouette, hands holding coffee) to trigger empathy and projection.",
        "Facebook favors horizontal 16:9 frame for organic reach; include destination tag overlay at upper-left.",
        "Use warm, slightly desaturated tones — not oversaturated tropical clichés.",
        "CTA text in caption: 'Plan your escape →' — drives link-click micro-conversion on Facebook.",
      ],
    },
    naver: {
      options: [
        "세부에서 찾은 나만의 힐링 스팟 🌴\n\n바쁜 일상에서 벗어나, 필리핀 세부에서 진정한 휴식을 경험했어요. 따뜻한 바람, 맑은 바다, 그리고 느린 시간...\n\n세부 여행 완전 정복 가이드는 본문에서 확인하세요! 💙\n\n#세부여행 #필리핀여행 #힐링여행 #세부맛집 #여행스타그램 #세부2025",
        "직장인 필수 코스! 세부 프라이빗 리조트 3박 4일 힐링 후기 ✈️\n\n매일 야근에 지쳐있다가 드디어 떠난 세부 여행! 시끄러운 관광지 대신 조용히 쉬기 좋은 숨겨진 보석 같은 곳을 발견했습니다. 나만 알고 싶은 세부 힐링 숙소 추천 리스트를 공개합니다. 💙\n\n#세부여행 #세부프라이빗리조트 #필리핀여행 #직장인휴가 #힐링여행"
      ],
      guide: [
        "Long-form editorial blog layout — Korean audiences expect deep photo-journaling, not quick posts.",
        "Lead with a 3×2 hero image collage grid — establishes visual authority before text.",
        "Include food close-ups, accommodation review shots, and activity documentation shots sequentially.",
        "Write in warm, conversational Korean (반말체 adjusted for blog persona) with clear subheadings.",
        "Minimum 1,500 characters with embedded map — Naver SEO depends heavily on content depth.",
      ],
    },
  },
  compliance: {
    score: 88,
    aligned: [
      "Destination tags are correctly added so travelers can easily find your location.",
      "Text is clear and very easy to read against the background image.",
      "Important text is placed exactly where Korean travelers naturally look first.",
      "Words like 'healing' and 'rest' perfectly match what your target audience wants to see.",
    ],
    gaps: [
      "The background looks a bit too crowded or messy. Try using a cleaner, simpler image.",
      "Missing words that suggest a 'fresh start' or 'new beginning', which Korean tourists love.",
      "No people are visible in the photo. Adding a person helps travelers imagine themselves there.",
    ],
  },
};

const PLATFORMS = [
  { id: 'instagram', label: 'Instagram', icon: <img src="/assets/instagram.svg" alt="Instagram" className="w-[18px] h-[18px] block shrink-0"/> },
  { id: 'tiktok',   label: 'TikTok', icon: <img src="/assets/tiktok.svg" alt="TikTok" className="w-[18px] h-[18px] block shrink-0"/> },
  { id: 'facebook', label: 'Facebook', icon: <img src="/assets/facebook.svg" alt="Facebook" className="w-[18px] h-[18px] block shrink-0"/>},
  { id: 'naver',    label: 'Naver Blog', icon: <img src="/assets/naver.svg" alt="Naver Blog" className="w-[18px] h-[18px] block shrink-0"/>},
];

const CHANNELS = [
  { id: 'instagram', label: 'Instagram',  icon: <img src="/assets/instagram.svg" alt="Instagram" className="w-[32px] h-[32px] block mx-auto"/>, handle: '@cebutravel_kr',   verified: true },
  { id: 'tiktok',   label: 'TikTok', icon: <img src="/assets/tiktok.svg" alt="TikTok" className="w-[32px] h-[32px] block mx-auto"/>, handle: '@cebuhealing',     verified: true },
  { id: 'facebook', label: 'Facebook', icon: <img src="/assets/facebook.svg" alt="Facebook" className="w-[32px] h-[32px] block mx-auto"/>, handle: 'CebuTourismKR',    verified: false },
  { id: 'naver',    label: 'Naver Blog', icon: <img src="/assets/naver.svg" alt="Naver Blog" className="w-[32px] h-[32px] block mx-auto"/>, handle: '세부관광블로그',   verified: true },
];

const AUDIT_STEPS = [
  { label: 'Looking at the image background and layout...',    at: 15  },
  { label: 'Checking if the text is easy to read...',          at: 35  },
  { label: 'Reading the words in your image...',               at: 55  },
  { label: 'Comparing your post to what Korean tourists like...', at: 75  },
  { label: 'Scoring your post based on our marketing rules...',  at: 90  },
  { label: 'Putting together your simple feedback report...',    at: 100 },
];

/* ─────────────────────────────────────────────
   SUB-COMPONENTS
───────────────────────────────────────────── */
function CircularScore({ score }: { score: number }) {
  const r    = 52;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const col  = score >= 80 ? COLORS.GREEN : score >= 60 ? COLORS.GOLD : COLORS.RED_ORANGE;
  
  return (
    <div className="relative mx-auto" style={{ width: 136, height: 136 }}>
      <svg width="136" height="136" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="68" cy="68" r={r} fill="none" stroke={COLORS.LIGHT_GREY} strokeWidth="9" />
        <circle
          cx="68" cy="68" r={r} fill="none"
          stroke={col} strokeWidth="9"
          strokeDasharray={`${fill} ${circ}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1.6s cubic-bezier(0.22,1,0.36,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-black leading-none tracking-tight" style={{ color: col }}>{score}%</span>
        <span className="text-[9px] font-black tracking-widest mt-1" style={{ color: COLORS.TEXT_MUTED }}>COMPLIANCE</span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────── */
export default function ContentGeneration({ onBack }: { onBack?: () => void }) {
  const [activeTab,        setActiveTab]        = useState('instagram');
  const [copiedId,         setCopiedId]         = useState<string | null>(null);
  const [stagedCaption,    setStagedCaption]    = useState<string>(""); // Staged workspace state tracking 
  const [uploadedFile,     setUploadedFile]     = useState<File | null>(null);
  const [previewUrl,       setPreviewUrl]       = useState<string | null>(null);
  const [isDragging,       setIsDragging]       = useState(false);
  const [auditOn,          setAuditOn]          = useState(false);
  const [auditRunning,     setAuditRunning]     = useState(false);
  const [auditDone,        setAuditDone]        = useState(false);
  const [auditProgress,    setAuditProgress]    = useState(0);
  const [selectedChannels, setSelectedChannels] = useState(new Set(['instagram']));
  const [posted,           setPosted]           = useState(false);

  const fileRef     = useRef<HTMLInputElement>(null);
  const timerRef    = useRef<any>(null);
  
  const platform = MOCK.captions[activeTab as keyof typeof MOCK.captions];

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setStagedCaption(text); // Automatically mirrors copied text down into the staging card component workspace
      setTimeout(() => setCopiedId(null), 2200);
    });
  };

  const ingestFile = (file?: File | null) => {
    if (!file || !file.type.startsWith('image/')) return;
    setUploadedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setAuditDone(false);
    setAuditProgress(0);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    ingestFile(e.dataTransfer.files[0]);
  }, []);

  const runAudit = () => {
    clearInterval(timerRef.current);
    setAuditRunning(true);
    setAuditDone(false);
    setAuditProgress(0);
    let prog = 0;
    timerRef.current = setInterval(() => {
      prog += Math.random() * 11 + 4;
      if (prog >= 100) {
        prog = 100;
        clearInterval(timerRef.current);
        setTimeout(() => { setAuditRunning(false); setAuditDone(true); }, 450);
      }
      setAuditProgress(Math.min(prog, 100));
    }, 160);
  };

  const toggleAudit = () => {
    if (!auditOn) {
      setAuditOn(true);
      if (uploadedFile) runAudit();
    } else {
      setAuditOn(false);
      setAuditDone(false);
      setAuditProgress(0);
      clearInterval(timerRef.current);
    }
  };

  useEffect(() => {
    if (auditOn && uploadedFile && !auditRunning && !auditDone) runAudit();
  }, [uploadedFile, auditOn]);

  const toggleChannel = (id: string) => {
    setSelectedChannels(prev => {
      const next = new Set(prev);
      if (next.has(id) && next.size > 1) next.delete(id);
      else next.add(id);
      return next;
    });
    setPosted(false);
  };

  const deployLabel = () => {
    const sel = CHANNELS.filter(c => selectedChannels.has(c.id));
    if (sel.length === CHANNELS.length) return `Deploy to All ${CHANNELS.length} Channels Simultaneously`;
    if (sel.length === 1) return `Post to ${sel[0].label}`;
    return `Post to ${sel.map(c => c.label).join(' & ')} Simultaneously`;
  };

  const currentStep = AUDIT_STEPS.find(s => auditProgress < s.at) || AUDIT_STEPS.at(-1);

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6" style={{ backgroundColor: COLORS.CREAM, minHeight: '100vh' }}>
      
      {onBack && (
        <button onClick={onBack} className="flex items-center text-slate-500 hover:text-slate-800 mb-2 font-medium transition-colors">
          <ArrowLeft size={18} className="mr-2" /> Back to Market Radar
        </button>
      )}

      {/* ══ MARKET STRATEGY BANNER ══ */}
      <div className="rounded-2xl shadow-xl overflow-hidden p-6 md:p-8" style={{ backgroundColor: COLORS.NAVY }}>
        <div className="flex items-center gap-2 mb-2">
          <h2 className="text-sm font-black uppercase tracking-widest" style={{ color: COLORS.LIGHT_GOLD }}>Content Generation Engine</h2>
        </div>
        <div className="flex items-center gap-4 mt-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight leading-none" style={{ color: COLORS.WHITE }}>
              {MOCK.market.country} — {MOCK.market.city} Profile
            </h1>
          </div>
        </div>
      </div>

      {/* ══ TWO-COLUMN: COPYWRITING + BLUEPRINT ══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── PHASE 3: AI COPYWRITING MATRIX ── */}
        <div className="rounded-2xl shadow-sm border overflow-hidden flex flex-col max-h-[600px]" style={{ backgroundColor: COLORS.WHITE, borderColor: COLORS.LIGHT_GREY }}>
          {/* Header */}
          <div className="p-5 border-b flex items-center gap-3 shrink-0" style={{ borderColor: COLORS.LIGHT_GREY }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${COLORS.TEAL}18` }}>
              <Sparkles size={16} style={{ color: COLORS.TEAL }} />
            </div>
            <div>
              <h2 className="text-base font-black leading-tight" style={{ color: COLORS.NAVY }}>AI Copywriting Matrix</h2>
              <p className="text-xs font-bold uppercase tracking-wider mt-0.5" style={{ color: COLORS.TEXT_MUTED }}>Culture-Fit Generation Options</p>
            </div>
          </div>

          {/* Platform tabs */}
          <div className="flex border-b shrink-0" style={{ borderColor: COLORS.LIGHT_GREY }}>
            {PLATFORMS.map(p => {
              const active = activeTab === p.id;
              return (
                <button 
                  key={p.id} 
                  onClick={() => setActiveTab(p.id)} 
                  className="flex-1 py-3 text-xs font-black transition-all border-b-2 flex items-center justify-center gap-2"
                  style={{
                    color: active ? COLORS.NAVY : COLORS.TEXT_MUTED,
                    borderColor: active ? COLORS.NAVY : 'transparent',
                    backgroundColor: active ? COLORS.OFF_WHITE : 'transparent'
                  }}
                >
                  <span className="flex items-center justify-center shrink-0">{p.icon}</span> {p.label}
                </button>
              );
            })}
          </div>

          {/* Caption Options Body (Scrollable) */}
          <div className="p-5 overflow-y-auto flex-1 space-y-6">
            {platform.options.map((opt, idx) => {
              const hashCount = (opt.match(/#\S+/g) || []).length;
              const uniqueId = `${activeTab}-cap-${idx}`;

              return (
                <div key={uniqueId} className="flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black uppercase tracking-wider" style={{ color: COLORS.NAVY }}>Option {idx + 1}</span>
                  </div>
                  <div className="p-4 rounded-xl border mb-3 flex-1" style={{ backgroundColor: COLORS.CREAM, borderColor: COLORS.LIGHT_GREY }}>
                    <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap" style={{ color: COLORS.TEXT_MAIN }}>
                      {opt}
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Hash size={14} style={{ color: COLORS.TEXT_MUTED }} />
                      <span className="text-xs font-bold" style={{ color: COLORS.TEXT_MUTED }}>{hashCount} hashtags</span>
                    </div>
                    <button
                      onClick={() => copyText(opt, uniqueId)}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-black transition-all"
                      style={{
                        border: `1.5px solid ${copiedId === uniqueId ? COLORS.GREEN : COLORS.NAVY}`,
                        backgroundColor: copiedId === uniqueId ? COLORS.GREEN_LIGHT : COLORS.NAVY,
                        color: copiedId === uniqueId ? COLORS.GREEN : COLORS.WHITE,
                      }}
                    >
                      {copiedId === uniqueId ? <CheckCircle size={14} /> : <Copy size={14} />}
                      {copiedId === uniqueId ? 'Copied!' : 'Copy Text'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── VISUAL BLUEPRINT ── */}
        <div className="rounded-2xl shadow-sm border overflow-hidden flex flex-col max-h-[600px]" style={{ backgroundColor: COLORS.WHITE, borderColor: COLORS.LIGHT_GREY }}>
          <div className="p-5 border-b flex items-center gap-3 shrink-0" style={{ borderColor: COLORS.LIGHT_GREY }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${COLORS.NAVY}12` }}>
              <Eye size={16} style={{ color: COLORS.NAVY }} />
            </div>
            <div>
              <h2 className="text-base font-black leading-tight" style={{ color: COLORS.NAVY }}>Visual Direction Guide</h2>
              <p className="text-xs font-bold uppercase tracking-wider mt-0.5" style={{ color: COLORS.TEXT_MUTED }}>AI Staging Blueprint</p>
            </div>
          </div>
          
          <div className="p-5 overflow-y-auto">
            {platform.guide.map((step, i) => (
              <div key={i} className="flex gap-3 mb-3 p-3.5 rounded-xl border transition-all" style={{ backgroundColor: i % 2 === 0 ? COLORS.CREAM : COLORS.OFF_WHITE, borderColor: COLORS.LIGHT_GREY }}>
                <div className="w-6 h-6 rounded-full flex shrink-0 items-center justify-center text-xs font-black text-white" style={{ backgroundColor: COLORS.NAVY }}>
                  {i + 1}
                </div>
                <p className="text-sm font-medium leading-relaxed" style={{ color: COLORS.TEXT_MAIN }}>{step}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══ MEDIA & CAPTION HUB (INTEGRATED DROPZONE) ══ */}
      <div className="rounded-2xl shadow-sm border overflow-hidden" style={{ backgroundColor: COLORS.WHITE, borderColor: COLORS.LIGHT_GREY }}>
        <div className="p-5 border-b flex items-center gap-3" style={{ borderColor: COLORS.LIGHT_GREY }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${COLORS.GOLD}18` }}>
            <UploadCloud size={16} style={{ color: COLORS.GOLD }} />
          </div>
          <div>
            <h2 className="text-lg font-black leading-tight" style={{ color: COLORS.NAVY }}>Media & Caption Manager</h2>
            <p className="text-sm tracking-wider mt-0.5" style={{ color: COLORS.TEXT_MUTED }}>Stage text content and upload media profiles for distribution</p>
          </div>
        </div>

        <div className="p-5 md:p-6 space-y-4">
          
          {/* Staged Text Frame Area */}
          <div className="space-y-1.5 animate-fade-in">
            <label className="text-xs font-black uppercase tracking-wider block" style={{ color: COLORS.TEXT_MUTED }}> Staging Campaign Caption</label>
            <textarea
              value={stagedCaption}
              onChange={(e) => setStagedCaption(e.target.value)}
              placeholder="Select an option above by clicking 'Copy Text' to auto-populate this box, or compose custom copy here..."
              className="w-full p-4 rounded-xl border font-medium text-sm leading-relaxed min-h-[96px] focus:outline-none focus:ring-2 focus:ring-slate-400 transition-all"
              style={{ backgroundColor: COLORS.CREAM, borderColor: COLORS.LIGHT_GREY, color: COLORS.TEXT_MAIN }}
            />
          </div>

          {/* Graphical drop elements container layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Drop area */}
            <div
              onDrop={handleDrop}
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all min-h-[160px]"
              style={{
                borderColor: isDragging ? COLORS.TEAL : COLORS.LIGHT_GREY,
                backgroundColor: isDragging ? `${COLORS.TEAL}07` : COLORS.CREAM,
              }}
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center transition-all" style={{ backgroundColor: isDragging ? `${COLORS.TEAL}18` : COLORS.LIGHT_GREY }}>
                <UploadCloud size={24} style={{ color: isDragging ? COLORS.TEAL : COLORS.TEXT_MUTED }} />
              </div>
              <div className="text-center">
                <p className="font-black text-sm" style={{ color: isDragging ? COLORS.TEAL : COLORS.TEXT_MAIN }}>
                  {isDragging ? 'Release to upload' : 'Drag & drop your media here'}
                </p>
                <p className="text-xs font-medium mt-1" style={{ color: COLORS.TEXT_MUTED }}>PNG, JPG, WEBP — up to 20MB</p>
              </div>
              <div className="px-4 py-2 rounded-lg text-xs font-bold border mt-2" style={{ backgroundColor: COLORS.WHITE, borderColor: COLORS.LIGHT_GREY, color: COLORS.TEXT_MUTED }}>
                Browse files
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => ingestFile(e.target.files?.[0])} />
            </div>

            {/* Preview */}
            {previewUrl ? (
              <div className="rounded-2xl overflow-hidden border relative min-h-[160px]" style={{ borderColor: COLORS.LIGHT_GREY }}>
                <img src={previewUrl} alt="Preview" className="w-full h-full object-cover block" />
                <button
                  onClick={(e) => { e.stopPropagation(); setUploadedFile(null); setPreviewUrl(null); setAuditDone(false); setAuditProgress(0); }}
                  className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black shadow-md transition-all hover:scale-105"
                  style={{ backgroundColor: 'rgba(0,0,0,0.7)', color: COLORS.WHITE }}
                >
                  <X size={12} /> Remove
                </button>
                <div className="absolute bottom-0 left-0 right-0 p-4 pt-8" style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.8))' }}>
                  <p className="m-0 text-xs font-black text-white line-clamp-1">📎 {uploadedFile?.name}</p>
                  <p className="mt-1 text-xs font-medium text-slate-300">
                    {uploadedFile && (uploadedFile.size / 1024).toFixed(0)}KB · Ready for audit
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border flex flex-col items-center justify-center p-6 text-center" style={{ backgroundColor: COLORS.OFF_WHITE, borderColor: COLORS.LIGHT_GREY }}>
                 <Eye size={24} style={{ color: COLORS.TEXT_MUTED }} className="mb-2 opacity-50" />
                 <p className="text-sm font-bold" style={{ color: COLORS.TEXT_MUTED }}>No Media Attached</p>
                 <p className="text-xs font-medium mt-1" style={{ color: COLORS.TEXT_MUTED }}>Upload an asset to preview</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══ XAI COMPLIANCE AUDITOR ══ */}
      <div className="rounded-2xl shadow-sm border overflow-hidden transition-all duration-300" style={{ backgroundColor: COLORS.WHITE, borderColor: auditOn ? COLORS.NAVY : COLORS.LIGHT_GREY }}>
        <div className="p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b" style={{ borderColor: auditOn ? COLORS.LIGHT_GREY : 'transparent' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center transition-all shrink-0" style={{ backgroundColor: auditOn ? COLORS.GOLD : COLORS.LIGHT_GREY }}>
              <Shield size={18} style={{ color: auditOn ? COLORS.WHITE : COLORS.NAVY }} />
            </div>
            <div>
              <h2 className="text-base font-black leading-tight" style={{ color: COLORS.NAVY }}>Smart Optimization Audit</h2>
              <p className="text-xs font-bold uppercase tracking-wider mt-0.5" style={{ color: COLORS.TEXT_MUTED }}>
                Content Review <span className="ml-2 px-2 py-0.5 rounded text-[9px]" style={{ backgroundColor: COLORS.GOLD_LIGHT, color: COLORS.GOLD }}>OPTIONAL</span>
              </p>
            </div>
          </div>
          <button onClick={toggleAudit} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-black transition-all border shadow-sm shrink-0" style={{ backgroundColor: auditOn ? COLORS.NAVY : COLORS.WHITE, borderColor: auditOn ? COLORS.NAVY : COLORS.LIGHT_GREY, color: auditOn ? COLORS.WHITE : COLORS.TEXT_MUTED }}>
            {auditOn ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
            {auditOn ? 'Audit Active' : 'Activate Audit'}
          </button>
        </div>

        {auditOn && (
          <div className="p-5 md:p-6 bg-white">
            {!uploadedFile && (
              <div className="flex items-start gap-3 p-4 rounded-xl border mb-2" style={{ backgroundColor: COLORS.GOLD_LIGHT, borderColor: `${COLORS.GOLD}40` }}>
                <AlertTriangle size={18} className="shrink-0 mt-0.5" style={{ color: COLORS.GOLD }} />
                <p className="text-sm font-bold" style={{ color: COLORS.TEXT_MAIN }}>
                  Upload a media asset in the Dropzone above to allow the AI to check your image and give helpful suggestions.
                </p>
              </div>
            )}

            {auditRunning && (
              <div className="p-6 rounded-xl border" style={{ backgroundColor: COLORS.CREAM, borderColor: COLORS.LIGHT_GREY }}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-sm font-black" style={{ color: COLORS.NAVY }}>
                    <div className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ backgroundColor: COLORS.NAVY }} />
                    AI Review in Progress
                  </div>
                  <span className="text-sm font-black" style={{ color: COLORS.NAVY }}>{Math.round(auditProgress)}%</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden mb-4" style={{ backgroundColor: COLORS.LIGHT_GREY }}>
                  <div className="h-full rounded-full transition-all duration-300" style={{ width: `${auditProgress}%`, backgroundColor: COLORS.NAVY }} />
                </div>
                <p className="text-xs font-bold mb-3" style={{ color: COLORS.TEXT_MUTED }}>⚙️ {currentStep?.label}</p>
                <div className="flex gap-1.5 mb-4">
                  {AUDIT_STEPS.map((s, i) => (
                    <div key={i} className="flex-1 h-1 rounded-full" style={{ backgroundColor: auditProgress >= s.at ? COLORS.NAVY : COLORS.LIGHT_GREY }} />
                  ))}
                </div>
              </div>
            )}

            {auditDone && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-6 rounded-xl border flex flex-col items-center justify-center text-center" style={{ backgroundColor: COLORS.CREAM, borderColor: COLORS.LIGHT_GREY }}>
                    <CircularScore score={MOCK.compliance.score} />
                    <div className="mt-4 px-3 py-1 rounded-lg border text-xs font-black" style={{ backgroundColor: COLORS.GREEN_LIGHT, borderColor: `${COLORS.GREEN}40`, color: COLORS.GREEN }}>
                      ✓ Great Content
                    </div>
                  </div>
                  <div className="md:col-span-2 flex flex-col gap-4">
                    <div className="p-4 rounded-xl border" style={{ backgroundColor: COLORS.CREAM, borderColor: COLORS.LIGHT_GREY }}>
                      <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: COLORS.TEXT_MUTED }}>Checks Completed</p>
                      <div className="space-y-2">
                        {[{ name: 'Image Check', task: 'Looking at layout and background' }, { name: 'Text Reader', task: 'Finding and reading the words' }, { name: 'Meaning Matcher', task: 'Checking if the message fits the audience' }].map(m => (
                          <div key={m.name} className="flex items-start gap-2">
                            <CheckCircle size={14} className="shrink-0 mt-0.5" style={{ color: COLORS.GREEN }} />
                            <p className="text-xs font-medium"><strong className="font-black" style={{ color: COLORS.NAVY }}>{m.name}</strong> — {m.task}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex-1 p-4 rounded-xl border flex items-center" style={{ backgroundColor: COLORS.OFF_WHITE, borderLeftColor: COLORS.NAVY, borderLeftWidth: 4 }}>
                      <p className="text-sm font-medium leading-relaxed" style={{ color: COLORS.TEXT_MAIN }}>
                        <strong className="font-black" style={{ color: COLORS.NAVY }}>88% Marketing Score</strong> — Your content creates the right emotional feeling for travelers from <strong className="font-black">{MOCK.market.city}</strong> looking for a healing vacation.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-5 rounded-xl border" style={{ backgroundColor: COLORS.GREEN_LIGHT, borderColor: `${COLORS.GREEN}40` }}>
                    <h3 className="text-sm font-black uppercase tracking-wider mb-4 flex items-center gap-2" style={{ color: COLORS.GREEN }}><CheckCircle size={16}/> What You Did Great</h3>
                    {MOCK.compliance.aligned.map((item, i) => (
                      <p key={i} className="text-xs font-bold leading-relaxed mb-2 border p-2 bg-white/70 rounded-lg shadow-2xs">✓ {item}</p>
                    ))}
                  </div>
                  <div className="p-5 rounded-xl border" style={{ backgroundColor: COLORS.GOLD_LIGHT, borderColor: `${COLORS.RED_ORANGE}40` }}>
                    <h3 className="text-sm font-black uppercase tracking-wider mb-4 flex items-center gap-2" style={{ color: COLORS.RED_ORANGE }}><AlertTriangle size={16}/> Tips to Improve</h3>
                    {MOCK.compliance.gaps.map((item, i) => (
                      <p key={i} className="text-xs font-bold leading-relaxed mb-2 border p-2 bg-white/70 rounded-lg shadow-2xs">⚠ {item}</p>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ══ CHANNEL DISTRIBUTION ENGINE ══ */}
      <div className="rounded-2xl shadow-sm border overflow-hidden" style={{ backgroundColor: COLORS.WHITE, borderColor: COLORS.LIGHT_GREY }}>
        <div className="p-5 border-b flex items-center gap-3" style={{ borderColor: COLORS.LIGHT_GREY }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${COLORS.RED_ORANGE}18` }}>
            <Share2 size={16} style={{ color: COLORS.RED_ORANGE }} />
          </div>
          <div>
            <h2 className="text-base font-black leading-tight" style={{ color: COLORS.NAVY }}>Multi-Platform Distribution</h2>
            <p className="text-xs font-bold uppercase tracking-wider mt-0.5" style={{ color: COLORS.TEXT_MUTED }}>Simultaneous Deployment</p>
          </div>
        </div>
        
        <div className="p-5 md:p-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {CHANNELS.map(ch => {
              const sel = selectedChannels.has(ch.id);
              return (
                <button 
                  key={ch.id} 
                  onClick={() => toggleChannel(ch.id)} 
                  className="p-5 rounded-2xl border text-center transition-all duration-300 relative flex flex-col items-center justify-center min-h-[140px]"
                  style={{
                    borderColor: sel ? COLORS.NAVY : COLORS.LIGHT_GREY,
                    backgroundColor: sel ? 'rgba(15,40,84,0.03)' : COLORS.CREAM,
                    transform: sel ? 'scale(1.02)' : 'scale(1)',
                    boxShadow: sel ? `0 4px 16px ${COLORS.NAVY}20` : 'none',
                  }}
                >
                  {sel && (
                    <div className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: COLORS.NAVY }}>
                      <Check size={12} color={COLORS.WHITE} strokeWidth={3} />
                    </div>
                  )}
                  <div className="mb-3 flex items-center justify-center">{ch.icon}</div>
                  <p className="text-sm font-black mb-1" style={{ color: COLORS.NAVY }}>{ch.label}</p>
                  <p className="text-xs font-medium mb-3" style={{ color: COLORS.TEXT_MUTED }}>{ch.handle}</p>
                  <div className="flex items-center justify-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: ch.verified ? COLORS.GREEN : COLORS.GOLD }} />
                    <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: ch.verified ? COLORS.GREEN : COLORS.GOLD }}>
                      {ch.verified ? 'Token Active' : 'Auth Pending'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setPosted(true)}
            className="w-full p-4 rounded-xl text-sm font-black flex items-center justify-center gap-2 transition-all hover:opacity-90 shadow-lg"
            style={{
              backgroundColor: posted ? COLORS.GREEN : COLORS.NAVY,
              color: COLORS.WHITE,
            }}
          >
            {posted ? (
              <><CheckCircle size={18} /> Successfully Deployed to {selectedChannels.size} Channel{selectedChannels.size > 1 ? 's' : ''}!</>
            ) : (
              <><Share2 size={18} /> {deployLabel()}</>
            )}
          </button>

          {posted && (
            <div className="mt-4 p-4 rounded-xl border flex items-center gap-3 animate-fade-in" style={{ backgroundColor: COLORS.GREEN_LIGHT, borderColor: `${COLORS.GREEN}40` }}>
              <CheckCircle size={18} style={{ color: COLORS.GREEN }} />
              <p className="text-sm font-bold" style={{ color: COLORS.GREEN }}>
                Content is live. Analytics will propagate to the Phase 5 dashboard within 2–4 hours.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}