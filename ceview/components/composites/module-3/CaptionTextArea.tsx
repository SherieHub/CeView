import React from 'react';
import { COLORS } from '../../../constants';

interface CaptionTextAreaProps {
  value: string;
  onChange: (value: string) => void;
}

const CaptionTextArea: React.FC<CaptionTextAreaProps> = ({ value, onChange }) => (
  <div className="space-y-1.5 animate-fade-in">
    <label className="text-xs font-black uppercase tracking-wider block" style={{ color: COLORS.TEXT_MUTED }}>Staging Campaign Caption</label>
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Select an option above by clicking 'Copy Text' to auto-populate this box, or compose custom copy here..."
      className="w-full p-4 rounded-xl border font-medium text-sm leading-relaxed min-h-[96px] focus:outline-none focus:ring-2 focus:ring-slate-400 transition-all"
      style={{ backgroundColor: COLORS.CREAM, borderColor: COLORS.LIGHT_GREY, color: COLORS.TEXT_MAIN }}
    />
  </div>
);

export default CaptionTextArea;