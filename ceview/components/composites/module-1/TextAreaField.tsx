// import React from 'react';
// import { COLORS } from '../../../constants';

// interface TextAreaFieldProps {
//   label: string;
//   value: string;
//   onChange: (val: string) => void;
//   placeholder?: string;
// }

// const TextAreaField: React.FC<TextAreaFieldProps> = ({ label, value, onChange, placeholder }) => (
//   <div className="flex flex-col mb-4">
//     <label className="text-xs font-black uppercase tracking-wider block mb-1.5" style={{ color: COLORS.TEXT_MUTED }}>
//       {label}
//     </label>
//     <textarea
//       value={value}
//       onChange={(e) => onChange(e.target.value)}
//       placeholder={placeholder}
//       className="w-full h-28 p-4 rounded-xl border font-medium text-sm leading-relaxed resize-none focus:outline-none focus:ring-2"
//       style={{ borderColor: COLORS.LIGHT_GREY, color: COLORS.TEXT_MAIN }}
//     />
//   </div>
// );

// export default TextAreaField;

import React from 'react';
import { COLORS } from '../../../constants';

interface TextAreaFieldProps {
  label: string;
  guideText?: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
}

const TextAreaField: React.FC<TextAreaFieldProps> = ({ label, guideText, value, onChange, placeholder, className }) => (
  <div className={'flex flex-col mb-5'} >
    <label className="text-xs font-black uppercase tracking-wider block mb-1" style={{ color: COLORS.TEXT_MUTED }}>
      {label}
    </label>
    {guideText && (
      <p className="text-xs font-medium mb-2" style={{ color: COLORS.TEXT_MUTED }}>{guideText}</p>
    )}
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full p-4 rounded-xl border font-medium text-sm leading-relaxed resize-none focus:outline-none focus:ring-2 ${className || 'h-28'}`}
      style={{ borderColor: COLORS.LIGHT_GREY, color: COLORS.TEXT_MAIN }}
    />
  </div>
);

export default TextAreaField;