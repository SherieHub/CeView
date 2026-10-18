/**
 * State behind the per-caption "Show English" toggle.
 *
 * `useCaptionTranslation` is for read-only captions. `useEditableCaptionTranslation`
 * adds the edit-in-English flow: the owner edits the English, then explicitly
 * applies it, which rewrites the native caption (never word-for-word) through
 * POST /api/content/localize. Nothing is published from the English view.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '../../../services/apiClient';
import { hasNonEnglishScript, nativeLanguageOf } from './captionLanguage';
import {
  getTranslation,
  rememberTranslation,
  requestTranslation,
  useTranslationEntry,
  useTranslationVersion,
} from './captionTranslationStore';

export type CaptionView = 'native' | 'english';
export type TranslationStatus = 'idle' | 'loading' | 'error';

export interface CaptionTranslationOptions {
  /** English already known for this caption (from generation or the record). */
  knownEnglish?: string | null;
  platform?: string;
  /** Called when an on-demand translation arrives, so the owner can store it. */
  onTranslated?: (english: string) => void;
}

export function useCaptionTranslation(native: string, options: CaptionTranslationOptions = {}) {
  const { knownEnglish, platform, onTranslated } = options;
  const cached = useTranslationEntry(native);
  const english = knownEnglish || cached || '';

  const [showing, setShowing] = useState<CaptionView>('native');
  const [status, setStatus] = useState<TranslationStatus>('idle');
  const nativeRef = useRef(native);
  nativeRef.current = native;

  // A different caption (another option staged, text edited) always starts native.
  useEffect(() => {
    setShowing('native');
    setStatus('idle');
  }, [native]);

  const show = useCallback(async () => {
    if (english) {
      setShowing('english');
      return;
    }
    const startedFor = native;
    setStatus('loading');
    try {
      const en = await requestTranslation(native, platform);
      if (nativeRef.current !== startedFor) return;
      onTranslated?.(en);
      setStatus('idle');
      setShowing('english');
    } catch {
      if (nativeRef.current === startedFor) setStatus('error');
    }
  }, [english, native, platform, onTranslated]);

  const hide = useCallback(() => setShowing('native'), []);

  return {
    visible: hasNonEnglishScript(native),
    showing,
    english,
    status,
    show,
    hide,
    toggle: () => (showing === 'english' ? hide() : void show()),
  };
}

export interface EditableCaptionOptions extends CaptionTranslationOptions {
  /** Receives the rewritten native caption and its fresh English. */
  onApply: (caption: string, captionEn: string) => void;
}

export function useEditableCaptionTranslation(native: string, options: EditableCaptionOptions) {
  const base = useCaptionTranslation(native, options);
  const { onApply, platform } = options;
  const [edited, setEdited] = useState<string | null>(null);
  const [pendingLeave, setPendingLeave] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState(false);

  useEffect(() => {
    setEdited(null);
    setPendingLeave(false);
    setApplyError(false);
  }, [native]);

  const englishDraft = edited ?? base.english;
  const dirty = edited !== null && edited !== base.english;
  const language = nativeLanguageOf(native);

  const discard = useCallback(() => {
    setEdited(null);
    setPendingLeave(false);
    setApplyError(false);
    base.hide();
  }, [base]);

  const apply = useCallback(async () => {
    if (!language || !englishDraft.trim()) return;
    setApplying(true);
    setApplyError(false);
    try {
      const r = await apiClient.content.localize({
        captionEn: englishDraft,
        targetLanguage: language,
        platform,
        originalCaption: native,
      });
      rememberTranslation(r.caption, r.captionEn);
      onApply(r.caption, r.captionEn);
      setEdited(null);
      setPendingLeave(false);
      base.hide();
    } catch {
      setApplyError(true);
    } finally {
      setApplying(false);
    }
  }, [language, englishDraft, platform, native, onApply, base]);

  return {
    ...base,
    toggle: () => {
      if (base.showing !== 'english') return void base.show();
      if (dirty) setPendingLeave(true);
      else base.hide();
    },
    englishDraft,
    setEnglishDraft: (value: string) => setEdited(value),
    dirty,
    language,
    pendingLeave,
    applying,
    applyError,
    apply,
    discard,
    keepEditing: () => setPendingLeave(false),
  };
}

/**
 * The same toggle state for a list of captions (the option cards). One hook call
 * for the whole grid, because hooks cannot run per card inside a map.
 */
export function useCaptionTranslationSet(options: string[], optionsEn: string[] | undefined, platform?: string) {
  useTranslationVersion();
  const [showing, setShowing] = useState<Record<number, boolean>>({});
  const [status, setStatus] = useState<Record<number, TranslationStatus>>({});
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    setShowing({});
    setStatus({});
  }, [options]);

  const englishAt = (i: number) => optionsEn?.[i] || getTranslation(options[i] ?? '') || '';

  const toggleAt = async (i: number) => {
    if (showing[i]) {
      setShowing((s) => ({ ...s, [i]: false }));
      return;
    }
    if (englishAt(i)) {
      setShowing((s) => ({ ...s, [i]: true }));
      return;
    }
    const startedFor = optionsRef.current;
    setStatus((s) => ({ ...s, [i]: 'loading' }));
    try {
      await requestTranslation(options[i], platform);
      if (optionsRef.current !== startedFor) return;
      setStatus((s) => ({ ...s, [i]: 'idle' }));
      setShowing((s) => ({ ...s, [i]: true }));
    } catch {
      if (optionsRef.current === startedFor) setStatus((s) => ({ ...s, [i]: 'error' }));
    }
  };

  /** Text to display for option i: its English when toggled on and known, else the native text. */
  const displayAt = (i: number) => (showing[i] && englishAt(i) ? englishAt(i) : options[i]);

  const stateAt = (i: number) => ({
    visible: hasNonEnglishScript(options[i] ?? ''),
    showing: (showing[i] ? 'english' : 'native') as CaptionView,
    status: status[i] ?? ('idle' as TranslationStatus),
    toggle: () => void toggleAt(i),
  });

  return { stateAt, displayAt };
}
