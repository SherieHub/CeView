import React, { useState } from 'react';
import { UserPlus, Mail, Lock, User, Phone } from 'lucide-react';
import { COLORS } from '../../constants';
import { useAuth } from '../../services/auth';
import PrimaryButton from '../shared/PrimaryButton';
import ServerErrorBanner from '../shared/ServerErrorBanner';

interface RegisterPageProps {
  onSwitchToLogin: () => void;
}

const RegisterPage: React.FC<RegisterPageProps> = ({ onSwitchToLogin }) => {
  const { register } = useAuth();
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
    } catch (err: any) {
      setError(err?.message || 'Registration failed. Please try again.');
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
          <h2 className="text-xl font-black mb-1" style={{ color: COLORS.NAVY }}>Create Account</h2>
          <p className="text-sm mb-6" style={{ color: COLORS.TEXT_MUTED }}>
            Set up your operator profile to get started.
          </p>

          {error && <ServerErrorBanner message={error} onDismiss={() => setError(null)} />}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-black uppercase tracking-wider block mb-1.5" style={{ color: COLORS.TEXT_MUTED }}>
                  First Name
                </label>
                <div className="relative">
                  <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: COLORS.TEXT_MUTED }} />
                  <input
                    type="text"
                    required
                    autoComplete="given-name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Juan"
                    className="w-full pl-9 pr-3 py-3 rounded-xl border text-sm font-semibold focus:outline-none"
                    style={{ borderColor: COLORS.LIGHT_GREY, color: COLORS.TEXT_MAIN }}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-black uppercase tracking-wider block mb-1.5" style={{ color: COLORS.TEXT_MUTED }}>
                  Last Name
                </label>
                <input
                  type="text"
                  required
                  autoComplete="family-name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Dela Cruz"
                  className="w-full px-3 py-3 rounded-xl border text-sm font-semibold focus:outline-none"
                  style={{ borderColor: COLORS.LIGHT_GREY, color: COLORS.TEXT_MAIN }}
                />
              </div>
            </div>

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
                  className="w-full pl-9 pr-3 py-3 rounded-xl border text-sm font-semibold focus:outline-none"
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
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-3 rounded-xl border text-sm font-semibold focus:outline-none"
                  style={{ borderColor: COLORS.LIGHT_GREY, color: COLORS.TEXT_MAIN }}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-black uppercase tracking-wider block mb-1.5" style={{ color: COLORS.TEXT_MUTED }}>
                Contact Number <span className="normal-case font-medium">(optional)</span>
              </label>
              <div className="relative">
                <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: COLORS.TEXT_MUTED }} />
                <input
                  type="tel"
                  autoComplete="tel"
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  placeholder="+63 900 000 0000"
                  className="w-full pl-9 pr-3 py-3 rounded-xl border text-sm font-semibold focus:outline-none"
                  style={{ borderColor: COLORS.LIGHT_GREY, color: COLORS.TEXT_MAIN }}
                />
              </div>
            </div>

            <PrimaryButton type="submit" fullWidth isLoading={isLoading} icon={<UserPlus size={16} />}>
              Create Account
            </PrimaryButton>
          </form>

          <p className="text-center text-xs font-medium mt-6" style={{ color: COLORS.TEXT_MUTED }}>
            Already have an account?{' '}
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="font-black hover:opacity-80 transition-opacity"
              style={{ color: COLORS.NAVY }}
            >
              Sign in
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
