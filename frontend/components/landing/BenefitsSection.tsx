/**
 * Why CeView — four outcomes, told as what changes for the business rather
 * than as features. A 2×2 whose cards share a system but not a costume: the
 * first is the lead (pale-cyan wash), the last closes on the dark surface.
 */
import { Compass, History, PenLine, Radar } from 'lucide-react';
import { BENEFITS } from './landingContent';
import { SectionHead } from './landingParts';

const ICONS = [Radar, Compass, PenLine, History];

export default function BenefitsSection() {
  return (
    <section className="lp-section lp-section--white" id="why-ceview" aria-labelledby="lp-why-title">
      <div className="lp-wrap">
        <div className="lp-why-head">
          <SectionHead id="lp-why-title" eyebrow={BENEFITS.eyebrow} title={BENEFITS.title} />
          <p className="lp-lede lp-why-lede">{BENEFITS.lede}</p>
        </div>

        <ul className="lp-why-grid">
          {BENEFITS.items.map((b, i) => {
            const Icon = ICONS[i];
            return (
              <li key={b.title} className="lp-why-card lp-reveal" data-variant={i}>
                <div className="lp-why-top">
                  <span className="lp-why-num" aria-hidden="true">
                    0{i + 1}
                  </span>
                  <span className="lp-why-icon" aria-hidden="true">
                    <Icon size={22} />
                  </span>
                </div>
                <h3 className="lp-h3">{b.title}</h3>
                <p className="lp-body">{b.body}</p>
                <p className="lp-why-tag">{b.why}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
