/**
 * The closing band (#cta) and the footer.
 *
 * FinalCta: a full-bleed aerial island photo, darkened by a teal gradient on
 * the left only (behind the copy) so the photo stays vivid on the right; the
 * closing promise and CTAs, and a white panel anchored bottom-right with three
 * short pillars in mint icon circles. On phones the photo is a band above the
 * copy.
 *
 * Footer: links are real or absent. Contact appears only once its address
 * is configured (SITE) — no invented email, phone or address. The bottom row
 * carries the Terms of Use and Privacy Notice (/terms, /privacy) and "Photo
 * credits", a dialog listing every photo's source and licence (the visible
 * attribution CC BY / CC BY-SA require). The footer also closes the legal
 * pages, so its in-page anchors point back to the home page from there.
 *
 * Styles: styles/landing-closing.css (.cv-cta-*, .cv-footer-*).
 */
import { useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Compass, HeartHandshake, Radar, X, type LucideIcon } from 'lucide-react';
import { DEMO_ANCHOR, FINAL_CTA, FOOTER, SITE, TOUR_ANCHOR } from '../../content/landing';
import { IMAGE_CREDITS } from '../../content/image-credits';
import { Accent, Button, Eyebrow, LandingImage } from './ui';
import { BrandMark } from './LandingNav';

const PILLAR_ICONS: LucideIcon[] = [Radar, Compass, HeartHandshake];

export function FinalCta() {
  return (
    <section className="cv-cta" id="cta" aria-labelledby="cv-cta-title">
      <div className="cv-cta-media" aria-hidden="true">
        <LandingImage slot="cta-aerial-ocean" fill decorative sizes="100vw" className="cv-cta-photo" />
        <span className="cv-cta-overlay" />
      </div>
      <div className="cv-container cv-cta-inner">
        <div className="cv-cta-copy">
          <Eyebrow>{FINAL_CTA.eyebrow}</Eyebrow>
          <h2 id="cv-cta-title" className="cv-display-lg cv-cta-title">
            {FINAL_CTA.titleLead}
            <Accent>
              {FINAL_CTA.titleAccent}
              {FINAL_CTA.titleTail}
            </Accent>
          </h2>
          <p className="cv-cta-lede">{FINAL_CTA.lede}</p>
          <div className="cv-cta-actions">
            <Button href={DEMO_ANCHOR} size="lg">
              {FINAL_CTA.primaryCta}
            </Button>
            <Button href={TOUR_ANCHOR} variant="ghost-on-dark" size="lg" play>
              {FINAL_CTA.secondaryCta}
            </Button>
          </div>
        </div>
      </div>
      <ul className="cv-cta-panel">
        {FINAL_CTA.pillars.map((p, i) => {
          const Icon = PILLAR_ICONS[i];
          return (
            <li key={p}>
              <span className="cv-cta-panel-icon" aria-hidden="true">
                <Icon size={22} strokeWidth={1.75} />
              </span>
              <span>{p}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function PhotoCredits() {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" className="cv-footer-credits-btn" onClick={() => ref.current?.showModal()}>
        {FOOTER.creditsLink}
      </button>
      <dialog
        ref={ref}
        className="cv-credits"
        aria-labelledby="cv-credits-title"
        onClick={(e) => {
          // A click on the backdrop (the dialog element itself) closes it.
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
      >
        <div className="cv-credits-inner">
          <div className="cv-credits-head">
            <h2 id="cv-credits-title">{FOOTER.creditsTitle}</h2>
            <button type="button" className="cv-credits-close" onClick={() => ref.current?.close()} aria-label="Close photo credits">
              <X size={20} aria-hidden="true" />
            </button>
          </div>
          <p className="cv-credits-intro">{FOOTER.creditsIntro}</p>
          <ul className="cv-credits-list">
            {IMAGE_CREDITS.map((c) => (
              <li key={c.slot}>
                <p className="cv-credits-what">{c.caption}</p>
                <p>
                  {c.photographer} ·{' '}
                  {'licenseUrl' in c ? (
                    <a href={c.licenseUrl} target="_blank" rel="noopener noreferrer">
                      {c.license}
                    </a>
                  ) : (
                    c.license
                  )}{' '}
                  ·{' '}
                  <a href={c.sourceUrl} target="_blank" rel="noopener noreferrer">
                    Source
                  </a>
                </p>
              </li>
            ))}
          </ul>
        </div>
      </dialog>
    </>
  );
}

export default function LandingFooter() {
  const { pathname } = useLocation();
  // "#faq" only resolves on the home page; elsewhere it has to lead back there.
  const anchor = (href: string) => (pathname === '/' || !href.startsWith('#') ? href : `/${href}`);

  return (
    <footer className="cv-footer">
      <div className="cv-container">
        <div className="cv-footer-grid">
          <div className="cv-footer-brand">
            <BrandMark tone="light" />
            <p>{FOOTER.blurb}</p>
          </div>

          <nav className="cv-footer-col" aria-label="Product">
            <p className="cv-footer-head">Product</p>
            {FOOTER.product.map((l) => (
              <a key={l.href} href={anchor(l.href)}>
                {l.label}
              </a>
            ))}
          </nav>

          <nav className="cv-footer-col" aria-label="Company">
            <p className="cv-footer-head">Company</p>
            {FOOTER.company.map((l) => (
              <a key={l.href} href={anchor(l.href)}>
                {l.label}
              </a>
            ))}
            <Link to="/login">{FOOTER.signIn}</Link>
            {SITE.contactEmail && <a href={`mailto:${SITE.contactEmail}`}>Contact</a>}
          </nav>

          <div className="cv-footer-col">
            <p className="cv-footer-head">{FOOTER.supportsTitle}</p>
            <ul className="cv-footer-sdgs">
              {FOOTER.supports.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="cv-footer-bottom">
          <p>{FOOTER.copyright}</p>
          <nav className="cv-footer-legal" aria-label="Legal">
            <Link to="/terms">{FOOTER.termsLink}</Link>
            <Link to="/privacy">{FOOTER.privacyLink}</Link>
            <PhotoCredits />
          </nav>
        </div>
      </div>
    </footer>
  );
}
