/**
 * Product section part B: a guided look at the REAL CeView screens (captured
 * from the /demo sandbox with the sample business). A dark stage shows the
 * selected screen in a browser frame; the four tool cards sit beside it on
 * desktop (below it on smaller screens).
 *
 * Each screen opens on an overview with numbered points. A point — or Next —
 * zooms onto the part of the screen it explains, dims the rest, and says what
 * it is in a sentence. On phones the zoom is stronger, so the focused part is
 * readable instead of a shrunken dashboard. Points are positioned in percent
 * of the screenshot (content/landing.ts), measured from the app itself.
 *
 * Lightweight on purpose: screenshots and a little state, no app code. The
 * full product is one click away at /demo. A screenshot loads only once its
 * tool has been shown.
 *
 * WAI-ARIA tabs for the tools (arrow keys / Home / End); inactive panels are
 * `inert` + aria-hidden. The step text is a polite live region.
 */
import { useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import { ArrowLeft, ArrowRight, ChartLine, PenLine, Radar, ShieldCheck } from 'lucide-react';
import dashboardShot from './assets/dashboard.webp';
import studioShot from './assets/content-studio.webp';
import reviewShot from './assets/content-review.webp';
import performanceShot from './assets/performance.webp';
import { DEMO_ANCHOR, SCREENS, walkthroughCta } from '../../content/landing';
import type { ShowcaseBox, TourId } from '../../content/landing';
import { track } from '../../services/analytics';
import { Accent, Button, Eyebrow, IconTile, LandingImage } from './ui';

const SHOTS: Record<TourId, { src: string; label: string; icon: typeof Radar }> = {
  radar: { src: dashboardShot, label: 'app.ceview · Dashboard', icon: Radar },
  studio: { src: studioShot, label: 'app.ceview · Content Studio', icon: PenLine },
  review: { src: reviewShot, label: 'app.ceview · Content Review', icon: ShieldCheck },
  performance: { src: performanceShot, label: 'app.ceview · Performance', icon: ChartLine },
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Scale and offset that bring `box` to the middle of the frame, never past
 * the screenshot's edges. `reach` is how much of the frame the box may fill.
 */
function zoomTo(box: ShowcaseBox | null, reach: number, max: number) {
  if (!box) return { s: 1, tx: 0, ty: 0 };
  const s = clamp(reach / Math.max(box.w, box.h), 1, max);
  const half = 50 / s;
  const cx = clamp(box.x + box.w / 2, half, 100 - half);
  const cy = clamp(box.y + box.h / 2, half, 100 - half);
  return { s, tx: 50 - cx, ty: 50 - cy };
}

export default function ScreenTabs() {
  const [active, setActive] = useState(0);
  /** -1 is the overview; 0… are the numbered steps. */
  const [step, setStep] = useState(-1);
  const [seen, setSeen] = useState<Set<number>>(() => new Set([0]));
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const secondary = walkthroughCta();
  const count = SCREENS.tabs.length;

  function selectTab(index: number) {
    setActive(index);
    setStep(-1);
    setSeen((s) => new Set(s).add(index));
    track('showcase_feature_selected', { feature: SCREENS.tabs[index].id });
  }

  function goToStep(next: number) {
    const tab = SCREENS.tabs[active];
    if (next >= tab.steps.length) {
      // Past the last step: on to the next tool.
      const nextTab = (active + 1) % count;
      selectTab(nextTab);
      tabRefs.current[nextTab]?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
      return;
    }
    if (next > step) track('showcase_step_completed', { feature: tab.id, step: next + 1 });
    setStep(next);
  }

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
    selectTab(next);
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
            const current = selected && step >= 0 ? t.steps[step] : null;
            const desk = zoomTo(current?.box ?? null, 64, 1.7);
            const phone = zoomTo(current?.box ?? null, 92, 2.6);
            const layerVars = {
              '--s-d': desk.s, '--tx-d': `${desk.tx}%`, '--ty-d': `${desk.ty}%`,
              '--s-m': phone.s, '--tx-m': `${phone.tx}%`, '--ty-m': `${phone.ty}%`,
            } as CSSProperties;
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
                  <div className="cv-screens-frame-view cv-shot" data-zoomed={current ? true : undefined}>
                    <div className="cv-shot-layer" style={layerVars}>
                      {seen.has(i) && (
                        <img src={SHOTS[t.id].src} alt={t.alt} width={2000} height={1250} decoding="async" />
                      )}
                      {current && (
                        <span
                          className="cv-shot-focus"
                          aria-hidden="true"
                          style={{ left: `${current.box.x}%`, top: `${current.box.y}%`, width: `${current.box.w}%`, height: `${current.box.h}%` }}
                        />
                      )}
                      {/* Zoomed in, the other points would sit off-frame where they
                          can't be tapped — only the current one shows then. */}
                      {t.steps.map((s, n) => (current && step !== n ? null : (
                        <button
                          key={s.title}
                          type="button"
                          className="cv-shot-point"
                          style={{ left: `${s.box.x}%`, top: `${s.box.y}%` }}
                          aria-pressed={selected && step === n}
                          aria-label={`Point ${n + 1}: ${s.title}`}
                          onClick={() => goToStep(n)}
                        >
                          {n + 1}
                        </button>
                      )))}
                    </div>
                  </div>
                </figure>

                <div className="cv-walk">
                  <div className="cv-walk-text" aria-live="polite">
                    <p className="cv-walk-count">{current ? `Step ${step + 1} of ${t.steps.length}` : 'Overview'}</p>
                    <p className="cv-walk-title">{current ? current.title : t.label}</p>
                    <p className="cv-walk-body">{current ? current.body : SCREENS.overviewHint}</p>
                  </div>
                  <div className="cv-walk-nav">
                    <button
                      type="button"
                      className="cv-walk-btn"
                      onClick={() => setStep((s) => Math.max(-1, s - 1))}
                      disabled={!selected || step < 0}
                      aria-label="Previous step"
                    >
                      <ArrowLeft size={16} aria-hidden="true" />
                    </button>
                    <span className="cv-walk-dots">
                      {[-1, ...t.steps.map((_, n) => n)].map((n) => (
                        <button
                          key={n}
                          type="button"
                          aria-label={n < 0 ? 'Show the whole screen' : `Show step ${n + 1}`}
                          aria-current={selected && step === n ? 'step' : undefined}
                          onClick={() => (n < 0 ? setStep(-1) : goToStep(n))}
                        />
                      ))}
                    </span>
                    <button type="button" className="cv-walk-btn cv-walk-btn--next" onClick={() => goToStep(step + 1)}>
                      <span>{step === t.steps.length - 1 ? 'Next tool' : 'Next'}</span>
                      <ArrowRight size={16} aria-hidden="true" />
                    </button>
                  </div>
                </div>
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
                onClick={() => selectTab(i)}
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
          {/* demo_opened fires when /demo mounts; no separate click event needed. */}
          <Button to={SCREENS.tryDemoHref}>
            {SCREENS.tryDemo}
          </Button>
          <Button href={DEMO_ANCHOR} variant="secondary" arrow={false}>
            {SCREENS.requestDemo}
          </Button>
        </div>
      </div>
    </div>
  );
}
