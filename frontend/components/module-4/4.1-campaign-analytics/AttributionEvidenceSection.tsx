import React from 'react';
import { BarChart3, Ticket } from 'lucide-react';
import LinkAttributionPanel from './LinkAttributionPanel';
import CodeRedemptionPanel from './CodeRedemptionPanel';
import StatisticalLiftPanel from './StatisticalLiftPanel';

type AttributionEvidenceSectionProps = {
  codeEvidence?: React.ReactNode;
  liftEvidence?: React.ReactNode;
  /** 'tab' is the results screen's Attribution tab: the table full width, the
   * two unbuilt analyses as a compact note rather than cards of their own. */
  layout?: 'entry' | 'tab';
  /** The scored period, so the link panel can say when its window differs. */
  period?: { periodStart: string; periodEnd: string };
};

/** Decorative only: a receipt and a rising bar chart, for the two not-yet-built panels. */
function CodeArt() {
  return (
    <span className="perf-ev-art perf-ev-art--code" aria-hidden="true">
      <i /><i /><i /><i />
    </span>
  );
}
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
          <section className="perf-attr-item" aria-labelledby="perf-attr-code">
            <Ticket size={16} aria-hidden="true" />
            <div>
              <h3 id="perf-attr-code" className="perf-attr-item-title">Code-redemption evidence</h3>
              {codeEvidence ?? (
                <p>Not available in this build. It will record codes customers mention on Messenger, by phone or at walk-in.</p>
              )}
            </div>
          </section>
          <section className="perf-attr-item" aria-labelledby="perf-attr-lift">
            <BarChart3 size={16} aria-hidden="true" />
            <div>
              <h3 id="perf-attr-lift" className="perf-attr-item-title">Statistical lift</h3>
              {liftEvidence ?? (
                <p>Statistical lift analysis is not available in this build. It will compare results with the period before the campaign.</p>
              )}
            </div>
          </section>
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

      <section className="card perf-ev" aria-labelledby="perf-ev-code-title">
        <div className="perf-ev-head">
          <span className="perf-ev-icon" aria-hidden="true"><Ticket size={18} /></span>
          <h3 id="perf-ev-code-title" className="perf-ev-title">Code-redemption evidence</h3>
        </div>
        {codeEvidence ?? (
          <>
            <p className="perf-ev-text">Code-redemption evidence is not available in this build. It records operator-reported codes from Messenger, phone and walk-in bookings.</p>
            <CodeArt />
          </>
        )}
      </section>

      <section className="card perf-ev" aria-labelledby="perf-ev-lift-title">
        <div className="perf-ev-head">
          <span className="perf-ev-icon" aria-hidden="true"><BarChart3 size={18} /></span>
          <h3 id="perf-ev-lift-title" className="perf-ev-title">Statistical lift</h3>
        </div>
        {liftEvidence ?? (
          <>
            <p className="perf-ev-text">Statistical lift is not available in this build. It compares campaign results with the pre-campaign baseline.</p>
            <LiftArt />
          </>
        )}
      </section>
    </div>
  );
}
