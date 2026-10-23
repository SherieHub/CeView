/**
 * The dashboard's last forecast, kept in localStorage so a page reload or a return visit shows
 * it at once while the store refreshes it in the background (see forecastStore.tsx).
 *
 * Keyed by business profile (`ceview.forecast.<profileId>`), the same per-tenant pattern as the
 * cover photo, and removed on logout. An entry is only used while it is the current version,
 * was saved for the same categories, and is under a day old; anything else reads as "no cache".
 *
 * Every access is wrapped: private windows, blocked storage and a full quota all degrade to
 * "nothing cached" rather than breaking the screen.
 */
import type { DemandAlert, Market } from '../types';

export const FORECAST_CACHE_VERSION = 1;
export const FORECAST_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const KEY_PREFIX = 'ceview.forecast.';

/** Everything the dashboard shows that comes from the forecast pipeline. */
export interface ForecastSnapshot {
  alerts: DemandAlert[];
  keywordAlerts: DemandAlert[];
  /** The ranked markets for each of the operator's categories. */
  marketsByCategory: Record<string, Market[]>;
  aiServiceDown: boolean;
  /** Alerts the operator has opened — the server's view, plus what they opened since. */
  readIds: string[];
  /** When this was last read successfully from the server (ms since epoch). */
  fetchedAt: number;
  /** When the forecast itself was generated, as the backend reports it (ISO-8601). */
  generatedAt: string | null;
}

interface CacheEntry {
  version: number;
  savedAt: number;
  categoriesKey: string;
  snapshot: ForecastSnapshot;
}

/** Order-insensitive identity of a category list. */
export function categoriesKey(categories: string[]): string {
  return [...categories].sort().join('|');
}

export function loadForecastCache(
  profileId: string,
  categories: string[],
  now: number = Date.now(),
): ForecastSnapshot | null {
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + profileId);
    if (!raw) return null;
    const entry = JSON.parse(raw) as Partial<CacheEntry> | null;
    if (!entry || entry.version !== FORECAST_CACHE_VERSION) return null;
    if (entry.categoriesKey !== categoriesKey(categories)) return null;
    if (typeof entry.savedAt !== 'number' || now - entry.savedAt > FORECAST_CACHE_MAX_AGE_MS) return null;
    const s = entry.snapshot;
    if (!s || !Array.isArray(s.alerts) || !Array.isArray(s.keywordAlerts) || !Array.isArray(s.readIds)) return null;
    if (!s.marketsByCategory || typeof s.marketsByCategory !== 'object') return null;
    return s;
  } catch {
    return null;
  }
}

export function saveForecastCache(
  profileId: string,
  categories: string[],
  snapshot: ForecastSnapshot,
  now: number = Date.now(),
): void {
  try {
    const entry: CacheEntry = {
      version: FORECAST_CACHE_VERSION,
      savedAt: now,
      categoriesKey: categoriesKey(categories),
      snapshot,
    };
    window.localStorage.setItem(KEY_PREFIX + profileId, JSON.stringify(entry));
  } catch {
    // Quota exceeded or storage unavailable: the in-memory copy still works.
  }
}

/** Removes every operator's cached forecast from this browser. Called on logout. */
export function clearForecastCache(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(KEY_PREFIX)) keys.push(key);
    }
    keys.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}
