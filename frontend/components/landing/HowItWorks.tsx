/**
 * How CeView works — the one dark "journey" band. Five stops on a single
 * route line (horizontal on desktop, a vertical timeline on small screens).
 * Teal nodes; the demand-signal stop is the one drawn in the opportunity colour.
 */
import { BarChart3, Building2, Globe, PenLine, RefreshCw } from 'lucide-react';
import { HOW } from './landingContent';
import { CtaPair, SectionHead } from './landingParts';

const ICONS = [Building2, BarChart3, Globe, PenLine, RefreshCw];

export default function HowItWorks() {
  return (
    <section className="lp-section lp-section--dark lp-how" id="how-it-works" aria-labelledby="lp-how-title">
      <div className="lp-how-bg" aria-hidden="true">
        <span className="lp-dotgrid lp-dotgrid--inverse" />
        <span className="lp-orb lp-orb--deep" />
      </div>
      <div className="lp-wrap">
        <SectionHead id="lp-how-title" eyebrow={HOW.eyebrow} title={HOW.title} tone="dark" align="center" />

        <ol className="lp-how-route">
          {HOW.steps.map((s, i) => {
            const Icon = ICONS[i];
            return (
              <li key={s.title} className="lp-how-step lp-reveal" data-signal={i === HOW.highlight || undefined}>
                <span className="lp-how-node" aria-hidden="true">
                  <Icon size={20} />
                </span>
                <span className="lp-how-num" aria-hidden="true">
                  0{i + 1}
                </span>
                <h3 className="lp-h3">
                  <span className="lp-sr">Step {i + 1}: </span>
                  {s.title}
                </h3>
                <p className="lp-body">{s.body}</p>
              </li>
            );
          })}
        </ol>

        <div className="lp-how-result">
          <p>
            <strong>{HOW.resultLead}</strong> {HOW.result}
          </p>
          <CtaPair tone="dark" center />
        </div>
      </div>
    </section>
  );
}
