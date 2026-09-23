/**
 * Small building blocks shared by the landing sections. Styling lives in
 * styles/index.css under "Landing page" (.lp-*), so the brand tokens stay the
 * single source of truth.
 */
import type { ReactNode } from 'react';
import { ArrowRight, PlayCircle } from 'lucide-react';
import { DEMO_ANCHOR, walkthroughCta } from './landingContent';

export function SectionHead({
  id,
  eyebrow,
  title,
  lede,
  align = 'left',
  tone = 'light',
}: {
  id: string;
  eyebrow: string;
  title: ReactNode;
  lede?: ReactNode;
  align?: 'left' | 'center';
  tone?: 'light' | 'dark';
}) {
  return (
    <header className="lp-head" data-align={align} data-tone={tone}>
      <p className="lp-eyebrow">{eyebrow}</p>
      <h2 className="lp-h2" id={id}>
        {title}
      </h2>
      {lede && <p className="lp-lede">{lede}</p>}
    </header>
  );
}

/** "Request a Demo" + the walkthrough/tour CTA, as a pair. */
export function CtaPair({ tone = 'light', center = false }: { tone?: 'light' | 'dark'; center?: boolean }) {
  const secondary = walkthroughCta();
  return (
    <div className="lp-cta-row" data-center={center || undefined}>
      <a href={DEMO_ANCHOR} className="lp-btn lp-btn--primary" data-tone={tone}>
        Request a Demo
        <ArrowRight size={18} aria-hidden="true" />
      </a>
      <a
        href={secondary.href}
        className={tone === 'dark' ? 'lp-btn lp-btn--ghost-inverse' : 'lp-btn lp-btn--ghost'}
        {...(secondary.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      >
        <PlayCircle size={18} aria-hidden="true" />
        {secondary.label}
      </a>
    </div>
  );
}

/**
 * A light browser window around a real product screenshot. Children are
 * absolutely positioned overlays (annotation pins, floating cards).
 */
export function BrowserFrame({
  src,
  alt,
  label = 'app.ceview · Dashboard',
  eager = false,
  children,
}: {
  src: string;
  alt: string;
  label?: string;
  eager?: boolean;
  children?: ReactNode;
}) {
  return (
    <figure className="lp-browser">
      <div className="lp-browser-bar" aria-hidden="true">
        <span className="lp-browser-dots">
          <i />
          <i />
          <i />
        </span>
        <span className="lp-browser-url">{label}</span>
      </div>
      <div className="lp-browser-view">
        <img
          src={src}
          alt={alt}
          width={1800}
          height={1125}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          {...(eager ? { fetchPriority: 'high' as const } : {})}
        />
        {children}
      </div>
    </figure>
  );
}

/** Numbered annotation dot + label over a screenshot, positioned in %. */
export function Pin({ n, x, y, label }: { n: number; x: number; y: number; label: string }) {
  return (
    <span className="lp-pin" data-side={x > 60 ? 'left' : undefined} style={{ left: `${x}%`, top: `${y}%` }}>
      <span className="lp-pin-dot" aria-hidden="true">
        {n}
      </span>
      <span className="lp-pin-label">{label}</span>
    </span>
  );
}

/**
 * Thin travel-route curves with signal dots — the page's recurring motif.
 * Purely decorative, so hidden from assistive tech.
 */
export function RouteLines({ className = '', variant = 'a' }: { className?: string; variant?: 'a' | 'b' }) {
  const d =
    variant === 'a'
      ? 'M-20 250 C 120 170, 220 300, 360 210 S 600 60, 760 140'
      : 'M-20 90 C 140 180, 260 20, 420 110 S 640 250, 780 150';
  const d2 =
    variant === 'a'
      ? 'M-20 300 C 150 250, 260 350, 400 270 S 620 150, 780 220'
      : 'M-20 150 C 160 240, 300 90, 450 170 S 650 300, 780 230';
  return (
    <svg className={`lp-routes ${className}`} viewBox="0 0 760 340" fill="none" aria-hidden="true" focusable="false">
      <path d={d} className="lp-route" />
      <path d={d2} className="lp-route lp-route--faint" />
      <circle cx={variant === 'a' ? 360 : 420} cy={variant === 'a' ? 210 : 110} r="5" className="lp-route-node" />
      <circle cx={variant === 'a' ? 600 : 640} cy={variant === 'a' ? 84 : 250} r="6" className="lp-route-signal" />
      <circle cx={variant === 'a' ? 600 : 640} cy={variant === 'a' ? 84 : 250} r="14" className="lp-route-signal-halo" />
    </svg>
  );
}
