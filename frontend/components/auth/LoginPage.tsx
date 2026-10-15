/**
 * Split sign-in / create-account screen: a full-height Cebu photo panel with
 * the brand promise on the left, the form card on the right. Google Sign-In
 * uses the Firebase JS SDK client-side (services/firebase.ts) to get an ID
 * token, which the backend verifies before minting the same session shape as
 * password login/register (see services/apiClient.ts's auth.google).
 *
 * Styles: styles/auth.css (.cv-auth-*).
 */
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ChartColumnIncreasing, Clock, Lock, Mail, MapPin, Phone, UserRound, type LucideIcon } from 'lucide-react';
import '@fontsource-variable/fraunces/opsz.css';
import '@fontsource-variable/fraunces/opsz-italic.css';
import { useAuth } from '../../services/auth';
import { signInWithGooglePopup } from '../../services/firebase';
import { ApiError } from '../../services/apiError';
import { LandingImage } from '../landing/ui';
import { BrandMark } from '../landing/LandingNav';

const HIGHLIGHTS: [LucideIcon, string, string][] = [
  [ChartColumnIncreasing, 'Smarter', 'insights'],
  [MapPin, 'Local', 'relevance'],
  [Clock, 'Plan', 'ahead'],
];

/** Google "G" mark (decorative; the button text names the action). */
function GoogleMark() {
  return (
    <svg className="cv-auth-google-mark" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

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

  const signin = mode === 'signin';

  return (
    <div className="cv-auth">
      {/* Brand panel — Cebu photo under a deep-teal fade, promise and highlights. */}
      <section className="cv-auth-brand" aria-label="CeView">
        <div className="cv-auth-brand-media" aria-hidden="true">
          <LandingImage slot="challenge-aerial-boats" fill priority decorative sizes="(min-width: 768px) 55vw, 100vw" />
        </div>
        <BrandMark tone="light" />
        <div className="cv-auth-brand-copy">
          <h1 className="cv-auth-title">
            Know the surge <em>before</em> it lands.
          </h1>
          <span className="cv-auth-rule" aria-hidden="true" />
          <p className="cv-auth-lede">
            Get demand forecasting and market-localized insights to help your Cebu tourism business attract
            the right travelers, create relevant content, and plan ahead with confidence.
          </p>
        </div>
        <ul className="cv-auth-highlights">
          {HIGHLIGHTS.map(([Icon, a, b]) => (
            <li key={a}>
              <Icon size={22} strokeWidth={1.75} aria-hidden="true" />
              <span>
                {a}
                <br />
                {b}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Form pane — pale mint canvas with the sign-in card. */}
      <main className="cv-auth-pane">
        <div className="cv-auth-card">
          <BrandMark />
          <h2 className="cv-auth-heading">{signin ? 'Welcome back' : 'Create your account'}</h2>
          <p className="cv-auth-sub">
            {signin ? 'Sign in to your CeView account' : 'Start seeing traveler demand for your Cebu business'}
          </p>

          <div className="cv-auth-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'signin'}
              aria-pressed={mode === 'signin'}
              onClick={() => setMode('signin')}
            >
              Sign in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'signup'}
              aria-pressed={mode === 'signup'}
              onClick={() => setMode('signup')}
            >
              Create account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="cv-auth-form">
            {mode === 'signup' && (
              <div className="cv-auth-name-row">
                <div className="cv-auth-field">
                  <label htmlFor="login-first-name">First name</label>
                  <div className="cv-auth-control">
                    <UserRound size={16} strokeWidth={1.75} aria-hidden="true" />
                    <input
                      id="login-first-name"
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                    />
                  </div>
                </div>
                <div className="cv-auth-field">
                  <label htmlFor="login-last-name">Last name</label>
                  <div className="cv-auth-control">
                    <UserRound size={16} strokeWidth={1.75} aria-hidden="true" />
                    <input
                      id="login-last-name"
                      type="text"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                    />
                  </div>
                </div>
                <div className="cv-auth-field cv-auth-field--wide">
                  <label htmlFor="login-contact-number">Contact number</label>
                  <div className="cv-auth-control">
                    <Phone size={16} strokeWidth={1.75} aria-hidden="true" />
                    <input
                      id="login-contact-number"
                      type="tel"
                      required
                      value={contactNumber}
                      onChange={(e) => setContactNumber(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}
            <div className="cv-auth-field">
              <label htmlFor="login-email">Email</label>
              <div className="cv-auth-control">
                <Mail size={16} strokeWidth={1.75} aria-hidden="true" />
                <input
                  id="login-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
            </div>
            <div className="cv-auth-field">
              <label htmlFor="login-password">Password</label>
              <div className="cv-auth-control">
                <Lock size={16} strokeWidth={1.75} aria-hidden="true" />
                <input
                  id="login-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
            </div>
            {error && (
              <p className="cv-auth-error" role="alert">
                {error}
              </p>
            )}
            <button type="submit" disabled={submitting} className="cv-auth-submit">
              {signin ? 'Sign in' : 'Create account'}
              <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
            </button>
          </form>

          <p className="cv-auth-divider">
            <span>or continue with</span>
          </p>

          <button type="button" onClick={handleGoogleClick} disabled={googleSubmitting} className="cv-auth-google">
            <GoogleMark />
            {googleSubmitting ? 'Signing in…' : 'Continue with Google'}
          </button>

          <p className="cv-auth-switch">
            {signin ? 'Don’t have an account?' : 'Already have an account?'}{' '}
            <button type="button" onClick={() => setMode(signin ? 'signup' : 'signin')}>
              {signin ? 'Create account' : 'Sign in'}
            </button>
          </p>
        </div>
      </main>
    </div>
  );
}
