import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './services/auth';

// Design System — Tailwind v4 @theme tokens + base/typography layer per the
// tourism-app-branding skill (.claude/skills/tourism-app-branding/SKILL.md),
// which is the single source of truth for colour, type, buttons and spacing.
// ui-ux-prototype.html remains authoritative for app flow and logic, not visuals.
// See styles/index.css for the full token list.
import './styles/index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <AuthProvider>
    <App />
  </AuthProvider>
);
