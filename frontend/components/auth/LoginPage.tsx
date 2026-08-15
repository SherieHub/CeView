/**
 * Split brand/pane login screen — ports ui-ux-prototype.html:900–959 (brand
 * panel with stat tiles + Sign in/Create account tabs). Google OAuth button
 * is inert (no provider wired yet) per this card's scope.
 */
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../../services/auth';

export default function LoginPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'signin') await login(email, password);
      else await register(email, password);
    } catch {
      setError('Something went wrong. Check your details and try again.');
    } finally {
      setSubmitting(false);
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
          <div className="tabs mb-6 flex gap-2 rounded-full bg-panel-sunk p-1">
            <button
              type="button"
              onClick={() => setMode('signin')}
              className="h-sm flex-1 rounded-full py-2"
              data-active={mode === 'signin'}
              style={mode === 'signin' ? { background: 'var(--color-panel)', boxShadow: 'var(--shadow-1)' } : undefined}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setMode('signup')}
              className="h-sm flex-1 rounded-full py-2"
              data-active={mode === 'signup'}
              style={mode === 'signup' ? { background: 'var(--color-panel)', boxShadow: 'var(--shadow-1)' } : undefined}
            >
              Create account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1">
              <span className="body-xs">Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-md border border-line px-3 py-2"
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
            disabled
            aria-disabled
            className="body-sm mt-4 w-full rounded-full border border-line py-2.5 opacity-60"
            title="Google OAuth not wired yet"
          >
            Continue with Google
          </button>
        </div>
      </div>
    </div>
  );
}
