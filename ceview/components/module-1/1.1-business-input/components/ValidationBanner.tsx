import React from 'react';
import { Info } from 'lucide-react';
import { COLORS } from '../../../../constants';

interface ValidationBannerProps {
  isValid: boolean;
  errors?: string[];
}

const ValidationBanner: React.FC<ValidationBannerProps> = ({ isValid, errors }) => {
  if (isValid) return null;

  const messages = errors && errors.length > 0
    ? errors
    : ['All four fields must be filled to compute a uniqueness score.'];

  return (
    <div className="p-3 rounded-lg mb-4" style={{ backgroundColor: COLORS.GOLD_LIGHT, color: COLORS.TEXT_MAIN }}>
      {messages.map((msg, i) => (
        <div key={i} className="flex items-start gap-2">
          <Info size={16} className="shrink-0 mt-0.5" style={{ color: COLORS.GOLD }} />
          <span className="text-xs font-bold">{msg}</span>
        </div>
      ))}
    </div>
  );
};

export default ValidationBanner;
