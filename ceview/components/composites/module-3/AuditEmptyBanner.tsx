import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { COLORS } from '../../../constants';

const AuditEmptyBanner: React.FC = () => (
  <div className="flex items-start gap-3 p-4 rounded-xl border mb-2" style={{ backgroundColor: COLORS.GOLD_LIGHT, borderColor: `${COLORS.GOLD}40` }}>
    <AlertTriangle size={18} className="shrink-0 mt-0.5" style={{ color: COLORS.GOLD }} />
    <p className="text-sm font-bold" style={{ color: COLORS.TEXT_MAIN }}>
      Upload a media asset in the Dropzone above to allow the AI to check your image and give helpful suggestions.
    </p>
  </div>
);

export default AuditEmptyBanner;