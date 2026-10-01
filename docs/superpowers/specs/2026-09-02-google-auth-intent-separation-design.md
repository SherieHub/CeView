# Google auth intent separation — design

## Problem

`POST /api/auth/google` currently does a single find-or-create regardless of which
tab the user clicked "Continue with Google" from. The frontend's Sign in / Create
account tabs are purely cosmetic for the Google path — both send the exact same
request and both silently succeed whether or not an operator already exists for
that Google account. This means:

- Creating an account with a Google identity that's already registered silently
  logs the user into their existing account instead of telling them it's already
  taken.
- Signing in with a Google identity that has never been registered silently
  provisions a brand-new account instead of telling the user to register first.

## Goal

Make the two tabs behave symmetrically and honestly:

- **Create account** tab: succeeds only if this is genuinely a new operator (no
  existing operator already linked to this Google account). Rejects if the
  Google account was already used to register.
- **Sign in** tab: succeeds only if an operator already exists for this identity
  (by Google UID, or by verified email match to a password-based account, which
  also links the Google UID). Rejects if no such operator exists.

## Non-goals

- No change to password-based `/register` or `/login`.
- No change to the profile-completion flow (`ProfileCompletionFilter`,
  `/api/auth/profile`).
- No UI redesign — same two-tab form, same Google button; only the click
  behavior and error messaging change.
- No auto-switching tabs on rejection — the user stays on the tab they clicked
  from and reads the inline error.

## Backend design

### Request shape

`AuthController.GoogleAuthRequest` gains a required `intent` field:

```java
public record GoogleAuthRequest(@NotBlank String idToken, @NotBlank String intent) {}
```

`intent` must be exactly `"login"` or `"register"`; anything else is a 400
(validated in the handler — a plain string field keeps the record simple, no new
enum type needed for two values).

### Branching logic in `/api/auth/google`

After decoding the Firebase token (unchanged) and looking up
`repo.findByGoogleUid(googleUid)`:

**`intent == "register"`:**
- If a googleUid match already exists → **409 Conflict**,
  `{"error": "google_account_already_registered", "message": "This Google account is already registered. Please sign in instead."}`.
  No session is issued.
- Otherwise, proceed exactly as the current find-or-create body does: if a
  verified-email match exists, link this googleUid to that operator and issue a
  session (this is the "already has a password account" case — treated as a
  successful login/link, not a rejection, per design discussion). Otherwise,
  provision a brand-new operator from the Google profile and issue a session.

**`intent == "login"`:**
- If there's no googleUid match **and** no verified-email match → **404 Not
  Found**, `{"error": "google_account_not_registered", "message": "No account found for this Google account. Please create an account first."}`.
  No session is issued.
- Otherwise, proceed as today: return the existing operator's session (googleUid
  match), or link-by-email and return a session.

The existing email-link logic (`decoded.isEmailVerified() && email != null` →
`repo.findByEmail`) is unchanged — it's just now reached only in the cases above
that don't short-circuit into a rejection.

### Response shape

Success responses are unchanged (`sessionResponse`). Error responses now include
both `error` (a stable slug, consumed by `ApiError.code`) and `message` (a
user-facing sentence, consumed by `ApiError.message`) — the existing `/google`
error path only sets `error`; this is extended, not replaced, so the
`ApiError.code` contract other callers rely on doesn't change.

## Frontend design

### `services/apiClient.ts`

`auth.google` takes an `intent: 'login' | 'register'` parameter and sends it in
the request body:

```ts
google: (idToken: string, intent: 'login' | 'register') =>
  USE_FIXTURES
    ? delay({ ... })
    : request<{ token: string; operatorId: string; profileCompleted: boolean }>('/api/auth/google', {
        method: 'POST',
        body: JSON.stringify({ idToken, intent }),
      }).then(...)
```

### `services/auth.tsx`

`loginWithGoogle` takes and forwards the same `intent` parameter to
`apiClient.auth.google`.

### `components/auth/LoginPage.tsx`

`handleGoogleClick` derives intent from the active tab:

```ts
const intent = mode === 'signup' ? 'register' : 'login';
await loginWithGoogle(idToken, intent);
```

Error handling changes from a hardcoded generic string to reading the thrown
error's message when it's an `ApiError` with one:

```ts
catch (err) {
  setError(err instanceof ApiError && err.message ? err.message : 'Something went wrong signing in with Google. Please try again.');
}
```

(`ApiError` is already imported by other module error-handling call sites in
this codebase; `LoginPage.tsx` will import it from `../../services/apiError`.)

No tab auto-switch on rejection — the user reads the inline error and switches
tabs manually if needed, consistent with how password-based errors already
behave on this screen.

## Testing

- **Backend** (`AuthController` test, wherever the existing Google auth tests
  live — likely `backend/spring-boot/src/test/java/com/ceview/auth/`):
  - `register` intent + existing googleUid → 409 with the expected body, no
    session issued.
  - `register` intent + no googleUid match + existing verified-email match →
    still links and issues a session (unchanged behavior, now explicitly
    covered under the new branch).
  - `register` intent + no match at all → still provisions a new operator
    (unchanged).
  - `login` intent + no googleUid match + no email match → 404 with the
    expected body, no session issued.
  - `login` intent + existing googleUid → still returns a session (unchanged).
  - `login` intent + no googleUid match + existing verified-email match → still
    links and returns a session (unchanged).
  - Missing/invalid `intent` value → 400.

- **Frontend** (`components/auth/LoginPage.test.tsx`):
  - Clicking "Continue with Google" on the Sign in tab sends
    `intent: "login"`.
  - Clicking "Continue with Google" on the Create account tab sends
    `intent: "register"`.
  - A 409 response renders the "already registered" message inline.
  - A 404 response renders the "no account found" message inline.
