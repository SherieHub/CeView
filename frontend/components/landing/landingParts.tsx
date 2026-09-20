/**
 * Small building blocks shared by the landing page sections.
 */
import { useEffect, useId } from 'react';
import type { ReactNode, RefObject } from 'react';
import { isPlaceholder } from './landingContent';

/**
 * An unconfirmed value, rendered so it is impossible to mistake for real copy.
 * See the PLACEHOLDERS note in landingContent.ts.
 */
export function Placeholder({ value }: { value: string }) {
  return (
    <span className="lp-ph" data-placeholder="true">
      {value}
    </span>
  );
}

/**
 * A link whose destination may not be confirmed yet. With a real URL it is an
 * ordinary anchor; with a placeholder it renders the label plus the visible
 * token instead of a link that goes nowhere.
 */
export function MaybeLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  if (isPlaceholder(href)) {
    return (
      <span className={className}>
        {children} <Placeholder value={href} />
      </span>
    );
  }
  const external = /^https?:/i.test(href);
  return (
    <a
      href={href}
      className={className}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      {children}
    </a>
  );
}

/** Eyebrow + heading + optional lede, in the app's §3 type scale. */
export function SectionHead({
  eyebrow,
  title,
  lede,
  id,
  align = 'center',
  tone = 'light',
}: {
  eyebrow: string;
  title: string;
  lede?: string;
  id?: string;
  align?: 'center' | 'left';
  tone?: 'light' | 'dark';
}) {
  return (
    <header className="lp-head" data-align={align} data-tone={tone} data-reveal>
      <p className="lp-eyebrow">{eyebrow}</p>
      <h2 className="lp-title" id={id}>
        {title}
      </h2>
      {lede && <p className="lp-lede">{lede}</p>}
    </header>
  );
}

/**
 * Adds data-reveal="in" to every [data-reveal] element under `root` as it
 * scrolls into view. One observer for the whole page.
 *
 * Where IntersectionObserver is unavailable (older browsers, jsdom) everything
 * is revealed immediately — content must never depend on the animation to be
 * visible. prefers-reduced-motion is handled in CSS, not here.
 */
export function useReveal(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const targets = Array.from(el.querySelectorAll<HTMLElement>('[data-reveal]'));

    if (typeof IntersectionObserver === 'undefined') {
      targets.forEach((t) => t.setAttribute('data-reveal', 'in'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.setAttribute('data-reveal', 'in');
            observer.unobserve(entry.target);
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
    );
    targets.forEach((t) => observer.observe(t));
    return () => observer.disconnect();
  }, [root]);
}

/* ── The opportunity line ─────────────────────────────────────────────────
   The page's signature graphic, taken from the logo's own cyan -> orange
   sweep: twelve calm weeks of measured interest in the app's deep teal, then
   a dashed look-ahead that warms to orange where it crosses into a demand
   window. Illustrative shape only — it carries no real data, so it is
   aria-hidden and every surface that shows it says so. */

const W = 560;
const H = 240;
const TOP = 24;
const BOTTOM = 212;

/** 0-100 interest onto the drawing's y axis. */
const y = (v: number) => BOTTOM - (v / 100) * (BOTTOM - TOP);

const OBSERVED = [34, 37, 35, 39, 38, 41, 40, 43, 42, 45, 47, 50];
const FORECAST = [50, 54, 59, 64, 68, 71, 73, 74, 74, 73, 72, 71];
const THRESHOLD = 58;

const OBS_STEP = 240 / (OBSERVED.length - 1);
const NOW_X = 24 + 240;
const FC_STEP = (W - 20 - NOW_X) / (FORECAST.length - 1);

const observedPts = OBSERVED.map((v, i) => [24 + i * OBS_STEP, y(v)] as const);
const forecastPts = FORECAST.map((v, i) => [NOW_X + i * FC_STEP, y(v)] as const);

/** Where the look-ahead first crosses the threshold, linearly interpolated. */
const crossing = (() => {
  for (let i = 1; i < FORECAST.length; i++) {
    const a = FORECAST[i - 1];
    const b = FORECAST[i];
    if (a < THRESHOLD && b >= THRESHOLD) {
      const t = (THRESHOLD - a) / (b - a);
      return { x: NOW_X + (i - 1 + t) * FC_STEP, y: y(THRESHOLD) };
    }
  }
  return { x: NOW_X, y: y(THRESHOLD) };
})();

/** Catmull-Rom through the points, as cubic Béziers — smooth without overshoot at this density. */
function smooth(points: ReadonlyArray<readonly [number, number]>): string {
  let d = `M${points[0][0].toFixed(1)},${points[0][1].toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

const OBSERVED_PATH = smooth(observedPts);
const FORECAST_PATH = smooth(forecastPts);
const AREA_PATH = `${OBSERVED_PATH} L${NOW_X},${BOTTOM} L24,${BOTTOM} Z`;

export function OpportunityLine({ className }: { className?: string }) {
  // Gradient ids must be unique per instance — the hero and the preview both render one.
  const uid = useId().replace(/:/g, '');
  const warm = `lp-warm-${uid}`;
  const fill = `lp-fill-${uid}`;

  return (
    <svg
      className={`lp-oline ${className ?? ''}`}
      viewBox={`0 0 ${W} ${H}`}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={warm} gradientUnits="userSpaceOnUse" x1={NOW_X} y1="0" x2={W - 20} y2="0">
          <stop offset="0%" stopColor="var(--color-teal-accent)" />
          <stop offset="45%" stopColor="var(--color-sand)" />
          <stop offset="100%" stopColor="var(--color-coral-cta)" />
        </linearGradient>
        <linearGradient id={fill} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-cyan-accent)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--color-cyan-accent)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* The demand window — only the stretch past the threshold crossing. */}
      <rect
        className="lp-oline-window"
        x={crossing.x}
        y={TOP - 8}
        width={W - 20 - crossing.x}
        height={BOTTOM - TOP + 8}
        rx="10"
      />

      <line className="lp-oline-threshold" x1="24" x2={W - 20} y1={y(THRESHOLD)} y2={y(THRESHOLD)} />
      <line className="lp-oline-now" x1={NOW_X} x2={NOW_X} y1={TOP - 8} y2={BOTTOM} />

      <path className="lp-oline-area" d={AREA_PATH} fill={`url(#${fill})`} />
      <path className="lp-oline-observed" d={OBSERVED_PATH} pathLength={1} />
      <path className="lp-oline-forecast" d={FORECAST_PATH} stroke={`url(#${warm})`} />

      <g className="lp-oline-pulse" transform={`translate(${crossing.x.toFixed(1)} ${crossing.y.toFixed(1)})`}>
        <circle r="14" className="lp-oline-halo" />
        <circle r="6" className="lp-oline-dot" />
      </g>
    </svg>
  );
}

/**
 * Position of the "now" divider and the window's start, as % of the drawing —
 * for HTML labels laid over it. Valid because the drawing's container holds
 * the same W:H aspect ratio (see .lp-oline-frame), so the SVG fills it exactly.
 */
export const OPPORTUNITY_ASPECT = `${W} / ${H}`;
export const OPPORTUNITY_LAYOUT = {
  nowPct: (NOW_X / W) * 100,
  windowPct: (crossing.x / W) * 100,
  thresholdPct: (y(THRESHOLD) / H) * 100,
} as const;
