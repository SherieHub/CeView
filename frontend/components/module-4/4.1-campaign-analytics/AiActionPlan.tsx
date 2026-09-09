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
      {/* Full-width summary: prose on the left uses the column's width, the
          right rail carries the recommended platform + a scannable priority
          list that the detail cards below expand on. */}
      <div className="card grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex flex-col gap-2">
          <h2 className="heading-md flex items-center gap-2">
            <Sparkles size={20} className="text-teal-accent" aria-hidden="true" />
            AI Action Plan
          </h2>
          <p className="body-sm">{report.executiveSummary}</p>
        </div>
        <div className="flex flex-col gap-3 lg:border-l lg:border-[var(--color-gray-light)] lg:pl-6">
          <span className="badge badge--teal w-fit whitespace-nowrap">
            Recommended platform: {report.recommendedPlatform}
          </span>
          <div>
            <span className="eyebrow">Funnel priorities</span>
            <ul className="mt-2 flex flex-col divide-y divide-[var(--color-gray-light)]">
              {report.funnelDiagnostics.map((diagnostic) => (
                <li
                  key={diagnostic.stage}
                  className="flex items-center justify-between gap-3 py-2 text-sm"
                >
                  <span className="font-semibold text-[var(--color-text-heading)]">
                    {diagnostic.stage}
                  </span>
                  <span className="text-meta shrink-0">
                    {diagnostic.rank} · {diagnostic.dropRate}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
