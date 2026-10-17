/**
 * The caption's shots (captionShots.ts) — one slide each: an inspiration
 * photo, the caption line it illustrates, the angle, and how to take it.
 * `ShotCarousel` is the Attach page's one-at-a-time view; `ShotList` is the
 * full guide's all-at-once view.
 */
import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Bot, Camera, ChevronLeft, ChevronRight, Lightbulb, Maximize2, MessageSquareQuote, Sparkles } from 'lucide-react';
import { LandingImage } from '../../landing/ui';
import Modal from '../../shared/Modal';
import { imageFor } from '../../../content/image-credits';
import type { ShotSlide } from './captionShots';

const SOURCE_LABEL: Record<ShotSlide['source'], string> = {
  ai: 'AI shot',
  caption: 'From your caption',
  guide: 'Platform guide',
};

function Credit({ slide }: { slide: ShotSlide }) {
  const img = imageFor(slide.slot);
  return <p className="ss-credit">Example photo — {img.attribution ?? `${img.photographer} (${img.license})`}</p>;
}

export function SlideBody({ slide, n, total }: { slide: ShotSlide; n: number; total: number }) {
  return (
    <div className="ss-body">
      <p className="ss-meta">
        <span className="ss-source" data-source={slide.source}>
          {slide.source === 'ai' ? <Bot size={12} aria-hidden="true" /> : <Sparkles size={12} aria-hidden="true" />}
          {SOURCE_LABEL[slide.source]}
        </span>
        <span className="ss-count">Shot {n} of {total}</span>
      </p>
      <h5 className="ss-title">{slide.title}</h5>
      {slide.quote && (
        <p className="ss-quote">
          <MessageSquareQuote size={14} aria-hidden="true" />
          <span>“{slide.quote}”</span>
        </p>
      )}
      {slide.angle && (
        <p className="ss-angle">
          <Camera size={14} aria-hidden="true" /> {slide.angle}
        </p>
      )}
      <ol className="ss-steps">
        {slide.steps.map((s) => <li key={s}>{s}</li>)}
      </ol>
      {slide.lighting && (
        <p className="ss-light">
          <Lightbulb size={14} aria-hidden="true" />
          <span><b>Light:</b> {slide.lighting}</span>
        </p>
      )}
    </div>
  );
}

function SlideMedia({ slide, onExpand }: { slide: ShotSlide; onExpand: () => void }) {
  return (
    <div className="ss-media">
      <LandingImage slot={slide.slot} fill sizes="(max-width: 767px) 100vw, 480px" />
      <span className="ss-tag">Example for inspiration</span>
      <button type="button" className="ss-expand" aria-label={`View ${slide.title} full size`} title="View full size" onClick={onExpand}>
        <Maximize2 size={15} aria-hidden="true" />
      </button>
    </div>
  );
}

/**
 * The photo uncropped — the slide crops it to fill its frame, and the framing
 * is the point of an inspiration shot. Pages through every shot.
 */
function ShotViewer({ slides, index, onIndex, onClose }: { slides: ShotSlide[]; index: number | null; onIndex: (i: number) => void; onClose: () => void }) {
  const slide = index == null ? null : slides[index];
  const go = (n: number) => onIndex((n + slides.length) % slides.length);
  // Arrow keys page the viewer wherever focus is — it opens from a button
  // that stays focused behind it.
  const goRef = useRef(go);
  goRef.current = go;
  useEffect(() => {
    if (index == null) return;
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      e.stopPropagation();
      goRef.current((index as number) + (e.key === 'ArrowRight' ? 1 : -1));
    }
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [index]);
  return (
    <Modal open={slide != null} onClose={onClose} title={slide?.title ?? 'Shot'}>
      {slide && index != null && (
        <div className="ss-viewer">
          <div className="ss-viewer-stage">
            <LandingImage slot={slide.slot} sizes="(max-width: 767px) 100vw, 1000px" className="ss-viewer-img" />
            {slides.length > 1 && (
              <>
                <button type="button" className="ss-nav ss-nav--prev" aria-label="Previous shot" onClick={() => go(index - 1)}>
                  <ChevronLeft size={18} aria-hidden="true" />
                </button>
                <button type="button" className="ss-nav ss-nav--next" aria-label="Next shot" onClick={() => go(index + 1)}>
                  <ChevronRight size={18} aria-hidden="true" />
                </button>
              </>
            )}
          </div>
          <div className="ss-viewer-foot">
            <div>
              {slide.quote && <p className="ss-viewer-quote">“{slide.quote}”</p>}
              {slide.angle && (
                <p className="ss-angle"><Camera size={14} aria-hidden="true" /> {slide.angle}</p>
              )}
              <Credit slide={slide} />
            </div>
            <span className="ss-count">Shot {index + 1} of {slides.length}</span>
          </div>
        </div>
      )}
    </Modal>
  );
}

export function ShotCarousel({ slides }: { slides: ShotSlide[] }) {
  const [index, setIndex] = useState(0);
  const [viewing, setViewing] = useState<number | null>(null);
  const key = slides.map((s) => s.id).join('|');
  // A new caption is a new set of shots: start from the first.
  useEffect(() => setIndex(0), [key]);
  const i = Math.min(index, slides.length - 1);
  const slide = slides[i];
  if (!slide) return null;

  const go = (next: number) => setIndex((next + slides.length) % slides.length);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') go(i + 1);
    else if (e.key === 'ArrowLeft') go(i - 1);
  };

  return (
    <div
      className="ss-carousel"
      role="region"
      aria-roledescription="carousel"
      aria-label="Shots for your caption"
      tabIndex={0}
      onKeyDown={onKey}
    >
      <div className="ss-slide" role="group" aria-roledescription="slide" aria-label={`Shot ${i + 1} of ${slides.length}: ${slide.title}`}>
        <div className="ss-media-wrap">
          <SlideMedia slide={slide} onExpand={() => setViewing(i)} />
          {slides.length > 1 && (
            <>
              <button type="button" className="ss-nav ss-nav--prev" aria-label="Previous shot" onClick={() => go(i - 1)}>
                <ChevronLeft size={18} aria-hidden="true" />
              </button>
              <button type="button" className="ss-nav ss-nav--next" aria-label="Next shot" onClick={() => go(i + 1)}>
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            </>
          )}
        </div>
        <SlideBody slide={slide} n={i + 1} total={slides.length} />
      </div>
      <div className="ss-foot">
        <Credit slide={slide} />
        {slides.length > 1 && (
          <div className="ss-dots">
            {slides.map((s, n) => (
              <button
                key={s.id}
                type="button"
                className="ss-dot"
                aria-label={`Show shot ${n + 1}: ${s.title}`}
                aria-current={n === i || undefined}
                onClick={() => setIndex(n)}
              />
            ))}
          </div>
        )}
      </div>
      <ShotViewer
        slides={slides}
        index={viewing}
        // Paging in the viewer moves the carousel with it.
        onIndex={(n) => {
          setViewing(n);
          setIndex(n);
        }}
        onClose={() => setViewing(null)}
      />
    </div>
  );
}

export function ShotList({ slides }: { slides: ShotSlide[] }) {
  const [viewing, setViewing] = useState<number | null>(null);
  return (
    <>
    <ShotViewer slides={slides} index={viewing} onIndex={setViewing} onClose={() => setViewing(null)} />
    <ol className="ss-list">
      {slides.map((slide, n) => (
        <li key={slide.id} className="ss-item">
          <div>
            <SlideMedia slide={slide} onExpand={() => setViewing(n)} />
            <Credit slide={slide} />
          </div>
          <SlideBody slide={slide} n={n + 1} total={slides.length} />
        </li>
      ))}
    </ol>
    </>
  );
}
