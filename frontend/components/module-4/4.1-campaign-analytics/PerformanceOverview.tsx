/**
 * Results → Overview: the answer in about one screen. The score beside the
 * five KPIs, then what the numbers mean and the single most important next
 * step, then a small score trend. Everything deeper lives on its own tab.
 *
 * The findings are worked out from this period's metrics (resultFindings);
 * the next action is the AI plan's own first recommendation, labelled with
 * the plan's wider scope so the two are never read as one analysis.
 */
import { ArrowRight, CheckCircle2, Info, Lightbulb, TriangleAlert } from 'lucide-react';
import type { CampaignHistoryEntry, PrescriptiveReport } from '@/types';
import { ApiErrorPanel } from '../../shared/ApiErrorPanel';
import FlaggedMetricBanner from './FlaggedMetricBanner';
import KpiCard from './KpiCard';
import PesGauge from './PesGauge';
import PesTrendChart from './PesTrendChart';
import { resultFindings } from './resultFindings';
import type { FlaggedMetric, Metrics } from './campaignTypes';

export type ResultsTab = 'overview' | 'plan' | 'journey' | 'trends' | 'attribution' | 'posts';

/**
 * Ordered by weight in the Performance Score (ARCHITECTURE_SPEC.md §4.2), so
 * the row reads "what moved the score most" first. ROAS and conversion rate,
 * together 65% of the score, lead at a larger size.
 */
const KPI_CARD_SPECS: {
  label: string;
  key: keyof Metrics;
  name: string;
  weightPct: number;
  unit: 'currency' | '%' | '×';
  hint: (currency: string) => string;
}[] = [
  { label: 'ROAS', key: 'roas', name: 'Return on ad spend', weightPct: 35, unit: '×',
    hint: (c) => `Revenue earned for every ${c}1 spent on ads.` },
  { label: 'CR', key: 'convRate', name: 'Conversion rate', weightPct: 30, unit: '%',
    hint: () => 'Bookings per 100 ad clicks.' },
  { label: 'CAC', key: 'cac', name: 'Customer acquisition cost', weightPct: 15, unit: 'currency',
    hint: () => 'Ad spend per new customer — lower is better.' },
  { label: 'CTR', key: 'ctr', name: 'Click-through rate', weightPct: 15, unit: '%',
    hint: () => 'Clicks per 100 times your ads were shown.' },
  { label: 'CPC', key: 'cpc', name: 'Cost per click', weightPct: 5, unit: 'currency',
    hint: () => 'What each ad click cost — lower is better.' },
];

const FINDING_ICON = { good: CheckCircle2, concern: TriangleAlert, note: Info } as const;

export function isReportPopulated(r: PrescriptiveReport | null): boolean {
  return !!r && typeof r.executiveSummary === 'string' && r.executiveSummary.trim().length > 0;
}

/** The report's empty/failed/loading states, shared by Overview and the Action Plan tab. */
export function ReportState({ report, error }: { report: PrescriptiveReport | null; error: unknown | null }) {
  if (error != null) return <ApiErrorPanel error={error} label="Campaign Analytics" />;
  if (report === null) {
    return <p className="ov-muted" aria-busy="true">Drafting your AI action plan…</p>;
  }
  return (
    <p className="ov-muted">
      The report service returned no content.{' '}
      <span className="font-mono text-xs">POST /api/analytics/report</span> responded 200 with an empty body.
    </p>
  );
}

export default function PerformanceOverview({
  score, label, metrics, flagged, money, periodLabel, report, error, trendWindow, onOpenTab,
}: {
  score: number;
  label: string;
  metrics: Metrics;
  flagged: FlaggedMetric[];
  money: string;
  periodLabel: string | null;
  report: PrescriptiveReport | null;
  error: unknown | null;
  trendWindow: CampaignHistoryEntry[];
  onOpenTab: (tab: ResultsTab) => void;
}) {
  const findings = resultFindings({ metrics, flagged, label, money, periodLabel });
  const populated = isReportPopulated(report);
  const lead = populated ? (report as PrescriptiveReport) : null;
  const leadRec = lead?.recommendations[0];
  const leadDiag = lead?.funnelDiagnostics[0];

  return (
    <div className="ov">
      <FlaggedMetricBanner flagged={flagged} />

      <section className="ov-score-row" aria-label="Score and key metrics">
        <PesGauge score={score} label={label} metrics={metrics} />
        <div className="ov-kpis">
          {KPI_CARD_SPECS.map((spec, i) => (
            <div key={spec.label} className={i < 2 ? 'ov-kpi ov-kpi--lead' : 'ov-kpi'}>
              <KpiCard
                label={spec.label}
                value={metrics[spec.key]}
                name={spec.name}
                hint={spec.hint(money)}
                weightPct={spec.weightPct}
                prefix={spec.unit === 'currency' ? money.trim() : undefined}
                suffix={spec.unit === 'currency' ? undefined : spec.unit}
                featured={i < 2}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="ov-insights" aria-label="Key findings">
        <div className="card ov-panel">
          <h2 className="ov-panel-title">What your results mean</h2>
          <ul className="ov-findings">
            {findings.map((f) => {
              const Icon = FINDING_ICON[f.tone];
              return (
                <li key={f.title} data-tone={f.tone}>
                  <Icon size={18} aria-hidden="true" />
                  <span>
                    <strong>{f.title}</strong>
                    <span>{f.text}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="card ov-panel ov-next">
          <h2 className="ov-panel-title">
            <Lightbulb size={18} aria-hidden="true" /> Your next best action
          </h2>
          {lead && leadRec ? (
            <>
              <p className="ov-next-where">
                {leadDiag ? <>{leadDiag.rank} step: <strong>{leadDiag.stage}</strong> · {leadDiag.dropRate} drop</> : leadRec.stage}
              </p>
              <h3 className="ov-next-title">{leadRec.title}</h3>
              <p className="ov-next-action">{leadRec.action}</p>
              <div className="ov-next-foot">
                <span className="ov-next-scope">From your AI action plan · last 4 saved periods</span>
                <button type="button" className="ov-link" onClick={() => onOpenTab('plan')}>
                  View full action plan <ArrowRight size={15} aria-hidden="true" />
                </button>
              </div>
            </>
          ) : lead ? (
            <p className="ov-muted">The action plan has no recommendations for this period.</p>
          ) : (
            <ReportState report={report} error={error} />
          )}
        </div>
      </section>

      {trendWindow.length > 1 && (
        <section className="card ov-trend" aria-labelledby="ov-trend-title">
          <div className="ov-trend-head">
            <div>
              <h2 id="ov-trend-title" className="ov-panel-title">Score over time</h2>
              <p className="ov-muted">Your last {trendWindow.length} saved periods.</p>
            </div>
            <button type="button" className="ov-link" onClick={() => onOpenTab('trends')}>
              See all trends <ArrowRight size={15} aria-hidden="true" />
            </button>
          </div>
          <PesTrendChart window={trendWindow} compact />
        </section>
      )}
    </div>
  );
}
