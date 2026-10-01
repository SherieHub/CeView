/**
 * Reporting-period picker for the ingestion form: a trigger showing the
 * current range, opening a one-month calendar with one-click presets.
 *
 * Range selection is two clicks — the first day clicked anchors the range,
 * the second closes it (in either order) and commits. Days after `maxDate`
 * are disabled: ad platforms have nothing to report for the future, and a
 * record covering it would be meaningless. Weeks start Monday to match the
 * Monday–Sunday reporting cadence.
 *
 * Hand-rolled rather than a date-picker dependency — the form needs one
 * month grid and a few presets, not a library.
 */
import { useEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { PERIOD_PRESETS, addDays, formatPeriod, parseIsoDate, toIsoDate } from './dateRange';
import type { Period } from './dateRange';

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

/** The 6×7 grid of ISO days covering `month` (any date inside it), Monday-first. */
function monthGrid(month: Date): string[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const lead = (first.getDay() + 6) % 7;
  const start = addDays(toIsoDate(first), -lead);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export default function DateRangePicker({
  value,
  onChange,
  maxDate = toIsoDate(new Date()),
  disabled = false,
}: {
  value: Period;
  onChange: (period: Period) => void;
  maxDate?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => parseIsoDate(value.periodEnd));
  const [anchor, setAnchor] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  function openPicker() {
    setViewMonth(parseIsoDate(value.periodEnd));
    setAnchor(null);
    setHovered(null);
    setOpen(true);
  }

  function commit(period: Period) {
    onChange(period);
    setOpen(false);
    setAnchor(null);
  }

  // Close on a click outside the picker.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  function pickDay(iso: string) {
    if (anchor === null) {
      setAnchor(iso);
      return;
    }
    const [periodStart, periodEnd] = anchor <= iso ? [anchor, iso] : [iso, anchor];
    commit({ periodStart, periodEnd });
  }

  // While anchored, the highlighted range follows the pointer; otherwise it's the committed value.
  const preview: Period | null = anchor
    ? {
        periodStart: hovered && hovered < anchor ? hovered : anchor,
        periodEnd: hovered && hovered > anchor ? hovered : anchor,
      }
    : value;

  const month = viewMonth.getMonth();
  const monthLabel = viewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const nextMonthStart = toIsoDate(new Date(viewMonth.getFullYear(), month + 1, 1));
  const todayIso = toIsoDate(new Date());
  const shiftMonth = (delta: number) =>
    setViewMonth(new Date(viewMonth.getFullYear(), month + delta, 1));

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="input flex items-center justify-between gap-3 text-left"
        aria-label={`Reporting period: ${formatPeriod(value)}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openPicker())}
      >
        <span>{formatPeriod(value)}</span>
        <CalendarDays size={16} aria-hidden="true" className="shrink-0 text-[var(--color-text-muted)]" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Choose reporting period"
          className="absolute left-0 z-30 mt-2 flex flex-wrap gap-4 rounded-[var(--radius-md)] border bg-white p-4"
          style={{ borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-overlay)', width: 'min(460px, calc(100vw - 32px))' }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation();
              setOpen(false);
            }
          }}
        >
          <div className="flex min-w-[120px] flex-col gap-1">
            {PERIOD_PRESETS.map((p) => {
              const range = p.range(parseIsoDate(maxDate));
              const active = range.periodStart === value.periodStart && range.periodEnd === value.periodEnd;
              return (
                <button
                  key={p.id}
                  type="button"
                  className="body-xs rounded-[var(--radius-sm)] px-3 py-2 text-left hover:bg-[var(--color-mint-pale)]"
                  style={{
                    color: 'var(--color-navy-primary)',
                    fontWeight: active ? 600 : 400,
                    background: active ? 'var(--color-mint-pale)' : undefined,
                  }}
                  onClick={() => commit(range)}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          <div className="min-w-[252px] flex-1">
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                aria-label="Previous month"
                className="rounded-[var(--radius-sm)] p-1 hover:bg-[var(--color-mint-pale)]"
                onClick={() => shiftMonth(-1)}
              >
                <ChevronLeft size={16} aria-hidden="true" />
              </button>
              <span className="body-sm" style={{ fontWeight: 600, color: 'var(--color-text-heading)' }}>
                {monthLabel}
              </span>
              <button
                type="button"
                aria-label="Next month"
                className="rounded-[var(--radius-sm)] p-1 hover:bg-[var(--color-mint-pale)] disabled:opacity-30"
                disabled={nextMonthStart > maxDate}
                onClick={() => shiftMonth(1)}
              >
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </div>

            <div className="grid grid-cols-7 text-center" onMouseLeave={() => setHovered(null)}>
              {WEEKDAYS.map((w) => (
                <span key={w} className="body-xs py-1 text-[var(--color-text-muted)]">
                  {w}
                </span>
              ))}
              {monthGrid(viewMonth).map((iso) => {
                const d = parseIsoDate(iso);
                const outside = d.getMonth() !== month;
                const future = iso > maxDate;
                const inRange = !!preview && iso >= preview.periodStart && iso <= preview.periodEnd;
                const endpoint = !!preview && (iso === preview.periodStart || iso === preview.periodEnd);
                return (
                  <button
                    key={iso}
                    type="button"
                    aria-label={d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    aria-pressed={endpoint}
                    disabled={future}
                    onClick={() => pickDay(iso)}
                    onMouseEnter={() => setHovered(iso)}
                    className="body-xs h-9 disabled:cursor-not-allowed disabled:opacity-30"
                    style={{
                      background: endpoint
                        ? 'var(--color-mint-primary)'
                        : inRange
                          ? 'var(--color-mint-pale)'
                          : undefined,
                      color: outside && !inRange ? 'var(--color-text-muted)' : 'var(--color-navy-primary)',
                      fontWeight: endpoint ? 600 : 400,
                      borderRadius: endpoint ? 'var(--radius-sm)' : 0,
                      outline: iso === todayIso && !endpoint ? '1px solid var(--color-gray-light)' : undefined,
                      outlineOffset: -2,
                    }}
                  >
                    {d.getDate()}
                  </button>
                );
              })}
            </div>

            <p className="body-xs mt-2 text-[var(--color-text-muted)]">
              {anchor ? 'Now pick the last day.' : 'Pick the first day, then the last.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
