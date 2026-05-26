import React, { useState, useRef, useEffect } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { COLORS } from '../../../constants';
import { api, ApiError } from '../../../services/apiClient';
import type { ContentResponseDTO, ComplianceResultDTO, ContentPlatformId, ResponseSource } from '../../../types';

import ServerErrorBanner from '../../shared/ServerErrorBanner';
import AIContentMatrixPanel from './components/AIContentMatrixPanel';
import VisualDirectionBoard from './components/VisualDirectionBoard';
import MediaCaptionManager from './components/MediaCaptionManager';
import SmartOptimizationBoard from './components/SmartOptimizationBoard';
import DistributionPanel from './components/DistributionPanel';

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
  { label: 'Comparing your post to what visitors expect...',   at: 75  },
  { label: 'Scoring your post based on our marketing rules...', at: 90  },
  { label: 'Putting together your simple feedback report...',  at: 100 },
];

const FALLBACK_PILL_LABEL = 'Demo content (Gemini offline)';

function formatErrorBanner(prefix: string, e: ApiError): string {
  const trace = e.traceId ? ` · trace ${e.traceId}` : '';
  return `${prefix} [${e.code}${trace}]`;
}

function logModule3Error(scope: string, e: unknown): void {
  if (e instanceof ApiError) {
    console.warn(`[Module 3] scope=${scope} code=${e.code} trace=${e.traceId ?? 'none'} status=${e.status} :: ${e.message}`);
  } else {
    console.warn(`[Module 3] scope=${scope} unexpected`, e);
  }
}

interface ContentStudioViewProps {
  onBack?: () => void;
  businessProfileId?: string | null;
  businessName?: string;
  description?: string;
  categories?: string[];
  initialMarketId?: string;
  initialTrend?: string;
}

export default function ContentStudioView({
  onBack, businessProfileId, businessName, description, categories,
  initialMarketId, initialTrend,
}: ContentStudioViewProps) {
  const [content, setContent] = useState<ContentResponseDTO | null>(null);
  const [contentSource, setContentSource] = useState<ResponseSource | null>(null);
  const [contentLoading, setContentLoading] = useState<boolean>(true);
  const [serverError, setServerError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<ContentPlatformId>('instagram');
  const [stagedCaption, setStagedCaption] = useState<string>("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  /** Which option index (0/1/2) has been approved per platform (-1 = none). */
  const [approvedIndices, setApprovedIndices] = useState<Record<ContentPlatformId, number>>({
    instagram: -1, tiktok: -1, facebook: -1, naver: -1,
  });
  /** The approved caption text for each platform — forwarded to compliance audit. */
  const [approvedCaptions, setApprovedCaptions] = useState<Record<ContentPlatformId, string>>({
    instagram: '', tiktok: '', facebook: '', naver: '',
  });

  const [auditOn, setAuditOn] = useState(false);
  const [auditRunning, setAuditRunning] = useState(false);
  const [auditDone, setAuditDone] = useState(false);
  const [auditProgress, setAuditProgress] = useState(0);
  const [compliance, setCompliance] = useState<ComplianceResultDTO | null>(null);
  const [complianceSource, setComplianceSource] = useState<ResponseSource | null>(null);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    setContentLoading(true);
    setServerError(null);
    api.generateContent({
      market: initialMarketId ?? 'korea',
      businessName: businessName ?? '',
      description: description ?? '',
      categories: categories ?? [],
      trend: initialTrend ?? '',
    })
      .then(r => {
        if (cancelled) return;
        setContent(r);
        setContentSource(r.source ?? 'fallback');
      })
      .catch(e => {
        if (cancelled) return;
        logModule3Error('generateContent', e);
        if (e instanceof ApiError) {
          setServerError(formatErrorBanner('Content generation service unavailable.', e));
        } else {
          setServerError('Content generation service unavailable.');
        }
      })
      .finally(() => { if (!cancelled) setContentLoading(false); });
    return () => { cancelled = true; };
  }, [initialMarketId, businessName, description, categories, initialTrend]);

  const platform = content?.captions[activeTab] ?? null;
  const headerLabel = content ? `${content.market.country} — ${content.market.city} Profile` : 'Generating content…';

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
    setCompliance(null);
    setComplianceSource(null);

    if (!stagedCaption || !stagedCaption.trim()) {
      setServerError('Add a caption before running the audit. [MOD3_COMPLIANCE_VALIDATION]');
      setAuditRunning(false);
      return;
    }

    api.evaluateCompliance({
      caption: stagedCaption,
      market: initialMarketId ?? 'korea',
      mediaName: uploadedFile?.name,
      mediaSize: uploadedFile?.size,
    })
      .then(r => {
        setCompliance({ score: r.score, aligned: r.aligned ?? [], gaps: r.gaps ?? [] });
        setComplianceSource(r.source ?? 'fallback');
      })
      .catch(e => {
        logModule3Error('evaluateCompliance', e);
        if (e instanceof ApiError) {
          setServerError(formatErrorBanner('Compliance evaluation failed.', e));
        } else {
          setServerError('Compliance evaluation failed.');
        }
      });

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

  /**
   * Approve an option card — stores the approved index + text per platform,
   * and stages it in the Media Caption Manager for the compliance audit.
   */
  const handleApproveOption = (idx: number, text: string) => {
    setApprovedIndices(prev => ({ ...prev, [activeTab]: idx }));
    setApprovedCaptions(prev => ({ ...prev, [activeTab]: text }));
    setStagedCaption(text);
  };

  // ── Loading / error empty states ─────────────────────────────────────────
  if (contentLoading) {
    return (
      <div className="max-w-6xl mx-auto p-4 md:p-6 min-h-[60vh] flex flex-col items-center justify-center gap-3" style={{ backgroundColor: COLORS.CREAM }}>
        <Loader2 size={32} className="animate-spin" style={{ color: COLORS.NAVY }} />
        <p className="text-sm font-bold" style={{ color: COLORS.TEXT_MUTED }}>Generating content from Gemini…</p>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6" style={{ backgroundColor: COLORS.CREAM, minHeight: '100vh' }}>
        {onBack && (
          <button onClick={onBack} className="flex items-center text-slate-500 hover:text-slate-800 mb-2 font-medium transition-colors">
            <ArrowLeft size={18} className="mr-2" /> Back to Market Radar
          </button>
        )}
        {serverError
          ? <ServerErrorBanner message={serverError} onDismiss={() => setServerError(null)} />
          : <ServerErrorBanner message="No content available." onDismiss={() => {}} />}
        <div className="p-8 rounded-2xl border text-center" style={{ backgroundColor: COLORS.WHITE, borderColor: COLORS.LIGHT_GREY }}>
          <p className="text-sm font-medium" style={{ color: COLORS.TEXT_MUTED }}>
            The content engine is unavailable. Verify the backend is running and reload to retry.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6" style={{ backgroundColor: COLORS.CREAM, minHeight: '100vh' }}>
      {serverError && <ServerErrorBanner message={serverError} onDismiss={() => setServerError(null)} />}
      {onBack && (
        <button onClick={onBack} className="flex items-center text-slate-500 hover:text-slate-800 mb-2 font-medium transition-colors">
          <ArrowLeft size={18} className="mr-2" /> Back to Market Radar
        </button>
      )}

      <div className="rounded-2xl shadow-xl overflow-hidden p-4 md:p-8 relative" style={{ backgroundColor: COLORS.NAVY }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest mb-2" style={{ color: COLORS.LIGHT_GOLD }}>Content Generation Engine</h2>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight leading-none" style={{ color: COLORS.WHITE }}>
              {headerLabel}
            </h1>
          </div>
          {contentSource === 'fallback' && (
            <span
              className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border shrink-0"
              style={{ backgroundColor: COLORS.GOLD_LIGHT, color: COLORS.NAVY, borderColor: `${COLORS.GOLD}40` }}
              title="Gemini is offline or disabled — the backend returned its built-in fallback content."
            >
              {FALLBACK_PILL_LABEL}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AIContentMatrixPanel
          platforms={PLATFORMS}
          activeTab={activeTab}
          setActiveTab={(id) => setActiveTab(id as ContentPlatformId)}
          options={platform?.options ?? []}
          optionNames={platform?.optionNames}
          optionMetadata={platform?.optionMetadata}
          approvedIndex={approvedIndices[activeTab]}
          onCopyOption={setStagedCaption}
          onApproveOption={handleApproveOption}
        />
        <VisualDirectionBoard guide={platform?.guide ?? []} />
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
        compliance={compliance}
        marketCity={content.market.city}
        complianceSource={complianceSource}
        fallbackPillLabel={FALLBACK_PILL_LABEL}
        auditSteps={AUDIT_STEPS}
      />

      <DistributionPanel channels={CHANNELS} />
    </div>
  );
}
