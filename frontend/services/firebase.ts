/**
 * Thin wrapper around the Firebase JS SDK, kept isolated from auth.tsx so the
 * app's own session/context logic doesn't need to know anything about
 * Firebase specifics. Firebase is used purely to obtain a Google-signed ID
 * token client-side — the backend verifies that token and issues CeView's
 * own JWT (see AuthController#google); no Firestore, no Firebase-side data.
 */
import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signInWithPopup,
  type ConfirmationResult,
} from 'firebase/auth';

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
 * Opens the Google account picker in a popup and resolves with the signed-in
 * user's Firebase ID token, ready to send to POST /api/auth/google.
 * Rejects (e.g. popup closed by the user, blocked popup) exactly as the
 * underlying Firebase SDK call does — callers surface that via their own
 * error handling, matching how SignInForm/CreateAccountForm already do for
 * password login/register failures.
 */
export async function signInWithGooglePopup(): Promise<string> {
  const auth = getAuth(getFirebaseApp());
  const provider = new GoogleAuthProvider();
  // Without this, Google silently reuses the browser's existing Google
  // session instead of showing the account chooser — so a user could never
  // pick a different account without first signing out of Google entirely.
  provider.setCustomParameters({ prompt: 'select_account' });
  const result = await signInWithPopup(auth, provider);
  return result.user.getIdToken();
}

/** True when the Firebase web config is present, i.e. phone OTP can actually be sent. */
export function isFirebaseConfigured(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);
}

/**
 * SMS phone verification is opt-in: Firebase Phone Auth needs the paid Blaze plan, while
 * Google sign-in (the other Firebase use) does not. Off unless VITE_PHONE_VERIFICATION_ENABLED
 * is "true"; the backend's PHONE_VERIFICATION_ENABLED must match.
 */
export function isPhoneVerificationEnabled(): boolean {
  return isFirebaseConfigured() && import.meta.env.VITE_PHONE_VERIFICATION_ENABLED === 'true';
}

/**
 * Normalizes a Philippine mobile number to E.164: "09171234567" and "9171234567"
 * become "+639171234567"; anything already starting with "+" is kept (digits only).
 */
export function toE164PH(input: string): string {
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (trimmed.startsWith('+')) return `+${digits}`;
  if (digits.startsWith('63')) return `+${digits}`;
  if (digits.startsWith('0')) return `+63${digits.slice(1)}`;
  return `+63${digits}`;
}

let recaptcha: RecaptchaVerifier | null = null;

/**
 * Starts phone verification: renders an invisible reCAPTCHA into the element with
 * `recaptchaContainerId` and asks Firebase to text a 6-digit code to `e164`.
 */
export async function sendPhoneCode(e164: string, recaptchaContainerId: string): Promise<ConfirmationResult> {
  const auth = getAuth(getFirebaseApp());
  recaptcha?.clear();
  recaptcha = new RecaptchaVerifier(auth, recaptchaContainerId, { size: 'invisible' });
  try {
    return await signInWithPhoneNumber(auth, e164, recaptcha);
  } catch (err) {
    recaptcha.clear();
    recaptcha = null;
    throw err;
  }
}

/** Confirms the SMS code and resolves with a Firebase ID token carrying the verified phone_number claim. */
export async function confirmPhoneCode(confirmation: ConfirmationResult, code: string): Promise<string> {
  const result = await confirmation.confirm(code);
  return result.user.getIdToken();
}
