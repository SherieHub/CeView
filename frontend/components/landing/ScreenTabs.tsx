/**
 * Product section part B: the REAL CeView screens (captured from the app's
 * own dev previews with the demo business). A dark stage shows the whole
 * selected screenshot in a browser frame; the four tab cards sit beside it
 * on desktop (below it on smaller screens). The screenshot's size follows the
 * viewport height, so the stage and the caption fit on one screen.
 *
 * WAI-ARIA tabs: arrow keys / Home / End move between tabs and activate them.
 * All panels stay mounted (stacked in one grid cell) and crossfade; inactive
 * ones are `inert` + aria-hidden.
 *
 * Demand Intelligence uses the dashboard screenshot: that is where surge
 * alerts and ranked markets live in the app.
 */
import { useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { ArrowRight, ChartLine, PenLine, Radar, ShieldCheck } from 'lucide-react';
import dashboardShot from './assets/dashboard.webp';
import studioShot from './assets/content-studio.webp';
import reviewShot from './assets/content-review.webp';
import performanceShot from './assets/performance.webp';
import { DEMO_ANCHOR, SCREENS, walkthroughCta } from '../../content/landing';
import type { TourId } from '../../content/landing';
import { Accent, Eyebrow, IconTile, LandingImage } from './ui';

const SHOTS: Record<TourId, { src: string; label: string; icon: typeof Radar }> = {
  radar: { src: dashboardShot, label: 'app.ceview · Dashboard', icon: Radar },
  studio: { src: studioShot, label: 'app.ceview · Content Studio', icon: PenLine },
  review: { src: reviewShot, label: 'app.ceview · Content Review', icon: ShieldCheck },
  performance: { src: performanceShot, label: 'app.ceview · Performance', icon: ChartLine },
};

export default function ScreenTabs() {
  const [active, setActive] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const secondary = walkthroughCta();
  const count = SCREENS.tabs.length;

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
    <div className="cv-screens">
      <header className="cv-screens-head">
        <div className="cv-screens-heading">
          <Eyebrow>{SCREENS.eyebrow}</Eyebrow>
          <h3 id="cv-screens-title" className="cv-display-lg cv-screens-title">
            {SCREENS.titleLead}
            <Accent>{SCREENS.titleAccent}</Accent>
            {SCREENS.titleTail}
          </h3>
        </div>
        <p className="cv-body-lg cv-screens-intro">{SCREENS.intro}</p>
      </header>

      <div className="cv-screens-layout">
        <div className="cv-screens-stage">
          <div className="cv-screens-stage-bg" aria-hidden="true">
            <LandingImage slot="howitworks-ocean-texture" fill decorative sizes="(min-width: 1024px) 80vw, 100vw" />
          </div>
          {SCREENS.tabs.map((t, i) => {
            const selected = i === active;
            return (
              <div
                key={t.id}
                role="tabpanel"
                id={`cv-panel-${t.id}`}
                aria-labelledby={`cv-tab-${t.id}`}
                className="cv-screens-panel"
                data-active={selected || undefined}
                aria-hidden={!selected}
                inert={!selected}
              >
                <div className="cv-screens-pills">
                  <p className="cv-screens-status">
                    <span className="cv-screens-status-dot" aria-hidden="true" />
                    {t.status}
                  </p>
                  <span className="cv-screens-real">{SCREENS.realBadge}</span>
                </div>
                <figure className="cv-screens-frame">
                  <div className="cv-screens-frame-bar" aria-hidden="true">
                    <span className="cv-screens-frame-dots">
                      <i />
                      <i />
                      <i />
                    </span>
                    <span className="cv-screens-frame-url">{SHOTS[t.id].label}</span>
                  </div>
                  <div className="cv-screens-frame-view">
                    <img src={SHOTS[t.id].src} alt={t.alt} width={1800} height={1125} loading="lazy" decoding="async" />
                  </div>
                </figure>
              </div>
            );
          })}
        </div>

        <div className="cv-screens-tabs" role="tablist" aria-label="Product areas">
          {SCREENS.tabs.map((t, i) => {
            const selected = i === active;
            return (
              <button
                key={t.id}
                ref={(el) => {
                  tabRefs.current[i] = el;
                }}
                type="button"
                role="tab"
                id={`cv-tab-${t.id}`}
                aria-selected={selected}
                aria-controls={`cv-panel-${t.id}`}
                aria-labelledby={`cv-tab-${t.id}-name`}
                aria-describedby={`cv-tab-${t.id}-body`}
                tabIndex={selected ? 0 : -1}
                className="cv-screens-tab"
                onClick={() => setActive(i)}
                onKeyDown={(e) => onKeyDown(e, i)}
              >
                <IconTile icon={SHOTS[t.id].icon} tone={t.tone} />
                <span className="cv-screens-tab-text">
                  <span className="cv-screens-tab-top">
                    <span className="cv-screens-tab-name" id={`cv-tab-${t.id}-name`}>
                      {t.label}
                    </span>
                    {selected && <span className="cv-screens-shown">{SCREENS.shownLabel}</span>}
                  </span>
                  <span className="cv-screens-tab-body" id={`cv-tab-${t.id}-body`}>
                    {t.body}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="cv-screens-foot">
        <p className="cv-screens-caption">{SCREENS.caption}</p>
        <div className="cv-screens-links">
          {secondary.external && (
            <a href={secondary.href} className="cv-screens-link" target="_blank" rel="noopener noreferrer">
              Watch the Full Walkthrough <ArrowRight size={16} aria-hidden="true" />
            </a>
          )}
          <a href={DEMO_ANCHOR} className="cv-screens-link">
            {SCREENS.ctaLead} {SCREENS.ctaLink} <ArrowRight size={16} aria-hidden="true" />
          </a>
        </div>
      </div>
    </div>
  );
}
