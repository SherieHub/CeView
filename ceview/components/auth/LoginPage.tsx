import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LogIn, Mail, Lock, User, Phone, UserPlus } from 'lucide-react';
import { ApiError } from '../../services/apiClient';
import { useAuth } from '../../services/auth';
import PrimaryButton from '../shared/PrimaryButton';
import ServerErrorBanner from '../shared/ServerErrorBanner';

/**
 * Where to land after a successful login/register: back to whatever route
 * AuthGate bounced the user off of (state.from, set when redirecting an
 * unauthenticated visit to /login), or /dashboard by default. React Router
 * only re-renders on a URL change — flipping isAuthenticated alone doesn't
 * move off /login, so both forms below must navigate explicitly on success.
 */
interface LoginRedirectSource {
  pathname: string;
  search?: string;
}

function useLoginRedirectTarget(): string {
  const location = useLocation();
  const from = (location.state as { from?: LoginRedirectSource } | null)?.from;
  return from ? `${from.pathname}${from.search ?? ''}` : '/dashboard';
}

/**
 * Rewrite against the prototype's split brand/pane login layout
 * (ui-ux-prototype.html:900-959). Sign in / Create account now live as
 * tabs within a single page rather than two routes/components — only the
 * active tab's form is mounted, so form-field placeholders stay unique per
 * render (LoginPage.test.tsx / e2e login.spec.ts both rely on that).
 */
type AuthTab = 'login' | 'register';

const LoginPage: React.FC = () => {
  const [authTab, setAuthTab] = useState<AuthTab>('login');

  return (
    <div id="view-login">
      <aside className="login-brand">
        <div className="login-mark">
          <div className="login-mark-glyph">Ce</div>
          <div>
            <b style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-.02em', display: 'block', lineHeight: 1.1 }}>CeView</b>
            <span style={{ fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,.46)', fontWeight: 700 }}>
              Tourism Demand Intelligence
            </span>
          </div>
        </div>

        <div className="login-pitch">
          <h1>Know which market is <em>about to move</em> — before your competitors do.</h1>
          <p>
            CeView forecasts inbound-traveler demand surges into Cebu from Korea, Japan and the
            USA, then helps you draft, review and publish market-localized content around them.
          </p>
        </div>

        <div className="login-stats">
          <div className="login-stat"><b>3</b><span>Source markets tracked</span></div>
          <div className="login-stat"><b>12wk</b><span>Demand forecast horizon</span></div>
          <div className="login-stat"><b>2σ</b><span>Surge detection threshold</span></div>
        </div>
      </aside>

      <main className="login-pane">
        <div className="login-card">
          <div className="tabs" style={{ marginBottom: 'var(--sp-6)' }} role="tablist">
            <button
              type="button"
              className="tab"
              role="tab"
              aria-selected={authTab === 'login'}
              onClick={() => setAuthTab('login')}
            >
              Sign in
            </button>
            <button
              type="button"
              className="tab"
              role="tab"
              aria-selected={authTab === 'register'}
              onClick={() => setAuthTab('register')}
            >
              Create account
            </button>
          </div>

          {authTab === 'login' ? <SignInForm /> : <CreateAccountForm />}
        </div>
      </main>
    </div>
  );
};

const GoogleOAuthButton: React.FC = () => (
  <div style={{ marginTop: 'var(--sp-6)' }}>
    <button type="button" className="oauth-btn" disabled title="Google sign-in is not yet available">
      <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
        <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.9z" />
        <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24z" />
        <path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.6V6.7H1.4a12 12 0 0 0 0 10.8l4-3.1z" />
        <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.7l4 3.1C6.3 6.9 8.9 4.8 12 4.8z" />
      </svg>
      Continue with Google
    </button>
    <p className="body-xs" style={{ marginTop: 8, textAlign: 'center' }}>
      Firebase handles sign-in; CeView issues a JWT for the Spring Boot API.
    </p>
  </div>
);

const SignInForm: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const redirectTo = useLoginRedirectTarget();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await login(email, password);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      const ae = err instanceof ApiError ? err : null;
      setError(ae?.message || 'Invalid credentials. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <h2 className="h-lg">Sign In</h2>
      <p className="body-sm" style={{ marginTop: 5 }}>Welcome back. Enter your credentials to continue.</p>

      <GoogleOAuthButton />
      <div className="or-rule">OR</div>

      {error && <ServerErrorBanner message={error} onDismiss={() => setError(null)} />}

      <form onSubmit={handleSubmit} noValidate>
        <label className="field">
          <span className="field-label">Work email</span>
          <div style={{ position: 'relative' }}>
            <Mail size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
            <input
              className="input"
              style={{ paddingLeft: 36 }}
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
        </label>

        <label className="field">
          <span className="field-label">Password</span>
          <div style={{ position: 'relative' }}>
            <Lock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
            <input
              className="input"
              style={{ paddingLeft: 36 }}
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
        </label>

        <PrimaryButton type="submit" fullWidth isLoading={isLoading} icon={<LogIn size={16} />}>
          Sign In
        </PrimaryButton>
      </form>
    </>
  );
};

const CreateAccountForm: React.FC = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const redirectTo = useLoginRedirectTarget();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await register(firstName, lastName, email, password, contactNumber || undefined);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      const ae = err instanceof ApiError ? err : null;
      setError(ae?.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <h2 className="h-lg">Create Account</h2>
      <p className="body-sm" style={{ marginTop: 5 }}>Set up your operator profile to get started.</p>

      <GoogleOAuthButton />
      <div className="or-rule">OR</div>

      {error && <ServerErrorBanner message={error} onDismiss={() => setError(null)} />}

      <form onSubmit={handleSubmit} noValidate>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label className="field">
            <span className="field-label">First name</span>
            <div style={{ position: 'relative' }}>
              <User size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
              <input
                className="input"
                style={{ paddingLeft: 36 }}
                type="text"
                required
                autoComplete="given-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Juan"
              />
            </div>
          </label>
          <label className="field">
            <span className="field-label">Last name</span>
            <input
              className="input"
              type="text"
              required
              autoComplete="family-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Dela Cruz"
            />
          </label>
        </div>

        <label className="field">
          <span className="field-label">Work email</span>
          <div style={{ position: 'relative' }}>
            <Mail size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
            <input
              className="input"
              style={{ paddingLeft: 36 }}
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
        </label>

        <label className="field">
          <span className="field-label">Password</span>
          <div style={{ position: 'relative' }}>
            <Lock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
            <input
              className="input"
              style={{ paddingLeft: 36 }}
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
        </label>

        <label className="field">
          <span className="field-label">Contact number <span className="opt">(optional)</span></span>
          <div style={{ position: 'relative' }}>
            <Phone size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
            <input
              className="input"
              style={{ paddingLeft: 36 }}
              type="tel"
              autoComplete="tel"
              value={contactNumber}
              onChange={(e) => setContactNumber(e.target.value)}
              placeholder="+63 900 000 0000"
            />
          </div>
        </label>

        <PrimaryButton type="submit" fullWidth isLoading={isLoading} icon={<UserPlus size={16} />}>
          Create Account
        </PrimaryButton>
      </form>
    </>
  );
};

export default LoginPage;
