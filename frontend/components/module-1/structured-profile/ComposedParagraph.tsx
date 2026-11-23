/**
 * The composed Business Story / UVP paragraph — the text that is actually saved
 * and sent to the AI services.
 *
 * Controlled: the parent owns the text and the `edited` flag. While not edited
 * the parent keeps `value` equal to the template output; once the operator
 * types here the parent marks it edited and stops overwriting it, and
 * "Regenerate from fields" hands control back to the template.
 */
import { useId, useState } from 'react';
import { Check, Copy, RefreshCw } from 'lucide-react';
import './structured-profile.css';

interface ComposedParagraphProps {
  title: string;
  value: string;
  edited: boolean;
  /** Every field feeding the template meets its minimum. */
  complete: boolean;
  placeholder: string;
  onChange: (text: string) => void;
  onRegenerate: () => void;
}

export default function ComposedParagraph({
  title, value, edited, complete, placeholder, onChange, onRegenerate,
}: ComposedParagraphProps) {
  const id = useId();
  const [copied, setCopied] = useState(false);
  // Hand-written text (including a legacy profile's prose) stays editable even
  // while the fields are incomplete; only an untouched, incomplete paragraph
  // is locked behind the placeholder.
  const locked = !complete && !edited;

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be unavailable (permissions, insecure context); the
      // text is still selectable in the box.
    }
  }

  return (
    <div className="sp-output">
      <div className="sp-output-head">
        <label className="sp-output-title" htmlFor={id}>{title}</label>
        {edited && <span className="sp-output-edited">Edited manually</span>}
        <div className="sp-output-actions">
          {edited && complete && (
            <button type="button" className="btn-outline btn-outline--sm" onClick={onRegenerate}>
              <RefreshCw size={14} aria-hidden="true" /> Regenerate from fields
            </button>
          )}
          <button
            type="button"
            className="btn-outline btn-outline--sm"
            onClick={() => void copy()}
            disabled={!value.trim()}
          >
            {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
      <textarea
        id={id}
        className="textarea sp-output-text"
        value={locked ? '' : value}
        placeholder={placeholder}
        disabled={locked}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
