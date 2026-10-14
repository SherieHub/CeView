/**
 * Product section part B: the REAL CeView screens (captured from the app's
 * own dev previews with the demo business), one tab each. Each panel pairs a
 * short description and three bullets with the screenshot in a browser
 * frame; numbered markers with short labels point at what the copy names.
 *
 * WAI-ARIA tabs: arrow keys / Home / End move between tabs and activate them.
 * All panels stay mounted (stacked in one grid cell, so the height never
 * jumps) and crossfade; inactive ones are `inert` + aria-hidden.
 *
 * Market radar has no screen of its own in the app: it uses the dashboard,
 * which is where surge alerts and ranked markets live.
 */
import { useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { ArrowRight, ChartLine, CircleCheck, PenLine, Radar, ShieldCheck } from 'lucide-react';
import dashboardShot from './assets/dashboard.webp';
import studioShot from './assets/content-studio.webp';
import reviewShot from './assets/content-review.webp';
import performanceShot from './assets/performance.webp';
import { DEMO_ANCHOR, SCREENS, walkthroughCta } from '../../content/landing';
import type { TourId } from '../../content/landing';
import { Eyebrow } from './ui';

const SHOTS: Record<TourId, { src: string; label: string; icon: typeof Radar }> = {
  radar: { src: dashboardShot, label: 'app.ceview · Dashboard', icon: Radar },
  studio: {
    src: studioShot,
    label: 'app.ceview · Content Studio',
    icon: PenLine,
  },
  review: {
    src: reviewShot,
    label: 'app.ceview · Content Review',
    icon: ShieldCheck,
  },
  performance: {
    src: performanceShot,
    label: 'app.ceview · Performance',
    icon: ChartLine,
  },
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
    tabRefs.current[next]?.scrollIntoView?.({
      block: 'nearest',
      inline: 'nearest',
    });
  }

  return (
    <div className="cv-screens">
      <header className="cv-screens-head">
        <Eyebrow>{SCREENS.eyebrow}</Eyebrow>
        <h3 id="cv-screens-title" className="cv-screens-title">
          {SCREENS.title}
        </h3>
      </header>

      <div className="cv-screens-tabs-wrap">
        <div className="cv-screens-tabs" role="tablist" aria-labelledby="cv-screens-title">
          {SCREENS.tabs.map((t, i) => {
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
                id={`cv-tab-${t.id}`}
                aria-selected={selected}
                aria-controls={`cv-panel-${t.id}`}
                tabIndex={selected ? 0 : -1}
                className="cv-screens-tab"
                onClick={() => setActive(i)}
                onKeyDown={(e) => onKeyDown(e, i)}
              >
                <Icon size={17} strokeWidth={1.75} aria-hidden="true" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="cv-screens-panels">
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
              <div className="cv-screens-copy">
                <p className="cv-screens-panel-title">{t.label}</p>
                <p className="cv-screens-body">{t.body}</p>
                <ul className="cv-screens-bullets">
                  {t.bullets.map((b) => (
                    <li key={b}>
                      <CircleCheck size={18} strokeWidth={1.75} aria-hidden="true" />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>

              <figure className="cv-screens-shot">
                <div className="cv-screens-frame">
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
                    {/* Brief pointers to what the copy names; hidden from AT,
                      which gets the same information from the bullets. */}
                    {t.pins.map((pin, n) => (
                      <span
                        key={n}
                        className="cv-screens-pin"
                        data-side={pin.side}
                        style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
                        aria-hidden="true"
                      >
                        <span className="cv-screens-pin-dot">{n + 1}</span>
                        <span className="cv-screens-pin-label">{pin.label}</span>
                      </span>
                    ))}
                  </div>
                </div>
                <figcaption className="cv-screens-caption">{SCREENS.caption}</figcaption>
              </figure>
            </div>
          );
        })}
      </div>

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
  );
}
