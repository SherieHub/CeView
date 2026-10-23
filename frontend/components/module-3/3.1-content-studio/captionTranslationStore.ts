/**
 * Session cache of caption translations, keyed by the native caption text.
 *
 * Keyed by text rather than by post or option so one translation serves every
 * place the same caption appears (card, composer, preview, board), and so an
 * edited caption naturally misses the cache — a stale translation can never be
 * shown against changed text.
 *
 * Failures are not cached, so Retry works; concurrent requests for the same text
 * share one API call.
 */
import { useSyncExternalStore } from 'react';
import { apiClient } from '../../../services/apiClient';
import type { ContentResponse } from '../../../types';

const translations = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();
const listeners = new Set<() => void>();
let version = 0;

function emit() {
  version += 1;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getTranslation(native: string): string | undefined {
  return translations.get(native);
}

export function rememberTranslation(native: string, english: string) {
  if (!native || !english || translations.get(native) === english) return;
  translations.set(native, english);
  emit();
}

/** Seeds the cache from a generate response so the first toggle needs no API call. */
export function seedFromContent(content: ContentResponse) {
  for (const platform of Object.values(content.captions)) {
    platform.options.forEach((native, i) => {
      const en = platform.optionsEn?.[i];
      if (native && en) translations.set(native, en);
    });
  }
  emit();
}

export function requestTranslation(native: string, platform?: string): Promise<string> {
  const known = translations.get(native);
  if (known) return Promise.resolve(known);
  const pending = inflight.get(native);
  if (pending) return pending;

  const request = apiClient.content
    .translate({ caption: native, platform })
    .then((r) => {
      rememberTranslation(native, r.captionEn);
      return r.captionEn;
    })
    .finally(() => {
      inflight.delete(native);
    });
  inflight.set(native, request);
  return request;
}

/** Re-renders the caller whenever any translation is added; for components that read many. */
export function useTranslationVersion(): number {
  return useSyncExternalStore(subscribe, () => version);
}

export function useTranslationEntry(native: string): string | undefined {
  return useSyncExternalStore(subscribe, () => translations.get(native));
}

/** Test seam. */
export function resetCaptionTranslations() {
  translations.clear();
  inflight.clear();
  emit();
}
