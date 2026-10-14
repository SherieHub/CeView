/**
 * The challenge (#challenge): why small tourism businesses miss demand shifts.
 * A centred heading and intro; one wide panel pairing the Moalboal photo with
 * "What's at stake" (published tourism statistics on dark teal, as real text,
 * sources included — #challenge-sources is also the market strip note's
 * target); the two problems as side-by-side cards; a closing line.
 *
 * Styles: styles/landing-challenge.css (.cv-challenge-*).
 */
import { Layers, Radar } from 'lucide-react';
import { CHALLENGE } from '../../content/landing';
import { IMAGE_CREDITS } from '../../content/image-credits';
import { Accent, Card, Eyebrow, IconTile, LandingImage } from './ui';

const ICONS = [Radar, Layers];

const photo = IMAGE_CREDITS.find((c) => c.slot === 'challenge-aerial-boats')!;

/** Photo half of the panel: ~500px on desktop, full width when stacked. */
const PHOTO_SIZES = '(min-width: 1024px) 520px, 100vw';

export default function ChallengeSection() {
  return (
    <section className="cv-section cv-challenge" id="challenge" aria-labelledby="cv-challenge-title">
      <div className="cv-container cv-challenge-inner">
        <header className="cv-challenge-head">
          <Eyebrow>{CHALLENGE.eyebrow}</Eyebrow>
          <h2 id="cv-challenge-title" className="cv-display-lg cv-challenge-title">
            {CHALLENGE.titleLead}
            <Accent>{CHALLENGE.titleAccent}</Accent>
            {CHALLENGE.titleTail}
          </h2>
          <p className="cv-body-lg cv-challenge-intro">{CHALLENGE.intro}</p>
        </header>

        <div className="cv-challenge-panel">
          <figure className="cv-challenge-photo">
            <LandingImage slot="challenge-aerial-boats" fill sizes={PHOTO_SIZES} />
            <figcaption className="cv-challenge-place">
              <span className="cv-challenge-dot" aria-hidden="true" />
              {photo.caption}
            </figcaption>
          </figure>

          <div className="cv-challenge-stats">
            <p className="cv-eyebrow cv-challenge-stats-eyebrow">{CHALLENGE.statsEyebrow}</p>
            <dl>
              {CHALLENGE.stats.map((s) => (
                <div key={s.value}>
                  <dt className="cv-challenge-stat-label">{s.label}</dt>
                  <dd className="cv-challenge-stat-value" data-negative={'negative' in s || undefined}>
                    {s.value}
                  </dd>
                </div>
              ))}
            </dl>
            <p id="challenge-sources" className="cv-challenge-sources">
              {CHALLENGE.sources}
            </p>
          </div>
        </div>

        <ul className="cv-challenge-problems">
          {CHALLENGE.problems.map((p, i) => (
            <li key={p.title}>
              <Card className="cv-challenge-problem">
                <IconTile icon={ICONS[i]} tone={p.tone} />
                <div>
                  <h3 className="cv-challenge-problem-title">{p.title}</h3>
                  <p className="cv-challenge-problem-body">{p.body}</p>
                </div>
              </Card>
            </li>
          ))}
        </ul>

        <p className="cv-challenge-closing">{CHALLENGE.closing}</p>
      </div>
    </section>
  );
}
