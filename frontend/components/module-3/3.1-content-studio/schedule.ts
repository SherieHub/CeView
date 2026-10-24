/**
 * Scheduling helpers for Quick Post. Values are LOCAL date-times in the
 * `yyyy-mm-ddThh:mm` shape the date and time inputs speak, so what the owner
 * picks is exactly what is stored and shown back.
 */

const pad = (n: number) => String(n).padStart(2, '0');

export function toLocalValue(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** A sensible first suggestion: tomorrow at 9:00. */
export function defaultSchedule(now = new Date()): string {
  const d = new Date(now);
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return toLocalValue(d);
}

export function parseLocal(value: string): Date | null {
  // API timestamps include an explicit offset; datetime-local drafts do not.
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    const instant = new Date(value);
    return Number.isNaN(instant.getTime()) ? null : instant;
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function isFuture(value: string, now = new Date()): boolean {
  const d = parseLocal(value);
  return d != null && d.getTime() > now.getTime();
}

/** "Mon, Oct 20 · 9:00 AM" */
export function formatSchedule(value: string): string {
  const d = parseLocal(value);
  if (!d) return value;
  const day = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${day} · ${time}`;
}

/** The browser's time zone, for the label under the picker. */
export function timeZoneName(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'your local time';
  } catch {
    return 'your local time';
  }
}
