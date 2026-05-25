import React from 'react';
import { Hash } from 'lucide-react';
import CopyTargetBtn from './CopyTargetBtn';
import { COLORS } from '../../../../constants';

interface CopywritingOptionCardProps {
  index: number;
  text: string;
  isCopied: boolean;
  onCopy: () => void;
}

const CopywritingOptionCard: React.FC<CopywritingOptionCardProps> = ({ index, text, isCopied, onCopy }) => {
  const hashCount = (text.match(/#\S+/g) || []).length;

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-black uppercase tracking-wider" style={{ color: COLORS.NAVY }}>Option {index + 1}</span>
      </div>
      <div className="p-4 rounded-xl border mb-3 flex-1" style={{ backgroundColor: COLORS.CREAM, borderColor: COLORS.LIGHT_GREY }}>
        <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap" style={{ color: COLORS.TEXT_MAIN }}>
          {text}
        </p>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Hash size={14} style={{ color: COLORS.TEXT_MUTED }} />
          <span className="text-xs font-bold" style={{ color: COLORS.TEXT_MUTED }}>{hashCount} hashtags</span>
        </div>
        <CopyTargetBtn isCopied={isCopied} onClick={onCopy} />
      </div>
    </div>
  );
};

export default CopywritingOptionCard;
