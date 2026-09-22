import React from 'react';
import LinkAttributionPanel from './LinkAttributionPanel';

type AttributionEvidenceSectionProps = {
  codeEvidence?: React.ReactNode;
  liftEvidence?: React.ReactNode;
};

export default function AttributionEvidenceSection({ codeEvidence, liftEvidence }: AttributionEvidenceSectionProps) {
  return (
    // The link table carries four columns, so it gets twice the width of each companion panel.
    <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
      <div className="min-w-0">
        <LinkAttributionPanel />
      </div>
      
      <div className="min-w-0 flex flex-col space-y-4">
        <h3 className="heading-sm">Code-redemption evidence</h3>
        {codeEvidence ? (
          codeEvidence
        ) : (
          <div className="card body-sm">
            <p>Code-redemption evidence is not available in this build. It records operator-reported codes from Messenger, phone and walk-in bookings.</p>
          </div>
        )}
      </div>
      
      <div className="min-w-0 flex flex-col space-y-4">
        <h3 className="heading-sm">Statistical lift</h3>
        {liftEvidence ? (
          liftEvidence
        ) : (
          <div className="card body-sm">
            <p>Statistical lift is not available in this build. It compares campaign results with the pre-campaign baseline.</p>
          </div>
        )}
      </div>
    </div>
  );
}
