/**
 * Reporting-period date helpers for the ingestion form and its range picker.
 *
 * Every date is an inclusive `YYYY-MM-DD` string in the operator's LOCAL
 * calendar. The form used to derive them with `toISOString()`, which is UTC:
 * before 08:00 in Manila that is still yesterday, so every window slid back a
 * day. Build strings from the local date parts instead.
 */

/** An inclusive reporting window — the shape ManualIngestRequest and the insights query take. */
export interface Period {
  periodStart: string;
  periodEnd: string;
}

export function toIsoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local midnight of an ISO date — `new Date('YYYY-MM-DD')` alone would parse as UTC. */
export function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, days: number): string {
  const d = parseIsoDate(iso);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

/**
 * The most recent complete Monday–Sunday week — the form's default period.
 *
 * Matches the cadence the seeded campaign records use (e.g. 2026-06-08 →
 * 2026-06-14), so ingested rows sort and plot alongside them on the history
 * trend charts. On a Sunday the current week is still open, so step back a
 * further week.
 */
export function lastCompleteWeek(today: Date = new Date()): Period {
  const daysSinceSunday = today.getDay(); // 0=Sun … 6=Sat
  const end = addDays(toIsoDate(today), -daysSinceSunday - (daysSinceSunday === 0 ? 7 : 0));
  return { periodStart: addDays(end, -6), periodEnd: end };
}

/**
 * Monday of the current week through today. A deliberately *partial* week —
 * it powers only the read-only "Live this week" preview and is never submitted.
 */
export function weekToDate(today: Date = new Date()): Period {
  const todayIso = toIsoDate(today);
  // ISO weeks start Monday, so Sunday is 6 days after Monday rather than 0.
  const daysSinceMonday = (today.getDay() + 6) % 7;
  return { periodStart: addDays(todayIso, -daysSinceMonday), periodEnd: todayIso };
}

/** "Sep 14 – Sep 20, 2026", "Dec 29, 2025 – Jan 4, 2026", or "Sep 21, 2026" for one day. */
export function formatPeriod({ periodStart, periodEnd }: Period): string {
  const fmt = (iso: string, withYear: boolean) =>
    parseIsoDate(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      ...(withYear ? { year: 'numeric' } : {}),
    });
  if (periodStart === periodEnd) return fmt(periodEnd, true);
  const sameYear = periodStart.slice(0, 4) === periodEnd.slice(0, 4);
  return `${fmt(periodStart, !sameYear)} – ${fmt(periodEnd, true)}`;
}

/** One-click ranges offered beside the calendar. Each resolves against "today". */
export const PERIOD_PRESETS: { id: string; label: string; range: (today: Date) => Period }[] = [
  { id: 'last-week', label: 'Last week', range: lastCompleteWeek },
  {
    id: 'last-7',
    label: 'Last 7 days',
    range: (today) => ({ periodStart: addDays(toIsoDate(today), -6), periodEnd: toIsoDate(today) }),
  },
  {
    id: 'last-30',
    label: 'Last 30 days',
    range: (today) => ({ periodStart: addDays(toIsoDate(today), -29), periodEnd: toIsoDate(today) }),
  },
  {
    id: 'this-month',
    label: 'This month',
    range: (today) => ({
      periodStart: toIsoDate(new Date(today.getFullYear(), today.getMonth(), 1)),
      periodEnd: toIsoDate(today),
    }),
  },
  {
    id: 'last-month',
    label: 'Last month',
    range: (today) => ({
      periodStart: toIsoDate(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
      // Day 0 of this month is the last day of the previous one.
      periodEnd: toIsoDate(new Date(today.getFullYear(), today.getMonth(), 0)),
    }),
  },
];
