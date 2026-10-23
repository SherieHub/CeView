/**
 * Hero.
 *
 * A full-bleed photo of the Cebu coast (decorative: the copy carries the
 * meaning) under a white wash, the promise and CTAs on the left, and an
 * illustrative CeView dashboard card on the right (sample data, labelled).
 * The photo's CC BY-SA credit is in the footer (LandingFooter).
 *
 * Styles: styles/landing-hero.css (.cv-hero-*, .cv-dash-*). The market strip
 * that follows is MarketStrip.tsx.
 */
import { CircleCheck } from 'lucide-react';
import { DEMO_ANCHOR, HERO, TOUR_ANCHOR } from '../../content/landing';
import { Accent, Button, Eyebrow, LandingImage } from './ui';
import HeroDashboard from './HeroDashboard';

/**
 * The photo is wider than any hero box (≈2.56:1), so object-fit: cover sizes
 * it by height. These widths are the rendered width at each layout, which is
 * what the browser needs to pick the right file:
 *   < 768px: a 4:3 band, 75vw tall → 75vw × 2.56 ≈ 192vw wide
 *   ≥ 768px: min(88vh, 820px) tall, zoomed 1.32 → that × 3.4, at least the viewport
 */
const HERO_PHOTO_SIZES = '(max-width: 767px) 192vw, max(100vw, calc(min(88vh, 820px) * 3.4))';

export default function LandingHero() {
  return (
    <section className="cv-hero" id="top" aria-labelledby="lp-hero-title">
      <div className="cv-hero-media">
        <LandingImage slot="hero-cebu-coast" fill priority decorative sizes={HERO_PHOTO_SIZES} className="cv-hero-photo" />
        <span className="cv-hero-wash" aria-hidden="true" />
      </div>

      <div className="cv-container cv-hero-grid">
        <div className="cv-hero-copy">
          <Eyebrow>{HERO.eyebrow}</Eyebrow>
          <h1 id="lp-hero-title" className="cv-hero-title">
            {HERO.titleLines.map((line, i) => (
              <span key={i} className="cv-hero-title-line">
                {'accent' in line && <Accent>{line.accent}</Accent>}
                {line.text}{' '}
              </span>
            ))}
          </h1>
          <p className="cv-hero-lede">{HERO.lede}</p>
          <div className="cv-hero-ctas">
            <Button href={DEMO_ANCHOR} size="lg">
              {HERO.primaryCta}
            </Button>
            <Button href={TOUR_ANCHOR} variant="secondary" size="lg" play>
              {HERO.secondaryCta}
            </Button>
          </div>
          <ul className="cv-hero-trust">
            {HERO.trust.map((t) => (
              <li key={t}>
                <CircleCheck size={18} strokeWidth={1.75} aria-hidden="true" />
                {t}
              </li>
            ))}
          </ul>
        </div>

        <div className="cv-hero-visual">
          <HeroDashboard />
        </div>
      </div>
    </section>
  );
}
