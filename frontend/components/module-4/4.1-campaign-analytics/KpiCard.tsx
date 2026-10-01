/**
 * CARD — Performance: KPI Cards & Flagged Metrics
 * Depends on: Foundation — Performance Shell & Ingestion (M4-F)
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/05-module-4.md (M4-1)
 * Prototype reference: pct(value, benchmark) calls — ui-ux-prototype.html:3941-3945
 *
 * The shell (M4-F) mounts 5 of these, one per metric, each with its own
 * {label, value} — this is NOT the KpiSlotProps bundle FlaggedMetricBanner
 * takes.
 *
 * Previously this compared `value` against a fixed per-metric benchmark
 * table (ported from the prototype) to render an "up X% / down X%" trend
 * badge — the same benchmark for every operator regardless of business,
 * market, or currency, so the badge was a hardcoded number dressed up as a
 * real trend. There is no per-business or cohort baseline anywhere in the
 * system to compare against honestly, so the badge is dropped rather than
 * kept pointing at a fabricated reference — see the same "honest zero over
 * fake data" precedent in MetricsCalculationService.defaultMetrics().
 */
interface KpiCardProps {
  /** The acronym, e.g. "CTR". */
  label: string;
  value: number;
  /** Spelled-out name — an MSME owner shouldn't have to know what CAC stands for. */
  name?: string;
  /** One line on what the number means for this business. */
  hint?: string;
  /** Rendered beside the value, never inside it: "₱" before, "%" or "×" after. */
  prefix?: string;
  suffix?: string;
  /** This metric's share of the Performance Score, in percent. */
  weightPct?: number;
  /** The heaviest-weighted metric gets a larger value so the row has a lead. */
  featured?: boolean;
}

export default function KpiCard({ label, value, name, hint, prefix, suffix, weightPct, featured = false }: KpiCardProps) {
  const formattedValue = value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <div className="card flex h-full flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="eyebrow">{label}</span>
        {weightPct != null && <span className="body-xs">{weightPct}% of score</span>}
      </div>
      {name && (
        <span className="body-xs" style={{ fontWeight: 600, color: 'var(--color-text-heading)' }}>
          {name}
        </span>
      )}
      <span className="mt-auto flex items-baseline gap-1">
        {prefix && <span className="heading-sm text-[var(--color-text-muted)]">{prefix}</span>}
        <span className={`num ${featured ? 'heading-xl' : 'heading-lg'}`}>{formattedValue}</span>
        {suffix && <span className="heading-sm text-[var(--color-text-muted)]">{suffix}</span>}
      </span>
      {hint && <span className="body-xs">{hint}</span>}
    </div>
  );
}
