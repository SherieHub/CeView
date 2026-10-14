/**
 * Features (#features): a 12-column bento of the eight capabilities. Every
 * mini-visual is live HTML/SVG on the landing tokens and carries a "Sample" or
 * "Illustrative" label; the information in each is also in its text, so
 * purely graphic parts are hidden from assistive tech (the forecast chart
 * has its own title and description instead).
 *
 * Cards fade up as they enter view (80ms apart within a row); bars, rings and
 * the chart line then animate once. Reduced motion shows everything at rest.
 *
 * Styles: styles/landing-features.css (.cv-feat-*).
 */
import type { CSSProperties, ReactNode } from 'react';
import {
  ArrowRight,
  BellRing,
  ChartLine,
  Languages,
  ListOrdered,
  PenLine,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { FACTS, FEATURES } from '../../content/landing';
import { Accent, Eyebrow, SampleBadge } from './ui';
import useInView from './ui/useInView';

const f = FEATURES;

/* ---------------- forecast chart geometry ---------------- */

const CW = 520;
const CH = 292; // 16:9
const CP = { l: 14, r: 14, t: 52, b: 30 };
const HIST = 52;
const AHEAD = 12;
const NOW = HIST - 1;
const V_MIN = 22;
const V_MAX = 92;

const cx = (i: number) => CP.l + (i * (CW - CP.l - CP.r)) / (NOW + AHEAD);
const cy = (v: number) => CP.t + ((V_MAX - v) * (CH - CP.t - CP.b)) / (V_MAX - V_MIN);

/** An illustrative weekly series: a seasonal swell with some week-to-week noise. */
const history = Array.from(
  { length: HIST },
  (_, i) =>
    Math.round(
      (44 + 6 * Math.sin((2 * Math.PI * (i + 8)) / 52) + 2.2 * Math.sin(i * 0.55 + 0.4) + 1.1 * Math.sin(i * 1.3)) * 10,
    ) / 10,
);
const base = history[NOW];
/** Forecast from "now": rises to a peak about 7 weeks out, then eases. */
const forecast = Array.from({ length: AHEAD + 1 }, (_, j) => base + 24 * Math.sin((Math.PI * j) / 14) ** 1.3);
const band = (j: number) => 1.5 + j * 1.1;
const PEAK = 7;
const WIN_FROM = 3;
const WIN_TO = 11;

function smooth(pts: [number, number][]): string {
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

const histPts = history.map((v, i) => [cx(i), cy(v)] as [number, number]);
const histLine = smooth(histPts);
const histArea = `${histLine} L${cx(NOW).toFixed(1)},${CH - CP.b} L${cx(0).toFixed(1)},${CH - CP.b} Z`;
const foreLine = smooth(forecast.map((v, j) => [cx(NOW + j), cy(v)] as [number, number]));
const upper = forecast.map((v, j) => [cx(NOW + j), cy(v + band(j))] as [number, number]);
const lower = forecast.map((v, j) => [cx(NOW + j), cy(v - band(j))] as [number, number]).reverse();
const bandPath = `${smooth(upper)} L${lower[0][0].toFixed(1)},${lower[0][1].toFixed(1)} ${smooth(lower).slice(1)} Z`;

function ForecastChart() {
  const winX = cx(NOW + WIN_FROM);
  const winW = cx(NOW + WIN_TO) - winX;
  return (
    <svg className="cv-feat-chart" viewBox={`0 0 ${CW} ${CH}`} role="img" aria-labelledby="cv-fc-title cv-fc-desc">
      <title id="cv-fc-title">{f.forecasts.chartTitle}</title>
      <desc id="cv-fc-desc">{f.forecasts.chartDesc}</desc>
      <defs>
        <linearGradient id="cv-fc-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#1c9a8e" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#1c9a8e" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g className="cv-feat-chart-ahead">
        <rect
          x={winX}
          y={CP.t - 18}
          width={winW}
          height={CH - CP.t - CP.b + 18}
          rx="10"
          className="cv-feat-chart-window"
        />
        <text x={winX + winW} y={CP.t - 26} className="cv-feat-chart-label" data-tone="coral" textAnchor="end">
          {f.forecasts.window}
        </text>
        <path d={bandPath} className="cv-feat-chart-band" />
        <path d={foreLine} className="cv-feat-chart-fore" />
        <circle cx={cx(NOW + PEAK)} cy={cy(forecast[PEAK])} r="6" className="cv-feat-chart-peak" />
      </g>
      <path d={histArea} fill="url(#cv-fc-fill)" className="cv-feat-chart-area" />
      <path d={histLine} pathLength={1} className="cv-feat-chart-line" />
      <line x1={cx(NOW)} x2={cx(NOW)} y1={CP.t - 18} y2={CH - CP.b} className="cv-feat-chart-now" />
      <text x={cx(NOW) - 8} y={CH - CP.b + 20} className="cv-feat-chart-label" textAnchor="end">
        {f.forecasts.now}
      </text>
      <line x1={CP.l} x2={CW - CP.r} y1={CH - CP.b} y2={CH - CP.b} className="cv-feat-chart-axis" />
    </svg>
  );
}

/* ---------------- shared pieces ---------------- */

/** Keeps a hyphenated compound on one line ("better-timed", not "better- / timed"). */
function KeepTogether({ text, phrase }: { text: string; phrase: string }) {
  const i = text.indexOf(phrase);
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <span className="cv-nowrap">{phrase}</span>
      {text.slice(i + phrase.length)}
    </>
  );
}

function Kicker({ children }: { children: ReactNode }) {
  return <p className="cv-feat-kicker">{children}</p>;
}

/** A score ring; the stroke grows to `value` (0–1) once the card is shown. */
function Ring({ value, size, className }: { value: number; size: number; className?: string }) {
  const r = 50;
  const c = 2 * Math.PI * r;
  return (
    <svg
      className={`cv-feat-ring${className ? ` ${className}` : ''}`}
      viewBox="0 0 120 120"
      width={size}
      height={size}
      aria-hidden="true"
      style={{ '--c': c, '--off': c * (1 - value) } as CSSProperties}
    >
      <circle cx="60" cy="60" r={r} className="cv-feat-ring-track" />
      <circle cx="60" cy="60" r={r} className="cv-feat-ring-value" transform="rotate(-90 60 60)" />
    </svg>
  );
}

function Bar({ value }: { value: number }) {
  return (
    <span className="cv-feat-bar" aria-hidden="true">
      <span style={{ '--w': `${value}%` } as CSSProperties} />
    </span>
  );
}

function FeatureCard({
  area,
  tone,
  delay,
  className,
  children,
}: {
  area: string;
  tone?: 'warm' | 'dark' | 'tint';
  /** Position within its row, for the 80ms stagger. */
  delay: number;
  className?: string;
  children: ReactNode;
}) {
  const [ref, shown] = useInView<HTMLElement>(0.2);
  return (
    <article
      ref={ref}
      className={`cv-feat${className ? ` ${className}` : ''}`}
      data-area={area}
      data-tone={tone}
      data-shown={shown || undefined}
      style={{ '--d': `${delay * 80}ms` } as CSSProperties}
    >
      {children}
    </article>
  );
}

function Title({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <h3 className="cv-feat-title">
      <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
      {children}
    </h3>
  );
}

/* ---------------- section ---------------- */

export default function FeaturesSection() {
  return (
    <section className="cv-section cv-features" data-bg="white" id="features" aria-labelledby="cv-features-title">
      <div className="cv-container">
        <div className="cv-grid cv-features-head">
          <div className="cv-features-heading">
            <Eyebrow>{f.eyebrow}</Eyebrow>
            <h2 id="cv-features-title" className="cv-display-lg">
              <KeepTogether text={f.titleLead} phrase="better-timed" />
              <Accent>{f.titleAccent}</Accent>
              {f.titleTail}
            </h2>
          </div>
          <p className="cv-body-lg cv-features-intro">{f.intro}</p>
        </div>

        <div className="cv-features-grid">
          {/* A — demand forecasts */}
          <FeatureCard area="a" delay={0}>
            <div className="cv-feat-visual cv-feat-forecast">
              <ForecastChart />
              <p className="cv-feat-tag">{f.forecasts.tag}</p>
            </div>
            <div className="cv-feat-copy">
              <Title icon={TrendingUp}>{f.forecasts.title}</Title>
              <p className="cv-feat-body">{f.forecasts.body}</p>
              <p className="cv-feat-note">{f.forecasts.note}</p>
            </div>
          </FeatureCard>

          {/* B — market ranking */}
          <FeatureCard area="b" delay={1}>
            <div className="cv-feat-visual">
              <Kicker>{f.ranking.kicker}</Kicker>
              <ol className="cv-feat-rank">
                {f.ranking.rows.map((r, i) => (
                  <li key={r.name} data-lead={i === 0 || undefined}>
                    <span className="cv-feat-rank-pos" aria-hidden="true">
                      {i + 1}
                    </span>
                    <span className="cv-feat-rank-name">{r.name}</span>
                    <span className="cv-feat-rank-score">{r.score}</span>
                    <Bar value={r.score} />
                  </li>
                ))}
              </ol>
            </div>
            <div className="cv-feat-copy">
              <Title icon={ListOrdered}>{f.ranking.title}</Title>
              <p className="cv-feat-body">{f.ranking.body}</p>
            </div>
          </FeatureCard>

          {/* C — surge alerts */}
          <FeatureCard area="c" tone="warm" delay={0}>
            <div className="cv-feat-visual">
              <div className="cv-feat-alert">
                <span className="cv-feat-alert-chip">
                  <Zap size={13} strokeWidth={2} aria-hidden="true" />
                  {f.surge.chip}
                </span>
                <p className="cv-feat-alert-title">{f.surge.alertTitle}</p>
                <p className="cv-feat-alert-note">{f.surge.alertNote}</p>
              </div>
              <Kicker>{f.surge.kicker}</Kicker>
            </div>
            <div className="cv-feat-copy">
              <Title icon={BellRing}>{f.surge.title}</Title>
              <p className="cv-feat-body">{f.surge.body}</p>
            </div>
          </FeatureCard>

          {/* D — business profile & themes */}
          <FeatureCard area="d" tone="dark" delay={1}>
            <div className="cv-feat-visual cv-feat-profile">
              <ul className="cv-feat-themes">
                {FACTS.themes.map((t) => {
                  const match = f.profile.matched.find((m) => m.theme === t);
                  return (
                    <li key={t} data-on={match ? true : undefined}>
                      {t}
                      {match && <span className="cv-feat-conf">{match.confidence}</span>}
                    </li>
                  );
                })}
              </ul>
              <div className="cv-feat-unique">
                <span className="cv-feat-unique-ring">
                  <Ring
                    value={f.profile.uniqueness.value / f.profile.uniqueness.max}
                    size={84}
                    className="cv-feat-ring--coral"
                  />
                  <span className="cv-feat-unique-value">{f.profile.uniqueness.value}</span>
                </span>
                <span className="cv-feat-unique-label">
                  {f.profile.uniqueness.label} {f.profile.uniqueness.value}/{f.profile.uniqueness.max}
                </span>
              </div>
              <Kicker>{f.profile.kicker}</Kicker>
            </div>
            <div className="cv-feat-copy">
              <Title icon={Sparkles}>{f.profile.title}</Title>
              <p className="cv-feat-body">{f.profile.body}</p>
            </div>
          </FeatureCard>

          {/* E — content direction */}
          <FeatureCard area="e" delay={0}>
            <div className="cv-feat-visual">
              <ul className="cv-feat-options">
                {f.direction.options.map((o, i) => (
                  <li key={o} data-picked={i === 2 || undefined}>
                    <span className="cv-feat-option-pill">Option {i + 1}</span>
                    {o}
                  </li>
                ))}
              </ul>
              <Kicker>{f.direction.kicker}</Kicker>
            </div>
            <div className="cv-feat-copy">
              <Title icon={PenLine}>{f.direction.title}</Title>
              <p className="cv-feat-body">{f.direction.body}</p>
            </div>
          </FeatureCard>

          {/* F — content review */}
          <FeatureCard area="f" tone="tint" delay={1}>
            <div className="cv-feat-visual cv-feat-review">
              <div className="cv-feat-review-score">
                <span className="cv-feat-review-ring">
                  <Ring value={f.review.score / 100} size={120} />
                  <span className="cv-feat-review-value">{f.review.score}</span>
                </span>
                <span className="cv-feat-pass">
                  <ShieldCheck size={14} strokeWidth={1.75} aria-hidden="true" />
                  {f.review.pass}
                </span>
              </div>
              <div className="cv-feat-review-bars">
                <ul>
                  {f.review.bars.map((b) => (
                    <li key={b.label}>
                      <span className="cv-feat-review-head">
                        <span>{b.label}</span>
                        <span>{b.score}</span>
                      </span>
                      <Bar value={b.score} />
                    </li>
                  ))}
                </ul>
                <Kicker>{f.review.kicker}</Kicker>
              </div>
            </div>
            <div className="cv-feat-copy">
              <Title icon={ShieldCheck}>{f.review.title}</Title>
              <p className="cv-feat-body">{f.review.body}</p>
            </div>
          </FeatureCard>

          {/* G — performance guidance */}
          <FeatureCard area="g" delay={0}>
            <div className="cv-feat-visual">
              <div className="cv-feat-flow">
                <ul className="cv-feat-kpis">
                  {f.performance.metrics.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
                <ArrowRight className="cv-feat-flow-arrow" size={18} strokeWidth={1.75} aria-hidden="true" />
                <span className="cv-feat-flow-chip" data-tone="coral">
                  {f.performance.score}
                </span>
                <ArrowRight className="cv-feat-flow-arrow" size={18} strokeWidth={1.75} aria-hidden="true" />
                <span className="cv-feat-flow-chip">{f.performance.report}</span>
              </div>
              <p className="cv-feat-sources">
                {f.performance.sources.map((s) => (
                  <span key={s} className="cv-feat-source">
                    {s}
                  </span>
                ))}
                <span>{f.performance.manual}</span>
              </p>
              <SampleBadge kind="illustrative" className="cv-feat-badge" />
            </div>
            <div className="cv-feat-copy">
              <Title icon={ChartLine}>{f.performance.title}</Title>
              <p className="cv-feat-body">{f.performance.body}</p>
            </div>
          </FeatureCard>

          {/* H — local-language keywords */}
          <FeatureCard area="h" delay={1}>
            <div className="cv-feat-visual">
              <ul className="cv-feat-keywords">
                {f.keywords.rows.map((k) => (
                  <li key={k.lang}>
                    <abbr className="cv-feat-lang" title={k.langName}>
                      {k.lang}
                    </abbr>
                    <span lang={k.htmlLang}>{k.term}</span>
                  </li>
                ))}
              </ul>
              <Kicker>{f.keywords.kicker}</Kicker>
            </div>
            <div className="cv-feat-copy">
              <Title icon={Languages}>{f.keywords.title}</Title>
              <p className="cv-feat-body">{f.keywords.body}</p>
            </div>
          </FeatureCard>
        </div>
      </div>
    </section>
  );
}
