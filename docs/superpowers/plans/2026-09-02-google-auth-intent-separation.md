# Google Auth Intent Separation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make "Continue with Google" behave differently depending on whether the
user clicked it from the Sign in tab or the Create account tab: Create account
rejects a Google identity that's already registered; Sign in rejects a Google
identity that's never been registered.

**Architecture:** `POST /api/auth/google` gains a required `intent` field
(`"login"` | `"register"`) that the frontend derives from the active tab. The
handler's existing find-by-googleUid → link-by-email → create-new logic is
unrolled from `.orElseGet(...)` into an explicit if/else so two new guard
checks — reject on `register` if already linked, reject on `login` if nothing
matches — can sit at the right points without changing the underlying linking
behavior.

**Tech Stack:** Spring Boot 3.3 (Java 21) + JUnit/Mockito for the backend;
React 19 + TypeScript + Vitest/Testing Library for the frontend.

---

### Task 1: Backend — add `intent` to the request, validate it, thread it through existing tests

**Files:**
- Modify: `backend/spring-boot/src/main/java/com/ceview/auth/AuthController.java:52` (record), `:86-124` (`google` method)
- Modify: `backend/spring-boot/src/test/java/com/ceview/auth/AuthControllerTest.java:98,111,137,171,200` (existing `GoogleAuthRequest` call sites)

This task only adds the field and its validation — no behavior change to the
find-or-create logic yet, so all five existing Google tests keep passing once
their call sites compile again.

- [ ] **Step 1: Add the failing invalid-intent test**

Add to `AuthControllerTest.java`, right after `googleReturns401WhenTokenVerificationFails` (after line 114):

```java
    // ---- google(): intent must be "login" or "register" ----

    @Test
    void googleReturns400WhenIntentIsInvalid() {
        AuthController controller = newController(Optional.empty());

        ResponseEntity<?> response = controller.google(
            new AuthController.GoogleAuthRequest("some-id-token", "bogus"));

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
    }
```

Also update the five existing `GoogleAuthRequest` call sites to pass an
`intent` so the file compiles:
- Line 98 (`googleReturns503WhenFirebaseIsNotConfigured`): `new AuthController.GoogleAuthRequest("some-id-token", "login")`
- Line 111 (`googleReturns401WhenTokenVerificationFails`): `new AuthController.GoogleAuthRequest("bad-token", "login")`
- Line 137 (`googleProvisionsNewOperatorWhenNoExistingRowMatches`): `new AuthController.GoogleAuthRequest("good-token", "register")`
- Line 171 (`googleLinksToExistingOperatorWhenVerifiedEmailMatches`): `new AuthController.GoogleAuthRequest("good-token", "login")`
- Line 200 (`googleDoesNotLinkWhenEmailIsUnverifiedEvenIfItMatches`): `new AuthController.GoogleAuthRequest("good-token", "register")`

- [ ] **Step 2: Run the tests to see the new one fail (and the rest fail to compile)**

Run: `cd backend/spring-boot && mvn -pl . -am test -Dtest=AuthControllerTest`
Expected: compile error — `GoogleAuthRequest` doesn't have a two-arg constructor yet.

- [ ] **Step 3: Add `intent` to the record and validate it in `google()`**

In `AuthController.java`, change line 52:

```java
    public record GoogleAuthRequest(@NotBlank String idToken, @NotBlank String intent) {}
```

And change the start of the `google` method (currently lines 86-91) to validate
`intent` first, before the Firebase-configured check:

```java
    @PostMapping("/google")
    public ResponseEntity<?> google(@RequestBody @Valid GoogleAuthRequest req) {
        if (!"login".equals(req.intent()) && !"register".equals(req.intent())) {
            return ResponseEntity.badRequest().body(Map.of("error", "invalid intent"));
        }

        if (firebaseAuth.isEmpty()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(Map.of("error", "Google sign-in is not configured"));
        }
```

- [ ] **Step 4: Run the tests to see everything pass**

Run: `cd backend/spring-boot && mvn -pl . -am test -Dtest=AuthControllerTest`
Expected: PASS — all 9 tests (the original 8 plus the new invalid-intent one).

- [ ] **Step 5: Commit**

```bash
git add backend/spring-boot/src/main/java/com/ceview/auth/AuthController.java backend/spring-boot/src/test/java/com/ceview/auth/AuthControllerTest.java
git commit -m "feat(auth): require intent on Google auth requests"
```

---

### Task 2: Backend — reject `register` intent when the Google account is already linked

**Files:**
- Modify: `backend/spring-boot/src/main/java/com/ceview/auth/AuthController.java` (`google` method body)
- Modify: `backend/spring-boot/src/test/java/com/ceview/auth/AuthControllerTest.java`

- [ ] **Step 1: Write the failing test**

Add to `AuthControllerTest.java`, after `googleReturns400WhenIntentIsInvalid`:

```java
    // ---- google(): register intent rejects an already-linked Google account ----

    @Test
    void googleRegisterRejectsWhenGoogleAccountAlreadyLinked() throws FirebaseAuthException {
        FirebaseAuth firebaseAuth = mock(FirebaseAuth.class);
        FirebaseToken token = mock(FirebaseToken.class);
        when(token.getUid()).thenReturn("google-uid-existing");
        when(firebaseAuth.verifyIdToken("good-token")).thenReturn(token);

        MsmeOperator existing = new MsmeOperator();
        existing.setOperatorId(UUID.randomUUID());
        existing.setGoogleUid("google-uid-existing");
        when(repo.findByGoogleUid("google-uid-existing")).thenReturn(Optional.of(existing));
        AuthController controller = newController(Optional.of(firebaseAuth));

        ResponseEntity<?> response = controller.google(
            new AuthController.GoogleAuthRequest("good-token", "register"));

        assertEquals(HttpStatus.CONFLICT, response.getStatusCode());
        Map<?, ?> body = (Map<?, ?>) response.getBody();
        assertEquals("google_account_already_registered", body.get("error"));
        assertEquals("This Google account is already registered. Please sign in instead.", body.get("message"));
        verify(jwt, org.mockito.Mockito.never()).issue(any(), any());
    }
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend/spring-boot && mvn -pl . -am test -Dtest=AuthControllerTest#googleRegisterRejectsWhenGoogleAccountAlreadyLinked`
Expected: FAIL — current code returns 200 (issues a session) because `register`
carries no rejection logic yet.

- [ ] **Step 3: Add the rejection branch**

In `AuthController.java`, replace the body of `google()` from
`String googleUid = decoded.getUid();` through the closing of the
`findByGoogleUid(...).orElseGet(...)` call (the current lines 100-121) with:

```java
        String googleUid = decoded.getUid();
        String email = decoded.getEmail();
        boolean isRegister = "register".equals(req.intent());

        Optional<MsmeOperator> byGoogleUid = repo.findByGoogleUid(googleUid);

        if (isRegister && byGoogleUid.isPresent()) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
                "error", "google_account_already_registered",
                "message", "This Google account is already registered. Please sign in instead."
            ));
        }

        MsmeOperator op;
        if (byGoogleUid.isPresent()) {
            op = byGoogleUid.get();
        } else {
            Optional<MsmeOperator> byEmail = (decoded.isEmailVerified() && email != null)
                ? repo.findByEmail(email)
                : Optional.empty();

            MsmeOperator o;
            if (byEmail.isPresent()) {
                o = byEmail.get();
                o.setGoogleUid(googleUid);
            } else {
                o = new MsmeOperator();
                String[] names = splitDisplayName(decoded.getName(), email);
                o.setFirstName(names[0]);
                o.setLastName(names[1]);
                o.setEmail(email);
                o.setGoogleUid(googleUid);
            }
            op = repo.save(o);
        }
```

Note: the following line (`return sessionResponse(op);`) already exists at the
end of the method — leave it as-is; this block only replaces what feeds `op`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd backend/spring-boot && mvn -pl . -am test -Dtest=AuthControllerTest`
Expected: PASS — all tests, including the new one and the five from Task 1.

- [ ] **Step 5: Commit**

```bash
git add backend/spring-boot/src/main/java/com/ceview/auth/AuthController.java backend/spring-boot/src/test/java/com/ceview/auth/AuthControllerTest.java
git commit -m "feat(auth): reject Google sign-up when the account is already registered"
```

---

### Task 3: Backend — reject `login` intent when no account matches

**Files:**
- Modify: `backend/spring-boot/src/main/java/com/ceview/auth/AuthController.java` (`google` method body)
- Modify: `backend/spring-boot/src/test/java/com/ceview/auth/AuthControllerTest.java`

- [ ] **Step 1: Write the failing test**

Add to `AuthControllerTest.java`, after `googleRegisterRejectsWhenGoogleAccountAlreadyLinked`:

```java
    // ---- google(): login intent rejects when no account exists yet ----

    @Test
    void googleLoginRejectsWhenNoAccountExists() throws FirebaseAuthException {
        FirebaseAuth firebaseAuth = mock(FirebaseAuth.class);
        FirebaseToken token = mock(FirebaseToken.class);
        when(token.getUid()).thenReturn("google-uid-unknown");
        when(token.getEmail()).thenReturn("nobody@example.com");
        when(token.isEmailVerified()).thenReturn(true);
        when(firebaseAuth.verifyIdToken("good-token")).thenReturn(token);
        when(repo.findByGoogleUid("google-uid-unknown")).thenReturn(Optional.empty());
        when(repo.findByEmail("nobody@example.com")).thenReturn(Optional.empty());
        AuthController controller = newController(Optional.of(firebaseAuth));

        ResponseEntity<?> response = controller.google(
            new AuthController.GoogleAuthRequest("good-token", "login"));

        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
        Map<?, ?> body = (Map<?, ?>) response.getBody();
        assertEquals("google_account_not_registered", body.get("error"));
        assertEquals("No account found for this Google account. Please create an account first.", body.get("message"));
        verify(repo, org.mockito.Mockito.never()).save(any(MsmeOperator.class));
    }
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend/spring-boot && mvn -pl . -am test -Dtest=AuthControllerTest#googleLoginRejectsWhenNoAccountExists`
Expected: FAIL — current code provisions a brand-new operator for `login`
intent instead of rejecting.

- [ ] **Step 3: Add the rejection branch**

In `AuthController.java`, inside the `else` branch added in Task 2 (the one
that computes `byEmail`), add the guard right after `byEmail` is computed and
before building `o`:

```java
            Optional<MsmeOperator> byEmail = (decoded.isEmailVerified() && email != null)
                ? repo.findByEmail(email)
                : Optional.empty();

            if (!isRegister && byEmail.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of(
                    "error", "google_account_not_registered",
                    "message", "No account found for this Google account. Please create an account first."
                ));
            }

            MsmeOperator o;
```

(This replaces just the two lines between computing `byEmail` and declaring
`MsmeOperator o;` from Task 2's edit — the rest of the `else` branch is
unchanged.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd backend/spring-boot && mvn -pl . -am test -Dtest=AuthControllerTest`
Expected: PASS — all tests.

- [ ] **Step 5: Commit**

```bash
git add backend/spring-boot/src/main/java/com/ceview/auth/AuthController.java backend/spring-boot/src/test/java/com/ceview/auth/AuthControllerTest.java
git commit -m "feat(auth): reject Google sign-in when no account exists yet"
```

---

### Task 4: Backend — cover the register-intent linking case explicitly

**Files:**
- Modify: `backend/spring-boot/src/test/java/com/ceview/auth/AuthControllerTest.java`

Per the spec, a `register` click against a Google identity that isn't yet
linked, but whose verified email matches an existing password-based account,
must still succeed (link + session), not reject. Task 1 already routed the
existing `googleLinksToExistingOperatorWhenVerifiedEmailMatches` test through
`login` intent; this task adds the mirrored `register`-intent case so both
paths through the shared linking logic are covered.

- [ ] **Step 1: Write the test**

Add to `AuthControllerTest.java`, after `googleLoginRejectsWhenNoAccountExists`:

```java
    // ---- google(): register intent still links (not rejects) when only the email matches ----

    @Test
    void googleRegisterLinksWhenVerifiedEmailMatchesExistingPasswordAccount() throws FirebaseAuthException {
        FirebaseAuth firebaseAuth = mock(FirebaseAuth.class);
        FirebaseToken token = mock(FirebaseToken.class);
        when(token.getUid()).thenReturn("google-uid-4");
        when(token.getEmail()).thenReturn("existing2@example.com");
        when(token.isEmailVerified()).thenReturn(true);
        when(firebaseAuth.verifyIdToken("good-token")).thenReturn(token);
        when(repo.findByGoogleUid("google-uid-4")).thenReturn(Optional.empty());

        UUID existingId = UUID.randomUUID();
        MsmeOperator existing = new MsmeOperator();
        existing.setOperatorId(existingId);
        existing.setEmail("existing2@example.com");
        existing.setContactNumber("0917");
        when(repo.findByEmail("existing2@example.com")).thenReturn(Optional.of(existing));
        when(repo.save(any(MsmeOperator.class))).thenAnswer(inv -> inv.getArgument(0));
        when(jwt.issue(any(), any())).thenReturn("jwt-token");
        AuthController controller = newController(Optional.of(firebaseAuth));

        ResponseEntity<?> response = controller.google(
            new AuthController.GoogleAuthRequest("good-token", "register"));

        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<?, ?> body = (Map<?, ?>) response.getBody();
        assertEquals(existingId.toString(), body.get("operatorId").toString());
        assertEquals("google-uid-4", existing.getGoogleUid());
        verify(repo).save(existing);
    }
```

- [ ] **Step 2: Run the test**

Run: `cd backend/spring-boot && mvn -pl . -am test -Dtest=AuthControllerTest#googleRegisterLinksWhenVerifiedEmailMatchesExistingPasswordAccount`
Expected: PASS immediately — this exercises a path already implemented in
Task 2/3; it's a regression-lock test, not a new behavior.

- [ ] **Step 3: Run the full `AuthControllerTest` suite**

Run: `cd backend/spring-boot && mvn -pl . -am test -Dtest=AuthControllerTest`
Expected: PASS — all 12 tests.

- [ ] **Step 4: Commit**

```bash
git add backend/spring-boot/src/test/java/com/ceview/auth/AuthControllerTest.java
git commit -m "test(auth): cover register-intent linking against an existing password account"
```

---

### Task 5: Frontend — thread `intent` through `apiClient` and `auth.tsx`

**Files:**
- Modify: `frontend/services/apiClient.ts:362-374` (`auth.google`)
- Modify: `frontend/services/auth.tsx:19,72-75` (`loginWithGoogle`)

No new frontend test in this task — `apiClient` and `auth.tsx` have no
dedicated unit tests today (they're exercised indirectly through
`LoginPage.test.tsx`, which Task 6 updates). This task is a mechanical
signature change; Task 6's tests are what validate it end-to-end.

- [ ] **Step 1: Update `apiClient.ts`**

Replace lines 362-374 in `frontend/services/apiClient.ts`:

```ts
    /** Verifies a Firebase ID token server-side and mints the same session shape as login/register. */
    google: (idToken: string, intent: 'login' | 'register') =>
      USE_FIXTURES
        ? delay({ accessToken: 'mock-access-token-123', profileCompleted: false, user: { id: 'usr-1', email: null, businessName: null } })
        : request<{ token: string; operatorId: string; profileCompleted: boolean }>('/api/auth/google', {
            method: 'POST',
            body: JSON.stringify({ idToken, intent }),
          }).then(({ token, operatorId, profileCompleted }) => ({
            accessToken: token,
            profileCompleted,
            // Google sign-in's email comes back inside the JWT, not this
            // response body — callers that need it read it off the token.
            user: { id: operatorId, email: null, businessName: null },
          })),
```

- [ ] **Step 2: Update `auth.tsx`**

In `frontend/services/auth.tsx`, change the interface field on line 19:

```ts
  loginWithGoogle: (idToken: string, intent: 'login' | 'register') => Promise<void>;
```

And change `loginWithGoogle` (lines 72-75):

```ts
  const loginWithGoogle = useCallback(async (idToken: string, intent: 'login' | 'register') => {
    const res = await apiClient.auth.google(idToken, intent);
    applySession(res);
  }, [applySession]);
```

- [ ] **Step 3: Run the frontend build/typecheck to confirm nothing else references the old signature yet**

Run: `cd frontend && npx tsc --noEmit`
Expected: one error, in `components/auth/LoginPage.tsx`, where `loginWithGoogle(idToken)` no longer matches the new two-arg signature — this confirms the change took effect; Task 6 fixes that call site.

- [ ] **Step 4: Commit**

```bash
git add frontend/services/apiClient.ts frontend/services/auth.tsx
git commit -m "feat(auth): thread Google auth intent through apiClient and AuthProvider"
```

---

### Task 6: Frontend — `LoginPage.tsx` sends intent and surfaces the new error messages

**Files:**
- Modify: `frontend/components/auth/LoginPage.tsx:41-53` (`handleGoogleClick`)
- Modify: `frontend/components/auth/LoginPage.test.tsx`

- [ ] **Step 1: Write the failing tests**

Replace the contents of `frontend/components/auth/LoginPage.test.tsx` with:

```tsx
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import LoginPage from './LoginPage';
import { AuthProvider } from '../../services/auth';

vi.mock('../../services/firebase', () => ({
  signInWithGooglePopup: vi.fn(),
}));

import { signInWithGooglePopup } from '../../services/firebase';

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
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('signs in via the Firebase popup and navigates on success', async () => {
    (signInWithGooglePopup as ReturnType<typeof vi.fn>).mockResolvedValue('the-id-token');
    (fetch as ReturnType<typeof vi.fn>).mockReturnValue(
      jsonResponse({ token: 'jwt-1', operatorId: 'op-1', profileCompleted: true }),
    );
    renderLoginPage();

    fireEvent.click(screen.getByRole('button', { name: /continue with google/i }));

    await waitFor(() => expect(screen.getByText('Dashboard')).toBeInTheDocument());
    expect(signInWithGooglePopup).toHaveBeenCalledTimes(1);
  });

  it('shows an error message when the Google popup sign-in fails', async () => {
    (signInWithGooglePopup as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('popup-closed-by-user'));
    renderLoginPage();

    fireEvent.click(screen.getByRole('button', { name: /continue with google/i }));

    await waitFor(() => expect(screen.getByText(/something went wrong/i)).toBeInTheDocument());
    expect(fetch).not.toHaveBeenCalled();
  });

  it('sends intent "login" from the Sign in tab', async () => {
    (signInWithGooglePopup as ReturnType<typeof vi.fn>).mockResolvedValue('the-id-token');
    (fetch as ReturnType<typeof vi.fn>).mockReturnValue(
      jsonResponse({ token: 'jwt-1', operatorId: 'op-1', profileCompleted: true }),
    );
    renderLoginPage();

    fireEvent.click(screen.getByRole('button', { name: /continue with google/i }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(requestBody().intent).toBe('login');
  });

  it('sends intent "register" from the Create account tab', async () => {
    (signInWithGooglePopup as ReturnType<typeof vi.fn>).mockResolvedValue('the-id-token');
    (fetch as ReturnType<typeof vi.fn>).mockReturnValue(
      jsonResponse({ token: 'jwt-1', operatorId: 'op-1', profileCompleted: true }),
    );
    renderLoginPage();

    fireEvent.click(screen.getByRole('tab', { name: /create account/i }));
    fireEvent.click(screen.getByRole('button', { name: /continue with google/i }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(requestBody().intent).toBe('register');
  });

  it('shows the "already registered" message when Create account rejects with 409', async () => {
    (signInWithGooglePopup as ReturnType<typeof vi.fn>).mockResolvedValue('the-id-token');
    (fetch as ReturnType<typeof vi.fn>).mockReturnValue(
      jsonResponse(
        { error: 'google_account_already_registered', message: 'This Google account is already registered. Please sign in instead.' },
        409,
      ),
    );
    renderLoginPage();

    fireEvent.click(screen.getByRole('tab', { name: /create account/i }));
    fireEvent.click(screen.getByRole('button', { name: /continue with google/i }));

    await waitFor(() =>
      expect(screen.getByText('This Google account is already registered. Please sign in instead.')).toBeInTheDocument(),
    );
  });

  it('shows the "no account found" message when Sign in rejects with 404', async () => {
    (signInWithGooglePopup as ReturnType<typeof vi.fn>).mockResolvedValue('the-id-token');
    (fetch as ReturnType<typeof vi.fn>).mockReturnValue(
      jsonResponse(
        { error: 'google_account_not_registered', message: 'No account found for this Google account. Please create an account first.' },
        404,
      ),
    );
    renderLoginPage();

    fireEvent.click(screen.getByRole('button', { name: /continue with google/i }));

    await waitFor(() =>
      expect(screen.getByText('No account found for this Google account. Please create an account first.')).toBeInTheDocument(),
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify the new ones fail**

Run: `cd frontend && npx vitest run components/auth/LoginPage.test.tsx`
Expected: the 4 new tests FAIL — `intent` is `undefined` in the sent body (or
the call throws, since `loginWithGoogle` doesn't accept a second arg yet), and
the two message tests see the old generic "Something went wrong..." text
instead of the specific message.

- [ ] **Step 3: Update `LoginPage.tsx`**

Add the `ApiError` import at the top of `frontend/components/auth/LoginPage.tsx` (after the existing imports, so after line 12):

```ts
import { ApiError } from '../../services/apiError';
```

Replace `handleGoogleClick` (lines 41-53):

```ts
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

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd frontend && npx vitest run components/auth/LoginPage.test.tsx`
Expected: PASS — all 6 tests.

- [ ] **Step 5: Run the full frontend typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors (this confirms Task 5's `loginWithGoogle`/`apiClient.auth.google` signature changes are now fully consumed).

- [ ] **Step 6: Commit**

```bash
git add frontend/components/auth/LoginPage.tsx frontend/components/auth/LoginPage.test.tsx
git commit -m "feat(auth): send Google auth intent per tab and surface reject messages"
```

---

### Task 7: Update `backend/CONTRACT.md`

**Files:**
- Modify: `backend/CONTRACT.md:14`

- [ ] **Step 1: Update the `/api/auth/google` row**

Replace line 14 in `backend/CONTRACT.md`:

```markdown
| POST | `/api/auth/google` | "Continue with Google" — body `{ idToken, intent }` (a Firebase ID token, and `"login"` or `"register"` matching the active tab) | `{ operatorId, token, profileCompleted }`, or 503 if Google sign-in isn't configured (no `FIREBASE_CREDENTIALS_JSON`), 401 on an invalid/expired token, 409 `google_account_already_registered` when `intent: "register"` targets an already-linked Google account, 404 `google_account_not_registered` when `intent: "login"` targets one that was never registered |
```

- [ ] **Step 2: Commit**

```bash
git add backend/CONTRACT.md
git commit -m "docs: document Google auth intent and its reject responses"
```

---

## Self-review notes

- **Spec coverage:** intent field + validation (Task 1), register-reject (Task 2), login-reject (Task 3), register-still-links-by-email (Task 4), frontend intent threading (Task 5), frontend tab-derived intent + error display + no-auto-switch (Task 6, and the design's "no auto-switch" is satisfied by leaving tab-switching code untouched), CONTRACT.md update (Task 7). All spec sections are covered.
- **Placeholder scan:** no TBD/TODO; every step has literal code and literal run commands with expected output.
- **Type consistency:** `intent: 'login' | 'register'` is the same literal union across `apiClient.ts`, `auth.tsx`, and `LoginPage.tsx`; `GoogleAuthRequest(String idToken, String intent)` and its accessor `req.intent()` are used consistently across all backend tasks; `ApiError.message`/`.code` usage matches the existing class in `frontend/services/apiError.ts` (read during brainstorming — `message` comes from `body.message`, `code` from `body.error`).
