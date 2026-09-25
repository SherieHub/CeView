/**
 * Closing CTA band + footer, both on deep navy.
 *
 * Footer links are real or absent: Contact, Privacy and Terms appear only once
 * their URLs are configured (SITE). No "[PLACEHOLDER]" ever reaches the page.
 */
import { Link } from 'react-router-dom';
import { FINAL_CTA, FOOTER, SITE } from './landingContent';
import { CtaPair, RouteLines } from './landingParts';
import { BrandMark } from './LandingNav';

export function FinalCta() {
  return (
    <section className="lp-final" aria-labelledby="lp-final-title">
      <div className="lp-final-bg" aria-hidden="true">
        <span className="lp-dotgrid lp-dotgrid--inverse" />
        <span className="lp-orb lp-orb--glow" />
        <RouteLines className="lp-final-routes" />
      </div>
      <div className="lp-wrap lp-final-inner">
        <p className="lp-eyebrow lp-eyebrow--inverse">
          <span className="lp-signal-dot" aria-hidden="true" />
          {FINAL_CTA.eyebrow}
        </p>
        <h2 className="lp-h2 lp-final-title" id="lp-final-title">
          {FINAL_CTA.title}
        </h2>
        <p className="lp-lede lp-final-lede">{FINAL_CTA.lede}</p>
        <CtaPair tone="dark" center />
      </div>
    </section>
  );
}

export default function LandingFooter() {
  const company = [SITE.contactEmail && { label: 'Contact', href: `mailto:${SITE.contactEmail}` }].filter(Boolean) as {
    label: string;
    href: string;
  }[];
  const legal = [
    SITE.privacyUrl && { label: 'Privacy Policy', href: SITE.privacyUrl },
    SITE.termsUrl && { label: 'Terms', href: SITE.termsUrl },
  ].filter(Boolean) as { label: string; href: string }[];

  return (
    <footer className="lp-footer">
      <div className="lp-wrap">
        <div className="lp-footer-grid">
          <div className="lp-footer-brand">
            <BrandMark tone="light" />
            <p>{FOOTER.blurb}</p>
          </div>

          <nav className="lp-footer-col" aria-label="Product">
            <p className="lp-footer-head">Product</p>
            <a href="#why-ceview">Why CeView</a>
            <a href="#features">Features</a>
            <a href="#how-it-works">How It Works</a>
            <a href="#request-demo">Request a Demo</a>
          </nav>

          <nav className="lp-footer-col" aria-label="Account and company">
            <p className="lp-footer-head">Company</p>
            {company.map((l) => (
              <a key={l.label} href={l.href}>
                {l.label}
              </a>
            ))}
            <a href="#faq">FAQ</a>
            <Link to="/login">Sign In</Link>
          </nav>

          {legal.length > 0 && (
            <nav className="lp-footer-col" aria-label="Legal">
              <p className="lp-footer-head">Legal</p>
              {legal.map((l) => (
                <a key={l.label} href={l.href}>
                  {l.label}
                </a>
              ))}
            </nav>
          )}
        </div>

        <div className="lp-footer-bottom">
          <p>© 2026 CeView. All rights reserved.</p>
          {SITE.contactEmail && <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>}
        </div>
      </div>
    </footer>
  );
}
