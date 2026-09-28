/**
 * Demo request — the page's main conversion point. Split layout: what the
 * walkthrough covers (plus honest access/pricing status) beside the form.
 */
import { CircleCheck, KeyRound } from 'lucide-react';
import { DEMO } from './landingContent';
import { SectionHead } from './landingParts';
import LeadForm from './LeadForm';

export default function DemoSection() {
  return (
    <section className="lp-section lp-demo" id="request-demo" aria-labelledby="lp-demo-title">
      <div className="lp-demo-bg" aria-hidden="true">
        <span className="lp-orb lp-orb--cyan" />
      </div>
      <div className="lp-wrap lp-demo-grid">
        <div className="lp-demo-copy">
          <SectionHead id="lp-demo-title" eyebrow={DEMO.eyebrow} title={DEMO.title} lede={DEMO.lede} />
          <div className="lp-demo-see">
            <h3 className="lp-h3">{DEMO.seeTitle}</h3>
            <ul>
              {DEMO.see.map((s) => (
                <li key={s}>
                  <CircleCheck size={20} aria-hidden="true" />
                  {s}
                </li>
              ))}
            </ul>
          </div>
          <div className="lp-demo-access">
            <span className="lp-demo-access-icon" aria-hidden="true">
              <KeyRound size={18} />
            </span>
            <div>
              <p className="lp-demo-access-title">{DEMO.accessTitle}</p>
              <p className="lp-body">{DEMO.access}</p>
            </div>
          </div>
        </div>
        <LeadForm />
      </div>
    </section>
  );
}
