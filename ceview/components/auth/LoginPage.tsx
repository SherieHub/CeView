import React, { useState } from 'react';
import { LogIn, Mail, Lock } from 'lucide-react';
import { COLORS } from '../../constants';
import { ApiError } from '../../services/apiClient';
import { useAuth } from '../../services/auth';
import PrimaryButton from '../shared/PrimaryButton';
import ServerErrorBanner from '../shared/ServerErrorBanner';

interface LoginPageProps {
  onSwitchToRegister: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onSwitchToRegister }) => {
  const { login } = useAuth();
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
    } catch (err) {
      const ae = err instanceof ApiError ? err : null;
      setError(ae?.message || 'Invalid credentials. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: COLORS.OFF_WHITE }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold tracking-tight" style={{ color: COLORS.NAVY }}>
            Ce<span style={{ color: COLORS.GOLD }}>View</span>
          </h1>
          <p className="text-sm font-medium mt-2" style={{ color: COLORS.TEXT_MUTED }}>
            Demand Stabilization Engine
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 md:p-8">
          <h2 className="text-xl font-black mb-1" style={{ color: COLORS.NAVY }}>Sign In</h2>
          <p className="text-sm mb-6" style={{ color: COLORS.TEXT_MUTED }}>
            Welcome back. Enter your credentials to continue.
          </p>

          {error && <ServerErrorBanner message={error} onDismiss={() => setError(null)} />}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label className="text-xs font-black uppercase tracking-wider block mb-1.5" style={{ color: COLORS.TEXT_MUTED }}>
                Email
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: COLORS.TEXT_MUTED }} />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-9 pr-3 py-3 rounded-xl border text-sm font-semibold focus:outline-none focus:ring-2"
                  style={{ borderColor: COLORS.LIGHT_GREY, color: COLORS.TEXT_MAIN }}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-black uppercase tracking-wider block mb-1.5" style={{ color: COLORS.TEXT_MUTED }}>
                Password
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: COLORS.TEXT_MUTED }} />
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-3 rounded-xl border text-sm font-semibold focus:outline-none focus:ring-2"
                  style={{ borderColor: COLORS.LIGHT_GREY, color: COLORS.TEXT_MAIN }}
                />
              </div>
            </div>

            <PrimaryButton type="submit" fullWidth isLoading={isLoading} icon={<LogIn size={16} />}>
              Sign In
            </PrimaryButton>
          </form>

          <p className="text-center text-xs font-medium mt-6" style={{ color: COLORS.TEXT_MUTED }}>
            Don't have an account?{' '}
            <button
              type="button"
              onClick={onSwitchToRegister}
              className="font-black hover:opacity-80 transition-opacity"
              style={{ color: COLORS.NAVY }}
            >
              Create one
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
