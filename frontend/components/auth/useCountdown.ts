import { useCallback, useEffect, useState } from 'react';

/**
 * Whole seconds remaining, ticking down once a second to 0. `start(n)` (re)starts it;
 * used for the "resend code in 42s" button on the verify and forgot-password screens.
 */
export function useCountdown(): [remaining: number, start: (seconds: number) => void] {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (remaining <= 0) return;
    const id = setTimeout(() => setRemaining((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [remaining]);

  const start = useCallback((seconds: number) => setRemaining(Math.max(0, Math.ceil(seconds))), []);
  return [remaining, start];
}
