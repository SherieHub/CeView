import React, { useState } from 'react';
import LoginPage from './LoginPage';
import RegisterPage from './RegisterPage';

/** Renders the login/register toggle for unauthenticated visitors. */
const AuthGate: React.FC = () => {
  const [mode, setMode] = useState<'login' | 'register'>('login');

  return mode === 'login' ? (
    <LoginPage onSwitchToRegister={() => setMode('register')} />
  ) : (
    <RegisterPage onSwitchToLogin={() => setMode('login')} />
  );
};

export default AuthGate;
