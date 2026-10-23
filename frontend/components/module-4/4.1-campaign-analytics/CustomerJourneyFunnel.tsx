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
import { AlertTriangle, ChevronDown, ChevronRight, TrendingDown } from 'lucide-react';
import type { FunnelSlotProps } from './campaignTypes';

interface FunnelStage {
  label: string;
  value: number;
  /** What this count actually is — impressions are not people, enquiries are not bookings. */
  means: string;
}

function computeDropOff(prevValue: number, currentValue: number): number | null {
  return prevValue > 0 ? ((prevValue - currentValue) / prevValue) * 100 : null;
}

export default function CustomerJourneyFunnel({ input }: FunnelSlotProps) {
  const stages: FunnelStage[] = [
    { label: 'Impressions', value: input.impressions, means: 'Times your ads were shown — not unique people.' },
    { label: 'Clicks', value: input.clicks, means: 'Clicks on your ads.' },
    { label: 'Conversions', value: input.conversions, means: 'Enquiries or leads — not yet bookings.' },
    { label: 'Bookings', value: input.bookings, means: 'Confirmed bookings you entered.' },
  ];

  const transitions = stages.slice(1).map((stage, i) => ({
    from: stages[i],
    to: stage,
    dropOff: computeDropOff(stages[i].value, stage.value),
  }));
  // The steepest real drop is where to look first. A stage larger than the
  // one before it isn't a drop — the counts likely come from different sources.
  const biggest = transitions
    .filter((t) => t.dropOff !== null && t.dropOff > 0)
    .reduce<(typeof transitions)[number] | null>((a, t) => (!a || (t.dropOff ?? 0) > (a.dropOff ?? 0) ? t : a), null);
  const grows = transitions.filter((t) => t.from.value > 0 && t.to.value > t.from.value);

  return (
    <div className="card cj">
      <div className="cj-head">
        <h3 className="cj-title">Customer Journey</h3>
        <p className="cj-sub">How people moved from seeing your ads to booking, this period.</p>
      </div>

      <div className="cj-flow">
        {stages.map((stage, i) => {
          const dropOff = i > 0 ? computeDropOff(stages[i - 1].value, stage.value) : null;
          const isBiggest = biggest !== null && biggest.to === stage;

          return (
            <Fragment key={stage.label}>
              {i > 0 && (
                <div className="cj-link" data-alert={isBiggest || undefined}>
                  <ChevronRight size={22} strokeWidth={2.5} aria-hidden="true" className="cj-arrow cj-arrow--h" />
                  <ChevronDown size={22} strokeWidth={2.5} aria-hidden="true" className="cj-arrow cj-arrow--v" />
                  {dropOff !== null && (
                    <span data-testid={`funnel-dropoff-${stage.label.toLowerCase()}`} className="cj-drop">
                      {dropOff === 0 ? 'No drop-off' : `-${dropOff.toFixed(1)}% drop-off`}
                    </span>
                  )}
                  {dropOff !== null && dropOff >= 0 && (
                    <span className="cj-keep">{(100 - dropOff).toFixed(1)}% continue</span>
                  )}
                </div>
              )}
              <div className="cj-stage">
                <span className="cj-stage-label">{stage.label}</span>
                <span className="num cj-stage-value">{stage.value.toLocaleString()}</span>
                <span className="cj-stage-means">{stage.means}</span>
              </div>
            </Fragment>
          );
        })}
      </div>

      {(biggest || grows.length > 0) && (
        <div className="cj-notes">
          {biggest && biggest.dropOff !== null && (
            <p className="cj-note cj-note--drop">
              <TrendingDown size={16} aria-hidden="true" />
              <span>
                <strong>Biggest drop: {biggest.from.label} → {biggest.to.label}.</strong>{' '}
                {biggest.dropOff.toFixed(1)}% of {biggest.from.label.toLowerCase()} didn&rsquo;t reach the next step.
              </span>
            </p>
          )}
          {grows.map((t) => (
            <p key={t.to.label} className="cj-note cj-note--warn">
              <AlertTriangle size={16} aria-hidden="true" />
              <span>
                <strong>More {t.to.label.toLowerCase()} than {t.from.label.toLowerCase()}.</strong> These two counts
                probably come from different places (for example enquiries that didn&rsquo;t start from an ad), so this
                step isn&rsquo;t a true drop-off.
              </span>
            </p>
          ))}
        </div>
      )}

      <details className="cj-details">
        <summary>How these are counted</summary>
        <p>
          Each percentage compares a stage with the one before it. Conversions here are enquiries; the Conversion
          rate on the Overview counts bookings per 100 clicks instead, so the two can differ.
        </p>
      </details>
    </div>
  );
}
