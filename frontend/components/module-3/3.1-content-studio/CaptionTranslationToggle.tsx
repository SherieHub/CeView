/**
 * "Show English" / "Show original" — the control that swaps a non-English caption
 * for its meaning-faithful English reading aid, in place.
 *
 * Presentational: state lives in useCaptionTranslation. Renders nothing for text
 * with no Hangul, Kana or Han, so English captions never show it.
 */
import { Languages } from 'lucide-react';
import type { MouseEvent } from 'react';
import { LANGUAGE_LABEL } from './captionLanguage';
import type { useCaptionTranslation, useEditableCaptionTranslation } from './useCaptionTranslation';

type ToggleState = Pick<ReturnType<typeof useCaptionTranslation>, 'visible' | 'showing' | 'status' | 'toggle'>;

export function CaptionTranslationToggle({
  state,
  label,
  stopPropagation,
}: {
  state: ToggleState;
  /** Names the caption for assistive tech where several toggles sit together, e.g. "Option 1". */
  label?: string;
  /** For toggles inside surfaces that close on any click (the expanded option view). */
  stopPropagation?: boolean;
}) {
  if (!state.visible) return null;
  const english = state.showing === 'english';
  const loading = state.status === 'loading';
  const text = loading ? 'Translating…' : english ? 'Show original' : 'Show English';
  const onClick = (e: MouseEvent) => {
    if (stopPropagation) e.stopPropagation();
    state.toggle();
  };
  return (
    <>
      <button
        type="button"
        className="link-inline cap-lang-toggle"
        aria-pressed={english}
        aria-label={label ? `${text} for ${label}` : undefined}
        disabled={loading}
        onClick={onClick}
      >
        {loading ? <span className="spinner" aria-hidden="true" /> : <Languages size={14} aria-hidden="true" />}
        {text}
      </button>
      {state.status === 'error' && (
        <span className="cap-lang-error" role="alert">
          Couldn’t translate this caption — try again.
        </span>
      )}
    </>
  );
}

type EditState = ReturnType<typeof useEditableCaptionTranslation>;

/** Shown under an editable caption while its English is on screen. */
export function EnglishEditBar({ state }: { state: EditState }) {
  if (state.showing !== 'english') return null;
  const target = state.language ? LANGUAGE_LABEL[state.language] : null;
  return (
    <div>
      <div className="cap-lang-bar">
        <span className="chip chip--muted">English translation — not published</span>
        {target && (
          <button
            type="button"
            className="btn-cta btn-cta--sm"
            disabled={!state.dirty || state.applying}
            onClick={() => void state.apply()}
          >
            {state.applying ? 'Applying…' : `Apply to ${target}`}
          </button>
        )}
      </div>
      {state.applyError && (
        <p className="cap-lang-error" role="alert">
          Couldn’t apply your English edits — try again.
        </p>
      )}
      {state.pendingLeave && target && (
        <div className="cap-lang-prompt" role="status">
          <span>You edited the English. Apply it to {target}, or discard the edits?</span>
          <button type="button" className="btn-cta btn-cta--sm" onClick={() => void state.apply()} disabled={state.applying}>
            Apply to {target}
          </button>
          <button type="button" className="btn-outline btn-outline--sm" onClick={state.discard}>
            Discard edits
          </button>
          <button type="button" className="link-inline" onClick={state.keepEditing}>
            Keep editing
          </button>
        </div>
      )}
    </div>
  );
}
