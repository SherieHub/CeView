/**
 * How it works (#how-it-works): the one place the page explains the workflow.
 * Five phases on a dashed rail over a faint aerial reef texture, a loop from
 * phase 05 back to 02, the approval gate, then the result and the CTAs.
 *
 * Interaction: one phase is active at a time (coral node, coral "You get"
 * pill). Hover, focus or tap makes a phase active; arrow keys, Home and End
 * move between phases (roving tabindex, aria-current="step"). On desktop the
 * active phase also advances every 4s while the rail is in view and not
 * hovered or focused; never with reduced motion, and never below 1024px.
 *
 * Styles: styles/landing-how.css (.cv-how-*).
 */
import { useEffect, useRef, useState, type FocusEvent, type KeyboardEvent } from 'react';
import { Building2, ChartLine, Hand, PenLine, RefreshCw, ShieldCheck } from 'lucide-react';
import { DEMO_ANCHOR, HOW, TOUR_ANCHOR } from '../../content/landing';
import { Button, Eyebrow, LandingImage } from './ui';

const ICONS = [Building2, ChartLine, PenLine, ShieldCheck, RefreshCw];
const ADVANCE_MS = 4000;
const AUTO_QUERY = '(min-width: 1024px) and (prefers-reduced-motion: no-preference)';

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(query).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return;
    const update = () => setMatches(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [query]);
  return matches;
}

export default function WorkflowSection() {
  const count = HOW.phases.length;
  const [active, setActive] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [inView, setInView] = useState(false);
  const canAutoAdvance = useMediaQuery(AUTO_QUERY);
  const railRef = useRef<HTMLOListElement>(null);
  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    const el = railRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.4 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!canAutoAdvance || !inView || hovered || focused) return;
    const timer = window.setInterval(() => setActive((a) => (a + 1) % count), ADVANCE_MS);
    return () => window.clearInterval(timer);
  }, [canAutoAdvance, inView, hovered, focused, count]);

  const moveTo = (i: number) => {
    const next = (i + count) % count;
    setActive(next);
    itemRefs.current[next]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLLIElement>, i: number) => {
    const keys: Record<string, number> = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: count - 1 };
    if (!(e.key in keys)) return;
    e.preventDefault();
    moveTo(keys[e.key]);
  };

  const onBlur = (e: FocusEvent<HTMLOListElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
  };

  return (
    <section className="cv-how" id="how-it-works" aria-labelledby="cv-how-title">
      <div className="cv-how-media" aria-hidden="true">
        <LandingImage slot="howitworks-ocean-texture" fill decorative sizes="100vw" className="cv-how-photo" />
        <span className="cv-how-vignette" />
      </div>

      <div className="cv-container cv-how-inner">
        <header className="cv-how-head">
          <Eyebrow>{HOW.eyebrow}</Eyebrow>
          <h2 id="cv-how-title" className="cv-display-lg cv-how-title">
            {HOW.title}
          </h2>
          <p className="cv-how-intro">{HOW.intro}</p>
        </header>

        <div className="cv-how-rail">
          <div className="cv-how-loop">
            <svg viewBox="0 0 600 60" preserveAspectRatio="none" aria-hidden="true" focusable="false">
              <path d="M600 60 C600 4, 0 4, 0 60" vectorEffect="non-scaling-stroke" />
            </svg>
            <span className="cv-how-loop-head" aria-hidden="true" />
            <p className="cv-how-loop-label">{HOW.loop}</p>
          </div>

          <ol
            ref={railRef}
            className="cv-how-phases"
            aria-label="The five phases"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onFocus={() => setFocused(true)}
            onBlur={onBlur}
          >
            {HOW.phases.map((p, i) => {
              const Icon = ICONS[i];
              const isActive = i === active;
              return (
                <li
                  key={p.title}
                  ref={(el) => {
                    itemRefs.current[i] = el;
                  }}
                  className="cv-how-phase"
                  tabIndex={isActive ? 0 : -1}
                  aria-current={isActive ? 'step' : undefined}
                  data-active={isActive || undefined}
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onClick={() => setActive(i)}
                  onKeyDown={(e) => onKeyDown(e, i)}
                >
                  <span className="cv-how-node" aria-hidden="true">
                    <Icon size={26} strokeWidth={1.5} />
                  </span>
                  <div className="cv-how-text">
                    <p className="cv-how-num" aria-hidden="true">
                      {String(i + 1).padStart(2, '0')}
                    </p>
                    <h3 className="cv-how-phase-title">
                      <span className="sr-only">Phase {i + 1}: </span>
                      {p.title}
                    </h3>
                    <p className="cv-how-does">{p.does}</p>
                    <p className="cv-how-get">
                      <strong>{HOW.youGetLabel}</strong> {p.youGet}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>

          <p className="cv-how-loop-mobile">
            <RefreshCw size={18} strokeWidth={1.75} aria-hidden="true" />
            {HOW.loopMobile}
          </p>
        </div>

        <p className="cv-how-gate">
          <Hand size={18} strokeWidth={1.75} aria-hidden="true" />
          {HOW.gate}
        </p>

        <div className="cv-how-result">
          <p className="cv-how-result-text">
            <strong>{HOW.resultLead}</strong> {HOW.result}
          </p>
          <div className="cv-how-ctas">
            <Button href={DEMO_ANCHOR} size="lg">
              {HOW.primaryCta}
            </Button>
            <Button href={TOUR_ANCHOR} variant="ghost-on-dark" size="lg" play>
              {HOW.secondaryCta}
            </Button>
          </div>
          <p className="cv-how-fine">{HOW.finePrint}</p>
        </div>
      </div>
    </section>
  );
}
