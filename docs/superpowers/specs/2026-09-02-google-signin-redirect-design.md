# Google sign-in: switch from popup to redirect — design

## Problem

"Continue with Google" uses Firebase's `signInWithPopup`, which relies on
window-to-window messaging between the popup and the opener (and on polling
the popup's `closed` state) to detect both successful sign-in and
cancellation. That channel is unreliable inside embedded/webview browsers —
confirmed by reproducing this in a VS Code-embedded browser: closing the
Google account-chooser popup leaves the underlying promise pending forever,
so the button is stuck on "Signing in…" indefinitely (`finally { setGoogle
Submitting(false) }` never runs because nothing ever resolves or rejects).

This is a known class of Firebase Auth limitation, not specific to this repo
— Firebase's own guidance for exactly this environment is to use
`signInWithRedirect` instead, which doesn't depend on any popup-to-opener
communication channel.

## Goal

Google sign-in must work reliably regardless of host browser environment
(standalone browser tabs and embedded webviews alike), using one code path
rather than environment detection plus a fallback.

## Non-goals

- No change to the backend (`POST /api/auth/google`, its `intent` field, or
  its 409/404 rejection responses) — all of that, built earlier, is unaffected.
- No change to `services/auth.tsx`'s `loginWithGoogle(idToken, intent)`
  signature or behavior — only *when* it gets called changes.
- No environment detection or dual popup/redirect code paths (explicitly
  decided against — see design discussion).
- No change to the Sign in / Create account tab UI itself, beyond the
  Google button's click handler and post-redirect resume logic.

## Design

### `frontend/services/firebase.ts`

Replace `signInWithGooglePopup()` with two functions:

```ts
import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, getRedirectResult, signInWithRedirect } from 'firebase/auth';

function getFirebaseApp(): FirebaseApp {
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

/**
 * Navigates the browser away to Google's account chooser and consent screen.
 * The browser leaves this page — nothing meaningful runs after this resolves
 * (the returned promise is typed `never` to make that explicit at call sites).
 * Google redirects back to this same URL once the user completes or cancels.
 */
export function beginGoogleRedirect(): Promise<never> {
  const auth = getAuth(getFirebaseApp());
  const provider = new GoogleAuthProvider();
  // Without this, Google silently reuses the browser's existing Google
  // session instead of showing the account chooser.
  provider.setCustomParameters({ prompt: 'select_account' });
  return signInWithRedirect(auth, provider) as Promise<never>;
}

/**
 * Call on mount to check whether the browser just came back from
 * beginGoogleRedirect(). Resolves to a Firebase ID token if the user
 * completed sign-in, or null if there's nothing to consume (including the
 * user declining/cancelling on Google's screen). Throws only for genuine
 * Firebase-side failures (network error, misconfiguration, etc.).
 */
export async function consumeGoogleRedirectResult(): Promise<string | null> {
  const auth = getAuth(getFirebaseApp());
  const result = await getRedirectResult(auth);
  return result ? result.user.getIdToken() : null;
}
```

(`getFirebaseApp` and `firebaseConfig` are unchanged from today.)

### `frontend/components/auth/LoginPage.tsx`

**Starting a sign-in.** `handleGoogleClick` becomes:

```ts
const GOOGLE_INTENT_KEY = 'ceview:googleAuthIntent';

function handleGoogleClick() {
  const intent = mode === 'signup' ? 'register' : 'login';
  sessionStorage.setItem(GOOGLE_INTENT_KEY, intent);
  setGoogleSubmitting(true);
  beginGoogleRedirect();
}
```
No `try`/`catch`/`finally` here — the browser navigates away immediately;
there's nothing meaningful to catch synchronously, and `googleSubmitting`
staying `true` through the navigation is correct (the page is about to
unload).

**Resuming after the redirect.** A `useEffect` runs once on mount:

```ts
const [googleSubmitting, setGoogleSubmitting] = useState(
  () => sessionStorage.getItem(GOOGLE_INTENT_KEY) !== null,
);

useEffect(() => {
  const intent = sessionStorage.getItem(GOOGLE_INTENT_KEY);
  if (!intent) return;
  sessionStorage.removeItem(GOOGLE_INTENT_KEY);

  (async () => {
    try {
      const idToken = await consumeGoogleRedirectResult();
      if (!idToken) {
        setError('Sign-in was cancelled. Please try again.');
        return;
      }
      await loginWithGoogle(idToken, intent as 'login' | 'register');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiError && err.message
          ? err.message
          : 'Something went wrong signing in with Google. Please try again.',
      );
    } finally {
      setGoogleSubmitting(false);
    }
  })();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
}, []);
```

The sessionStorage key is read and removed as the very first thing inside the
effect, before any `await` — so React 19/StrictMode's dev-mode double-invoke
of effects can't process the same pending flow twice (the second invocation
finds nothing to consume).

The `intent as 'login' | 'register'` cast is safe: the only writer of this
key is `handleGoogleClick`, which only ever writes one of those two literal
strings.

### `frontend/services/auth.tsx`

No changes. `loginWithGoogle(idToken, intent)` keeps its exact signature and
behavior (call `apiClient.auth.google`, apply the session) — only the caller
site moves from a popup-resolution `try` block to the mount-time effect above.

### Tests (`frontend/components/auth/LoginPage.test.tsx`)

The `services/firebase` mock changes from mocking `signInWithGooglePopup` to
mocking `beginGoogleRedirect` and `consumeGoogleRedirectResult` separately.
A real full-page navigation can't be simulated in jsdom, so "the browser came
back from Google" is simulated by pre-seeding `sessionStorage` with the
pending-intent key and then mounting `LoginPage` fresh — exactly the state a
real reload would hand the component on return.

Cases to cover:
- Clicking "Continue with Google" on the Sign in tab stores `intent: "login"`
  in `sessionStorage` and calls `beginGoogleRedirect()`.
- Clicking it on the Create account tab stores `intent: "register"` and calls
  `beginGoogleRedirect()`.
- Mounting with a pending `"login"` intent in `sessionStorage` and
  `consumeGoogleRedirectResult()` resolving to a token: calls
  `loginWithGoogle` with that token and `"login"`, then navigates to
  `/dashboard`.
- Mounting with a pending intent and `consumeGoogleRedirectResult()`
  resolving to `null`: shows "Sign-in was cancelled. Please try again." and
  does not navigate.
- Mounting with a pending `"register"` intent and the backend rejecting with
  409: shows the existing "This Google account is already registered..."
  message (same `ApiError`-based path as before, just reached via the
  redirect-resume effect instead of the popup handler).
- Mounting with a pending `"login"` intent and the backend rejecting with
  404: shows the existing "No account found..." message.
- Mounting with nothing pending in `sessionStorage`: the effect does nothing
  — no calls to `consumeGoogleRedirectResult`, no error shown, no navigation.
- After a completed flow (success, cancel, or error), a second mount with
  nothing pending doesn't re-trigger anything (covers the sessionStorage-key
  removal happening before any `await`).

## Testing (manual, end-to-end)

Since this is inherently live-Google-redirect behavior:
1. In a real Google Cloud/Firebase test environment, click "Continue with
   Google" from both tabs in a standalone browser — confirm the full
   navigate-away-and-back round trip still completes sign-in/registration
   correctly, including the existing 409/404 rejection messages.
2. Repeat inside VS Code's embedded browser (the environment that reproduced
   the original bug) — confirm the button no longer gets stuck, and
   cancelling on Google's screen returns to the sign-in form with the
   "Sign-in was cancelled" message instead of hanging.
