/**
 * CARD — Performance: Customer Journey Funnel
 * Depends on: Foundation — Performance Shell & Ingestion (M4-F)
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/05-module-4.md (M4-3)
 * Pseudocode: pseudocode/module-4/customer-journey-funnel.ts
 *
 * The 4-stage funnel (Impressions -> Clicks -> Conversions -> Bookings) drawn
 * as a left-to-right flow: one panel per stage, chevron connectors between
 * them, and the per-transition drop-off carried on each connector.
 *
 * dropOff = prev > 0 ? (prev - curr) / prev * 100 : null — rendered only when
 * non-null (a zero previous stage renders no drop-off badge at all, not
 * "0%"/"NaN%"/an empty badge). Visual treatment follows the
 * tourism-app-branding skill: .card wrapper, mint accents, navy/muted text
 * tokens — a data-density panel, not a conversion action, so no button
 * variants apply.
 */
import { Fragment } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { FunnelSlotProps } from './campaignTypes';

interface FunnelStage {
  label: string;
  value: number;
}

function computeDropOff(prevValue: number, currentValue: number): number | null {
  return prevValue > 0 ? ((prevValue - currentValue) / prevValue) * 100 : null;
}

export default function CustomerJourneyFunnel({ input }: FunnelSlotProps) {
  const stages: FunnelStage[] = [
    { label: 'Impressions', value: input.impressions },
    { label: 'Clicks', value: input.clicks },
    { label: 'Conversions', value: input.conversions },
    { label: 'Bookings', value: input.bookings },
  ];

  return (
    <div className="card flex flex-col gap-4">
      <div>
        <h3 className="heading-md">Customer Journey Funnel</h3>
        <p className="body-sm">How the audience narrows from first impression to booking.</p>
      </div>

      <div className="flex flex-col items-stretch gap-2 md:flex-row md:items-stretch">
        {stages.map((stage, i) => {
          const dropOff = i > 0 ? computeDropOff(stages[i - 1].value, stage.value) : null;

          return (
            <Fragment key={stage.label}>
              {i > 0 && (
                <div className="flex shrink-0 items-center justify-center gap-2 py-1 md:flex-col md:px-2 md:py-0">
                  <ChevronRight
                    size={24}
                    strokeWidth={2.5}
                    aria-hidden="true"
                    className="hidden shrink-0 text-[var(--color-teal-accent)] md:block"
                  />
                  <ChevronDown
                    size={24}
                    strokeWidth={2.5}
                    aria-hidden="true"
                    className="shrink-0 text-[var(--color-teal-accent)] md:hidden"
                  />
                  {dropOff !== null && (
                    <span
                      data-testid={`funnel-dropoff-${stage.label.toLowerCase()}`}
                      className="text-meta whitespace-nowrap rounded-pill bg-[var(--color-mint-pale)] px-2 py-0.5 font-semibold text-[var(--color-navy-primary)]"
                    >
                      -{dropOff.toFixed(1)}% drop-off
                    </span>
                  )}
                </div>
              )}
              <div className="flex flex-1 flex-col gap-1 rounded-[var(--radius-md)] border border-[var(--color-gray-light)] bg-[var(--color-off-white)] p-4">
                <span className="eyebrow">{stage.label}</span>
                <span className="num heading-lg text-[var(--color-text-heading)]">
                  {stage.value.toLocaleString()}
                </span>
              </div>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
