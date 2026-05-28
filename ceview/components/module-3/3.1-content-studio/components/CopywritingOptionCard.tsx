import React, { useState } from 'react';
import { Hash, Check, Pencil, X, CheckCircle2 } from 'lucide-react';
import CopyTargetBtn from './CopyTargetBtn';
import { COLORS } from '../../../../constants';
// ── Demographic archetype badge config ──────────────────────────────────────
// Index 0 → Witty & High-Energy (Gen Z)   → blue
// Index 1 → Formal & Educational (Mature)  → emerald
// Index 2 → Storytelling & Emotional       → purple
const BADGE_CONFIG = [
  { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE', label: 'Gen Z / Younger'      },
  { bg: '#ECFDF5', text: '#065F46', border: '#A7F3D0', label: 'Mature / Family'        },
  { bg: '#F5F3FF', text: '#5B21B6', border: '#DDD6FE', label: 'Aspirational / Experiential' },
] as const;

// ── Platform character limits ────────────────────────────────────────────────
export const PLATFORM_CHAR_LIMITS: Record<string, number> = {
  instagram: 2200,
  tiktok:    300,   // optimal display target (hard limit = 2200)
  facebook:  500,   // practical conversational target
};

// ── Progress bar color thresholds ────────────────────────────────────────────
function barColor(pct: number): string {
  if (pct >= 1.0)  return '#EF4444'; // over limit — red
  if (pct >= 0.85) return '#F59E0B'; // approaching  — amber
  return '#10B981';                   // comfortable  — emerald
}

// ── Props ────────────────────────────────────────────────────────────────────
interface CopywritingOptionCardProps {
  index: number;
  text: string;
  optionName?: string;
  /** Character limit for this platform (from PLATFORM_CHAR_LIMITS). */
  charLimit?: number;
  isApproved?: boolean;
  isCopied: boolean;
  onCopy: () => void;
  onApprove?: () => void;
  /** Called with the edited text when the user saves inline edits. */
  onEdit?: (text: string) => void;
}

const CopywritingOptionCard: React.FC<CopywritingOptionCardProps> = ({
  index,
  text,
  optionName,
  charLimit,
  isApproved = false,
  isCopied,
  onCopy,
  onApprove,
  onEdit,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(text);

  const hashCount  = (text.match(/#\S+/g) || []).length;
  const charCount  = text.length;
  const limit      = charLimit ?? 2200;
  const pct        = Math.min(charCount / limit, 1.1); // allow slight over for red bar

  const badge       = BADGE_CONFIG[index] ?? BADGE_CONFIG[0];
  const displayName = optionName ?? `Option ${index + 1}`;

  // ── Save inline edit ───────────────────────────────────────────────────────
  const handleSave = () => {
    setIsEditing(false);
    if (onEdit && editValue !== text) onEdit(editValue);
  };

  const handleCancel = () => {
    setEditValue(text);
    setIsEditing(false);
  };

  return (
    <div
      className="flex flex-col rounded-xl border overflow-hidden transition-shadow"
      style={{
        borderColor: isApproved ? '#10B981' : COLORS.LIGHT_GREY,
        boxShadow: isApproved ? '0 0 0 2px #10B98140' : undefined,
      }}
    >
      {/* ── Header row ──────────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-4 py-2.5 border-b"
        style={{ borderColor: isApproved ? '#A7F3D0' : COLORS.LIGHT_GREY, backgroundColor: COLORS.WHITE }}
      >
        {/* Left: archetype badge */}
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0"
            style={{ backgroundColor: badge.bg, color: badge.text, borderColor: badge.border }}
          >
            {badge.label}
          </span>
          <span
            className="text-xs font-bold truncate"
            style={{ color: COLORS.NAVY }}
            title={displayName}
          >
            {displayName}
          </span>
        </div>

        {/* Right: Approve + Edit + Copy actions */}
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {/* Approve button */}
          {onApprove && (
            <button
              onClick={onApprove}
              title={isApproved ? 'Approved' : 'Approve this caption'}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold border transition-colors"
              style={
                isApproved
                  ? { backgroundColor: '#ECFDF5', color: '#065F46', borderColor: '#A7F3D0' }
                  : { backgroundColor: COLORS.WHITE, color: COLORS.TEXT_MUTED, borderColor: COLORS.LIGHT_GREY }
              }
            >
              {isApproved ? (
                <><CheckCircle2 size={12} /> Approved</>
              ) : (
                <><Check size={12} /> Approve</>
              )}
            </button>
          )}

          {/* Edit toggle */}
          {onEdit && !isEditing && (
            <button
              onClick={() => { setEditValue(text); setIsEditing(true); }}
              title="Edit caption"
              className="p-1.5 rounded-lg border transition-colors hover:bg-slate-50"
              style={{ color: COLORS.TEXT_MUTED, borderColor: COLORS.LIGHT_GREY }}
            >
              <Pencil size={12} />
            </button>
          )}
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className="p-4" style={{ backgroundColor: COLORS.CREAM }}>
        {isEditing ? (
          <textarea
            className="w-full text-sm font-medium leading-relaxed rounded-lg border p-3 resize-y focus:outline-none focus:ring-2"
            style={{
              color: COLORS.TEXT_MAIN,
              borderColor: COLORS.LIGHT_GREY,
              backgroundColor: COLORS.WHITE,
              minHeight: 120,
            }}
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            autoFocus
          />
        ) : (
          <p
            className="text-sm font-medium leading-relaxed whitespace-pre-wrap"
            style={{ color: COLORS.TEXT_MAIN }}
          >
            {text}
          </p>
        )}
      </div>

      {/* ── Character count bar ─────────────────────────────────────────────── */}
      <div className="px-4 pb-2 pt-0" style={{ backgroundColor: COLORS.CREAM }}>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#E5E7EB' }}>
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${Math.min(pct * 100, 100)}%`,
                backgroundColor: barColor(pct),
              }}
            />
          </div>
          <span
            className="text-[10px] font-bold tabular-nums shrink-0"
            style={{ color: barColor(pct) }}
          >
            {charCount.toLocaleString()} / {limit.toLocaleString()}
          </span>
        </div>
      </div>

      {/* ── Footer row ──────────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-4 py-2.5 border-t"
        style={{ borderColor: COLORS.LIGHT_GREY, backgroundColor: COLORS.WHITE }}
      >
        <div className="flex items-center gap-1.5">
          <Hash size={13} style={{ color: COLORS.TEXT_MUTED }} />
          <span className="text-xs font-bold" style={{ color: COLORS.TEXT_MUTED }}>
            {hashCount} hashtag{hashCount !== 1 ? 's' : ''}
          </span>
        </div>

        {isEditing ? (
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleSave}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold"
              style={{ backgroundColor: COLORS.NAVY, color: COLORS.WHITE }}
            >
              <Check size={11} /> Save
            </button>
            <button
              onClick={handleCancel}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border"
              style={{ color: COLORS.TEXT_MUTED, borderColor: COLORS.LIGHT_GREY, backgroundColor: COLORS.WHITE }}
            >
              <X size={11} /> Cancel
            </button>
          </div>
        ) : (
          <CopyTargetBtn isCopied={isCopied} onClick={onCopy} />
        )}
      </div>
    </div>
  );
};

export default CopywritingOptionCard;
