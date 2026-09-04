import { useState } from 'react';
import { Check, CheckCircle2, ChevronDown, Copy, Loader2, Sparkles } from 'lucide-react';
import PanelHead from './PanelHead';
import type { ContentResponse, PlatformId, CaptionMetadata } from '../../../types';

export const PLATFORM_CHAR_LIMITS: Record<PlatformId, number> = {
  instagram: 2200,
  tiktok: 300,
  facebook: 500,
  // Naver Blog is long-form. This is an editorial guidance limit rather than
  // the platform's technical maximum.
  naver: 5000,
};

const PLATFORMS: Array<{ id: PlatformId; label: string }> = [
  { id: 'instagram', label: 'Instagram' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'naver', label: 'Naver Blog' },
];

const REASON_FIELDS: Array<[keyof CaptionMetadata, string]> = [
  ['core_business_context', 'Business context'],
  ['market_cultural_localization', 'Cultural localisation'],
  ['psychological_elements', 'Psychological elements'],
  ['creative_tone_atmosphere', 'Tone & atmosphere'],
  ['algorithmic_platform_architecture', 'Platform fit'],
];

export interface AIContentMatrixPanelProps {
  /** Optional controlled tab state supplied by ContentStudioView. */
  activePlatform?: PlatformId;
  onPlatformChange?: (platform: PlatformId) => void;
  /** Called when an option is approved, to stage it in the publish composer. */
  onStageCaption?: (caption: string) => void;
  /** Allows a shell to display an already-staged caption without taking ownership of it. */
  stagedCaption?: string;
  /** Generated content from POST /api/content/generate, owned by ContentStudioView. */
  content?: ContentResponse | null;
  /** True while ContentStudioView's generate() call is in flight. */
  loading?: boolean;
}

interface CaptionOptionCardProps {
  index: number;
  title: string;
  initialText: string;
  limit: number;
  metadata?: CaptionMetadata;
  approved: boolean;
  onApprove: (text: string) => void;
}

function CaptionOptionCard({
  index,
  title,
  initialText,
  limit,
  metadata,
  approved,
  onApprove,
}: CaptionOptionCardProps) {
  const [text, setText] = useState(initialText);
  const [whyOpen, setWhyOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const count = text.length;
  const isOverLimit = count > limit;

  const copyText = async () => {
    try {
      await navigator.clipboard?.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard access can be unavailable in non-secure previews. The edit
      // and approve paths remain fully usable there.
    }
  };

  return (
    <article className={`rounded-xl border bg-white p-4 shadow-sm ${approved ? 'border-success ring-2 ring-success/15' : 'border-gray-light'}`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <span className="badge badge--teal">Option {index + 1}</span>
          <h3 className="mt-2 text-sm font-semibold text-navy-dark">{title}</h3>
        </div>
        {approved && <span className="inline-flex items-center gap-1 text-xs font-semibold text-success"><CheckCircle2 size={15} /> Approved</span>}
      </div>

      <label className="sr-only" htmlFor={`caption-option-${index}`}>Edit {title} caption</label>
      <textarea
        id={`caption-option-${index}`}
        className={`textarea min-h-36 text-sm ${isOverLimit ? 'is-invalid' : ''}`}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      <div className={`mt-2 text-right text-xs font-semibold ${isOverLimit ? 'text-critical' : 'text-[var(--color-text-muted)]'}`}>
        {count.toLocaleString()} / {limit.toLocaleString()} characters{isOverLimit ? ' — over recommended limit' : ''}
      </div>

      {metadata && (
        <div className="mt-3 border-t border-gray-light pt-3">
          <button
            type="button"
            className="flex w-full items-center justify-between text-left text-sm font-semibold text-navy-dark"
            aria-expanded={whyOpen}
            onClick={() => setWhyOpen((open) => !open)}
          >
            Why this caption
            <ChevronDown size={16} className={whyOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
          </button>
          {whyOpen && (
            <dl className="mt-3 space-y-3 rounded-lg bg-mint-pale p-3 text-sm">
              {REASON_FIELDS.map(([field, label]) => (
                <div key={field}>
                  <dt className="font-semibold text-navy-dark">{label}</dt>
                  <dd className="mt-1 leading-5 text-[var(--color-text-muted)]">{metadata[field]}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}

      {/* btn/btn--secondary/btn--primary were never defined anywhere in the
          stylesheet, so both of these rendered as bare inline text with a
          stacked glyph. The system's three variants are .btn-primary,
          .btn-cta and .btn-outline (§4 of the brand doc). Copy is the
          secondary action and takes the outline; Approve carries the card and
          takes the mint fill, both at the compact size so a card footer does
          not get two screen-scale pills. */}
      <div className="mt-4 flex items-center justify-end gap-2">
        <button type="button" className="btn-outline btn-outline--sm" onClick={copyText}>
          {copied ? <Check size={15} /> : <Copy size={15} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
        {/* Editing an approved caption leaves the staged copy behind, so the
            label says what the click now does rather than repeating the
            "Approved" state the header chip already carries. */}
        <button
          type="button"
          className={approved ? 'btn-outline btn-outline--sm' : 'btn-primary btn-primary--sm'}
          onClick={() => onApprove(text)}
        >
          <Check size={15} /> {approved ? 'Re-approve' : 'Approve'}
        </button>
      </div>
    </article>
  );
}

/** Platform-specific, editable AI caption choices. */
export default function AIContentMatrixPanel({
  activePlatform,
  onPlatformChange,
  onStageCaption,
  content,
  loading,
}: AIContentMatrixPanelProps) {
  const [uncontrolledPlatform, setUncontrolledPlatform] = useState<PlatformId>('instagram');
  const [approved, setApproved] = useState<Partial<Record<PlatformId, number>>>({});
  const platform = activePlatform ?? uncontrolledPlatform;
  const captions = content?.captions[platform];

  const selectPlatform = (next: PlatformId) => {
    if (activePlatform === undefined) setUncontrolledPlatform(next);
    onPlatformChange?.(next);
  };

  const approve = (index: number, text: string) => {
    setApproved((current) => ({ ...current, [platform]: index }));
    onStageCaption?.(text);
  };

  return (
    <section className="card" aria-labelledby="copywriting-matrix-title">
      <PanelHead
        icon={<Sparkles />}
        titleId="copywriting-matrix-title"
        title="AI Copywriting Matrix"
        subtitle="Localised copy, tailored to platform and audience."
      />

      <div className="mt-4 flex gap-1 overflow-x-auto border-b border-gray-light" role="tablist" aria-label="Content platform">
        {PLATFORMS.map((item) => {
          const selected = platform === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              className={`relative whitespace-nowrap px-3 py-3 text-sm font-semibold ${selected ? 'border-b-2 border-teal-accent text-navy-dark' : 'text-[var(--color-text-muted)]'}`}
              onClick={() => selectPlatform(item.id)}
            >
              {item.label}
              {approved[item.id] !== undefined && <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-amber-400" aria-label="Has approved caption" />}
            </button>
          );
        })}
      </div>

      {platform === 'naver' && (
        <p className="mt-4 rounded-lg border border-teal-accent/30 bg-mint-pale p-3 text-sm leading-5 text-navy-dark">
          Naver Blog favours authentic, long-form Korean editorial. These two curated templates use a blog-review format rather than short social captions.
        </p>
      )}

      {loading && (
        <p className="mt-4 flex items-center gap-2 rounded-lg bg-mint-pale p-3 text-sm text-navy-dark">
          <Loader2 size={16} className="animate-spin" /> Generating localised captions…
        </p>
      )}

      {!loading && captions && (
        <div className="mt-4 space-y-4">
          {captions.options.map((text, index) => (
            <CaptionOptionCard
              key={`${platform}-${index}`}
              index={index}
              title={captions.optionNames[index] ?? `Option ${index + 1}`}
              initialText={text}
              limit={PLATFORM_CHAR_LIMITS[platform]}
              metadata={captions.optionMetadata[index]}
              approved={approved[platform] === index}
              onApprove={(editedText) => approve(index, editedText)}
            />
          ))}
        </div>
      )}

      {!loading && !captions && (
        <p className="mt-4 rounded-lg border border-gray-light p-3 text-sm text-[var(--color-text-muted)]">
          No generated content yet for this platform.
        </p>
      )}
    </section>
  );
}
