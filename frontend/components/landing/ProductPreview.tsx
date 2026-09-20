/**
 * Product preview — a faithful, static rendering of the operator dashboard.
 *
 * Built from the dashboard's OWN component classes (.stat-tile, .alert-card,
 * .rank-card, .chip, .bar — see styles/index.css) rather than a lookalike, so
 * the preview can't drift from the product: restyle the dashboard and this
 * follows. Wrapped in a chrome-and-canvas frame that echoes the app shell.
 *
 * Every figure here is sample data. The whole mock is one role="img" with a
 * plain description and aria-hidden internals, so a screen reader never reads
 * illustrative numbers out as if they were real results — and the caption
 * says so for sighted visitors too.
 */
import { ArrowRight, BellDot, CalendarClock, Compass, MapPin, Plane, Tag, TrendingUp, Zap } from 'lucide-react';
import { PREVIEW } from './landingContent';
import { OPPORTUNITY_ASPECT, OpportunityLine, SectionHead } from './landingParts';

const SAMPLE_MARKETS = [
  { rank: 1, name: 'Japan', city: 'Osaka', km: '2,186', score: 72, direct: true, hours: '2h 50m', freq: 8, surge: true },
  { rank: 2, name: 'South Korea', city: 'Seoul', km: '2,640', score: 58, direct: true, hours: '4h 10m', freq: 14, surge: false },
  { rank: 3, name: 'United States', city: 'Los Angeles', km: '11,027', score: 44, direct: false, hours: '16h+', freq: 3, surge: false },
] as const;

function Callout({ n }: { n: number }) {
  return (
    <span className="lp-callout-dot" aria-hidden="true">
      {n}
    </span>
  );
}

export default function ProductPreview() {
  return (
    <section className="lp-section lp-section--white lp-preview" id="product" aria-labelledby="lp-preview-title">
      <div className="lp-wrap">
        <SectionHead
          id="lp-preview-title"
          eyebrow={PREVIEW.eyebrow}
          title={PREVIEW.title}
          lede={PREVIEW.lede}
        />

        <div className="lp-preview-stage" data-reveal>
          <div
            className="lp-window"
            role="img"
            aria-label="Sample CeView dashboard showing new alerts, an active demand surge for Japan, markets ranked by potential, and a traveler-interest chart that looks ahead twelve weeks."
          >
            <div className="lp-window-bar" aria-hidden="true">
              <i />
              <i />
              <i />
              <span className="lp-window-url">app.ceview · Dashboard</span>
            </div>

            <div className="lp-window-body" aria-hidden="true">
              <div className="lp-window-rail">
                <span className="lp-rail-logo" />
                <span className="lp-rail-item" data-active="true" />
                <span className="lp-rail-item" />
                <span className="lp-rail-item" />
                <span className="lp-rail-item" />
              </div>

              <div className="lp-window-canvas">
                <div className="lp-window-head">
                  <div>
                    <p className="heading-sm">This week at a glance</p>
                    <p className="text-meta">Select an alert to see the markets ranked for its category.</p>
                  </div>
                </div>

                <div className="lp-anchor">
                  <Callout n={1} />
                  <div className="stat-row">
                    <div className="stat-tile">
                      <span className="stat-icon">
                        <BellDot size={22} strokeWidth={1.75} />
                      </span>
                      <div className="stat-head">
                        <span className="stat-label">Unread alerts</span>
                        <b className="stat-value num">2</b>
                      </div>
                      <div className="stat-foot">Across your categories</div>
                    </div>
                    <div className="stat-tile">
                      <span className="stat-icon">
                        <Zap size={22} strokeWidth={1.75} />
                      </span>
                      <div className="stat-head">
                        <span className="stat-label">Active surges</span>
                        <b className="stat-value num">1</b>
                      </div>
                      <div className="stat-foot">Japan</div>
                    </div>
                    <div className="stat-tile stat-tile--action">
                      <span className="stat-icon">
                        <Compass size={22} strokeWidth={1.75} />
                      </span>
                      <div className="stat-head">
                        <span className="stat-label">Top market now</span>
                        <b className="stat-value">Japan</b>
                      </div>
                      <div className="stat-foot">
                        <span>72/100 · Accommodation</span>
                        <ArrowRight size={15} className="stat-go" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="lp-window-cols">
                  <div className="lp-window-main">
                    <div className="alert-card lp-static" data-selected="true">
                      <div className="alert-top">
                        <span className="alert-dot" />
                        <span className="text-meta">This week</span>
                        <span className="chip chip--critical">
                          <Zap /> Surge
                        </span>
                      </div>
                      <h3 className="heading-sm">Demand window alert — Japan — Accommodation &amp; Staycation</h3>
                      <p className="body-sm">
                        Interest from Japan is forecast to rise above its recent baseline. The first week crossing the
                        demand-window threshold starts in three weeks.
                      </p>
                      <div className="chip-row mt-3">
                        <span className="chip">
                          <MapPin /> Japan
                        </span>
                        <span className="chip">
                          <Tag /> Accommodation &amp; Staycation
                        </span>
                        <span className="chip">
                          <TrendingUp /> Rising demand window
                        </span>
                      </div>
                    </div>

                    <div className="lp-anchor">
                      <Callout n={3} />
                      <div className="card lp-chart-card">
                        <div className="lp-chart-legend">
                          <span className="lp-legend lp-legend--observed">Observed</span>
                          <span className="lp-legend lp-legend--forecast">Forecast</span>
                          <span className="lp-chart-conf">Confidence shown on every forecast</span>
                        </div>
                        <div className="lp-oline-frame lp-oline-frame--light" style={{ aspectRatio: OPPORTUNITY_ASPECT }}>
                          <OpportunityLine />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="lp-anchor lp-window-side">
                    <Callout n={2} />
                    <p className="eyebrow lp-side-title">Top target markets</p>
                    <div className="lp-rank-list">
                      {SAMPLE_MARKETS.map((m) => (
                        <div key={m.name} className="rank-card lp-static">
                          <div className="rank-head">
                            <span className="rank-no" data-lead={m.rank === 1}>
                              {m.rank}
                            </span>
                            <div className="min-w-0 flex-1">
                              <h3 className="heading-sm">{m.name}</h3>
                              <p className="text-meta">
                                {m.city} · {m.km} km to Cebu
                              </p>
                            </div>
                            <div className="rank-score">
                              <b className="num">{m.score}</b>
                              <span className="text-meta">Potential</span>
                            </div>
                          </div>
                          <div className="mt-3">
                            <div className={`bar ${m.rank === 1 ? 'bar--lead' : ''}`}>
                              <i style={{ width: `${m.score}%` }} />
                            </div>
                          </div>
                          <div className="rank-facts">
                            <span className="rank-fact" data-direct={m.direct}>
                              <Plane size={14} />
                              <b>{m.direct ? 'Direct' : 'Via Manila'}</b> · {m.hours}
                            </span>
                            <span className="rank-fact">
                              <CalendarClock size={14} />
                              {m.freq}x / week
                            </span>
                            {m.surge && (
                              <span className="chip chip--critical ml-auto">
                                <Zap /> Surge active
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <p className="lp-illustrative lp-illustrative--center">{PREVIEW.caption}</p>
        </div>

        <ol className="lp-callouts">
          {PREVIEW.callouts.map((c, i) => (
            <li key={c.title} className="lp-callout" data-reveal>
              <span className="lp-callout-dot">{i + 1}</span>
              <div>
                <h3 className="lp-callout-title">{c.title}</h3>
                <p className="lp-callout-body">{c.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
