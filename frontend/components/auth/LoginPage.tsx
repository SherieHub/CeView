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
      <div className="flex flex-col justify-between bg-navy p-10 text-white">
        <div className="eyebrow text-skyblue">CeView</div>
        <div>
          <h1 className="h-xl mb-3">Know the surge before it lands.</h1>
          <p className="body-sm text-navy-muted">
            Demand forecasting and market-localized content for Cebu's tourism businesses.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[
            ['21', 'category × market signals'],
            ['3', 'tracked source markets'],
            ['24/7', 'surge monitoring'],
          ].map(([stat, label]) => (
            <div key={label}>
              <div className="h-lg num text-gold">{stat}</div>
              <div className="body-xs text-navy-muted">{label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-center p-10">
        <div className="w-full max-w-sm">
          <div className="tabs mb-6 flex gap-2 rounded-full bg-panel-sunk p-1" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'signin'}
              onClick={() => setMode('signin')}
              className="h-sm flex-1 rounded-full py-2"
              data-active={mode === 'signin'}
              style={mode === 'signin' ? { background: 'var(--color-panel)', boxShadow: 'var(--shadow-1)' } : undefined}
            >
              Sign in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'signup'}
              onClick={() => setMode('signup')}
              className="h-sm flex-1 rounded-full py-2"
              data-active={mode === 'signup'}
              style={mode === 'signup' ? { background: 'var(--color-panel)', boxShadow: 'var(--shadow-1)' } : undefined}
            >
              Create account
            </button>
          </div>

          <h2 className="h-lg mb-4">{mode === 'signin' ? 'Sign In' : 'Create Account'}</h2>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {mode === 'signup' && (
              <>
                <label className="flex flex-col gap-1">
                  <span className="body-xs">First name</span>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="rounded-md border border-line px-3 py-2"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="body-xs">Last name</span>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="rounded-md border border-line px-3 py-2"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="body-xs">Contact number</span>
                  <input
                    type="tel"
                    required
                    value={contactNumber}
                    onChange={(e) => setContactNumber(e.target.value)}
                    className="rounded-md border border-line px-3 py-2"
                  />
                </label>
              </>
            )}
            <label className="flex flex-col gap-1">
              <span className="body-xs">Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-md border border-line px-3 py-2"
                placeholder="you@example.com"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="body-xs">Password</span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-md border border-line px-3 py-2"
                placeholder="••••••••"
              />
            </label>
            {error && <p className="body-xs text-critical">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="rounded-full bg-gold py-2.5 font-bold text-navy disabled:opacity-60"
            >
              {mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <button
            type="button"
            onClick={handleGoogleClick}
            disabled={googleSubmitting}
            className="body-sm mt-4 w-full rounded-full border border-line py-2.5 disabled:opacity-60"
          >
            {googleSubmitting ? 'Signing in…' : 'Continue with Google'}
          </button>
        </div>
      </div>
    </div>
  );
}
