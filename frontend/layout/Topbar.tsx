/**
 * Topbar — a utility bar: the mobile sidebar toggle, notifications and the
 * account menu. No title of any kind.
 *
 * It used to render the route title and subtitle from NAV, and every screen
 * then stacked its own title block underneath — roughly 140px of chrome above
 * the fold spent saying the same thing twice, with an h1/h2 pair that read as
 * a hierarchy but wasn't one. Screens own their single <h1> via
 * layout/PageHead.tsx; the sidebar shows which route is active.
 *
 * Stays light and translucent against the dark sidebar: chrome meets canvas,
 * never another dark surface.
 */
import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, ChevronDown, LogOut, Menu, UserRound } from 'lucide-react';
import { useDismiss } from '../components/shared/useDismiss';
import { useAuth } from '../services/auth';
import { useProfile } from '../services/profileContext';

/** "Sunset Cove Beach Resort" -> "SC"; falls back to the email's first letters. */
function initials(name: string | null | undefined, email: string | null | undefined): string {
  const words = (name ?? '').split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (email ?? '').slice(0, 2).toUpperCase();
}

interface TopbarProps {
  onToggleSidebar?: () => void;
  /** Drives the burger's aria-expanded; the rail it controls is mobile-only. */
  sidebarOpen?: boolean;
}

export default function Topbar({ onToggleSidebar, sidebarOpen = false }: TopbarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const avatarRef = useRef<HTMLButtonElement>(null);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  useDismiss(menuRef, menuOpen, closeMenu, avatarRef);
  const { profile } = useProfile();
  // The signed-in user's name can be missing right after a reload (only the
  // token is restored), so the business profile's name is the fallback.
  const name = user?.businessName || profile.businessName || null;
  const who = name || user?.email || 'Your profile';
  const mono = initials(name, user?.email);

  return (
    <header className="app-topbar">
      <button
        type="button"
        onClick={onToggleSidebar}
        className="icon-btn md:hidden"
        // A stable name plus aria-expanded, rather than a name that flips
        // between "Open"/"Close" — that would collide with the veil's own
        // "Close menu" and give two controls the same accessible name.
        aria-label="Menu"
        aria-expanded={sidebarOpen}
        aria-controls="sb-rail"
      >
        <Menu size={20} aria-hidden="true" />
      </button>

      {/* No route label. It duplicated the screen's own <h1> two rows below
          and made the top of every page read as two headers stacked. The
          sidebar already shows which route is active. */}
      <div className="flex-1" />

      <button type="button" disabled aria-disabled className="icon-btn" title="Not wired yet">
        <Bell size={18} aria-hidden="true" />
        <span className="sr">Notifications</span>
      </button>
      {/* Account menu: who is signed in, View profile, Sign out. */}
      <div className="topbar-account" ref={menuRef}>
        <button
          ref={avatarRef}
          type="button"
          className="topbar-avatar"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label={`Account menu for ${who}`}
          onClick={() => setMenuOpen((o) => !o)}
        >
          {profile.imagePreview ? (
            <img className="topbar-avatar-img" src={profile.imagePreview} alt="" />
          ) : (
            mono || <UserRound size={18} strokeWidth={1.75} aria-hidden="true" />
          )}
          <span className="topbar-avatar-caret" aria-hidden="true">
            <ChevronDown size={11} strokeWidth={2.5} />
          </span>
        </button>
        {menuOpen && (
          <div className="topbar-menu" role="menu" aria-label="Account">
            <div className="topbar-menu-who">
              <b>{name || 'Your account'}</b>
              {user?.email && <span>{user.email}</span>}
            </div>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                closeMenu();
                navigate('/settings/profile');
              }}
            >
              <UserRound size={16} strokeWidth={1.75} aria-hidden="true" />
              View profile
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                closeMenu();
                logout();
              }}
            >
              <LogOut size={16} strokeWidth={1.75} aria-hidden="true" />
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
