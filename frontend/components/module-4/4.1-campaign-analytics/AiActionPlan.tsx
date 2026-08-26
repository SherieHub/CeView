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
import { Sparkles } from 'lucide-react';
import type { ActionPlanSlotProps } from './campaignTypes';

const URGENCY_CHIP_CLASS: Record<string, string> = {
  'Most Urgent': 'bg-coral-cta text-white',
  Urgent: 'bg-sand text-navy-dark',
  'Not Very Urgent': 'bg-mint-pale text-navy-primary',
};
const DEFAULT_CHIP_CLASS = 'bg-mint-pale text-navy-primary';

function UrgencyChip({ urgency }: { urgency: string }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-sm px-2 py-1 text-xs font-semibold ${
        URGENCY_CHIP_CLASS[urgency] ?? DEFAULT_CHIP_CLASS
      }`}
    >
      {urgency}
    </span>
  );
}

export default function AiActionPlan({ report }: ActionPlanSlotProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="card flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h2 className="heading-lg flex items-center gap-2">
            <Sparkles size={22} className="text-teal-accent" aria-hidden="true" />
            AI Action Plan
          </h2>
          <p className="body-sm max-w-[56ch]">{report.executiveSummary}</p>
        </div>
        <span className="badge badge--teal whitespace-nowrap">
          Recommended platform: {report.recommendedPlatform}
        </span>
      </div>

      <div className="flex flex-col gap-4">
        {report.funnelDiagnostics.map((diagnostic, index) => {
          const recommendation = report.recommendations[index];
          return (
            <div
              key={diagnostic.stage}
              data-testid={`action-plan-card-${index}`}
              className="card flex flex-col gap-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="eyebrow">{diagnostic.rank}</span>
                  <h3 className="heading-sm">{diagnostic.stage}</h3>
                </div>
                {recommendation && <UrgencyChip urgency={recommendation.urgency} />}
              </div>

              <p className="body-sm max-w-[56ch]">{diagnostic.insight}</p>

              {recommendation && (
                <div className="rounded-md bg-mint-pale-alt p-4">
                  <h4 className="heading-sm">{recommendation.title}</h4>
                  <p className="body-sm mt-1 max-w-[56ch]">{recommendation.action}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
