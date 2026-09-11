/**
 * One-shot trigger for TutorialModal: OnboardingWizard.handleFinish() calls
 * markJustOnboarded() right before navigating to /dashboard. On mount here,
 * that flag opens the tutorial and is immediately consumed (see
 * services/justOnboardedFlag.ts for why this isn't carried via router
 * navigation state — it races ProfileGate's own redirect and loses).
 *
 * Kept as its own hook, separate from DashboardView, so the trigger logic is
 * unit-testable without mounting the whole dashboard (profile context,
 * dashboard state machine, child panels, etc).
 */
import { useState } from 'react';
import { consumeJustOnboarded } from '../../../services/justOnboardedFlag';

export function useJustOnboardedTutorial() {
  const [open, setOpen] = useState(() => consumeJustOnboarded());

  return { open, close: () => setOpen(false) };
}
