/**
 * Thin wrapper around the Firebase JS SDK, kept isolated from auth.tsx so the
 * app's own session/context logic doesn't need to know anything about
 * Firebase specifics. Firebase is used purely to obtain a Google-signed ID
 * token client-side — the backend verifies that token and issues CeView's
 * own JWT (see AuthController#google); no Firestore, no Firebase-side data.
 */
import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

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
