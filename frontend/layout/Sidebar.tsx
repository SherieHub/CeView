/**
 * Sidebar — sections + nav items from layout/nav.ts, active-route highlight,
 * expandable Settings sub-tabs, footer identity block. Ports
 * ui-ux-prototype.html's buildNav()/toggleSbSettingsExpand().
 */
import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { NAV } from './nav';
import { useAuth } from '../services/auth';

const SETTINGS_TABS = [
  { tab: 'profile', label: 'Business Profile' },
  { tab: 'platforms', label: 'Platforms' },
  { tab: 'workspace', label: 'Workspace' },
];

export default function Sidebar() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { user, logout } = useAuth();

  return (
    <nav className="flex h-full w-[var(--sidebar-w)] flex-col border-r border-line bg-panel">
      <div className="eyebrow px-5 py-6 text-navy">CeView</div>

      <ul className="flex-1 overflow-y-auto px-3">
        {NAV.map((entry, i) => {
          if ('section' in entry) {
            return (
              <li key={`section-${i}`} className="sb-sec eyebrow px-2 pb-1 pt-4 first:pt-0">
                {entry.section}
              </li>
            );
          }

          const Icon = entry.icon;
          const isSettings = entry.id === 'settings';

          return (
            <li key={entry.id}>
              {isSettings ? (
                <button
                  type="button"
                  onClick={() => setSettingsOpen((o) => !o)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-panel-sunk"
                  aria-expanded={settingsOpen}
                >
                  <Icon size={16} />
                  <span className="h-sm flex-1">{entry.label}</span>
                  <ChevronDown size={14} className={settingsOpen ? 'rotate-180' : ''} />
                </button>
              ) : (
                <NavLink
                  to={`/${entry.id}`}
                  className={({ isActive }) =>
                    `flex items-center gap-2 rounded-md px-2 py-2 hover:bg-panel-sunk ${
                      isActive ? 'bg-gold-wash text-navy' : ''
                    }`
                  }
                >
                  <Icon size={16} />
                  <span className="h-sm flex-1">{entry.label}</span>
                  {entry.badge != null && (
                    <span className="rounded-full bg-critical px-1.5 text-[10px] font-bold text-white">
                      {entry.badge}
                    </span>
                  )}
                </NavLink>
              )}

              {isSettings && settingsOpen && (
                <ul className="ml-6 border-l border-line pl-2">
                  {SETTINGS_TABS.map((s) => (
                    <li key={s.tab}>
                      <NavLink
                        to={`/settings/${s.tab}`}
                        className={({ isActive }) =>
                          `body-sm block rounded-md px-2 py-1.5 hover:bg-panel-sunk ${isActive ? 'text-navy font-semibold' : ''}`
                        }
                      >
                        {s.label}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      <div className="border-t border-line px-5 py-4">
        <div className="h-sm truncate">{user?.businessName ?? user?.email ?? 'Signed in'}</div>
        <button type="button" onClick={logout} className="body-xs text-muted underline">
          Sign out
        </button>
      </div>
    </nav>
  );
}
