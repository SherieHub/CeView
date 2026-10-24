/**
 * Contact-number input with SMS-OTP verification (Firebase Phone Auth, see
 * services/firebase.ts). On success it reports the verified number plus a Firebase
 * ID token for the backend to check; the backend never trusts the typed number.
 *
 * Rate limits: Firebase enforces its own quotas, and we additionally cap sends client-side
 * (MAX_SENDS per SEND_WINDOW_MS per browser) with a resend cooldown.
 *
 * "Verify later": if SMS can't be sent (cap reached, quota/region/outage/captcha errors) the
 * user may continue with an unverified number; the backend records it as unverified.
 *
 * When SMS verification is off (VITE_PHONE_VERIFICATION_ENABLED unset, or Firebase not
 * configured), it degrades to a plain tel input that reports the raw number — mirroring the
 * backend's fallback.
 *
 * `variant="auth"` uses the LoginPage field styles (.cv-auth-*); `variant="card"` uses
 * the shared .field/.input styles from CompleteProfilePage.
 */
import { useEffect, useRef, useState } from 'react';
import type { ConfirmationResult } from 'firebase/auth';
import { Phone } from 'lucide-react';
import { confirmPhoneCode, isPhoneVerificationEnabled, sendPhoneCode, toE164PH } from '../../services/firebase';

export interface VerifiedPhone {
  contactNumber: string;
  /** Present only when the number was verified via Firebase; absent in the unconfigured fallback. */
  phoneIdToken?: string;
  /** The user skipped SMS verification because it was unavailable. */
  verifyLater?: boolean;
}

interface Props {
  id: string;
  variant: 'auth' | 'card';
  /** Called with the verified phone, or null whenever verification is (re)required. */
  onChange: (phone: VerifiedPhone | null) => void;
  /** Pre-fills the number (e.g. verifying an already-saved, unverified number). */
  initialNumber?: string;
  /** Offer "Verify later" when SMS is unavailable. Off where the user is already past signup. */
  allowLater?: boolean;
}

const RESEND_SECONDS = 30;
export const MAX_SENDS = 3;
export const SEND_WINDOW_MS = 60 * 60 * 1000;
const SENDS_KEY = 'cv.phoneVerify.sends';

/** Errors caused by what the user typed; anything else means SMS is unavailable right now. */
const USER_INPUT_ERRORS = new Set([
  'auth/invalid-phone-number',
  'auth/missing-phone-number',
  'auth/invalid-verification-code',
  'auth/missing-verification-code',
  'auth/code-expired',
]);

function errorCode(err: unknown): string {
  return (err as { code?: string } | null)?.code ?? '';
}

function recentSends(now: number): number[] {
  try {
    const raw = JSON.parse(localStorage.getItem(SENDS_KEY) ?? '[]') as unknown;
    return Array.isArray(raw) ? raw.filter((t): t is number => typeof t === 'number' && now - t < SEND_WINDOW_MS) : [];
  } catch {
    return [];
  }
}

function recordSend(now: number) {
  try {
    localStorage.setItem(SENDS_KEY, JSON.stringify([...recentSends(now), now]));
  } catch {
    /* storage unavailable: Firebase's own limits still apply */
  }
}

function friendlyError(err: unknown): string {
  const code = errorCode(err);
  if (code === 'auth/invalid-phone-number') return 'That phone number looks invalid.';
  if (code === 'auth/too-many-requests') return 'Too many attempts. Please try again later.';
  if (code === 'auth/invalid-verification-code') return 'That code is incorrect.';
  if (code === 'auth/code-expired') return 'That code has expired. Send a new one.';
  return 'Something went wrong. Please try again.';
}

export default function PhoneVerifyField({ id, variant, onChange, initialNumber = '', allowLater = true }: Props) {
  const firebaseOn = isPhoneVerificationEnabled();
  const [number, setNumber] = useState(initialNumber);
  const [code, setCode] = useState('');
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [later, setLater] = useState(false);
  const recaptchaId = `${id}-recaptcha`;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  function handleNumberChange(value: string) {
    setNumber(value);
    if (!firebaseOn) onChangeRef.current(value.trim() ? { contactNumber: value.trim() } : null);
  }

  async function handleSend() {
    setError(null);
    const now = Date.now();
    const sends = recentSends(now);
    if (sends.length >= MAX_SENDS) {
      const minutes = Math.max(1, Math.ceil((SEND_WINDOW_MS - (now - Math.min(...sends))) / 60000));
      setError(`You've requested too many codes. Try again in about ${minutes} min.`);
      setUnavailable(true);
      return;
    }
    setBusy(true);
    try {
      setConfirmation(await sendPhoneCode(toE164PH(number), recaptchaId));
      recordSend(now);
      setCode('');
      setCooldown(RESEND_SECONDS);
    } catch (err) {
      setError(USER_INPUT_ERRORS.has(errorCode(err)) ? friendlyError(err) : 'SMS verification is unavailable right now.');
      if (!USER_INPUT_ERRORS.has(errorCode(err))) setUnavailable(true);
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify() {
    if (!confirmation) return;
    setError(null);
    setBusy(true);
    try {
      const phoneIdToken = await confirmPhoneCode(confirmation, code.trim());
      setVerified(true);
      onChangeRef.current({ contactNumber: toE164PH(number), phoneIdToken });
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  function handleVerifyLater() {
    setLater(true);
    setConfirmation(null);
    setError(null);
    onChangeRef.current({ contactNumber: toE164PH(number), verifyLater: true });
  }

  function handleChangeNumber() {
    setLater(false);
    setUnavailable(false);
    setVerified(false);
    setConfirmation(null);
    setCode('');
    setCooldown(0);
    setError(null);
    onChangeRef.current(null);
  }

  const auth = variant === 'auth';
  const wrapClass = auth ? 'cv-auth-field cv-auth-field--wide' : 'field';
  const labelClass = auth ? undefined : 'field-label';
  const controlClass = auth ? 'cv-auth-control' : undefined;
  const inputClass = auth ? undefined : 'input';
  const btnClass = auth ? 'cv-auth-phone-btn' : 'btn-outline btn-outline--sm';
  const noteClass = auth ? 'cv-auth-phone-note' : 'body-xs';

  const numberInput = (
    <input
      id={id}
      type="tel"
      required
      value={number}
      disabled={verified || later || confirmation !== null}
      onChange={(e) => handleNumberChange(e.target.value)}
      placeholder={firebaseOn ? '09XX XXX XXXX' : undefined}
      className={inputClass}
    />
  );

  return (
    <div className={wrapClass}>
      <label htmlFor={id} className={labelClass}>
        Contact number
      </label>
      {controlClass ? (
        <div className={controlClass}>
          <Phone size={16} strokeWidth={1.75} aria-hidden="true" />
          {numberInput}
        </div>
      ) : (
        numberInput
      )}

      {firebaseOn && !verified && !later && !confirmation && (
        <button type="button" className={btnClass} onClick={handleSend} disabled={busy || !number.trim()}>
          Send code
        </button>
      )}

      {firebaseOn && !verified && !later && confirmation && (
        <>
          <label htmlFor={`${id}-code`} className={labelClass}>
            6-digit code
          </label>
          <div className={controlClass}>
            <input
              id={`${id}-code`}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className={inputClass}
            />
          </div>
          <div className={auth ? 'cv-auth-phone-actions' : undefined}>
            <button type="button" className={btnClass} onClick={handleVerify} disabled={busy || code.length !== 6}>
              Verify
            </button>
            <button type="button" className={btnClass} onClick={handleSend} disabled={busy || cooldown > 0}>
              {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
            </button>
            <button type="button" className={btnClass} onClick={handleChangeNumber} disabled={busy}>
              Change number
            </button>
          </div>
        </>
      )}

      {firebaseOn && verified && (
        <p className={noteClass} role="status">
          Number verified.{' '}
          <button type="button" className={btnClass} onClick={handleChangeNumber}>
            Change
          </button>
        </p>
      )}

      {firebaseOn && allowLater && unavailable && !verified && !later && (
        <p className={noteClass}>
          You can add your number now and verify it later.{' '}
          <button type="button" className={btnClass} onClick={handleVerifyLater} disabled={!number.trim()}>
            Verify later
          </button>
        </p>
      )}

      {firebaseOn && later && (
        <p className={noteClass} role="status">
          Number saved as unverified. You can verify it later.{' '}
          <button type="button" className={btnClass} onClick={handleChangeNumber}>
            Try verifying now
          </button>
        </p>
      )}

      {error && (
        <p className={noteClass} role="alert" style={{ color: 'var(--color-critical-text, #b42318)' }}>
          {error}
        </p>
      )}
      <div id={recaptchaId} />
    </div>
  );
}
