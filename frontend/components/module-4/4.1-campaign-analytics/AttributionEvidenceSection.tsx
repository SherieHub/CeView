import React from 'react';
import LinkAttributionPanel from './LinkAttributionPanel';
import CodeRedemptionPanel from './CodeRedemptionPanel';
import StatisticalLiftPanel from './StatisticalLiftPanel';

type AttributionEvidenceSectionProps = {
  codeEvidence?: React.ReactNode;
  liftEvidence?: React.ReactNode;
};

/**
 * The Performance screen's evidence block: three independent kinds of proof
 * that bookings came from a campaign, shown side by side rather than summed.
 *
 * Link and code evidence share one row as equal halves; lift spans the full
 * width beneath them, since its two before/during comparisons read best side
 * by side.
 */
export default function AttributionEvidenceSection({ codeEvidence, liftEvidence }: AttributionEvidenceSectionProps) {
  return (
    <section className="perf-section flex flex-col gap-5" aria-labelledby="attribution-evidence-heading">
      <header className="flex flex-col gap-1">
        <p className="eyebrow">Attribution</p>
        <h2 id="attribution-evidence-heading" className="heading-md">Campaign evidence</h2>
        <p className="body-sm max-w-[68ch] text-[var(--color-text-muted)]">
          Proof that bookings came from your campaigns. Each panel is a different kind of evidence,
          so they are shown side by side rather than added together.
        </p>
      </header>

      {/* Stretched rows so the two panels' bottoms line up instead of leaving a ragged gap. */}
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="min-w-0">
          <LinkAttributionPanel />
        </div>
        <div className="min-w-0">
          {codeEvidence ? (
            <div className="card flex flex-col gap-4">
              <h3 className="heading-sm">Code-redemption evidence</h3>
              {codeEvidence}
            </div>
          ) : (
            <CodeRedemptionPanel />
          )}
        </div>
      </div>

      {liftEvidence ?? <StatisticalLiftPanel />}
    </section>
  );
}
