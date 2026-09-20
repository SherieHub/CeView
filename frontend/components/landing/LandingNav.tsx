/**
 * Landing page header. Sits transparent over the dark hero, then turns into a
 * solid white bar once the page scrolls — the same white-on-canvas surface the
 * app's topbar uses, so the hand-off into the product feels continuous.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Menu, X } from 'lucide-react';
import ceviewLogo from '../CeView Logo.png';
import { useAuth } from '../../services/auth';
import { CTA, NAV_LINKS } from './landingContent';

export function BrandMark({ tone = 'dark' }: { tone?: 'dark' | 'light' }) {
  return (
    <span className="lp-brand" data-tone={tone}>
      <img src={ceviewLogo} alt="" className="lp-brand-logo" />
      <span className="lp-brand-name">CeView</span>
    </span>
  );
}

export default function LandingNav() {
  const { isAuthenticated } = useAuth();
  const [solid, setSolid] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close the mobile menu on Escape, and whenever the viewport grows past it.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const mq = window.matchMedia?.('(min-width: 960px)');
    const onMq = () => mq?.matches && setOpen(false);
    window.addEventListener('keydown', onKey);
    mq?.addEventListener?.('change', onMq);
    return () => {
      window.removeEventListener('keydown', onKey);
      mq?.removeEventListener?.('change', onMq);
    };
  }, [open]);

  const signIn = isAuthenticated
    ? { to: '/dashboard', label: 'Go to dashboard' }
    : { to: '/login', label: 'Sign in' };

  return (
    <header className="lp-nav" data-solid={solid || open}>
      <div className="lp-nav-inner">
        <a href="#top" className="lp-nav-brand" aria-label="CeView home">
          <BrandMark tone={solid || open ? 'dark' : 'light'} />
        </a>

        <nav className="lp-nav-links" aria-label="Page sections">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href} className="lp-nav-link">
              {l.label}
            </a>
          ))}
        </nav>

        <div className="lp-nav-actions">
          <Link to={signIn.to} className="lp-nav-link lp-nav-signin">
            {signIn.label}
          </Link>
          <a href="#request-demo" className="btn-cta lp-btn-nav">
            {CTA.primary}
          </a>
          <button
            type="button"
            className="lp-nav-toggle"
            aria-expanded={open}
            aria-controls="lp-mobile-menu"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="lp-mobile" id="lp-mobile-menu">
          <nav aria-label="Page sections (mobile)">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} className="lp-mobile-link" onClick={() => setOpen(false)}>
                {l.label}
              </a>
            ))}
          </nav>
          <div className="lp-mobile-actions">
            <Link to={signIn.to} className="btn-outline" onClick={() => setOpen(false)}>
              {signIn.label}
            </Link>
            <a href="#request-demo" className="btn-cta" onClick={() => setOpen(false)}>
              {CTA.primary} <ArrowRight size={16} aria-hidden="true" />
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
