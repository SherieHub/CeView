import React from 'react';
import { Copy, CheckCircle } from 'lucide-react';
import { COLORS } from '../../../constants';

interface CopyTargetBtnProps {
  isCopied: boolean;
  onClick: () => void;
}

const CopyTargetBtn: React.FC<CopyTargetBtnProps> = ({ isCopied, onClick }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-black transition-all"
    style={{
      border: `1.5px solid ${isCopied ? COLORS.GREEN : COLORS.NAVY}`,
      backgroundColor: isCopied ? COLORS.GREEN_LIGHT : COLORS.NAVY,
      color: isCopied ? COLORS.GREEN : COLORS.WHITE,
    }}
  >
    {isCopied ? <CheckCircle size={14} /> : <Copy size={14} />}
    {isCopied ? 'Copied!' : 'Copy Text'}
  </button>
);

export default CopyTargetBtn;