/**
 * Product philosophy + responsible use, in one calm band:
 *   1. three principles, set as an editorial row (no cards)
 *   2. four structured trust statements — only things the product actually
 *      does; no certifications or security claims that aren't confirmed
 *   3. social proof, rendered only when SOCIAL_PROOF has real, attributable
 *      entries. Until then it renders nothing — never a placeholder quote.
 */
import { Building2, Gauge, Hand, Lock, ShieldCheck } from 'lucide-react';
import { PRINCIPLES, SOCIAL_PROOF, TRUST } from './landingContent';
import { SectionHead } from './landingParts';

const TRUST_ICONS = { review: Hand, data: Building2, private: Lock, forecast: Gauge } as const;

function SocialProof() {
  if (SOCIAL_PROOF.length === 0) return null;
  return (
    <ul className="lp-proof" aria-label="What tourism businesses say">
      {SOCIAL_PROOF.map((p) => (
        <li key={p.name} className="lp-proof-card">
          <blockquote>“{p.quote}”</blockquote>
          <p className="lp-proof-who">
            <strong>{p.name}</strong> · {p.role}
          </p>
        </li>
      ))}
    </ul>
  );
}

export default function TrustSection() {
  return (
    <section className="lp-section lp-section--wash lp-trust" aria-labelledby="lp-principles-title">
      <div className="lp-wrap">
        <SectionHead id="lp-principles-title" eyebrow={PRINCIPLES.eyebrow} title={PRINCIPLES.title} />
        <ol className="lp-principles">
          {PRINCIPLES.items.map((p, i) => (
            <li key={p.title} className="lp-reveal">
              <span className="lp-principle-num" aria-hidden="true">
                0{i + 1}
              </span>
              <h3 className="lp-h3">{p.title}</h3>
              <p className="lp-body">{p.body}</p>
            </li>
          ))}
        </ol>

        <div className="lp-trust-block">
          <div className="lp-trust-intro">
            <span className="lp-trust-badge" aria-hidden="true">
              <ShieldCheck size={26} />
            </span>
            <p className="lp-eyebrow">{TRUST.eyebrow}</p>
            <h2 className="lp-h2 lp-h2--sm">{TRUST.title}</h2>
          </div>
          <ul className="lp-trust-grid">
            {TRUST.items.map((t) => {
              const Icon = TRUST_ICONS[t.icon];
              return (
                <li key={t.title} className="lp-trust-card lp-reveal">
                  <span className="lp-trust-icon" aria-hidden="true">
                    <Icon size={20} />
                  </span>
                  <h3 className="lp-h3">{t.title}</h3>
                  <p className="lp-body">{t.body}</p>
                </li>
              );
            })}
          </ul>
        </div>

        <SocialProof />
      </div>
    </section>
  );
}
