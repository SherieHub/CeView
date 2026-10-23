/**
 * Saved drafts for the market Content Studio is showing (see /api/content/drafts).
 *
 *  - Restore: on entering a market, looks up its auto-saved working draft. `restoring`
 *    is true from the moment a market is picked until that lookup settles, so the caller
 *    can hold off generating captions it may not need to.
 *  - Auto-save: `scheduleSave` debounces writes, skips ones that change nothing, and
 *    flushes what is pending when the market changes or the studio unmounts, so leaving
 *    quickly never drops an edit.
 *  - Named drafts: the list the operator saved on purpose, with save / open / rename / remove.
 *
 * It never throws into the studio: a failed lookup means "no draft", a failed save shows
 * as `status: 'error'` and can be retried.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '../../../services/apiClient';
import type { ContentDraft, ContentDraftSummary } from '../../../types';
import { parsePayload } from './contentDraftPayload';
import type { ContentDraftPayload } from './contentDraftPayload';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export const AUTOSAVE_DELAY_MS = 1500;

interface PendingSave {
  market: string;
  alertId: string;
  payload: ContentDraftPayload;
}

const saveKey = (market: string, payload: ContentDraftPayload) => `${market}:${JSON.stringify(payload)}`;

export function useContentDrafts(marketId: string | null, enabled: boolean) {
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [restored, setRestored] = useState<ContentDraftPayload | null>(null);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [named, setNamed] = useState<ContentDraftSummary[]>([]);
  const [namedError, setNamedError] = useState(false);

  const pending = useRef<PendingSave | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const lastSaved = useRef<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const restoring = enabled && marketId !== null && loadedFor !== marketId;

  const write = useCallback(async (save: PendingSave) => {
    if (mounted.current) setStatus('saving');
    try {
      await apiClient.contentDrafts.saveAuto(save.market, save.alertId, save.payload as unknown as Record<string, unknown>);
      lastSaved.current = saveKey(save.market, save.payload);
      if (mounted.current) { setStatus('saved'); setSavedAt(new Date()); }
    } catch {
      // Keep it so Retry (or the next edit) writes it again.
      if (!pending.current) pending.current = save;
      if (mounted.current) setStatus('error');
    }
  }, []);

  const flush = useCallback(() => {
    window.clearTimeout(timer.current);
    const save = pending.current;
    if (!save) return Promise.resolve();
    pending.current = null;
    return write(save);
  }, [write]);

  const refreshNamed = useCallback(async (market: string) => {
    try {
      const list = await apiClient.contentDrafts.list(market);
      if (mounted.current) { setNamed(list); setNamedError(false); }
    } catch {
      if (mounted.current) setNamedError(true);
    }
  }, []);

  useEffect(() => {
    if (!enabled || !marketId) {
      setRestored(null);
      return;
    }
    let cancelled = false;
    setRestored(null);
    setNamed([]);
    setStatus('idle');
    lastSaved.current = null;

    apiClient.contentDrafts
      .getAuto(marketId)
      .then((draft) => {
        if (cancelled) return;
        const payload = draft ? parsePayload(draft.payload) : null;
        if (payload) lastSaved.current = saveKey(marketId, payload);
        setRestored(payload);
        setSavedAt(draft && payload ? new Date(draft.updatedAt) : null);
      })
      .catch(() => { if (!cancelled) setRestored(null); })
      .finally(() => { if (!cancelled) setLoadedFor(marketId); });
    void refreshNamed(marketId);

    return () => {
      cancelled = true;
      void flush();
    };
  }, [marketId, enabled, flush, refreshNamed]);

  const scheduleSave = useCallback((market: string, alertId: string, payload: ContentDraftPayload) => {
    if (pending.current === null && saveKey(market, payload) === lastSaved.current) return;
    pending.current = { market, alertId, payload };
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { void flush(); }, AUTOSAVE_DELAY_MS);
  }, [flush]);

  /**
   * Saves a new named draft and returns it. When identical content is already saved the server
   * creates nothing and returns that draft with `existing: true`.
   */
  const saveAs = useCallback(async (name: string, alertId: string, payload: ContentDraftPayload): Promise<ContentDraft | null> => {
    if (!marketId) return null;
    const draft = await apiClient.contentDrafts.create(marketId, alertId, name, payload as unknown as Record<string, unknown>);
    await refreshNamed(marketId);
    return draft;
  }, [marketId, refreshNamed]);

  /** Replaces a saved draft's content in place (its name is kept). Rejects with 404 if it is gone. */
  const update = useCallback(async (id: string, payload: ContentDraftPayload): Promise<ContentDraft> => {
    const draft = await apiClient.contentDrafts.update(id, { payload: payload as unknown as Record<string, unknown> });
    if (marketId) await refreshNamed(marketId);
    return draft;
  }, [marketId, refreshNamed]);

  /** The saved payload for a named draft, or null when it is unreadable. */
  const open = useCallback(async (id: string) => {
    const draft = await apiClient.contentDrafts.get(id);
    return parsePayload(draft.payload);
  }, []);

  const rename = useCallback(async (id: string, name: string) => {
    await apiClient.contentDrafts.update(id, { name });
    if (marketId) await refreshNamed(marketId);
  }, [marketId, refreshNamed]);

  const remove = useCallback(async (id: string) => {
    await apiClient.contentDrafts.remove(id);
    if (marketId) await refreshNamed(marketId);
  }, [marketId, refreshNamed]);

  return {
    restoring,
    restored,
    status,
    savedAt,
    scheduleSave,
    /** Retries a failed auto-save now. */
    retry: flush,
    named,
    namedError,
    saveAs,
    update,
    open,
    rename,
    remove,
  };
}
