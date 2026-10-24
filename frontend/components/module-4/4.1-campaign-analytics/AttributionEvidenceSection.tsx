import React from 'react';
import LinkAttributionPanel from './LinkAttributionPanel';
import CodeRedemptionPanel from './CodeRedemptionPanel';
import StatisticalLiftPanel from './StatisticalLiftPanel';
import CvLaunchVoucherCard from './CvLaunchVoucherCard';

type AttributionEvidenceSectionProps = {
  codeEvidence?: React.ReactNode;
  liftEvidence?: React.ReactNode;
  /** 'tab' is the results screen's Attribution tab: the link panel full width,
   * the code and lift panels side by side below it. */
  layout?: 'entry' | 'tab';
  /** The scored period, so the link panel can say when its window differs. */
  period?: { periodStart: string; periodEnd: string };
};

/** Decorative only: a rising bar chart for the not-yet-built lift panel. */
function LiftArt() {
  return (
    <span className="perf-ev-art perf-ev-art--lift" aria-hidden="true">
      <i /><i /><i /><i /><i />
    </span>
  );
}

export default function AttributionEvidenceSection({ codeEvidence, liftEvidence, layout = 'entry', period }: AttributionEvidenceSectionProps) {
  if (layout === 'tab') {
    return (
      <div className="perf-attr">
        <div className="perf-attr-head">
          <h2 className="perf-tab-title">Attribution &amp; Evidence</h2>
          <p className="perf-tab-sub">See which tracked content brought clicks, enquiries and recorded revenue.</p>
        </div>
        <LinkAttributionPanel period={period} />
        <div className="perf-attr-more">
          <EvidenceColumns codeEvidence={codeEvidence} liftEvidence={liftEvidence} />
        </div>
      </div>
    );
  }

  return (
    // The link table carries four columns, so it gets twice the width of each companion panel.
    <div className="perf-ev-row">
      <div className="min-w-0">
        <LinkAttributionPanel />
      </div>
      <EvidenceColumns codeEvidence={codeEvidence} liftEvidence={liftEvidence} />
    </div>
  );
}

/** Each panel is its own titled card, so these sections only name the region. */
function EvidenceColumns({ codeEvidence, liftEvidence }: Pick<AttributionEvidenceSectionProps, 'codeEvidence' | 'liftEvidence'>) {
  return (
    <>
      <section className="perf-attr-col" aria-label="Code-redemption evidence">
        {codeEvidence ?? <><CodeRedemptionPanel /><CvLaunchVoucherCard /></>}
      </section>
      <section className="perf-attr-col" aria-label="Statistical lift">
        {liftEvidence ?? <StatisticalLiftPanel />}
      </section>
    </>
  );
}
