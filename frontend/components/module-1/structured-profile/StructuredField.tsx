/** One labelled answer in the Business Story / UVP forms, with its minimum-length hint. */
import { useId } from 'react';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import type { ReactNode } from 'react';

interface StructuredFieldProps {
  name: string;
  label: string;
  value: string;
  min: number;
  multiline?: boolean;
  placeholder?: string;
  help?: ReactNode;
  onChange: (value: string) => void;
}

function CharHint({ name, value, min }: { name: string; value: string; min: number }) {
  const count = String(value ?? '').trim().length;
  if (count === 0) {
    return (
      <div className="field-hint" data-testid={`hint-${name}`}>
        <Info size={14} aria-hidden="true" /> <span>At least {min} characters</span>
      </div>
    );
  }
  if (count < min) {
    return (
      <div className="field-hint bad" data-testid={`hint-${name}`}>
        <AlertCircle size={14} aria-hidden="true" /> <span>{count} / {min} characters</span>
      </div>
    );
  }
  return (
    <div className="field-hint good" data-testid={`hint-${name}`}>
      <CheckCircle2 size={14} aria-hidden="true" /> <span>Looks good</span>
    </div>
  );
}

export default function StructuredField({
  name, label, value, min, multiline, placeholder, help, onChange,
}: StructuredFieldProps) {
  const id = useId();
  return (
    <div className="sp-field">
      <label className="field-label" htmlFor={id}>{label}</label>
      {multiline ? (
        <textarea
          id={id}
          name={name}
          className="textarea"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          id={id}
          name={name}
          className="input"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {help && <p className="field-hint">{help}</p>}
      <CharHint name={name} value={value} min={min} />
    </div>
  );
}
