/**
 * One-shot "just finished onboarding" signal.
 *
 * NOT carried via router navigation state — OnboardingWizard.handleFinish's
 * navigate('/dashboard', { state }) races ProfileGate's own declarative
 * redirect (ProfileGate re-renders on the profile update this same Finish
 * triggers, sees uniquenessScore now set while the URL is still
 * /onboarding — react-router v7 data routers apply navigations via
 * startTransition, so the location change lags — and fires its own
 * stateless <Navigate to="/dashboard" replace />, which can win the race
 * and strip the state). A plain in-memory flag sidesteps that: it's set
 * before either navigation happens and consumed by the dashboard on mount
 * regardless of which navigate call actually landed.
 *
 * Module-level (not React state) since it must survive being set by one
 * component (OnboardingWizard) and read by an unrelated one
 * (useJustOnboardedTutorial, via DashboardView) with no shared parent
 * state to carry it. Resets on every full page load, same one-shot
 * precision router state would have given — a refresh of /dashboard never
 * sees it.
 */
let justOnboarded = false;

/** Called once, by OnboardingWizard.handleFinish, right before navigating. */
export function markJustOnboarded(): void {
  justOnboarded = true;
}

/** Reads and clears the flag in one step — a second call always returns false. */
export function consumeJustOnboarded(): boolean {
  const value = justOnboarded;
  justOnboarded = false;
  return value;
}
