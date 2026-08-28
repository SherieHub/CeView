/**
 * CARD — Performance: Customer Journey Funnel
 * Depends on: Foundation — Performance Shell & Ingestion (M4-F)
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/05-module-4.md (M4-3)
 * Pseudocode: pseudocode/module-4/customer-journey-funnel.ts
 *
 * The 4-stage funnel (Impressions -> Clicks -> Conversions -> Bookings) with
 * per-transition drop-off %. dropOff = prev > 0 ? (prev - curr) / prev * 100
 * : null — rendered only when non-null (a zero previous stage renders no
 * drop-off badge at all, not "0%"/"NaN%"/an empty badge). Visual treatment
 * follows the tourism-app-branding skill: .card wrapper, mint proportional
 * bars (stage value relative to the first/largest stage), navy/muted text
 * tokens — this is a data-density panel, not a conversion action, so no
 * button variants apply here.
 */
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
  const maxValue = stages[0].value;

  return (
    <div className="card flex flex-col gap-4">
      <h3 className="heading-md">Customer Journey Funnel</h3>
      <div className="flex flex-col gap-4">
        {stages.map((stage, i) => {
          const dropOff = i > 0 ? computeDropOff(stages[i - 1].value, stage.value) : null;
          const widthPct = maxValue > 0 ? Math.min(100, (stage.value / maxValue) * 100) : 0;

          return (
            <div key={stage.label} className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="body-sm font-semibold text-[var(--color-text-heading)]">{stage.label}</span>
                <div className="flex items-center gap-2">
                  <span className="num body-sm font-semibold text-[var(--color-text-heading)]">
                    {stage.value.toLocaleString()}
                  </span>
                  {dropOff !== null && (
                    <span
                      data-testid={`funnel-dropoff-${stage.label.toLowerCase()}`}
                      className="text-meta rounded-pill bg-[var(--color-mint-pale)] px-2 py-0.5 font-semibold text-[var(--color-navy-primary)]"
                    >
                      -{dropOff.toFixed(1)}% drop-off
                    </span>
                  )}
                </div>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-pill bg-[var(--color-mint-pale)]">
                <div
                  className="h-full rounded-pill bg-[var(--color-mint-primary)]"
                  style={{ width: `${widthPct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
