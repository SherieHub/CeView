import React from 'react';

interface ReportActionBtnProps {
  onClick?: () => void;
  disabled?: boolean;
  icon?: React.ReactNode;
  label: string;
  variant?: 'primary' | 'danger';
}

const ReportActionBtn: React.FC<ReportActionBtnProps> = ({ onClick, disabled, icon, label, variant = 'primary' }) => {
  const baseStyle = "px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-sm";
  const variants = {
    primary: "bg-[#0F2854] text-white hover:opacity-90 disabled:opacity-70",
    danger: "bg-red-700 hover:bg-red-600 text-white border border-slate-200"
  };

  return (
    <button onClick={onClick} disabled={disabled} className={`${baseStyle} ${variants[variant]} flex-1 md:flex-none`}>
      {icon}
      {label}
    </button>
  );
};

export default ReportActionBtn;