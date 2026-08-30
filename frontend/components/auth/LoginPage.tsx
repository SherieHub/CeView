/**
 * Split brand/pane login screen — ports ui-ux-prototype.html:900–959 (brand
 * panel with stat tiles + Sign in/Create account tabs). Google Sign-In uses
 * the Firebase JS SDK client-side (services/firebase.ts) to get an ID token,
 * which the backend verifies before minting the same session shape as
 * password login/register (see services/apiClient.ts's auth.google).
 */
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../services/auth';
import { signInWithGooglePopup } from '../../services/firebase';

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
      await loginWithGoogle(idToken);
      navigate('/dashboard', { replace: true });
    } catch {
      setError('Something went wrong signing in with Google. Please try again.');
    } finally {
      setGoogleSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-2">
      {/* Brand panel — dark chrome, same surface language as .ob-rail/.sb-rail. */}
      <div
        className="flex flex-col justify-between p-10"
        style={{ background: 'var(--gradient-chrome)', color: 'var(--color-text-inverse)' }}
      >
        <div className="eyebrow" style={{ color: 'var(--color-text-accent)' }}>
          CeView
        </div>
        <div>
          <h1 className="heading-hero mb-3">Know the surge before it lands.</h1>
          <p className="body-sm" style={{ color: 'var(--color-text-inverse-muted)' }}>
            Demand forecasting and market-localized content for Cebu's tourism businesses.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[
            ['21', 'category × market signals'],
            ['3', 'tracked source markets'],
            ['24/7', 'surge monitoring'],
          ].map(([stat, label]) => (
            <div
              key={label}
              className="rounded-md p-3"
              style={{ background: 'var(--chrome-raised)', borderTop: '1px solid var(--chrome-line)' }}
            >
              <div className="heading-md num" style={{ color: 'var(--color-text-inverse)' }}>
                {stat}
              </div>
              <div className="body-xs" style={{ color: 'var(--color-text-inverse-muted)' }}>
                {label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Form pane — pale mint canvas. */}
      <div className="flex items-center justify-center p-10" style={{ background: 'var(--gradient-canvas)' }}>
        <div className="w-full max-w-sm">
          <div className="seg mb-6 w-full" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'signin'}
              aria-pressed={mode === 'signin'}
              onClick={() => setMode('signin')}
              className="flex-1"
            >
              Sign in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'signup'}
              aria-pressed={mode === 'signup'}
              onClick={() => setMode('signup')}
              className="flex-1"
            >
              Create account
            </button>
          </div>

          <h2 className="heading-lg mb-4">{mode === 'signin' ? 'Sign In' : 'Create Account'}</h2>

          <form onSubmit={handleSubmit}>
            {mode === 'signup' && (
              <div className="field">
                <div className="flex flex-col gap-3">
                  <div>
                    <label className="field-label" htmlFor="login-first-name">
                      First name
                    </label>
                    <input
                      id="login-first-name"
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="field-label" htmlFor="login-last-name">
                      Last name
                    </label>
                    <input
                      id="login-last-name"
                      type="text"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="field-label" htmlFor="login-contact-number">
                      Contact number
                    </label>
                    <input
                      id="login-contact-number"
                      type="tel"
                      required
                      value={contactNumber}
                      onChange={(e) => setContactNumber(e.target.value)}
                      className="input"
                    />
                  </div>
                </div>
              </div>
            )}
            <div className="field">
              <label className="field-label" htmlFor="login-email">
                Email
              </label>
              <input
                id="login-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="you@example.com"
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="login-password">
                Password
              </label>
              <input
                id="login-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="••••••••"
              />
            </div>
            {error && (
              <p className="body-xs mb-3" role="alert" style={{ color: 'var(--color-critical-text)' }}>
                {error}
              </p>
            )}
            <button type="submit" disabled={submitting} className="btn-primary w-full">
              {mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <button
            type="button"
            onClick={handleGoogleClick}
            disabled={googleSubmitting}
            className="btn-outline mt-4 w-full"
          >
            {googleSubmitting ? 'Signing in…' : 'Continue with Google'}
          </button>
        </div>
      </div>
    </div>
  );
}
