/**
 * From fragmented to connected. Left: scattered, unlinked steps on grey.
 * Right: the same five jobs as one linked route on pale cyan. The closing
 * statement carries the positioning line.
 */
import { CircleCheck, CircleDashed } from 'lucide-react';
import { COMPARISON } from './landingContent';
import { SectionHead } from './landingParts';

export default function ComparisonSection() {
  return (
    <section className="lp-section lp-section--white lp-compare" aria-labelledby="lp-compare-title">
      <div className="lp-wrap">
        <SectionHead id="lp-compare-title" eyebrow={COMPARISON.eyebrow} title={COMPARISON.title} align="center" />

        <div className="lp-compare-grid">
          <div className="lp-compare-col lp-compare-col--without lp-reveal">
            <h3 className="lp-h3">{COMPARISON.without.title}</h3>
            <ul>
              {COMPARISON.without.items.map((item) => (
                <li key={item}>
                  <CircleDashed size={18} aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="lp-compare-col lp-compare-col--with lp-reveal">
            <span className="lp-compare-curve" aria-hidden="true" />
            <h3 className="lp-h3">{COMPARISON.with.title}</h3>
            <ul className="lp-compare-linked">
              {COMPARISON.with.items.map((item) => (
                <li key={item}>
                  <CircleCheck size={18} aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="lp-statement lp-reveal">
          {COMPARISON.statementLead} <strong>{COMPARISON.statement}</strong>
        </p>
      </div>
    </section>
  );
}
