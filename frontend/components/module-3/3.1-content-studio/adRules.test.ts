import { describe, expect, it } from 'vitest';
import {
  adEndTime, adProblems, adTotalMinor, defaultAdStart, formatMinor, marketAudience, normalizeAd, MAX_AD_INTERESTS,
} from './adRules';
import type { AdMinimumBudget, AdSpendLimits, PublishAd } from '../../../types';

const NOW = Date.parse('2026-10-23T00:00:00Z');
const AD: PublishAd = {
  objective: 'OUTCOME_TRAFFIC', dailyBudgetMinor: 10_000, startTime: '2026-10-23T02:00:00Z', durationDays: 14,
  interests: [{ id: '6003020834693', name: 'Scuba diving' }], advantageAudience: false,
  attributionLinkId: 'link-1', pinCampaign: false,
};
const LIMITS: AdSpendLimits = { configured: true, currency: 'PHP', maxDailyMinor: 50_000, maxTotalMinor: 1_000_000, committedMinor: 0 };
const MINIMUM: AdMinimumBudget = { currency: 'PHP', minDailyMinor: 6332 };
const ctx = (over: Partial<Parameters<typeof adProblems>[1]> = {}) =>
  ({ currency: 'PHP', limits: LIMITS, minimum: MINIMUM, market: 'korea', now: NOW, ...over });
const problems = (ad: Partial<PublishAd> = {}, over = {}) => adProblems({ ...AD, ...ad }, ctx(over));

describe('adProblems', () => {
  it('accepts a valid ad', () => {
    expect(problems()).toEqual([]);
  });

  it('needs a connected ad account and saved spending limits before anything else', () => {
    expect(problems({}, { currency: null })[0]).toMatch(/connect a meta ad account/i);
    expect(problems({}, { limits: null })[0]).toMatch(/spending limits/i);
    expect(problems({}, { limits: { ...LIMITS, configured: false } })[0]).toMatch(/spending limits/i);
  });

  it('needs a forecast market', () => {
    expect(problems({}, { market: 'philippines' }).join(' ')).toMatch(/forecast market/i);
    expect(problems({}, { market: undefined }).join(' ')).toMatch(/forecast market/i);
  });

  it('needs a positive whole daily budget above Meta\'s minimum', () => {
    expect(problems({ dailyBudgetMinor: 0 }).join(' ')).toMatch(/daily budget above zero/i);
    expect(problems({ dailyBudgetMinor: 6332 }).join(' ')).toMatch(/more than .*63\.32/);
    expect(problems({ dailyBudgetMinor: 6333 })).toEqual([]);
  });

  it('skips the minimum check when Meta could not say, or answered in another currency', () => {
    expect(problems({ dailyBudgetMinor: 100 }, { minimum: { currency: 'PHP', minDailyMinor: null } })).toEqual([]);
    expect(problems({ dailyBudgetMinor: 100 }, { minimum: null })).toEqual([]);
    expect(problems({ dailyBudgetMinor: 100 }, { minimum: { currency: 'USD', minDailyMinor: 99_999 } })).toEqual([]);
  });

  it('keeps the daily budget within the daily limit', () => {
    expect(problems({ dailyBudgetMinor: 50_001, durationDays: 1 }).join(' ')).toMatch(/daily limit/i);
    expect(problems({ dailyBudgetMinor: 50_000, durationDays: 1 })).toEqual([]);
  });

  it('keeps daily × days within what is left of the total limit, counting active ads', () => {
    expect(problems({ dailyBudgetMinor: 20_000, durationDays: 51 }).join(' ')).toMatch(/total limit/i);
    expect(problems({ dailyBudgetMinor: 20_000, durationDays: 50 })).toEqual([]);
    const committed = { limits: { ...LIMITS, committedMinor: 100_000 } };
    expect(problems({ dailyBudgetMinor: 18_000, durationDays: 51 }, committed).join(' ')).toMatch(/total limit/i);
    expect(problems({ dailyBudgetMinor: 18_000, durationDays: 50 }, committed)).toEqual([]);
  });

  it('needs a start in the future and a whole number of days of at least 1', () => {
    expect(problems({ startTime: '2026-10-22T23:00:00Z' }).join(' ')).toMatch(/start in the future/i);
    expect(problems({ durationDays: 0 }).join(' ')).toMatch(/days/i);
    expect(problems({ durationDays: 2.5 }).join(' ')).toMatch(/days/i);
    expect(problems({ durationDays: Number.NaN }).join(' ')).toMatch(/days/i);
  });

  it('allows at most 10 distinct interests', () => {
    const eleven = Array.from({ length: MAX_AD_INTERESTS + 1 }, (_, i) => ({ id: String(6000 + i), name: `Interest ${i}` }));
    expect(problems({ interests: eleven }).join(' ')).toMatch(/at most 10 interests/i);
    expect(problems({ interests: [{ id: '1', name: 'A' }, { id: '1', name: 'A' }] }).join(' ')).toMatch(/only once/i);
    expect(problems({ interests: [] })).toEqual([]);
  });

  it('needs a campaign tracking link', () => {
    expect(problems({ attributionLinkId: '' }).join(' ')).toMatch(/tracking link/i);
  });
});

describe('ad schedule and money helpers', () => {
  it('ends an ad whole days after it starts', () => {
    expect(adEndTime('2026-11-01T01:00:00.000Z', 14)).toBe('2026-11-15T01:00:00.000Z');
  });

  it('totals daily budget × days, and a bad day count totals nothing', () => {
    expect(adTotalMinor({ ...AD, dailyBudgetMinor: 10_000, durationDays: 14 })).toBe(140_000);
    expect(adTotalMinor({ ...AD, durationDays: Number.NaN })).toBe(0);
  });

  it('starts at the surge window when it is ahead, otherwise an hour from now', () => {
    expect(defaultAdStart('2026-11-05T00:00:00Z', NOW)).toBe('2026-11-05T00:00:00.000Z');
    expect(defaultAdStart('2026-10-01T00:00:00Z', NOW)).toBe(new Date(NOW + 3_600_000).toISOString());
    expect(defaultAdStart(null, NOW)).toBe(new Date(NOW + 3_600_000).toISOString());
    expect(defaultAdStart('garbage', NOW)).toBe(new Date(NOW + 3_600_000).toISOString());
  });

  it('formats minor units with the currency\'s own decimals', () => {
    expect(formatMinor(6332, 'PHP')).toContain('63.32');
    expect(formatMinor(500, 'JPY')).toContain('500');
    expect(formatMinor(500, 'JPY')).not.toContain('.');
  });

  it('knows the audience each forecast market implies', () => {
    expect(marketAudience('korea')).toEqual({ country: 'KR', countryName: 'South Korea', language: 'Korean' });
    expect(marketAudience('Japan')?.language).toBe('Japanese');
    expect(marketAudience('usa')).toEqual({ country: 'US', countryName: 'United States', language: null });
    expect(marketAudience('philippines')).toBeNull();
    expect(marketAudience(undefined)).toBeNull();
  });
});

describe('normalizeAd (drafts saved before targeting existed)', () => {
  it('upgrades the old shape: days from the end date, no interests, no widening', () => {
    const old = {
      objective: 'OUTCOME_AWARENESS', dailyBudgetMinor: 5000, startTime: '2026-11-01T00:00:00.000Z',
      endTime: '2026-11-09T00:00:00.000Z', countries: ['KR'], attributionLinkId: 'l', pinCampaign: true,
    };
    expect(normalizeAd(old)).toEqual({
      objective: 'OUTCOME_AWARENESS', dailyBudgetMinor: 5000, startTime: '2026-11-01T00:00:00.000Z', durationDays: 8,
      interests: [], advantageAudience: false, attributionLinkId: 'l', pinCampaign: true,
    });
  });

  it('keeps the new shape and drops malformed interests', () => {
    const ad = normalizeAd({ ...AD, interests: [{ id: '1', name: 'A' }, { id: 7 }, 'x', { id: '2' }] });
    expect(ad?.interests).toEqual([{ id: '1', name: 'A' }]);
    expect(ad?.durationDays).toBe(14);
  });

  it('returns nothing for a missing or unusable ad', () => {
    expect(normalizeAd(undefined)).toBeUndefined();
    expect(normalizeAd(null)).toBeUndefined();
    expect(normalizeAd('nope')).toBeUndefined();
  });

  it('falls back to Traffic for an unknown objective and 14 days when none can be worked out', () => {
    const ad = normalizeAd({ objective: 'OUTCOME_SALES', dailyBudgetMinor: 1, startTime: 'x', attributionLinkId: '' });
    expect(ad?.objective).toBe('OUTCOME_TRAFFIC');
    expect(ad?.durationDays).toBe(14);
  });
});
