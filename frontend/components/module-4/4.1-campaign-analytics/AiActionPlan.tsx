/**
 * CARD — Performance: AI Action Plan
 * Depends on: Foundation — Performance Shell & Ingestion (M4-F)
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/05-module-4.md (M4-5)
 * Pseudocode: pseudocode/module-4/ai-action-plan.ts
 *
 * Executive summary, then the 3 funnel diagnostics rendered exactly as given
 * in report.funnelDiagnostics — already ranked Weakest -> Moderate -> Alright
 * by business impact, NOT re-sorted by raw drop-rate percentage (see the
 * card's milestone text). Each diagnostic is zipped by index with
 * report.recommendations[i] into one card: diagnostic stage/rank/insight +
 * the paired recommendation's title/action + an urgency chip.
 *
 * No established convention exists yet for a 3-tier urgency chip (per the
 * card text), so Most Urgent / Urgent / Not Very Urgent map onto the
 * existing brand accent ramp — coral -> sand -> mint — rather than inventing
 * new colors.
 */
import { useState } from 'react';
import { ChevronDown, Info, Sparkles } from 'lucide-react';
import type { ActionPlanSlotProps } from './campaignTypes';

/** Urgency as the report states it, and the plain priority it stands for. */
const URGENCY_CHIP_CLASS: Record<string, string> = {
  'Most Urgent': 'ap-chip ap-chip--high',
  Urgent: 'ap-chip ap-chip--medium',
  'Not Very Urgent': 'ap-chip ap-chip--low',
};
const DEFAULT_CHIP_CLASS = 'ap-chip ap-chip--low';
const PRIORITY_LABEL: Record<string, string> = {
  'Most Urgent': 'High priority',
  Urgent: 'Medium priority',
  'Not Very Urgent': 'Lower priority',
};

function UrgencyChip({ urgency }: { urgency: string }) {
  return <span className={URGENCY_CHIP_CLASS[urgency] ?? DEFAULT_CHIP_CLASS}>{urgency}</span>;
}

/** Platforms CeView can publish to; anything else the operator posts on themselves. */
const PUBLISHABLE = /instagram|tiktok|facebook/i;

export default function AiActionPlan({ report }: ActionPlanSlotProps) {
  const [summaryOpen, setSummaryOpen] = useState(false);
  const canPublish = PUBLISHABLE.test(report.recommendedPlatform);

  return (
    <div className="ap">
      <div className="ap-head card">
        <div className="ap-head-main">
          <h2 className="ap-title">
            <Sparkles size={20} aria-hidden="true" /> Your AI Action Plan
          </h2>
          <p className="ap-sub">Practical improvements, most important first.</p>
          <p className={`ap-summary ${summaryOpen ? 'is-open' : ''}`}>{report.executiveSummary}</p>
          <button type="button" className="ap-more" aria-expanded={summaryOpen} onClick={() => setSummaryOpen((o) => !o)}>
            {summaryOpen ? 'Show less' : 'Read the full summary'}
            <ChevronDown size={15} aria-hidden="true" />
          </button>
          <p className="ap-scope">
            <Info size={14} aria-hidden="true" />
            Written from your last 4 saved periods combined, so its figures can differ from this period&rsquo;s score.
          </p>
        </div>
        <aside className="ap-platform" aria-label="Suggested channel">
          <span className="ap-platform-label">Suggested channel</span>
          <span className="ap-platform-name">Recommended platform: {report.recommendedPlatform}</span>
          <span className="ap-platform-note">
            {canPublish
              ? 'CeView can publish there once the account is connected in Settings → Platforms.'
              : 'CeView doesn’t publish there — post on it yourself if you try it.'}
          </span>
        </aside>
      </div>

      <ol className="ap-list">
        {report.funnelDiagnostics.map((diagnostic, index) => {
          const recommendation = report.recommendations[index];
          return (
            <li
              key={diagnostic.stage}
              data-testid={`action-plan-card-${index}`}
              className="card ap-card"
              data-lead={index === 0 || undefined}
            >
              <div className="ap-card-top">
                <span className="ap-num" aria-hidden="true">{index + 1}</span>
                {recommendation && (
                  <span className="ap-priority">{PRIORITY_LABEL[recommendation.urgency] ?? recommendation.urgency}</span>
                )}
                {recommendation && <UrgencyChip urgency={recommendation.urgency} />}
              </div>

              <div className="ap-stage">
                <span className="ap-rank">{diagnostic.rank}</span>
                <h3 className="ap-stage-name">{diagnostic.stage}</h3>
                <span className="ap-drop">{diagnostic.dropRate} drop</span>
              </div>

              {recommendation && (
                <div className="ap-rec">
                  <h4 className="ap-rec-title">{recommendation.title}</h4>
                  <p className="ap-rec-action">{recommendation.action}</p>
                </div>
              )}

              <details className="ap-why">
                <summary>Why this matters</summary>
                <p>{diagnostic.insight}</p>
              </details>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
