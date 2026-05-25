import React from 'react';
import { COLORS } from '../../../../constants';

interface DataInputFieldProps {
  label: string;
  name: string;
  type: string;
  placeholder: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const DataInputField: React.FC<DataInputFieldProps> = ({ label, name, type, placeholder, onChange }) => (
  <div className="flex flex-col space-y-1">
    <label className="text-sm font-bold uppercase tracking-wide" style={{ color: COLORS.TEXT_MUTED }}>{label}</label>
    <input
      type={type}
      name={name}
      placeholder={placeholder}
      onChange={onChange}
      required
      className="p-3 border rounded-xl focus:ring-2 outline-none transition-all"
      style={{ backgroundColor: COLORS.CREAM, borderColor: '#E2E8F0', outlineColor: COLORS.NAVY_LIGHT }}
    />
  </div>
);

export default DataInputField;
