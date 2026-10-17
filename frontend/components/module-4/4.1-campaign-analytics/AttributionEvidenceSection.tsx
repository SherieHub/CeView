import React from 'react';
import { BarChart3, Ticket } from 'lucide-react';
import LinkAttributionPanel from './LinkAttributionPanel';

type AttributionEvidenceSectionProps = {
  codeEvidence?: React.ReactNode;
  liftEvidence?: React.ReactNode;
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

export default function AttributionEvidenceSection({ codeEvidence, liftEvidence }: AttributionEvidenceSectionProps) {
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
