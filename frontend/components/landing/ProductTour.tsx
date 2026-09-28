/**
 * "See CeView in action" — an interactive tour over REAL product screens
 * (captured from the app's own dev previews with the demo business).
 *
 * WAI-ARIA tabs: arrow keys / Home / End move between tabs and activate them.
 * All four panels stay mounted so the screenshots can crossfade; inactive ones
 * are `inert` + aria-hidden, so only the visible panel is reachable.
 */
import { useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { ArrowRight, ChartLine, CircleCheck, PenLine, Radar, ShieldCheck } from 'lucide-react';
import dashboardShot from './assets/dashboard.webp';
import studioShot from './assets/content-studio.webp';
import reviewShot from './assets/content-review.webp';
import performanceShot from './assets/performance.webp';
import { TOUR, walkthroughCta } from './landingContent';
import type { TourId } from './landingContent';
import { BrowserFrame, Pin, SectionHead } from './landingParts';

const SHOTS: Record<TourId, { src: string; label: string; icon: typeof Radar }> = {
  demand: { src: dashboardShot, label: 'app.ceview · Dashboard', icon: Radar },
  studio: { src: studioShot, label: 'app.ceview · Content Studio', icon: PenLine },
  review: { src: reviewShot, label: 'app.ceview · Content Review', icon: ShieldCheck },
  performance: { src: performanceShot, label: 'app.ceview · Performance', icon: ChartLine },
};

export default function ProductTour() {
  const [active, setActive] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const secondary = walkthroughCta();
  const count = TOUR.tabs.length;

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next =
      e.key === 'ArrowRight' || e.key === 'ArrowDown'
        ? (index + 1) % count
        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
          ? (index - 1 + count) % count
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? count - 1
              : null;
    if (next === null) return;
    e.preventDefault();
    setActive(next);
    tabRefs.current[next]?.focus();
  }

  return (
    <section className="lp-section lp-section--white lp-tour" id="product" aria-labelledby="lp-tour-title">
      <div className="lp-wrap">
        <SectionHead id="lp-tour-title" eyebrow={TOUR.eyebrow} title={TOUR.title} lede={TOUR.lede} align="center" />

        <div className="lp-tour-grid">
          <div className="lp-tour-tabs" role="tablist" aria-label="Product areas" aria-orientation="vertical">
            {TOUR.tabs.map((t, i) => {
              const Icon = SHOTS[t.id].icon;
              const selected = i === active;
              return (
                <button
                  key={t.id}
                  ref={(el) => {
                    tabRefs.current[i] = el;
                  }}
                  type="button"
                  role="tab"
                  id={`lp-tab-${t.id}`}
                  aria-selected={selected}
                  aria-controls={`lp-panel-${t.id}`}
                  tabIndex={selected ? 0 : -1}
                  className="lp-tour-tab"
                  onClick={() => setActive(i)}
                  onKeyDown={(e) => onKeyDown(e, i)}
                >
                  <span className="lp-tour-tab-icon" aria-hidden="true">
                    <Icon size={20} />
                  </span>
                  <span className="lp-tour-tab-text">
                    <span className="lp-tour-tab-title">{t.title}</span>
                    <span className="lp-tour-tab-benefit">{t.benefit}</span>
                    <span className="lp-tour-tab-points">
                      {t.points.map((p) => (
                        <span key={p}>
                          <CircleCheck size={15} aria-hidden="true" />
                          {p}
                        </span>
                      ))}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="lp-tour-stage">
            <span className="lp-tour-glow" aria-hidden="true" />
            {TOUR.tabs.map((t, i) => {
              const selected = i === active;
              return (
                <div
                  key={t.id}
                  role="tabpanel"
                  id={`lp-panel-${t.id}`}
                  aria-labelledby={`lp-tab-${t.id}`}
                  className="lp-tour-panel"
                  data-active={selected || undefined}
                  aria-hidden={!selected}
                  inert={!selected}
                >
                  <BrowserFrame src={SHOTS[t.id].src} alt={t.alt} label={SHOTS[t.id].label}>
                    {t.pins.map((p, n) => (
                      <Pin key={p.label} n={n + 1} x={p.x} y={p.y} label={p.label} />
                    ))}
                  </BrowserFrame>
                  <div className="lp-tour-detail">
                    <p className="lp-body">{t.benefit}</p>
                    <ul>
                      {t.points.map((p) => (
                        <li key={p}>
                          <CircleCheck size={15} aria-hidden="true" />
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lp-tour-foot">
          <p className="lp-shot-note">{TOUR.caption}</p>
          {secondary.external && (
            <a href={secondary.href} className="lp-link-arrow" target="_blank" rel="noopener noreferrer">
              Watch the Full Walkthrough <ArrowRight size={16} aria-hidden="true" />
            </a>
          )}
          <a href="#request-demo" className="lp-link-arrow">
            {TOUR.cta} Request a demo <ArrowRight size={16} aria-hidden="true" />
          </a>
        </div>
      </div>
    </section>
  );
}
