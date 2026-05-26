import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import PlatformTab from './PlatformTab';
import CopywritingOptionCard, { PLATFORM_CHAR_LIMITS } from './CopywritingOptionCard';
import { COLORS } from '../../../../constants';
import type { CaptionMetadata } from '../../../../types';

interface PlatformDescriptor {
  id: string;
  label: string;
  icon: React.ReactNode;
}

interface AIContentMatrixPanelProps {
  platforms: PlatformDescriptor[];
  activeTab: string;
  setActiveTab: (id: string) => void;
  options: string[];
  /** Demographic-archetype labels parallel to `options[]`. Optional — falls
   *  back to "Option N" labels when absent (legacy / naver payloads). */
  optionNames?: string[];
  /** AI reasoning metadata parallel to `options[]`. When present, each card
   *  renders a collapsible "AI Reasoning" section with the 5 explainability fields. */
  optionMetadata?: CaptionMetadata[];
  /** Index of the currently approved caption for the active tab.
   *  -1 means no caption is approved yet. */
  approvedIndex?: number;
  onCopyOption: (text: string) => void;
  /** Called when the user clicks Approve on a specific option card. */
  onApproveOption?: (idx: number, text: string) => void;
}

const AIContentMatrixPanel: React.FC<AIContentMatrixPanelProps> = ({
  platforms,
  activeTab,
  setActiveTab,
  options,
  optionNames,
  optionMetadata,
  approvedIndex = -1,
  onCopyOption,
  onApproveOption,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  // Per-card edited text overrides — keys are "{activeTab}-{idx}"
  const [editOverrides, setEditOverrides] = useState<Record<string, string>>({});

  const charLimit = PLATFORM_CHAR_LIMITS[activeTab] ?? 2200;

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      onCopyOption(text);
      setTimeout(() => setCopiedId(null), 2200);
    });
  };

  const handleEdit = (idx: number, newText: string) => {
    const key = `${activeTab}-${idx}`;
    setEditOverrides(prev => ({ ...prev, [key]: newText }));
    // If this card is already the approved one, propagate the edit up
    if (approvedIndex === idx && onApproveOption) {
      onApproveOption(idx, newText);
    }
  };

  return (
    <div
      className="rounded-2xl shadow-sm border overflow-hidden flex flex-col max-h-[680px]"
      style={{ backgroundColor: COLORS.WHITE, borderColor: COLORS.LIGHT_GREY }}
    >
      {/* ── Panel header ────────────────────────────────────────────────────── */}
      <div
        className="p-5 border-b flex items-center gap-3 shrink-0"
        style={{ borderColor: COLORS.LIGHT_GREY }}
      >
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${COLORS.TEAL}18` }}
        >
          <Sparkles size={16} style={{ color: COLORS.TEAL }} />
        </div>
        <div>
          <h2 className="text-base font-black leading-tight" style={{ color: COLORS.NAVY }}>
            AI Copywriting Matrix
          </h2>
          <p
            className="text-xs font-bold uppercase tracking-wider mt-0.5"
            style={{ color: COLORS.TEXT_MUTED }}
          >
            3 Demographic Variations · Culture-Fit Generation
          </p>
        </div>
      </div>

      {/* ── Platform tabs ───────────────────────────────────────────────────── */}
      <div
        className="flex border-b shrink-0 overflow-x-auto"
        style={{ borderColor: COLORS.LIGHT_GREY }}
      >
        {platforms.map(p => (
          <PlatformTab
            key={p.id}
            {...p}
            isActive={activeTab === p.id}
            onClick={() => setActiveTab(p.id)}
          />
        ))}
      </div>

      {/* ── Caption cards ───────────────────────────────────────────────────── */}
      <div className="p-5 overflow-y-auto flex-1 space-y-4">
        {options.map((opt, idx) => {
          const uniqueId = `${activeTab}-cap-${idx}`;
          const editKey  = `${activeTab}-${idx}`;
          const liveText = editOverrides[editKey] ?? opt;
          const name     = optionNames?.[idx];
          const meta     = optionMetadata?.[idx];

          return (
            <CopywritingOptionCard
              key={uniqueId}
              index={idx}
              text={liveText}
              optionName={name}
              metadata={meta}
              charLimit={charLimit}
              isApproved={approvedIndex === idx}
              isCopied={copiedId === uniqueId}
              onCopy={() => handleCopy(liveText, uniqueId)}
              onApprove={onApproveOption ? () => onApproveOption(idx, liveText) : undefined}
              onEdit={onEdit => handleEdit(idx, onEdit)}
            />
          );
        })}
      </div>
    </div>
  );
};

export default AIContentMatrixPanel;
