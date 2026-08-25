/**
 * Sidebar — sections + nav items from layout/nav.ts, active-route highlight,
 * Settings sub-tabs, identity footer. Ports ui-ux-prototype.html's buildNav().
 *
 * Runs the same chrome surface as the onboarding rail — see the shared
 * `.ob-rail, .sb-rail` rules in styles/index.css. That is a restoration rather
 * than a redesign: the prototype's own sidebar was dark chrome with a 3px
 * active left bar and a monogram (ui-ux-prototype.html:426-465); this file had
 * regressed it to flat white on the legacy cream/gold tokens.
 *
 * Active state is carried by `aria-current="page"`, which the CSS selects on,
 * rather than a conditional class. Screen readers get the right announcement
 * and there is only one thing to keep correct instead of two.
 *
 * Every destination is a peer row. The three Settings screens used to be an
 * indented sub-list under a "Settings" parent (originally behind a disclosure),
 * which gave them a second, quieter visual class and named the group twice —
 * the section label already says Settings. They are ordinary nav items now,
 * with their own icons, so they collapse to the icon rail like everything else.
 *
 * Collapsed, the rail drops to icons only. Labels stay in the DOM (visually
 * hidden, not removed) so the nav reads identically to a screen reader in
 * either state, and each control keeps a `title` for pointer users.
 */
import { useLocation, useNavigate } from 'react-router-dom';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { NAV } from './nav';
import { useAuth } from '../services/auth';

/** One size and weight for every glyph in the rail, including the toggle. */
const ICON = { size: 18, strokeWidth: 1.75 } as const;

interface SidebarProps {
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

export default function Sidebar({ collapsed = false, onToggleCollapsed }: SidebarProps) {
  const { user, logout } = useAuth();
  const { pathname: rawPath } = useLocation();
  const navigate = useNavigate();

  // The dev preview routes mount real screens under /preview/<route> (see
  // App.tsx). Without this the rail would show nothing as active while
  // reviewing a screen, which is exactly the chrome the preview exists to
  // show. import.meta.env.DEV is statically false in a production build, so
  // this collapses to `rawPath` there.
  const pathname =
    import.meta.env.DEV && rawPath.startsWith('/preview/')
      ? rawPath.slice('/preview'.length)
      : rawPath;

  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <nav className="sb-rail" id="sb-rail" aria-label="Main">
      <div className="sb-head">
        {/* Identity block — shares .ob-rail-mark's rules so the wordmark is
            pixel-identical to the one an operator just saw in onboarding. */}
        <div className="g">Ce</div>
        <div className="sb-head-text min-w-0">
          <b className="block leading-tight">CeView</b>
        </div>
        <button
          type="button"
          className="sb-toggle"
          onClick={onToggleCollapsed}
          aria-expanded={!collapsed}
          aria-controls="sb-rail"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ToggleIcon {...ICON} aria-hidden="true" />
          <span className="sr">{collapsed ? 'Expand sidebar' : 'Collapse sidebar'}</span>
        </button>
      </div>

      <ul className="sb-nav">
        {NAV.map((entry, i) => {
          if ('section' in entry) {
            return (
              <li key={`section-${i}`} className="sb-sec eyebrow" aria-hidden={collapsed}>
                {entry.section}
              </li>
            );
          }

          const Icon = entry.icon;
          const isActive = pathname.startsWith(entry.path);

          return (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() => navigate(entry.path)}
                className="sb-item"
                aria-current={isActive ? 'page' : undefined}
                title={collapsed ? entry.label : undefined}
              >
                <Icon {...ICON} aria-hidden="true" />
                <span className="sb-label">{entry.label}</span>
                {entry.badge != null && <span className="sb-badge">{entry.badge}</span>}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="sb-foot">
        <b className="sb-label">{user?.businessName ?? user?.email ?? 'Signed in'}</b>
        <button
          type="button"
          onClick={logout}
          className="sb-signout"
          title={collapsed ? 'Sign out' : undefined}
        >
          <span className="sb-label">Sign out</span>
          <span className="sb-signout-short" aria-hidden="true">
            ⏻
          </span>
        </button>
      </div>
    </nav>
  );
}
