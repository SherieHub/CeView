/**
 * The challenge (why timing matters) — with the page's one contextual
 * destination photo — then the bridge into what CeView does:
 * one connected route from signal to review. The first node is drawn in the
 * opportunity colour — it's the moment everything else follows from.
 */
import { Clock, Layers, Radar } from 'lucide-react';
import moalboalPhoto from './assets/photos/moalboal.webp';
import { PROBLEM } from './landingContent';
import { RouteLines, SectionHead } from './landingParts';

const ICONS = [Radar, Clock, Layers];

export default function ProblemSection() {
  return (
    <section className="lp-section lp-section--wash lp-problem" aria-labelledby="lp-problem-title">
      <RouteLines className="lp-problem-routes" variant="b" />
      <div className="lp-wrap">
        <div className="lp-problem-grid">
          <div className="lp-problem-intro">
            <SectionHead id="lp-problem-title" eyebrow={PROBLEM.eyebrow} title={PROBLEM.title} lede={PROBLEM.lede} />
          </div>

          <div className="lp-problem-side">
            <ul className="lp-pain-list">
              {PROBLEM.points.map((p, i) => {
                const Icon = ICONS[i];
                return (
                  <li key={p.title} className="lp-pain lp-reveal" data-variant={i}>
                    <span className="lp-pain-icon" aria-hidden="true">
                      <Icon size={22} />
                    </span>
                    <div>
                      <h3 className="lp-h3">{p.title}</h3>
                      <p className="lp-body">{p.body}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
            <figure className="lp-context-photo lp-reveal">
              <img src={moalboalPhoto} alt={PROBLEM.photo.alt} width={1000} height={600} loading="lazy" decoding="async" />
              <figcaption>{PROBLEM.photo.caption}</figcaption>
            </figure>
          </div>
        </div>

        <div className="lp-bridge lp-reveal">
          <p className="lp-bridge-title">{PROBLEM.bridge}</p>
          <ol className="lp-bridge-route">
            {PROBLEM.bridgeSteps.map((s, i) => (
              <li key={s} className="lp-bridge-step" data-signal={i === 0 || undefined}>
                <span className="lp-bridge-node" aria-hidden="true">
                  <span />
                </span>
                <span className="lp-bridge-label">
                  <span className="lp-sr">Step {i + 1}: </span>
                  {s}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
