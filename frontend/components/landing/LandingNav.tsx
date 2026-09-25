/**
 * Floating navigation. A centred, lightly translucent bar that stays pinned,
 * highlights the section in view, and folds into a drawer below 1200px.
 */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Menu, X } from 'lucide-react';
import ceviewMark from './assets/ceview-mark.webp';
import { DEMO_ANCHOR, NAV_LINKS } from './landingContent';

export function BrandMark({ tone = 'dark' }: { tone?: 'dark' | 'light' }) {
  return (
    <span className="lp-brand" data-tone={tone}>
      <img src={ceviewMark} alt="" width={32} height={32} className="lp-brand-logo" />
      <span className="lp-brand-name">CeView</span>
    </span>
  );
}

/** Which nav section is currently being read. */
function useActiveSection(ids: string[]): string | null {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const visible = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) visible.set(e.target.id, e.isIntersecting ? e.intersectionRatio : 0);
        // The section occupying the reading band wins; none → nothing lit.
        let best: string | null = null;
        let bestRatio = 0;
        for (const id of ids) {
          const r = visible.get(id) ?? 0;
          if (r > bestRatio) {
            best = id;
            bestRatio = r;
          }
        }
        setActive(best);
      },
      // A band across the upper-middle of the viewport, below the pinned nav.
      { rootMargin: '-30% 0px -55% 0px', threshold: [0, 0.01, 0.25, 0.5, 1] },
    );
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [ids]);

  return active;
}

const SECTION_IDS = NAV_LINKS.map((l) => l.href.slice(1));

export default function LandingNav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const active = useActiveSection(SECTION_IDS);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Drawer: Escape closes, growing past the breakpoint closes, the page behind
  // doesn't scroll, and focus moves in on open and back to the toggle on close.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const mq = window.matchMedia?.('(min-width: 1200px)');
    const onMq = () => {
      if (mq?.matches) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    mq?.addEventListener?.('change', onMq);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    drawerRef.current?.querySelector<HTMLElement>('a')?.focus();
    const toggle = toggleRef.current;
    return () => {
      window.removeEventListener('keydown', onKey);
      mq?.removeEventListener?.('change', onMq);
      document.body.style.overflow = prevOverflow;
      toggle?.focus();
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <header className="lp-nav" data-scrolled={scrolled || undefined}>
      <div className="lp-nav-bar">
        <a href="#top" className="lp-nav-brand" aria-label="CeView — back to top">
          <BrandMark />
        </a>

        <nav className="lp-nav-links" aria-label="Page sections">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="lp-nav-link"
              aria-current={active === l.href.slice(1) ? 'location' : undefined}
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="lp-nav-actions">
          <Link to="/login" className="lp-nav-signin">
            Sign In
          </Link>
          <a href={DEMO_ANCHOR} className="lp-btn lp-btn--primary lp-btn--sm lp-nav-cta">
            <span className="lp-nav-cta-long">Request a Demo</span>
            <span className="lp-nav-cta-short">Demo</span>
            <ArrowRight size={16} aria-hidden="true" />
          </a>
          <button
            ref={toggleRef}
            type="button"
            className="lp-nav-toggle"
            aria-expanded={open}
            aria-controls="lp-drawer"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
          </button>
        </div>
      </div>

      {open && (
        <>
          <div className="lp-drawer-scrim" onClick={close} aria-hidden="true" />
          <div className="lp-drawer" id="lp-drawer" ref={drawerRef} role="dialog" aria-modal="true" aria-label="Menu">
            <nav aria-label="Page sections">
              {NAV_LINKS.map((l) => (
                <a key={l.href} href={l.href} className="lp-drawer-link" onClick={close}>
                  {l.label}
                  <ArrowRight size={18} aria-hidden="true" />
                </a>
              ))}
            </nav>
            <div className="lp-drawer-actions">
              <a href={DEMO_ANCHOR} className="lp-btn lp-btn--primary" onClick={close}>
                Request a Demo <ArrowRight size={18} aria-hidden="true" />
              </a>
              <Link to="/login" className="lp-btn lp-btn--ghost" onClick={close}>
                Sign In
              </Link>
            </div>
          </div>
        </>
      )}
    </header>
  );
}
