/**
 * Window event dispatched by apiClient when the backend answers 403 EMAIL_NOT_VERIFIED,
 * and listened for by AuthProvider (services/auth.tsx). Kept in its own module so neither
 * side imports the other for a string — importing it from apiClient would also break every
 * test that mocks that module.
 */
export const EMAIL_NOT_VERIFIED_EVENT = 'ceview:email-not-verified';

/** Carries the rejected access token so an older request cannot end a newer session. */
export const SESSION_REJECTED_EVENT = 'ceview:session-rejected';
