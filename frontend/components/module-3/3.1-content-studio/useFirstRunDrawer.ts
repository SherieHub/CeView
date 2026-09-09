/**
 * FTUE for the campaign-brief drawer.
 *
 * The drawer is genuinely useful and completely invisible, so it introduces
 * itself once and then gets out of the way permanently. The flag is written on
 * the operator's own dismissal rather than on open, so an auto-open they never
 * looked at does not count as having been shown.
 *
 * Key naming and the try/catch follow AppShell's `ceview.sidebarCollapsed` —
 * private mode and blocked site data make every access throw, and the feature
 * must degrade to "never auto-opens" rather than crashing the screen.
 */
import { useCallback, useState } from 'react';

export const BRIEF_SEEN_KEY = 'ceview.contentStudio.briefSeen';

interface BriefFlag {
  seen: boolean;
  /** False when storage threw — private mode, blocked site data. */
  ok: boolean;
}

function readFlag(): BriefFlag {
  try {
    return { seen: localStorage.getItem(BRIEF_SEEN_KEY) === 'true', ok: true };
  } catch {
    return { seen: false, ok: false };
  }
}

export interface FirstRunDrawer {
  open: boolean;
  showWelcome: boolean;
  showTooltip: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
}

export function useFirstRunDrawer(): FirstRunDrawer {
  const [flag] = useState(readFlag);
  const [seen, setSeen] = useState(flag.seen);
  // First render decides. Auto-open requires BOTH that the operator has never
  // dismissed it and that storage works — auto-opening when the dismissal
  // cannot be recorded would ambush them on every load forever.
  const [open, setOpen] = useState(() => flag.ok && !flag.seen);
  const [firstRun] = useState(() => !flag.seen);

  const closeDrawer = useCallback(() => {
    setOpen(false);
    setSeen(true);
    try {
      localStorage.setItem(BRIEF_SEEN_KEY, 'true');
    } catch {
      // Nothing to do — it will auto-open again next time, which is the safe
      // failure for a discovery aid.
    }
  }, []);

  const openDrawer = useCallback(() => setOpen(true), []);

  return {
    open,
    showWelcome: firstRun && open,
    // The fallback path: auto-open was skipped (storage blocked), so nothing
    // has introduced the drawer and the trigger pulses instead. Goes quiet the
    // moment the drawer is opened, and stays quiet after a dismissal.
    showTooltip: !seen && !open,
    openDrawer,
    closeDrawer,
  };
}
