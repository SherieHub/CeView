/**
 * Topbar — per-route title/subtitle from the same NAV table as Sidebar,
 * burger (mobile sidebar toggle), inert notification/search buttons.
 */
import { useLocation } from 'react-router-dom';
import { Bell, Menu, Search } from 'lucide-react';
import { navItemById } from './nav';
import type { NavId } from './nav';

interface TopbarProps {
  onToggleSidebar?: () => void;
}

function navIdFromPath(pathname: string): NavId {
  const seg = pathname.split('/')[1];
  if (seg === 'dashboard' || seg === 'content' || seg === 'calendar' || seg === 'performance' || seg === 'settings') {
    return seg;
  }
  return 'dashboard';
}

export default function Topbar({ onToggleSidebar }: TopbarProps) {
  const { pathname } = useLocation();
  const active = navItemById(navIdFromPath(pathname));

  return (
    <header className="flex h-16 items-center gap-4 border-b border-line bg-panel px-6">
      <button type="button" onClick={onToggleSidebar} className="md:hidden" aria-label="Toggle sidebar">
        <Menu size={20} />
      </button>

      <div className="topbar-title flex-1">
        <h1 className="heading-md"><b>{active?.title ?? 'CeView'}</b></h1>
        {active?.sub && <p className="body-xs">{active.sub}</p>}
      </div>

      <button type="button" disabled aria-disabled className="opacity-50" title="Not wired yet">
        <Search size={18} />
      </button>
      <button type="button" disabled aria-disabled className="opacity-50" title="Not wired yet">
        <Bell size={18} />
      </button>
    </header>
  );
}
