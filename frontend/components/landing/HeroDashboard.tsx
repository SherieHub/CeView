/**
 * The hero's product card: an illustrative CeView dashboard drawn in HTML,
 * following the real dashboard's layout (teal sidebar, greeting, three stat
 * tiles, a forecast chart and the ranked markets). Sample business and data
 * only, labelled as such; the whole card is exposed to assistive tech as one
 * image with a text summary.
 */
import {
  BarChart3,
  BellRing,
  CalendarDays,
  ChevronDown,
  LayoutDashboard,
  MapPin,
  PenLine,
  Radar,
  Settings,
  Telescope,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import sailMark from './assets/ceview-sail-light.webp';
import { HERO } from '../../content/landing';
import { MarketFlag, SampleBadge } from './ui';

const NAV_ICONS: LucideIcon[] = [LayoutDashboard, Radar, Telescope, PenLine, CalendarDays, TrendingUp, Settings];
const STAT_ICONS: LucideIcon[] = [BarChart3, BellRing, TrendingUp];

// Chart geometry (SVG user units).
const W = 400;
const H = 168;
const PAD = { l: 26, r: 8, t: 34, b: 22 };

/** The y-axis shows the band the series actually moves in, so the rise reads. */
const Y_MIN = 30;
const Y_MAX = 80;
const Y_TICKS = [80, 65, 50, 35];

const x = (i: number, n: number) => PAD.l + (i * (W - PAD.l - PAD.r)) / (n - 1);
const y = (v: number) => PAD.t + ((Y_MAX - v) * (H - PAD.t - PAD.b)) / (Y_MAX - Y_MIN);

/** Smooth path through the points (Catmull-Rom → cubic Bézier). */
function smoothPath(values: readonly number[]): string {
  const pts = values.map((v, i) => [x(i, values.length), y(v)] as const);
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

export default function HeroDashboard() {
  const d = HERO.dashboard;
  const { forecast, baseline, peak } = d.chart;
  const line = smoothPath(forecast);
  const area = `${line} L${x(forecast.length - 1, forecast.length)},${H - PAD.b} L${x(0, forecast.length)},${H - PAD.b} Z`;
  const px = x(peak, forecast.length);
  const py = y(forecast[peak]);
  const pxPct = (px / W) * 100;
  const pyPct = (py / H) * 100;

  return (
    <div className="cv-dash" role="img" aria-label={d.label}>
      <aside className="cv-dash-side">
        <img src={sailMark} alt="" width={140} height={112} className="cv-dash-mark" />
        <ul className="cv-dash-nav">
          {d.nav.map((label, i) => {
            const Icon = NAV_ICONS[i];
            return (
              <li key={label} data-active={i === 0 || undefined}>
                <Icon size={15} strokeWidth={1.75} />
                <span className="cv-dash-nav-label">{label}</span>
              </li>
            );
          })}
        </ul>
      </aside>

      <div className="cv-dash-main">
        <div className="cv-dash-top">
          <div className="cv-dash-hello">
            <p className="cv-dash-greeting">{d.greeting}</p>
            <p className="cv-dash-sub">{d.sub}</p>
          </div>
          <div className="cv-dash-filters">
            <span className="cv-dash-select">
              <MapPin size={12} strokeWidth={1.75} />
              {d.location}
              <ChevronDown size={12} strokeWidth={1.75} />
            </span>
            <span className="cv-dash-select">
              {d.range}
              <ChevronDown size={12} strokeWidth={1.75} />
            </span>
          </div>
        </div>

        <ul className="cv-dash-stats">
          {d.stats.map((s, i) => {
            const Icon = STAT_ICONS[i];
            return (
              <li key={s.label} className="cv-dash-stat">
                <span className="cv-dash-stat-icon" data-tone={s.tone}>
                  <Icon size={16} strokeWidth={1.75} />
                </span>
                <span className="cv-dash-stat-text">
                  <span className="cv-dash-stat-value">{s.value}</span>
                  <span className="cv-dash-stat-label">{s.label}</span>
                  <span className="cv-dash-stat-note">{s.note}</span>
                </span>
              </li>
            );
          })}
        </ul>

        <div className="cv-dash-panels">
          <section className="cv-dash-panel cv-dash-chart">
            <div className="cv-dash-panel-head">
              <p className="cv-dash-panel-title">{d.chart.title}</p>
              <span className="cv-dash-legend">
                <i data-series="forecast" />
                {d.chart.legendForecast}
                <i data-series="baseline" />
                {d.chart.legendBaseline}
              </span>
            </div>
            <p className="cv-dash-panel-sub">{d.chart.series}</p>
            <div className="cv-dash-plot">
              <svg viewBox={`0 0 ${W} ${H}`} focusable="false">
                <defs>
                  <linearGradient id="cv-dash-fill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#1c9a8e" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="#1c9a8e" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {Y_TICKS.map((v) => (
                  <g key={v}>
                    <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} className="cv-dash-grid" />
                    <text x={PAD.l - 6} y={y(v) + 3} className="cv-dash-axis" textAnchor="end">
                      {v}
                    </text>
                  </g>
                ))}
                <path d={area} fill="url(#cv-dash-fill)" />
                <path d={smoothPath(baseline)} className="cv-dash-baseline" />
                <path d={line} className="cv-dash-line" />
                <circle cx={px} cy={py} r="4.5" className="cv-dash-peak" />
              </svg>
              <span className="cv-dash-pill" style={{ left: `${pxPct}%`, top: `${pyPct}%` }}>
                {d.chart.peakLabel}
              </span>
              <span className="cv-dash-x">
                {d.chart.xLabels.map((l) => (
                  <span key={l}>{l}</span>
                ))}
              </span>
            </div>
          </section>

          <section className="cv-dash-panel cv-dash-markets">
            <p className="cv-dash-panel-title">{d.markets.title}</p>
            <p className="cv-dash-panel-sub">{d.markets.theme}</p>
            <ul>
              {d.markets.rows.map((m) => (
                <li key={m.key}>
                  <MarketFlag market={m.key} className="cv-dash-market" />
                  <span className="cv-dash-bar">
                    <span style={{ width: `${m.score}%` }} />
                  </span>
                  <span className="cv-dash-score">{m.score}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <SampleBadge className="cv-dash-sample" />
      </div>
    </div>
  );
}
