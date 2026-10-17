/**
 * Quick Post — Attach. The upload (PublishComposer's media half, unchanged in
 * behaviour) and what the media must meet on the left; the Visual guide — four
 * shots for the chosen caption, with how to take them — on the right; and why
 * it matters across the foot of both. The stage's own header sits above the left column (studio.css).
 */
import { CheckCircle2, FileCheck2, Info } from 'lucide-react';
import PublishComposer from './PublishComposer';
import VisualGuidePanel from './VisualGuidePanel';
import type { ShotSlide, ShotsState } from './captionShots';
import type { AuditState, PublishDraftState, StudioPlatformId } from './contentStudioTypes';

interface AttachStageProps {
  draft: PublishDraftState;
  onDraftChange: (patch: Partial<PublishDraftState>) => void;
  audit: AuditState;
  platform: StudioPlatformId;
  stageToken?: number;
  marketName?: string;
  /** The chosen caption's shots — see captionShots.ts. */
  slides: ShotSlide[];
  shotsState: ShotsState;
  onGenerateShots: () => void;
  onOpenGuide: () => void;
  onChooseCaption: () => void;
}

const REQUIREMENTS = [
  'PNG, JPG, or WEBP format',
  'High resolution (recommended)',
  'Maximum file size: 20 MB',
  'Clear and relevant to your caption',
];

export default function AttachStage({
  draft,
  onDraftChange,
  audit,
  platform,
  stageToken,
  marketName,
  slides,
  shotsState,
  onGenerateShots,
  onOpenGuide,
  onChooseCaption,
}: AttachStageProps) {
  return (
    <div className="att">
      <div className="att-main">
        <PublishComposer
          draft={draft}
          onDraftChange={onDraftChange}
          audit={audit}
          platform={platform}
          stageToken={stageToken}
          onOpenBrief={onOpenGuide}
          part="media"
        />

        <section className="att-box" aria-labelledby="att-req-title">
          <h4 id="att-req-title" className="att-box-title">
            <FileCheck2 size={18} aria-hidden="true" /> Media requirements
          </h4>
          <ul className="att-req">
            {REQUIREMENTS.map((r) => (
              <li key={r}><CheckCircle2 size={15} aria-hidden="true" /> {r}</li>
            ))}
          </ul>
        </section>
      </div>

      <VisualGuidePanel
        slides={slides}
        state={shotsState}
        onGenerate={onGenerateShots}
        marketName={marketName}
        onOpenGuide={onOpenGuide}
        onChooseCaption={onChooseCaption}
      />

      {/* Arrives with the shots, not before. */}
      {shotsState === 'ready' && slides.length > 0 && (
        <aside className="att-box att-box--info att-why" aria-labelledby="att-why-title">
          <Info size={20} aria-hidden="true" />
          <div>
            <h4 id="att-why-title" className="att-box-title">Why this matters</h4>
            <p>
              The compliance audit checks your photo against your business profile and this post&rsquo;s visual
              guidance, so a clear, authentic photo of your own place does best
              {marketName ? ` — and it’s what travelers from ${marketName} will judge you on` : ''}.
            </p>
          </div>
        </aside>
      )}
    </div>
  );
}
