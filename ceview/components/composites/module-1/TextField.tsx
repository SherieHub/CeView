import React from 'react';
import { COLORS } from '../../../constants';

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}

const TextField: React.FC<TextFieldProps> = ({ label, value, onChange, placeholder }) => (
  <div className="flex flex-col mb-4">
    <label className="text-xs font-bold uppercase tracking-wider block mb-1.5" style={{ color: COLORS.TEXT_MUTED }}>
      {label}
    </label>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full p-3 rounded-xl border text-sm font-semibold focus:outline-none focus:ring-2"
      style={{ borderColor: COLORS.LIGHT_GREY, color: COLORS.TEXT_MAIN }}
    />
  </div>
);

export default TextField;