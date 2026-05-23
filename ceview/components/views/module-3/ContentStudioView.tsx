import React, { useState, useRef } from "react";
import { ArrowLeft } from "lucide-react";
import { COLORS } from '../../../constants';

import AIContentMatrixPanel from '../../modules/module-3/AIContentMatrixPanel';
import VisualDirectionBoard from '../../modules/module-3/VisualDirectionBoard';
import MediaCaptionManager from '../../modules/module-3/MediaCaptionManager';
import SmartOptimizationBoard from '../../modules/module-3/SmartOptimizationBoard';
import DistributionPanel from '../../modules/module-3/DistributionPanel';

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

export default function ContentStudioView({ onBack }: { onBack?: () => void }) {
  // Global View State
  const [activeTab, setActiveTab] = useState('instagram');
  const [stagedCaption, setStagedCaption] = useState<string>(""); 
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Global Audit State
  const [auditOn, setAuditOn] = useState(false);
  const [auditRunning, setAuditRunning] = useState(false);
  const [auditDone, setAuditDone] = useState(false);
  const [auditProgress, setAuditProgress] = useState(0);
  const timerRef = useRef<any>(null);

  const platform = MOCK.captions[activeTab as keyof typeof MOCK.captions] || MOCK.captions.instagram;

  const ingestFile = (file?: File | null) => {
    if (!file || !file.type.startsWith('image/')) return;
    setUploadedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    resetAudit();
  };

  const removeFile = () => {
    setUploadedFile(null);
    setPreviewUrl(null);
    resetAudit();
  };

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

  const resetAudit = () => {
    setAuditDone(false);
    setAuditProgress(0);
    clearInterval(timerRef.current);
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6" style={{ backgroundColor: COLORS.CREAM, minHeight: '100vh' }}>
      {onBack && (
        <button onClick={onBack} className="flex items-center text-slate-500 hover:text-slate-800 mb-2 font-medium transition-colors">
          <ArrowLeft size={18} className="mr-2" /> Back to Market Radar
        </button>
      )}

      <div className="rounded-2xl shadow-xl overflow-hidden p-6 md:p-8" style={{ backgroundColor: COLORS.NAVY }}>
        <h2 className="text-sm font-black uppercase tracking-widest mb-2" style={{ color: COLORS.LIGHT_GOLD }}>Content Generation Engine</h2>
        <h1 className="text-3xl font-black tracking-tight leading-none" style={{ color: COLORS.WHITE }}>
          {MOCK.market.country} — {MOCK.market.city} Profile
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AIContentMatrixPanel 
          platforms={PLATFORMS} activeTab={activeTab} setActiveTab={setActiveTab} 
          options={platform.options} onCopyOption={setStagedCaption} 
        />
        <VisualDirectionBoard guide={platform.guide} />
      </div>

      <MediaCaptionManager 
        stagedCaption={stagedCaption} setStagedCaption={setStagedCaption}
        file={uploadedFile} previewUrl={previewUrl} 
        onFileIngest={ingestFile} onRemoveFile={removeFile} 
      />

      <SmartOptimizationBoard 
        auditOn={auditOn} setAuditOn={setAuditOn} hasFile={!!uploadedFile}
        auditRunning={auditRunning} auditDone={auditDone} auditProgress={auditProgress}
        onRunAudit={runAudit} onResetAudit={resetAudit}
        mockData={MOCK} auditSteps={AUDIT_STEPS}
      />

      <DistributionPanel channels={CHANNELS} />
    </div>
  );
}