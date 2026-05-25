import React from 'react';
import { Loader2 } from 'lucide-react';
import { COLORS } from '../../../../constants';

interface PrimaryButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  children, isLoading, icon, fullWidth, disabled, ...props
}) => {
  return (
    <button
      disabled={disabled || isLoading}
      className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-sm
        ${fullWidth ? 'w-full' : ''}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'}`}
      style={{ backgroundColor: COLORS.NAVY, color: COLORS.WHITE }}
      {...props}
    >
      {isLoading ? <Loader2 size={16} className="animate-spin" /> : icon}
      {children}
    </button>
  );
};

export default PrimaryButton;
