/**
 * Attach stage — the Visual guide beside the upload. With a caption chosen it
 * opens on one action, "Generate AI shots"; a loading state follows, then four
 * shots for that caption, one at a time (captionShots.ts), each with how to
 * take it. "View full guide" opens every shot at once, with the market tips.
 *
 * The generation is MOCK for now: the shots are the caption's own moments
 * matched to sample photos, revealed after a short delay (MOCK_GENERATION_MS)
 * standing in for the generation request.
 */
import { ArrowLeft, ArrowRight, ImageIcon, Sparkles } from 'lucide-react';
import { ShotCarousel } from './ShotSlides';
import type { ShotSlide, ShotsState } from './captionShots';

interface VisualGuidePanelProps {
  slides: ShotSlide[];
  /** idle: the generate action · loading · ready: the shots. */
  state?: ShotsState;
  onGenerate?: () => void;
  marketName?: string;
  onOpenGuide: () => void;
  /** Back to Draft, for the no-caption state. */
  onChooseCaption?: () => void;
}

export default function VisualGuidePanel({
  slides,
  state = 'ready',
  onGenerate,
  marketName,
  onOpenGuide,
  onChooseCaption,
}: VisualGuidePanelProps) {
  const fromAI = slides.some((s) => s.source === 'ai');
  const ready = state === 'ready' && slides.length > 0;

  return (
    <section
      className="vg-panel"
      aria-labelledby="vg-panel-title"
      data-state={slides.length ? state : 'empty'}
      aria-busy={state === 'loading' || undefined}
    >
      <header className="vg-panel-head">
        <span className="vg-panel-icon" aria-hidden="true"><ImageIcon size={20} /></span>
        <div>
          <h4 id="vg-panel-title" className="vg-panel-title">Visual guide</h4>
          <p className="vg-panel-sub">
            {fromAI
              ? 'Shots from your AI shot list, with how to take them.'
              : `Shots for your caption${marketName ? ` and travelers from ${marketName}` : ''}, with how to take them.`}
          </p>
        </div>
        {ready && (
          <button type="button" className="vg-full-link" onClick={onOpenGuide}>
            View full guide <ArrowRight size={14} aria-hidden="true" />
          </button>
        )}
      </header>

      {slides.length === 0 ? (
        <div className="vg-empty">
          <p className="vg-empty-title">Choose a caption first</p>
          <p className="vg-panel-sub">The guide suggests shots for the caption you pick — what to photograph and how.</p>
          {onChooseCaption && (
            <button type="button" className="btn-outline btn-outline--sm" onClick={onChooseCaption}>
              <ArrowLeft size={14} aria-hidden="true" /> Choose a caption
            </button>
          )}
        </div>
      ) : state === 'idle' ? (
        <div className="vg-generate">
          <span className="vg-generate-glyph" aria-hidden="true"><Sparkles size={26} /></span>
          <p className="vg-generate-title">Get shot ideas for this caption</p>
          <p className="vg-generate-sub">
            CeView suggests {slides.length} shots for your caption — what to photograph, from which angle, and how to
            take it.
          </p>
          <button type="button" className="vg-generate-btn" onClick={onGenerate}>
            <Sparkles size={18} aria-hidden="true" /> Generate AI shots
          </button>
        </div>
      ) : state === 'loading' ? (
        <div className="vg-loading" role="status">
          <div className="vg-skel" aria-hidden="true">
            <div className="vg-skel-media" />
            <div className="vg-skel-body">
              <span className="vg-skel-line vg-skel-line--chip" />
              <span className="vg-skel-line vg-skel-line--title" />
              <span className="vg-skel-line" />
              <span className="vg-skel-line" />
              <span className="vg-skel-line vg-skel-line--short" />
              <span className="vg-skel-line" />
              <span className="vg-skel-line vg-skel-line--short" />
            </div>
          </div>
          <p className="vg-loading-text">
            <Sparkles size={15} aria-hidden="true" /> Generating shots for your caption…
          </p>
        </div>
      ) : (
        // Each photo carries its own "Example for inspiration" tag and credit.
        <ShotCarousel slides={slides} />
      )}
    </section>
  );
}
