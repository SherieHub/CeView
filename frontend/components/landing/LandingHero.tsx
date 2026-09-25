/**
 * Hero + market-coverage strip.
 *
 * Asymmetric: the promise on the left, the real product on the right — the
 * dashboard as it looks for a sample resort, with three floating cards whose
 * values are read straight off that screenshot (no invented metrics).
 */
import { CalendarClock, CircleCheck, Globe, Target, TrendingUp } from 'lucide-react';
import dashboardShot from './assets/dashboard.webp';
import { HERO, MARKETS, MARKET_STRIP } from './landingContent';
import { BrowserFrame, CtaPair, RouteLines } from './landingParts';

const FLOATER_ICON = { coral: TrendingUp, teal: Target, navy: CalendarClock } as const;

export default function LandingHero() {
  return (
    <>
      <section className="lp-hero" id="top" aria-labelledby="lp-hero-title">
        <div className="lp-hero-bg" aria-hidden="true">
          <span className="lp-orb lp-orb--cyan" />
          <span className="lp-orb lp-orb--mint" />
          <span className="lp-dotgrid" />
        </div>

        <div className="lp-wrap lp-hero-grid">
          <div className="lp-hero-copy">
            <p className="lp-eyebrow lp-rise" style={{ animationDelay: '40ms' }}>
              <span className="lp-signal-dot" aria-hidden="true" />
              {HERO.eyebrow}
            </p>
            <h1 id="lp-hero-title" className="lp-h1 lp-rise" style={{ animationDelay: '110ms' }}>
              {HERO.titleLead} <span className="lp-accent-text">{HERO.titleAccent}</span>
            </h1>
            <p className="lp-hero-lede lp-rise" style={{ animationDelay: '180ms' }}>
              {HERO.lede}
            </p>
            <div className="lp-rise" style={{ animationDelay: '250ms' }}>
              <CtaPair />
            </div>
            <ul className="lp-hero-trust lp-rise" style={{ animationDelay: '320ms' }}>
              {HERO.trust.map((t) => (
                <li key={t}>
                  <CircleCheck size={16} aria-hidden="true" />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          <div className="lp-hero-visual lp-rise" style={{ animationDelay: '200ms' }}>
            <RouteLines className="lp-hero-routes" />
            <span className="lp-hero-shape" aria-hidden="true" />
            <BrowserFrame src={dashboardShot} alt={HERO.shotAlt} eager />
            {HERO.floaters.map((f, i) => {
              const Icon = FLOATER_ICON[f.tone];
              return (
                <div key={f.label} className="lp-floater" data-slot={i} data-tone={f.tone} aria-hidden="true">
                  <span className="lp-floater-icon">
                    <Icon size={16} />
                  </span>
                  <span className="lp-floater-text">
                    <span className="lp-floater-label">{f.label}</span>
                    <span className="lp-floater-value">{f.value}</span>
                    <span className="lp-floater-note">{f.note}</span>
                  </span>
                </div>
              );
            })}
            <p className="lp-shot-note">Real CeView dashboard · sample business and data</p>
          </div>
        </div>
      </section>

      <section className="lp-markets" aria-label="Markets CeView monitors">
        <div className="lp-wrap lp-markets-inner">
          <p className="lp-markets-label">{MARKET_STRIP.label}</p>
          <ul className="lp-markets-list">
            {MARKETS.map((m) => (
              <li key={m.code} className="lp-market">
                <span className="lp-market-globe" aria-hidden="true">
                  <Globe size={18} />
                </span>
                <span className="lp-market-name">{m.name}</span>
                <span className="lp-market-code" aria-hidden="true">
                  {m.code}
                </span>
              </li>
            ))}
          </ul>
          <p className="lp-markets-note">{MARKET_STRIP.note}</p>
        </div>
      </section>
    </>
  );
}
