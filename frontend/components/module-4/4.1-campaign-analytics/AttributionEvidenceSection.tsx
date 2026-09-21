import React from 'react';
import LinkAttributionPanel from './LinkAttributionPanel';

type AttributionEvidenceSectionProps = {
  codeEvidence?: React.ReactNode;
  liftEvidence?: React.ReactNode;
};

export default function AttributionEvidenceSection({ codeEvidence, liftEvidence }: AttributionEvidenceSectionProps) {
  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <div className="min-w-0">
        <LinkAttributionPanel />
      </div>
      
      <div className="min-w-0 flex flex-col space-y-4">
        <h3 className="text-lg font-semibold px-2">Code-redemption evidence</h3>
        {codeEvidence ? (
          codeEvidence
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 p-6 flex-1 text-gray-500">
            <p>Code-redemption evidence is not available in this build. It records operator-reported codes from Messenger, phone and walk-in bookings.</p>
          </div>
        )}
      </div>
      
      <div className="min-w-0 flex flex-col space-y-4">
        <h3 className="text-lg font-semibold px-2">Statistical lift</h3>
        {liftEvidence ? (
          liftEvidence
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 p-6 flex-1 text-gray-500">
            <p>Statistical lift is not available in this build. It compares campaign results with the pre-campaign baseline.</p>
          </div>
        )}
      </div>
    </div>
  );
}
