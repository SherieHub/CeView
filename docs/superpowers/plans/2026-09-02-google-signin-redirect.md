# Google Sign-In Redirect Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `signInWithPopup` with `signInWithRedirect` for "Continue
with Google" so sign-in works reliably in embedded/webview browsers (where
popup-to-opener communication is unreliable and currently leaves the button
stuck on "Signing in…" forever), using one code path with no environment
detection.

**Architecture:** `services/firebase.ts` exposes `beginGoogleRedirect()`
(navigates away to Google) and `consumeGoogleRedirectResult()` (checked on
`LoginPage` mount for a completed round trip). `LoginPage.tsx` persists the
clicked tab's `intent` in `sessionStorage` before redirecting (since a full
page navigation wipes React state), and a mount-time `useEffect` consumes it:
success logs in and navigates to `/dashboard`, cancellation shows a message,
and the existing `ApiError`-based 409/404 message handling is preserved
unchanged, just reached from the effect instead of a popup-resolution handler.

**Tech Stack:** React 19 + TypeScript, Firebase JS SDK (`firebase/auth`),
Vitest + Testing Library.

---

### Task 1: `services/firebase.ts` — redirect instead of popup

**Files:**
- Modify: `frontend/services/firebase.ts` (whole file)

No existing test file covers this module (confirmed — none found), and
`signInWithRedirect`/`getRedirectResult` aren't meaningfully unit-testable
(they drive a real browser navigation against Google's servers). This task is
a straight rewrite, verified by typecheck; Task 2's tests cover the
integration by mocking this module's exports.

- [ ] **Step 1: Rewrite the file**

Replace the full contents of `frontend/services/firebase.ts` with:

```ts
/**
 * Thin wrapper around the Firebase JS SDK, kept isolated from auth.tsx so the
 * app's own session/context logic doesn't need to know anything about
 * Firebase specifics. Firebase is used purely to obtain a Google-signed ID
 * token client-side — the backend verifies that token and issues CeView's
 * own JWT (see AuthController#google); no Firestore, no Firebase-side data.
 *
 * Uses signInWithRedirect rather than signInWithPopup: the popup approach
 * depends on window-to-window messaging between the popup and this page to
 * detect both success and cancellation, which is unreliable inside
 * embedded/webview browsers (confirmed via a VS Code-embedded browser — the
 * "Continue with Google" button got stuck on "Signing in…" forever because
 * the popup's closed-by-user detection never fired). Redirect avoids that
 * channel entirely: the browser just navigates away and back.
 */
import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, getRedirectResult, signInWithRedirect } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

function getFirebaseApp(): FirebaseApp {
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

/**
 * Navigates the browser away to Google's account chooser and consent screen.
 * The browser leaves this page — nothing meaningful runs after this resolves
 * (typed `never` to make that explicit at call sites). Google redirects back
 * to this same URL once the user completes or cancels.
 */
export function beginGoogleRedirect(): Promise<never> {
  const auth = getAuth(getFirebaseApp());
  const provider = new GoogleAuthProvider();
  // Without this, Google silently reuses the browser's existing Google
  // session instead of showing the account chooser — so a user could never
  // pick a different account without first signing out of Google entirely.
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

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no new errors from this file. `LoginPage.tsx` will now show an
error (`signInWithGooglePopup` no longer exported) — that's expected and
fixed in Task 2. No other file should be affected (confirmed by Task 2 below,
since `signInWithGooglePopup` had exactly one other consumer, `LoginPage.tsx`,
per this plan's design).

- [ ] **Step 3: Do NOT commit.**

This repo's `.claude/CLAUDE.md` forbids Claude from ever running `git commit`
or `git push`. Leave changes in the working tree.

---

### Task 2: `LoginPage.tsx` — redirect-based click handler and resume effect

**Files:**
- Modify: `frontend/components/auth/LoginPage.tsx`
- Modify: `frontend/components/auth/LoginPage.test.tsx` (full rewrite)

- [ ] **Step 1: Replace the test file**

Replace the full contents of `frontend/components/auth/LoginPage.test.tsx` with:

```tsx
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import LoginPage from './LoginPage';
import { AuthProvider } from '../../services/auth';

vi.mock('../../services/firebase', () => ({
  beginGoogleRedirect: vi.fn(),
  consumeGoogleRedirectResult: vi.fn(),
}));

import { beginGoogleRedirect, consumeGoogleRedirectResult } from '../../services/firebase';

const GOOGLE_INTENT_KEY = 'ceview:googleAuthIntent';

vi.stubEnv('VITE_USE_FIXTURES', 'false');

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status }));
}

function renderLoginPage() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<div>Dashboard</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

function requestBody(callIndex = 0): Record<string, unknown> {
  const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[callIndex];
  return JSON.parse((init as RequestInit).body as string);
}

describe('LoginPage — Continue with Google', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('stores intent "login" and starts the redirect from the Sign in tab', async () => {
    renderLoginPage();

    fireEvent.click(screen.getByRole('button', { name: /continue with google/i }));

    expect(sessionStorage.getItem(GOOGLE_INTENT_KEY)).toBe('login');
    expect(beginGoogleRedirect).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /signing in/i })).toBeInTheDocument();
  });

  it('stores intent "register" and starts the redirect from the Create account tab', async () => {
    renderLoginPage();

    fireEvent.click(screen.getByRole('tab', { name: /create account/i }));
    fireEvent.click(screen.getByRole('button', { name: /continue with google/i }));

    expect(sessionStorage.getItem(GOOGLE_INTENT_KEY)).toBe('register');
    expect(beginGoogleRedirect).toHaveBeenCalledTimes(1);
  });

  it('does nothing on mount when no Google sign-in is pending', async () => {
    renderLoginPage();

    expect(consumeGoogleRedirectResult).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument();
  });

  it('resumes a pending login, signs in, and navigates on success', async () => {
    sessionStorage.setItem(GOOGLE_INTENT_KEY, 'login');
    (consumeGoogleRedirectResult as ReturnType<typeof vi.fn>).mockResolvedValue('the-id-token');
    (fetch as ReturnType<typeof vi.fn>).mockReturnValue(
      jsonResponse({ token: 'jwt-1', operatorId: 'op-1', profileCompleted: true }),
    );

    renderLoginPage();

    await waitFor(() => expect(screen.getByText('Dashboard')).toBeInTheDocument());
    expect(requestBody().intent).toBe('login');
    expect(sessionStorage.getItem(GOOGLE_INTENT_KEY)).toBeNull();
  });

  it('resumes a pending register and sends intent "register"', async () => {
    sessionStorage.setItem(GOOGLE_INTENT_KEY, 'register');
    (consumeGoogleRedirectResult as ReturnType<typeof vi.fn>).mockResolvedValue('the-id-token');
    (fetch as ReturnType<typeof vi.fn>).mockReturnValue(
      jsonResponse({ token: 'jwt-1', operatorId: 'op-1', profileCompleted: true }),
    );

    renderLoginPage();

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(requestBody().intent).toBe('register');
  });

  it('shows a cancelled message when the redirect result is null', async () => {
    sessionStorage.setItem(GOOGLE_INTENT_KEY, 'login');
    (consumeGoogleRedirectResult as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    renderLoginPage();

    await waitFor(() => expect(screen.getByText('Sign-in was cancelled. Please try again.')).toBeInTheDocument());
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument();
  });

  it('shows the "already registered" message when a resumed register rejects with 409', async () => {
    sessionStorage.setItem(GOOGLE_INTENT_KEY, 'register');
    (consumeGoogleRedirectResult as ReturnType<typeof vi.fn>).mockResolvedValue('the-id-token');
    (fetch as ReturnType<typeof vi.fn>).mockReturnValue(
      jsonResponse(
        { error: 'google_account_already_registered', message: 'This Google account is already registered. Please sign in instead.' },
        409,
      ),
    );

    renderLoginPage();

    await waitFor(() =>
      expect(screen.getByText('This Google account is already registered. Please sign in instead.')).toBeInTheDocument(),
    );
  });

  it('shows the "no account found" message when a resumed login rejects with 404', async () => {
    sessionStorage.setItem(GOOGLE_INTENT_KEY, 'login');
    (consumeGoogleRedirectResult as ReturnType<typeof vi.fn>).mockResolvedValue('the-id-token');
    (fetch as ReturnType<typeof vi.fn>).mockReturnValue(
      jsonResponse(
        { error: 'google_account_not_registered', message: 'No account found for this Google account. Please create an account first.' },
        404,
      ),
    );

    renderLoginPage();

    await waitFor(() =>
      expect(screen.getByText('No account found for this Google account. Please create an account first.')).toBeInTheDocument(),
    );
  });

  it('shows the generic fallback message when consuming the redirect result throws', async () => {
    sessionStorage.setItem(GOOGLE_INTENT_KEY, 'login');
    (consumeGoogleRedirectResult as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network-error'));

    renderLoginPage();

    await waitFor(() =>
      expect(screen.getByText('Something went wrong signing in with Google. Please try again.')).toBeInTheDocument(),
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd frontend && npx vitest run components/auth/LoginPage.test.tsx`
Expected: FAIL — `LoginPage.tsx` still imports `signInWithGooglePopup`, which
no longer exists (Task 1 removed it), and none of the new sessionStorage/mount
behavior exists yet.

- [ ] **Step 3: Rewrite `LoginPage.tsx`**

Change the imports (lines 1-13) from:

```ts
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../services/auth';
import { signInWithGooglePopup } from '../../services/firebase';
import { ApiError } from '../../services/apiError';
```

to:

```ts
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../services/auth';
import { beginGoogleRedirect, consumeGoogleRedirectResult } from '../../services/firebase';
import { ApiError } from '../../services/apiError';

const GOOGLE_INTENT_KEY = 'ceview:googleAuthIntent';
```

Change the component body's state and `handleGoogleClick` (currently lines
15-59, the `googleSubmitting` state declaration plus `handleGoogleClick`)
from:

```ts
export default function LoginPage() {
  const { login, register, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'signin') await login(email, password);
      else await register(email, password, firstName, lastName, contactNumber);
    } catch {
      setError('Something went wrong. Check your details and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleClick() {
    setError(null);
    setGoogleSubmitting(true);
    try {
      const idToken = await signInWithGooglePopup();
      const intent = mode === 'signup' ? 'register' : 'login';
      await loginWithGoogle(idToken, intent);
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
  }
```

to:

```ts
export default function LoginPage() {
  const { login, register, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(
    () => sessionStorage.getItem(GOOGLE_INTENT_KEY) !== null,
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'signin') await login(email, password);
      else await register(email, password, firstName, lastName, contactNumber);
    } catch {
      setError('Something went wrong. Check your details and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleGoogleClick() {
    const intent = mode === 'signup' ? 'register' : 'login';
    sessionStorage.setItem(GOOGLE_INTENT_KEY, intent);
    setGoogleSubmitting(true);
    beginGoogleRedirect();
  }

  // Resumes a Google sign-in after the browser comes back from
  // beginGoogleRedirect(). Reads and clears the pending-intent key as the
  // very first thing, before any await, so a dev-mode double-invoke of this
  // effect can't process the same pending flow twice.
  useEffect(() => {
    const intent = sessionStorage.getItem(GOOGLE_INTENT_KEY);
    if (!intent) return;
    sessionStorage.removeItem(GOOGLE_INTENT_KEY);

    (async () => {
      setError(null);
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

Everything below this (the JSX return, including the Google button which
still reads `googleSubmitting`/`onClick={handleGoogleClick}`) is unchanged.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd frontend && npx vitest run components/auth/LoginPage.test.tsx`
Expected: PASS — all 9 tests.

- [ ] **Step 5: Run the full frontend typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors related to this plan's work. The only acceptable
remaining error is the pre-existing, unrelated one in
`components/module-3/3.2-calendar/CalendarView.tsx` (a `GOLD` property issue
predating this plan).

- [ ] **Step 6: Do NOT commit.**

This repo's `.claude/CLAUDE.md` forbids Claude from ever running `git commit`
or `git push`. Leave changes in the working tree.

---

## Self-review notes

- **Spec coverage:** redirect-only flow (Task 1), intent persisted across
  navigation via sessionStorage, cleared before any await (Task 2's effect),
  cancelled-message case, existing 409/404 `ApiError` handling preserved,
  generic-fallback case for a genuine Firebase-side throw — all covered by
  Task 2's 9 tests. Manual end-to-end verification (standalone browser +
  VS Code embedded browser) is called out in the design doc; it's inherently
  not automatable and isn't restated as a plan task.
- **Placeholder scan:** no TBD/TODO; every step has literal code and literal
  run commands with expected output.
- **Type consistency:** `beginGoogleRedirect(): Promise<never>` and
  `consumeGoogleRedirectResult(): Promise<string | null>` in `firebase.ts`
  match their usage in `LoginPage.tsx` exactly (fire-and-forget call vs.
  awaited call respectively); `GOOGLE_INTENT_KEY` is the same literal string
  in both the component and its test; `intent as 'login' | 'register'` cast
  is justified inline (only writer of the key is `handleGoogleClick`, which
  only ever writes one of those two literals).
