/**
 * The split screen shared by every pre-app auth page (sign in / create account,
 * verify email, forgot password): a full-height Cebu photo panel with the brand
 * promise on the left, a form card on a mint canvas on the right. `children`
 * is the card's content below the brand mark.
 *
 * Styles: styles/auth.css (.cv-auth-*).
 */
import type { ReactNode } from 'react';
import { ChartColumnIncreasing, Clock, MapPin, type LucideIcon } from 'lucide-react';
import '@fontsource-variable/fraunces/opsz.css';
import '@fontsource-variable/fraunces/opsz-italic.css';
import { LandingImage } from '../landing/ui';
import { BrandMark } from '../landing/LandingNav';

const HIGHLIGHTS: [LucideIcon, string, string][] = [
  [ChartColumnIncreasing, 'Smarter', 'insights'],
  [MapPin, 'Local', 'relevance'],
  [Clock, 'Plan', 'ahead'],
];

export default function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="cv-auth">
      {/* Brand panel — Cebu photo under a deep-teal fade, promise and highlights. */}
      <section className="cv-auth-brand" aria-label="CeView">
        <div className="cv-auth-brand-media" aria-hidden="true">
          <LandingImage slot="challenge-aerial-boats" fill priority decorative sizes="(min-width: 768px) 55vw, 100vw" />
        </div>
        <BrandMark tone="light" />
        <div className="cv-auth-brand-copy">
          <h1 className="cv-auth-title">
            Know the surge <em>before</em> it lands.
          </h1>
          <span className="cv-auth-rule" aria-hidden="true" />
          <p className="cv-auth-lede">
            Get demand forecasting and market-localized insights to help your Cebu tourism business attract
            the right travelers, create relevant content, and plan ahead with confidence.
          </p>
        </div>
        <ul className="cv-auth-highlights">
          {HIGHLIGHTS.map(([Icon, a, b]) => (
            <li key={a}>
              <Icon size={22} strokeWidth={1.75} aria-hidden="true" />
              <span>
                {a}
                <br />
                {b}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Form pane — pale mint canvas with the card. */}
      <main className="cv-auth-pane">
        <div className="cv-auth-card">
          <BrandMark />
          {children}
        </div>
      </main>
    </div>
  );
}
