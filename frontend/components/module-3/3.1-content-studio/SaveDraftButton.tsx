/**
 * The one-click "Save draft": saves the captions, edits, attached image and audit as a named
 * draft, without asking for a name first (the Drafts drawer is for choosing one).
 *
 * It knows whether the work on screen is already a saved draft (`mode`):
 *   new    — not saved yet: "Save draft" creates one.
 *   update — saved earlier and edited since: "Save changes" updates that same draft.
 *   clean  — saved and unchanged: a disabled "Saved ✓", so nothing can be saved twice.
 *
 * It is a filled primary button, the same weight as Continue, because saving is the action the
 * operator most needs to find. Its feedback lives on the button itself ("Saving…", "Saved ✓"):
 * a toast would need a provider that not every screen mounts, and the button is where the eyes
 * already are.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, LoaderCircle, Save } from 'lucide-react';
import { ApiError } from '../../../services/apiError';

type QuickSaveState = 'idle' | 'saving' | 'saved' | 'error' | 'limit';

/** Whether the work on screen is a saved draft, and if so whether it has changed since. */
export type SaveMode = 'new' | 'update' | 'clean';

/** What a save did: made a draft, updated the linked one, or found identical content already saved. */
export interface SaveOutcome {
  kind: 'created' | 'updated' | 'existing';
  name: string;
}

export const SAVED_FEEDBACK_MS = 2500;

/** "Japan · Oct 23, 3:41 PM" — recognisable in the Drafts list without being typed. */
export function quickDraftName(marketName: string, now: Date = new Date()): string {
  const when = new Intl.DateTimeFormat(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  }).format(now);
  return `${marketName} · ${when}`;
}

/** The state of the Save draft button: what the last save did, and whether one is under way. */
export function useQuickSaveDraft(save: () => Promise<SaveOutcome>) {
  const [state, setState] = useState<QuickSaveState>('idle');
  const [outcome, setOutcome] = useState<SaveOutcome | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const mounted = useRef(true);
  const saving = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      window.clearTimeout(timer.current);
    };
  }, []);

  const run = useCallback(async () => {
    // A second click while one is in flight must not start a second save.
    if (saving.current) return;
    saving.current = true;
    window.clearTimeout(timer.current);
    setState('saving');
    try {
      const result = await save();
      if (!mounted.current) return;
      setOutcome(result);
      setState('saved');
      timer.current = window.setTimeout(() => { if (mounted.current) setState('idle'); }, SAVED_FEEDBACK_MS);
    } catch (err) {
      if (!mounted.current) return;
      setState(err instanceof ApiError && err.code === 'MOD31_DRAFT_LIMIT' ? 'limit' : 'error');
    } finally {
      saving.current = false;
    }
  }, [save]);

  return { state, outcome, run };
}

function noteFor(state: QuickSaveState, outcome: SaveOutcome | null): string | null {
  if (state === 'error') return 'Couldn’t save your draft.';
  if (state === 'limit') return 'Draft limit reached — delete one in Drafts.';
  if (state !== 'saved' || !outcome) return null;
  if (outcome.kind === 'updated') return `Updated “${outcome.name}”`;
  if (outcome.kind === 'existing') return `Already saved as “${outcome.name}”`;
  return 'Find it under Drafts';
}

export default function SaveDraftButton({
  state,
  mode = 'new',
  outcome = null,
  linkedName,
  onSave,
  canSave,
  className = '',
}: {
  state: QuickSaveState;
  mode?: SaveMode;
  outcome?: SaveOutcome | null;
  /** The saved draft this work is, for the tooltip when there is nothing new to save. */
  linkedName?: string;
  onSave: () => void;
  /** There is something to save: captions have been generated. */
  canSave: boolean;
  className?: string;
}) {
  const saving = state === 'saving';
  const clean = mode === 'clean' && state !== 'error' && state !== 'limit';
  const note = noteFor(state, outcome);

  const label = saving ? 'Saving…'
    : state === 'saved' || clean ? 'Saved'
    : state === 'error' ? 'Retry save'
    : mode === 'update' ? 'Save changes'
    : 'Save draft';

  return (
    <span className={`sd-wrap ${className}`.trim()}>
      <button
        type="button"
        className="btn-cta sd-btn"
        data-state={clean ? 'saved' : state}
        disabled={!canSave || saving || clean}
        title={clean && linkedName ? `Up to date with “${linkedName}”` : undefined}
        onClick={onSave}
      >
        {saving ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />
          : state === 'saved' || clean ? <Check size={16} aria-hidden="true" />
          : <Save size={16} aria-hidden="true" />}
        {label}
      </button>
      <span className="sd-note" aria-live="polite" data-tone={state === 'saved' ? 'ok' : 'warn'}>
        {note}
      </span>
    </span>
  );
}
