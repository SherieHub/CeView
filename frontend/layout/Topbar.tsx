/**
 * Topbar — a utility bar: the mobile sidebar toggle and the search/
 * notification controls. No title of any kind.
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
import { Bell, Menu, Search } from 'lucide-react';

interface TopbarProps {
  onToggleSidebar?: () => void;
  /** Drives the burger's aria-expanded; the rail it controls is mobile-only. */
  sidebarOpen?: boolean;
}

export default function Topbar({ onToggleSidebar, sidebarOpen = false }: TopbarProps) {
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
        <Search size={18} aria-hidden="true" />
        <span className="sr">Search</span>
      </button>
      <button type="button" disabled aria-disabled className="icon-btn" title="Not wired yet">
        <Bell size={18} aria-hidden="true" />
        <span className="sr">Notifications</span>
      </button>
    </header>
  );
}
