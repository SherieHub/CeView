import { describe, expect, it } from 'vitest';
import {
  PERIOD_PRESETS,
  addDays,
  formatPeriod,
  lastCompleteWeek,
  toIsoDate,
  weekToDate,
} from './dateRange';

// Local-time constructors throughout: the helpers must follow the operator's
// wall clock, not UTC (toISOString() rolled Manila mornings back a day).
const MON_SEP_21 = new Date(2026, 8, 21, 7, 30);
const SUN_SEP_20 = new Date(2026, 8, 20, 12, 0);

describe('dateRange', () => {
  it('formats a Date as its local calendar day, not the UTC one', () => {
    expect(toIsoDate(new Date(2026, 8, 21, 0, 5))).toBe('2026-09-21');
    expect(toIsoDate(new Date(2026, 8, 21, 23, 55))).toBe('2026-09-21');
  });

  it('adds days across month boundaries', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('lastCompleteWeek is the previous Monday–Sunday', () => {
    expect(lastCompleteWeek(MON_SEP_21)).toEqual({ periodStart: '2026-09-14', periodEnd: '2026-09-20' });
  });

  it('lastCompleteWeek on a Sunday skips the still-open week', () => {
    expect(lastCompleteWeek(SUN_SEP_20)).toEqual({ periodStart: '2026-09-07', periodEnd: '2026-09-13' });
  });

  it('weekToDate runs Monday through today', () => {
    expect(weekToDate(MON_SEP_21)).toEqual({ periodStart: '2026-09-21', periodEnd: '2026-09-21' });
    expect(weekToDate(SUN_SEP_20)).toEqual({ periodStart: '2026-09-14', periodEnd: '2026-09-20' });
  });

  it('formats ranges within a year, across years, and single days', () => {
    expect(formatPeriod({ periodStart: '2026-09-14', periodEnd: '2026-09-20' })).toBe('Sep 14 – Sep 20, 2026');
    expect(formatPeriod({ periodStart: '2025-12-29', periodEnd: '2026-01-04' })).toBe('Dec 29, 2025 – Jan 4, 2026');
    expect(formatPeriod({ periodStart: '2026-09-21', periodEnd: '2026-09-21' })).toBe('Sep 21, 2026');
  });

  it('presets resolve relative to today and never run past it', () => {
    const byId = Object.fromEntries(PERIOD_PRESETS.map((p) => [p.id, p.range(MON_SEP_21)]));
    expect(byId['last-week']).toEqual({ periodStart: '2026-09-14', periodEnd: '2026-09-20' });
    expect(byId['last-7']).toEqual({ periodStart: '2026-09-15', periodEnd: '2026-09-21' });
    expect(byId['last-30']).toEqual({ periodStart: '2026-08-23', periodEnd: '2026-09-21' });
    expect(byId['this-month']).toEqual({ periodStart: '2026-09-01', periodEnd: '2026-09-21' });
    expect(byId['last-month']).toEqual({ periodStart: '2026-08-01', periodEnd: '2026-08-31' });
  });
});
