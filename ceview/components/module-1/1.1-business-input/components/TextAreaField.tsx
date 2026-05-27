import React from 'react';
import { COLORS } from '../../../../constants';

interface TextAreaFieldProps {
  label: string;
  guideText?: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  minWords?: number;
}

const countWords = (text: string): number =>
  text.trim() ? text.trim().split(/\s+/).length : 0;

const TextAreaField: React.FC<TextAreaFieldProps> = ({
  label, guideText, value, onChange, placeholder, className, minWords,
}) => {
  const wordCount = countWords(value);
  const hasContent = value.trim().length > 0;
  const isBelowMin = minWords !== undefined && wordCount < minWords;
  const isMet = minWords !== undefined && wordCount >= minWords;

  return (
    <div className={'flex flex-col mb-5'}>
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
        style={{
          borderColor: hasContent && isBelowMin ? '#EF4444' : isMet ? '#10B981' : COLORS.LIGHT_GREY,
          color: COLORS.TEXT_MAIN,
        }}
      />
      {minWords !== undefined && (
        <p
          className="text-[11px] font-bold mt-1 text-right"
          style={{ color: isMet ? '#10B981' : hasContent ? '#EF4444' : COLORS.TEXT_MUTED }}
        >
          {wordCount} / {minWords} words {isMet ? '✓' : `(${minWords - wordCount} more needed)`}
        </p>
      )}
    </div>
  );
};

export default TextAreaField;
