/**
 * Site header. A full-width sticky bar: solid white at the top of the page,
 * frosted with a hairline once the page scrolls, so nothing ever shows above
 * or around it. The link for the section being read is marked with a coral
 * dot. Below 1024px the links move into a full-height sheet.
 */
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Menu, X } from 'lucide-react';
import ceviewLogo from './assets/ceview-logo.webp';
import ceviewLogoLight from './assets/ceview-logo-light.webp';
import { DEMO_ANCHOR, HEADER, NAV_LINKS } from '../../content/landing';
import { Button } from './ui';

/** Matches the CSS breakpoint where the full nav appears. */
const DESKTOP_QUERY = '(min-width: 1024px)';
const SCROLL_THRESHOLD = 8;
const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * The CeView logo (sail mark + wordmark). `light` is for dark backgrounds:
 * the dark-teal sail and wordmark are drawn in white.
 */
export function BrandMark({ tone = 'dark' }: { tone?: 'dark' | 'light' }) {
  return (
    <span className="lp-brand" data-tone={tone}>
      <img
        src={tone === 'light' ? ceviewLogoLight : ceviewLogo}
        alt="CeView"
        width={440}
        height={112}
        className="lp-brand-logo"
      />
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
      // A band across the upper-middle of the viewport, below the header.
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
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > SCROLL_THRESHOLD);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Sheet open: Escape closes, widening to desktop closes, the page behind
  // doesn't scroll, focus moves in on open and back to the toggle on close.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const mq = window.matchMedia?.(DESKTOP_QUERY);
    const onMq = () => {
      if (mq?.matches) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    mq?.addEventListener?.('change', onMq);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    sheetRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    const toggle = toggleRef.current;
    return () => {
      window.removeEventListener('keydown', onKey);
      mq?.removeEventListener?.('change', onMq);
      document.body.style.overflow = prevOverflow;
      toggle?.focus({ preventScroll: true });
    };
  }, [open]);

  // Keep Tab and Shift+Tab inside the sheet while it's open.
  const trapFocus = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab') return;
    const items = Array.from(sheetRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const close = () => setOpen(false);

  return (
    <>
      <header className="cv-header" data-scrolled={scrolled || undefined}>
        <div className="cv-container cv-header-inner">
          <a href="#top" className="cv-header-home" aria-label={HEADER.homeLabel}>
            <BrandMark />
          </a>

          <nav className="cv-header-nav" aria-label="Page sections">
            <ul className="cv-header-links">
              {NAV_LINKS.map((l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    className="cv-header-link"
                    aria-current={active === l.href.slice(1) ? 'location' : undefined}
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="cv-header-actions">
            <Link to={HEADER.signIn.to} className="cv-header-signin">
              {HEADER.signIn.label}
            </Link>
            <Button href={DEMO_ANCHOR} className="cv-header-cta">
              {HEADER.cta}
            </Button>
            <button
              ref={toggleRef}
              type="button"
              className="cv-header-toggle"
              aria-expanded={open}
              aria-controls="cv-menu"
              aria-label={HEADER.menuOpen}
              onClick={() => setOpen(true)}
            >
              <Menu size={22} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      {/* Outside <header>: its backdrop-filter would otherwise trap this
          fixed-position sheet inside the 72px bar. */}
      {open && (
        <div
          className="cv-sheet"
          id="cv-menu"
          ref={sheetRef}
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          onKeyDown={trapFocus}
        >
          <div className="cv-container cv-sheet-top">
            <a href="#top" className="cv-header-home" aria-label={HEADER.homeLabel} onClick={close}>
              <BrandMark />
            </a>
            <button type="button" className="cv-sheet-close" aria-label={HEADER.menuClose} onClick={close}>
              <X size={22} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>
          <div className="cv-container cv-sheet-body">
            <nav aria-label="Page sections">
              <ul className="cv-sheet-links">
                {NAV_LINKS.map((l) => (
                  <li key={l.href}>
                    <a
                      href={l.href}
                      className="cv-sheet-link"
                      aria-current={active === l.href.slice(1) ? 'location' : undefined}
                      onClick={close}
                    >
                      {l.label}
                      <ArrowRight size={20} strokeWidth={1.75} aria-hidden="true" />
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="cv-sheet-actions">
              <Button href={DEMO_ANCHOR} size="lg" block onClick={close}>
                {HEADER.cta}
              </Button>
              <Button to={HEADER.signIn.to} variant="link" className="cv-sheet-signin" onClick={close}>
                {HEADER.signIn.label}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
