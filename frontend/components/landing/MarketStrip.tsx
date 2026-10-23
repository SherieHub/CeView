/**
 * Market coverage strip, under the hero. Stands in for the usual customer-logo
 * row: CeView has no confirmed customers or partners, so this row shows facts
 * (the five markets it tracks) instead.
 *
 * Styles: styles/landing-challenge.css (.cv-strip-*).
 */
import { MARKET_STRIP } from '../../content/landing';
import { MarketFlag } from './ui';

export default function MarketStrip() {
  return (
    <section className="cv-strip" aria-labelledby="cv-strip-title">
      <div className="cv-container cv-strip-inner">
        <p id="cv-strip-title" className="cv-eyebrow cv-strip-eyebrow">
          {MARKET_STRIP.eyebrow}
        </p>
        <div className="cv-strip-row">
          <ul className="cv-strip-list">
            {MARKET_STRIP.items.map((m) => (
              <li key={m.key} data-market={m.key}>
                <MarketFlag market={m.key} name={m.title} detail={m.label} size="lg" />
              </li>
            ))}
          </ul>
          <p className="cv-caption cv-strip-note">
            {MARKET_STRIP.note}
            <sup>
              <a href="#challenge-sources">
                1<span className="sr-only">: source, {MARKET_STRIP.noteSource}</span>
              </a>
            </sup>
          </p>
        </div>
        <p className="cv-caption cv-strip-facts">
          {MARKET_STRIP.facts.map((f, i) => (
            <span key={f}>
              {i > 0 && <span aria-hidden="true"> · </span>}
              {f}
            </span>
          ))}
        </p>
      </div>
    </section>
  );
}
