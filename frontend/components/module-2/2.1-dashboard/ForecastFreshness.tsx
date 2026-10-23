/**
 * Beside the Refresh button: how old the forecast on screen is, or that it is being refreshed
 * behind the data already shown. With the forecast cached, "loading" is no longer a state the
 * operator sees on a return visit — this is how they can still tell it is being kept current.
 */
import { useEffect, useState } from 'react';

/** "just now", "3 min ago", "2 h ago", or a date for anything older than a day. */
export function relativeAge(from: number, now: number): string {
  const minutes = Math.floor((now - from) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(from).toLocaleDateString();
}

export default function ForecastFreshness({
  syncing,
  isRefreshing,
  refreshError,
  generatedAt,
  fetchedAt,
}: {
  /** A background sync is running with data already on screen. */
  syncing: boolean;
  /** The Refresh button's own run: the button says so, so this stays quiet. */
  isRefreshing: boolean;
  /** The last sync failed; what is on screen is the previous forecast. */
  refreshError: unknown | null;
  generatedAt: string | null;
  fetchedAt: number | null;
}) {
  // Re-read the clock each minute so "3 min ago" does not freeze while the screen is open.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const parsed = generatedAt ? Date.parse(generatedAt) : NaN;
  const since = Number.isNaN(parsed) ? fetchedAt : parsed;

  let text: string | null = null;
  let tone: 'busy' | 'warn' | 'idle' = 'idle';
  if (refreshError != null) {
    text = 'Couldn’t update — showing your last forecast';
    tone = 'warn';
  } else if (syncing && !isRefreshing) {
    text = 'Updating forecast…';
    tone = 'busy';
  } else if (since != null) {
    text = `Updated ${relativeAge(since, now)}`;
  }
  if (text === null) return null;

  return (
    // aria-live without role="status": the degraded-mode banner already owns that role on this screen.
    <p className="dash-fresh" data-tone={tone} aria-live="polite">
      {tone === 'busy' && <span className="spinner" aria-hidden="true" />}
      {text}
    </p>
  );
}
