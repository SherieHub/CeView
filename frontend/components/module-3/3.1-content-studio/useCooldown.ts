/**
 * A wait that has to be honoured even if the operator leaves the screen and comes back: the end
 * time is kept in localStorage, so navigating away (or reloading) does not skip it. Used to space
 * out model calls, whose host meters tokens per minute.
 *
 * Storage that is blocked or unavailable just means the wait lasts as long as the page does.
 */
import { useCallback, useEffect, useState } from 'react';

function readEnd(key: string): number {
  try {
    const value = Number(window.localStorage.getItem(key));
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

function writeEnd(key: string, end: number): void {
  try {
    window.localStorage.setItem(key, String(end));
  } catch {
    // Not persisted; the in-memory wait still holds.
  }
}

export function useCooldown(storageKey: string) {
  const [until, setUntil] = useState(() => readEnd(storageKey));
  const [now, setNow] = useState(() => Date.now());

  // Tick once a second while there is a wait to count down; nothing runs otherwise.
  useEffect(() => {
    if (until <= Date.now()) return;
    setNow(Date.now());
    const timer = window.setInterval(() => {
      const tick = Date.now();
      setNow(tick);
      if (tick >= until) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [until]);

  /** Begins a wait of `ms` from now, replacing any wait already running. */
  const start = useCallback(
    (ms: number) => {
      const end = Date.now() + ms;
      setUntil(end);
      setNow(Date.now());
      writeEnd(storageKey, end);
    },
    [storageKey],
  );

  return { secondsLeft: Math.max(0, Math.ceil((until - now) / 1000)), start };
}
