/**
 * Request a demo (#demo) — the page's main conversion point. Left: what the
 * walkthrough covers and the Cebu pilot (no "spots left" counter or other
 * scarcity), with a photo on desktop. Right: the form card (LeadForm).
 * The background splits sand / white on desktop.
 *
 * Styles: styles/landing-pricing.css (.cv-demo-*, .cv-form-*).
 */
import { CircleCheck, KeyRound } from 'lucide-react';
import { DEMO } from '../../content/landing';
import { Eyebrow, IconTile, LandingImage } from './ui';
import LeadForm from './LeadForm';

export default function DemoSection() {
  return (
    <section className="cv-section cv-demo" id="demo" aria-labelledby="cv-demo-title">
      <div className="cv-container cv-demo-grid">
        <div className="cv-demo-copy">
          <Eyebrow>{DEMO.eyebrow}</Eyebrow>
          <h2 id="cv-demo-title" className="cv-display-lg cv-demo-title">
            {DEMO.title}
          </h2>
          <p className="cv-body-lg">{DEMO.lede}</p>

          <h3 className="cv-demo-see-title">{DEMO.seeTitle}</h3>
          <ul className="cv-demo-see">
            {DEMO.see.map((s) => (
              <li key={s}>
                <CircleCheck size={20} strokeWidth={1.75} aria-hidden="true" />
                {s}
              </li>
            ))}
          </ul>

          <div className="cv-demo-pilot">
            <IconTile icon={KeyRound} />
            <div>
              <Eyebrow>{DEMO.pilot.eyebrow}</Eyebrow>
              <p className="cv-demo-pilot-body">{DEMO.pilot.body}</p>
            </div>
          </div>

          <div className="cv-demo-photo">
            <LandingImage slot="demo-side" fill sizes="(min-width: 1024px) 40vw, 100vw" />
          </div>
        </div>

        <div className="cv-demo-form">
          <LeadForm />
        </div>
      </div>
    </section>
  );
}
