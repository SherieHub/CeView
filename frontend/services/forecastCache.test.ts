import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FORECAST_CACHE_MAX_AGE_MS,
  FORECAST_CACHE_VERSION,
  categoriesKey,
  clearForecastCache,
  loadForecastCache,
  saveForecastCache,
} from './forecastCache';
import type { ForecastSnapshot } from './forecastCache';

const SNAPSHOT: ForecastSnapshot = {
  alerts: [],
  keywordAlerts: [],
  marketsByCategory: { 'Coastal & Island': [] },
  aiServiceDown: false,
  readIds: ['n1'],
  fetchedAt: 1_000,
  generatedAt: '2026-10-22T06:30:00Z',
};
const CATEGORIES = ['Coastal & Island', 'Culinary & Gastronomy'];

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('forecastCache', () => {
  it('round-trips a snapshot for the same profile and categories', () => {
    saveForecastCache('bp-1', CATEGORIES, SNAPSHOT, 5_000);
    expect(loadForecastCache('bp-1', CATEGORIES, 6_000)).toEqual(SNAPSHOT);
  });

  it('keeps each profile in its own entry', () => {
    saveForecastCache('bp-1', CATEGORIES, SNAPSHOT, 5_000);
    expect(loadForecastCache('bp-2', CATEGORIES, 6_000)).toBeNull();
    expect(localStorage.getItem('ceview.forecast.bp-1')).not.toBeNull();
    expect(localStorage.getItem('ceview.forecast.bp-2')).toBeNull();
  });

  it('matches categories regardless of their order, and rejects a different set', () => {
    saveForecastCache('bp-1', CATEGORIES, SNAPSHOT, 5_000);
    expect(loadForecastCache('bp-1', [...CATEGORIES].reverse(), 6_000)).toEqual(SNAPSHOT);
    expect(loadForecastCache('bp-1', ['Coastal & Island'], 6_000)).toBeNull();
    expect(categoriesKey(['b', 'a'])).toBe(categoriesKey(['a', 'b']));
  });

  it('expires after a day', () => {
    saveForecastCache('bp-1', CATEGORIES, SNAPSHOT, 0);
    expect(loadForecastCache('bp-1', CATEGORIES, FORECAST_CACHE_MAX_AGE_MS - 1)).toEqual(SNAPSHOT);
    expect(loadForecastCache('bp-1', CATEGORIES, FORECAST_CACHE_MAX_AGE_MS + 1)).toBeNull();
  });

  it('ignores an entry written by another version', () => {
    localStorage.setItem(
      'ceview.forecast.bp-1',
      JSON.stringify({
        version: FORECAST_CACHE_VERSION + 1,
        savedAt: 5_000,
        categoriesKey: categoriesKey(CATEGORIES),
        snapshot: SNAPSHOT,
      }),
    );
    expect(loadForecastCache('bp-1', CATEGORIES, 6_000)).toBeNull();
  });

  it('treats corrupt or malformed entries as no cache', () => {
    localStorage.setItem('ceview.forecast.bp-1', '{not json');
    expect(loadForecastCache('bp-1', CATEGORIES)).toBeNull();

    localStorage.setItem(
      'ceview.forecast.bp-1',
      JSON.stringify({
        version: FORECAST_CACHE_VERSION,
        savedAt: Date.now(),
        categoriesKey: categoriesKey(CATEGORIES),
        snapshot: { alerts: 'nope' },
      }),
    );
    expect(loadForecastCache('bp-1', CATEGORIES)).toBeNull();
  });

  it('degrades quietly when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(loadForecastCache('bp-1', CATEGORIES)).toBeNull();
    expect(() => saveForecastCache('bp-1', CATEGORIES, SNAPSHOT)).not.toThrow();
  });

  it('clears every operator’s forecast and nothing else', () => {
    saveForecastCache('bp-1', CATEGORIES, SNAPSHOT);
    saveForecastCache('bp-2', CATEGORIES, SNAPSHOT);
    localStorage.setItem('ceview.auth', 'keep me');

    clearForecastCache();

    expect(localStorage.getItem('ceview.forecast.bp-1')).toBeNull();
    expect(localStorage.getItem('ceview.forecast.bp-2')).toBeNull();
    expect(localStorage.getItem('ceview.auth')).toBe('keep me');
  });
});
