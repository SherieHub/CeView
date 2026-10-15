/**
 * Trust & transparency (#trust): only things the product actually does — no
 * certifications or security claims that aren't confirmed. A sticky intro on
 * the left (desktop), six statements on the right, then the Cebu pilot's
 * targets, labelled as targets rather than results.
 *
 * Styles: styles/landing-compare.css (.cv-trust-*).
 */
import { BadgeCheck, Database, Gauge, Hand, Lock, MessageSquareText, ShieldCheck, type LucideIcon } from 'lucide-react';
import { TRUST } from '../../content/landing';
import { Eyebrow, IconTile, LandingImage } from './ui';

const ICONS: Record<(typeof TRUST.items)[number]['icon'], LucideIcon> = {
  hand: Hand,
  gauge: Gauge,
  badge: BadgeCheck,
  database: Database,
  lock: Lock,
  message: MessageSquareText,
};

export default function TrustSection() {
  const t = TRUST;
  return (
    <section className="cv-section cv-trust" data-bg="teal" id="trust" aria-labelledby="cv-trust-title">
      <div className="cv-container cv-trust-grid">
        {/* Approval and data transparency sit beside the four reassurance cards. */}
        <div className="cv-trust-main">
          <div className="cv-trust-intro">
            <div className="cv-trust-photo" aria-hidden="true">
              <LandingImage slot="hero-cebu-coast" fill decorative sizes="(min-width: 1024px) 40vw, 100vw" />
            </div>
            <IconTile icon={ShieldCheck} className="cv-trust-badge" />
            <Eyebrow>{t.eyebrow}</Eyebrow>
            <h2 id="cv-trust-title" className="cv-display-lg cv-trust-title">
              {t.title}
            </h2>
            <p className="cv-body-lg">{t.intro}</p>
            <ul className="cv-trust-assurances">
              {t.items.filter((item) => item.icon === 'hand' || item.icon === 'database').map((item) => {
                const Icon = ICONS[item.icon];
                return (
                  <li key={item.title}>
                    <IconTile icon={Icon} />
                    <div><h3>{item.title}</h3><p>{item.body}</p></div>
                  </li>
                );
              })}
            </ul>
          </div>

          <ul className="cv-trust-cards">
            {t.items.filter((item) => item.icon !== 'hand' && item.icon !== 'database').map((item) => {
              const Icon = ICONS[item.icon];
              return (
                <li key={item.title} className="cv-trust-card">
                  <IconTile icon={Icon} tone={item.icon === 'message' ? 'coral' : 'teal'} />
                  <h3 className="cv-trust-card-title">{item.title}</h3>
                  <p className="cv-trust-card-body">{item.body}</p>
                  {'statuses' in item && (
                    <p className="cv-trust-statuses">
                      {item.statuses.map((s, i) => (
                        <span key={s} className="cv-trust-status" data-status={i === 0 ? 'provisional' : 'validated'}>
                          {s}
                        </span>
                      ))}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        <div className="cv-trust-pilot">
          <div className="cv-trust-pilot-head">
            <Eyebrow>{t.pilot.eyebrow}</Eyebrow>
            <span className="cv-trust-pilot-pill">{t.pilot.pill}</span>
          </div>
          <dl className="cv-trust-targets">
            {t.pilot.targets.map((p) => (
              <div key={p.value}>
                <dt>{p.label}</dt>
                <dd>{p.value}</dd>
              </div>
            ))}
          </dl>
          <p className="cv-caption cv-trust-pilot-caption">{t.pilot.caption}</p>
        </div>
      </div>
    </section>
  );
}
