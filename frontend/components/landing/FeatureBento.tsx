/**
 * Features — a bento grid with a clear hierarchy instead of a wall of equal
 * cards. Each tile carries a small fragment of the real feature. Figures that
 * appear are the same sample values shown in the product screenshots
 * (Accommodation & Staycation demo business) and are labelled as samples.
 */
import { BellRing, ChartLine, PenLine, ShieldCheck, Sparkles, TrendingUp, Zap } from 'lucide-react';
import { BUSINESS_CATEGORIES, FEATURES } from './landingContent';
import { SectionHead } from './landingParts';

const RANKING = [
  { name: 'South Korea', score: 87 },
  { name: 'Japan', score: 79 },
  { name: 'United States', score: 64 },
];

const REVIEW_BARS = [
  { label: 'Fits your business', score: 88 },
  { label: 'Fits the target audience', score: 86 },
  { label: 'Fits the platform', score: 84 },
];

/** Past 12 weeks of interest, then a 12-week look-ahead — an illustrative shape, not data. */
function ForecastSpark() {
  return (
    <svg className="lp-spark" viewBox="0 0 480 150" role="img" aria-label="Illustration: traveler interest over the past 12 weeks, then a forecast rising over the next 12 weeks.">
      <defs>
        <linearGradient id="lp-spark-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--color-teal-accent)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--color-teal-accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="300" y="8" width="130" height="126" rx="10" className="lp-spark-window" />
      <line x1="240" y1="8" x2="240" y2="134" className="lp-spark-now" />
      <path d="M10 110 L40 104 L70 108 L100 98 L130 101 L160 92 L190 95 L220 86 L240 88 L240 134 L10 134 Z" fill="url(#lp-spark-fill)" />
      <path d="M10 110 L40 104 L70 108 L100 98 L130 101 L160 92 L190 95 L220 86 L240 88" className="lp-spark-past" />
      <path d="M240 88 L270 80 L300 70 L330 52 L360 40 L390 34 L420 38 L450 46 L470 50" className="lp-spark-next" />
      <circle cx="360" cy="40" r="6" className="lp-spark-signal" />
      <text x="250" y="126" className="lp-spark-text">Now</text>
      <text x="306" y="26" className="lp-spark-text lp-spark-text--signal">Window opens</text>
    </svg>
  );
}

/** Stops a heading breaking inside a hyphenated compound ("better- / timed"). */
function KeepTogether({ text, phrase }: { text: string; phrase: string }) {
  const i = text.indexOf(phrase);
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <span className="lp-nowrap">{phrase}</span>
      {text.slice(i + phrase.length)}
    </>
  );
}

export default function FeatureBento() {
  const f = FEATURES;
  return (
    <section className="lp-section lp-section--canvas" id="features" aria-labelledby="lp-features-title">
      <div className="lp-wrap">
        <SectionHead id="lp-features-title" eyebrow={f.eyebrow} title={<KeepTogether text={f.title} phrase="better-timed" />} />

        <div className="lp-bento">
          <article className="lp-tile lp-tile--forecast lp-reveal">
            <div className="lp-tile-visual">
              <ForecastSpark />
              <span className="lp-tile-badge">{f.forecasts.note} · 12-week look-ahead</span>
            </div>
            <div className="lp-tile-copy">
              <h3 className="lp-h3">
                <TrendingUp size={20} aria-hidden="true" /> {f.forecasts.title}
              </h3>
              <p className="lp-body">{f.forecasts.body}</p>
            </div>
          </article>

          <article className="lp-tile lp-tile--ranking lp-reveal">
            <div className="lp-tile-visual">
              <p className="lp-tile-kicker">Sample · Accommodation &amp; Staycation</p>
              <ol className="lp-rank">
                {RANKING.map((m, i) => (
                  <li key={m.name} data-lead={i === 0 || undefined}>
                    <span className="lp-rank-pos">{i + 1}</span>
                    <span className="lp-rank-name">{m.name}</span>
                    <span className="lp-rank-bar" aria-hidden="true">
                      <span style={{ width: `${m.score}%` }} />
                    </span>
                    <span className="lp-rank-score">{m.score}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="lp-tile-copy">
              <h3 className="lp-h3">{f.ranking.title}</h3>
              <p className="lp-body">{f.ranking.body}</p>
            </div>
          </article>

          <article className="lp-tile lp-tile--surge lp-reveal">
            <div className="lp-tile-visual">
              <span className="lp-surge-chip">
                <Zap size={14} aria-hidden="true" /> Surge
              </span>
              <p className="lp-surge-title">Demand window opening — South Korea</p>
              <p className="lp-tile-kicker">Sample alert</p>
            </div>
            <div className="lp-tile-copy">
              <h3 className="lp-h3">
                <BellRing size={20} aria-hidden="true" /> {f.surge.title}
              </h3>
              <p className="lp-body">{f.surge.body}</p>
            </div>
          </article>

          <article className="lp-tile lp-tile--guidance lp-reveal">
            <div className="lp-tile-visual">
              <ul className="lp-cat-chips" aria-label="Tourism categories CeView understands">
                {BUSINESS_CATEGORIES.map((c) => (
                  <li key={c} data-on={c === 'Accommodation & Staycation' || undefined}>
                    {c}
                  </li>
                ))}
              </ul>
            </div>
            <div className="lp-tile-copy">
              <h3 className="lp-h3">
                <Sparkles size={20} aria-hidden="true" /> {f.guidance.title}
              </h3>
              <p className="lp-body">{f.guidance.body}</p>
            </div>
          </article>

          <article className="lp-tile lp-tile--direction lp-reveal">
            <div className="lp-tile-visual">
              <ul className="lp-directions">
                {f.direction.samples.map((s, i) => (
                  <li key={s} data-picked={i === 2 || undefined}>
                    <span className="lp-directions-opt">Option {i + 1}</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
            <div className="lp-tile-copy">
              <h3 className="lp-h3">
                <PenLine size={20} aria-hidden="true" /> {f.direction.title}
              </h3>
              <p className="lp-body">{f.direction.body}</p>
            </div>
          </article>

          <article className="lp-tile lp-tile--review lp-reveal">
            <div className="lp-tile-visual lp-review">
              <div className="lp-review-ring" role="img" aria-label="Sample review score: 84 out of 100, pass mark 70.">
                <svg viewBox="0 0 120 120" aria-hidden="true">
                  <circle cx="60" cy="60" r="50" className="lp-ring-track" />
                  <circle cx="60" cy="60" r="50" className="lp-ring-value" style={{ strokeDasharray: `${0.84 * 314.16} 314.16` }} />
                </svg>
                <span className="lp-review-score">84</span>
                <span className="lp-review-pass">
                  <ShieldCheck size={14} aria-hidden="true" /> Pass · mark 70
                </span>
              </div>
              <div className="lp-review-bars">
                <ul className="lp-review-bars">
                  {REVIEW_BARS.map((b) => (
                    <li key={b.label}>
                      <span className="lp-review-bar-head">
                        <span>{b.label}</span>
                        <span>{b.score}</span>
                      </span>
                      <span className="lp-rank-bar" aria-hidden="true">
                        <span style={{ width: `${b.score}%` }} />
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="lp-tile-kicker">Sample review</p>
              </div>
            </div>
            <div className="lp-tile-copy">
              <h3 className="lp-h3">
                <ShieldCheck size={20} aria-hidden="true" /> {f.review.title}
              </h3>
              <p className="lp-body">{f.review.body}</p>
            </div>
          </article>

          <article className="lp-tile lp-tile--performance lp-reveal">
            <div className="lp-tile-copy">
              <h3 className="lp-h3">
                <ChartLine size={20} aria-hidden="true" /> {f.performance.title}
              </h3>
              <p className="lp-body">{f.performance.body}</p>
            </div>
            <ul className="lp-metric-chips" aria-label="Measures in the performance score">
              {f.performance.metrics.map((m) => (
                <li key={m}>{m}</li>
              ))}
              <li data-plan>Action plan for next time</li>
            </ul>
          </article>
        </div>
      </div>
    </section>
  );
}
