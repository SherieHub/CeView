import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { COLORS } from '../../constants';

interface ServerErrorBannerProps {
  message: string;
  onDismiss: () => void;
}

const ServerErrorBanner: React.FC<ServerErrorBannerProps> = ({ message, onDismiss }) => (
  <div
    className="flex items-start gap-3 p-4 rounded-xl border-l-4 mb-6"
    style={{ backgroundColor: '#FEF2F2', borderLeftColor: COLORS.RED_ORANGE }}
  >
    <AlertTriangle size={18} className="shrink-0 mt-0.5" style={{ color: COLORS.RED_ORANGE }} />
    <p className="flex-1 text-sm font-medium" style={{ color: COLORS.RED }}>{message}</p>
    <button
      onClick={onDismiss}
      className="shrink-0 transition-opacity hover:opacity-60"
      style={{ color: COLORS.RED_ORANGE }}
      aria-label="Dismiss"
    >
      <X size={16} />
    </button>
  </div>
);

export default ServerErrorBanner;
