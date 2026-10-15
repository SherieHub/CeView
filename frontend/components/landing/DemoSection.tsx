/**
 * Request a demo (#demo) — the page's main conversion point. A pale-mint band:
 * on the left the promise, what the walkthrough covers (icon list) and the
 * Cebu pilot card (no "spots left" counter or other scarcity); on the right
 * the form card (LeadForm). A wide Cebu beach photo closes the section.
 *
 * Styles: styles/landing-pricing.css (.cv-demo-*, .cv-form-*).
 */
import { ChartColumnIncreasing, Lightbulb, Map as MapIcon, Sprout, TrendingUp, type LucideIcon } from 'lucide-react';
import { DEMO } from '../../content/landing';
import { Eyebrow, LandingImage } from './ui';
import LeadForm from './LeadForm';

const SEE_ICONS: LucideIcon[] = [MapIcon, ChartColumnIncreasing, Lightbulb, TrendingUp];

export default function DemoSection() {
  return (
    <section className="cv-section cv-demo" id="demo" aria-labelledby="cv-demo-title">
      <div className="cv-container">
        <div className="cv-demo-grid">
          <div className="cv-demo-copy">
            <Eyebrow>{DEMO.eyebrow}</Eyebrow>
            <h2 id="cv-demo-title" className="cv-display-lg cv-demo-title">
              {DEMO.title}
            </h2>
            <p className="cv-demo-lede">{DEMO.lede}</p>

            <div className="cv-demo-details">
              <div>
                <h3 className="sr-only">{DEMO.seeTitle}</h3>
                <ul className="cv-demo-see">
                  {DEMO.see.map((s, i) => {
                    const Icon = SEE_ICONS[i];
                    return (
                      <li key={s}>
                        <span className="cv-demo-see-icon" aria-hidden="true">
                          <Icon size={20} strokeWidth={1.75} />
                        </span>
                        {s}
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="cv-demo-pilot">
                <span className="cv-demo-spark" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                <div className="cv-demo-pilot-head">
                  <span className="cv-demo-see-icon" aria-hidden="true">
                    <Sprout size={20} strokeWidth={1.75} />
                  </span>
                  <Eyebrow>{DEMO.pilot.eyebrow}</Eyebrow>
                </div>
                <p className="cv-demo-pilot-body">{DEMO.pilot.body}</p>
              </div>
            </div>
          </div>

          <div className="cv-demo-form">
            <LeadForm />
          </div>
        </div>

        <div className="cv-demo-banner">
          <LandingImage slot="demo-side" fill sizes="(min-width: 1024px) 90vw, 100vw" />
          <p className="cv-demo-banner-word" aria-hidden="true">
            Cebu
            <svg viewBox="0 0 120 16" focusable="false">
              <path d="M2 10 C 14 2, 22 14, 34 8 S 54 2, 66 8 S 90 14, 118 5" />
            </svg>
          </p>
        </div>
      </div>
    </section>
  );
}
