/**
 * The demo's guided tour and its welcome card.
 *
 * Not a modal: the card floats bottom-right (a bottom sheet on phones) and the
 * page stays usable, so a visitor can try what a stop describes. The element
 * a stop is about gets an outline that follows it as the page scrolls. Escape
 * or "Exit tour" ends it; the visitor stays where they are.
 */
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Compass, X } from 'lucide-react';
import { TOUR_STEPS } from './tourSteps';
import { track } from '../../services/analytics';

/** Outlines the stop's element, following it through scrolls and resizes. */
function Spotlight({ selector, stepKey }: { selector?: string; stepKey: string }) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    setRect(null);
    if (!selector) return;
    let el: Element | null = null;
    let tries = 0;
    let frame = 0;
    // The screen may still be loading (lazy route, sample-data delay).
    const find = window.setInterval(() => {
      el = document.querySelector(selector);
      if (el || ++tries > 40) {
        window.clearInterval(find);
        if (el) {
          const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
          el.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
          measure();
        }
      }
    }, 100);
    const measure = () => {
      frame = 0;
      if (el && el.isConnected) setRect(el.getBoundingClientRect());
      else setRect(null);
    };
    const onMove = () => { if (!frame) frame = requestAnimationFrame(measure); };
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    const settle = window.setInterval(onMove, 400);
    return () => {
      window.clearInterval(find);
      window.clearInterval(settle);
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [selector, stepKey]);

  if (!rect || rect.width === 0) return null;
  const pad = 8;
  return (
    <div
      className="dm-spot"
      aria-hidden="true"
      style={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }}
    />
  );
}

export function DemoTour({ index, onIndex, onExit }: {
  index: number;
  onIndex: (index: number) => void;
  onExit: () => void;
}) {
  const step = TOUR_STEPS[index];
  const last = index === TOUR_STEPS.length - 1;
  const navigate = useNavigate();
  const location = useLocation();
  const titleRef = useRef<HTMLHeadingElement>(null);

  // Each stop opens its screen.
  useEffect(() => {
    if (`${location.pathname}${location.search}` !== step.route) navigate(step.route);
    titleRef.current?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onExit(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onExit]);

  function next() {
    if (last) {
      track('demo_guided_tour_completed');
      onExit();
      return;
    }
    onIndex(index + 1);
  }

  return (
    <>
      <Spotlight selector={step.target} stepKey={step.id} />
      <section className="dm-tour" role="dialog" aria-modal="false" aria-labelledby="dm-tour-title">
        <div className="dm-tour-top">
          <span className="dm-tour-stage">
            <Compass size={14} aria-hidden="true" /> {step.stage}
          </span>
          <span className="dm-tour-count num">{index + 1} / {TOUR_STEPS.length}</span>
          <button type="button" className="dm-tour-x" onClick={onExit} aria-label="Exit tour">
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <div className="dm-tour-bar" aria-hidden="true">
          <i style={{ width: `${((index + 1) / TOUR_STEPS.length) * 100}%` }} />
        </div>
        <div aria-live="polite">
          <h2 id="dm-tour-title" className="dm-tour-title" tabIndex={-1} ref={titleRef}>{step.title}</h2>
          <p className="dm-tour-body">{step.body}</p>
        </div>
        {last ? (
          <div className="dm-tour-end">
            <Link
              to="/#demo"
              className="dm-action dm-action--primary"
              onClick={() => { track('demo_request_cta_clicked', { from: 'tour_end' }); track('demo_guided_tour_completed'); }}
            >
              Request a personalized demo
            </Link>
            <button type="button" className="dm-action" onClick={next}>Keep exploring</button>
          </div>
        ) : (
          <div className="dm-tour-nav">
            <button type="button" className="dm-action" onClick={() => onIndex(index - 1)} disabled={index === 0}>
              <ArrowLeft size={15} aria-hidden="true" /> Back
            </button>
            <button type="button" className="dm-tour-skip" onClick={onExit}>Skip tour</button>
            <button type="button" className="dm-action dm-action--primary" onClick={next}>
              Next <ArrowRight size={15} aria-hidden="true" />
            </button>
          </div>
        )}
      </section>
    </>
  );
}

/** First visit: start the tour or look around. Never blocks the page. */
export function DemoIntro({ onTour, onExplore }: { onTour: () => void; onExplore: () => void }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => { ref.current?.focus({ preventScroll: true }); }, []);
  return (
    <section className="dm-tour dm-intro" role="dialog" aria-modal="false" aria-labelledby="dm-intro-title">
      <span className="dm-intro-icon" aria-hidden="true"><Compass size={20} /></span>
      <h2 id="dm-intro-title" className="dm-tour-title" tabIndex={-1} ref={ref}>Welcome to the CeView demo</h2>
      <p className="dm-tour-body">
        You’re looking at the real CeView app, filled with sample data for a fictional Cebu resort. Nothing you do here
        is saved or posted.
      </p>
      <div className="dm-tour-end">
        <button type="button" className="dm-action dm-action--primary" onClick={onTour}>
          Take the 2-minute tour <ArrowRight size={15} aria-hidden="true" />
        </button>
        <button type="button" className="dm-action" onClick={onExplore}>Explore on my own</button>
      </div>
    </section>
  );
}
