/**
 * Small display helpers shared by the Market Radar drawer panels.
 */

/** "8000, 15000" -> "₱8,000 – ₱15,000". The backend now sends the range as two
 *  integers (H-16) instead of a pre-formatted string. */
export function formatPhpRange(min: number, max: number): string {
  const peso = (n: number) => `₱${Math.round(n).toLocaleString('en-PH')}`;
  return `${peso(min)} – ${peso(max)}`;
}

/** Human label for how the peak-month list was derived (H-19). */
export function peakMonthsSourceLabel(source: 'seasonal_history' | 'reference'): string {
  return source === 'seasonal_history'
    ? 'Derived from this market’s own demand history'
    : 'Route reference data — not enough demand history yet to derive';
}
