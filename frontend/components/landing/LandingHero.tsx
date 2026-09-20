/**
 * Hero — the app's dark chrome gradient (the same surface as the login brand
 * panel and the sidebar), with the opportunity line as its visual: steady
 * traveler interest warming to orange where a demand window opens.
 */
import { ArrowRight, MapPin, Play, Zap } from 'lucide-react';
import { CTA, HERO, LINKS, MARKETS, isPlaceholder } from './landingContent';
import { OPPORTUNITY_ASPECT, OPPORTUNITY_LAYOUT, OpportunityLine } from './landingParts';

/**
 * "Watch Product Walkthrough" — until a video URL is confirmed it scrolls to
 * the in-page product preview rather than pointing at a link that doesn't exist.
 */
export function walkthroughHref(): { href: string; external: boolean } {
  return isPlaceholder(LINKS.demoVideo)
    ? { href: '#product', external: false }
    : { href: LINKS.demoVideo, external: true };
}

export default function LandingHero() {
  const walkthrough = walkthroughHref();

  return (
    <section className="lp-hero" id="top" aria-labelledby="lp-hero-title">
      <div className="lp-hero-glow" aria-hidden="true" />
      <div className="lp-wrap lp-hero-grid">
        <div className="lp-hero-copy">
          <p className="lp-eyebrow lp-eyebrow--inverse lp-rise" style={{ animationDelay: '60ms' }}>
            {HERO.eyebrow}
          </p>
          <h1 id="lp-hero-title" className="lp-hero-title lp-rise" style={{ animationDelay: '140ms' }}>
            {HERO.title}
          </h1>
          <p className="lp-hero-lede lp-rise" style={{ animationDelay: '220ms' }}>
            {HERO.lede}
          </p>

          <div className="lp-hero-ctas lp-rise" style={{ animationDelay: '300ms' }}>
            <a href="#request-demo" className="btn-primary lp-btn-lg">
              {CTA.primary} <ArrowRight size={18} aria-hidden="true" />
            </a>
            <a
              href={walkthrough.href}
              className="btn-outline btn-outline--inverse lp-btn-lg"
              {...(walkthrough.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            >
              <Play size={16} aria-hidden="true" /> {CTA.secondary}
            </a>
          </div>

          <p className="lp-hero-note lp-rise" style={{ animationDelay: '380ms' }}>
            {HERO.reassurance}
          </p>
        </div>

        <figure className="lp-hero-card lp-rise" style={{ animationDelay: '260ms' }}>
          <div className="lp-hero-card-head">
            <div>
              <p className="lp-card-kicker">Traveler interest · Japan</p>
              <p className="lp-card-title">Demand window ahead</p>
            </div>
            <span className="chip chip--attention">
              <Zap aria-hidden="true" /> Opportunity
            </span>
          </div>

          <div className="lp-oline-frame" style={{ aspectRatio: OPPORTUNITY_ASPECT }}>
            <OpportunityLine />
            <span className="lp-oline-tag lp-oline-tag--past" style={{ right: `${100 - OPPORTUNITY_LAYOUT.nowPct}%` }}>
              Past 12 weeks
            </span>
            <span className="lp-oline-tag lp-oline-tag--next" style={{ left: `${OPPORTUNITY_LAYOUT.nowPct}%` }}>
              Next 12 weeks
            </span>
            <span className="lp-oline-flag" style={{ left: `${OPPORTUNITY_LAYOUT.windowPct}%` }}>
              Window opens
            </span>
          </div>

          <ul className="lp-hero-markets" aria-label="Markets CeView tracks">
            {MARKETS.map((m) => (
              <li key={m}>
                <MapPin size={14} aria-hidden="true" /> {m}
              </li>
            ))}
          </ul>
          <figcaption className="lp-illustrative">Illustrative example</figcaption>
        </figure>
      </div>
    </section>
  );
}
