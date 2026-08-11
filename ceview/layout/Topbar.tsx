import React from 'react';
import { useLocation } from 'react-router-dom';
import { Menu, Search, Bell } from 'lucide-react';
import { resolveNavForPath } from './nav';

interface TopbarProps {
  onOpenMobileSidebar: () => void;
}

/**
 * Per-route title/subtitle sourced from the same NAV table as Sidebar
 * (ui-ux-prototype.html:1792-1803). Search/notification buttons are inert
 * for this Foundation card — real wiring is a later card.
 */
const Topbar: React.FC<TopbarProps> = ({ onOpenMobileSidebar }) => {
  const location = useLocation();
  const { item, subTab } = resolveNavForPath(location.pathname);

  return (
    <header className="topbar">
      <button type="button" className="burger" aria-label="Open menu" onClick={onOpenMobileSidebar}>
        <Menu />
      </button>
      <div className="topbar-title">
        <b>{item.title}</b>
        <span>{subTab ? subTab.label : item.sub}</span>
      </div>
      <div className="topbar-actions">
        <button type="button" className="icon-btn" aria-label="Search">
          <Search />
        </button>
        <button type="button" className="icon-btn" aria-label="Notifications">
          <Bell />
          <span className="dot" />
        </button>
      </div>
    </header>
  );
};

export default Topbar;
