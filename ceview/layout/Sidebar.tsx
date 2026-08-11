import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, LogOut } from 'lucide-react';
import { NAV } from './nav';
import { useAuth } from '../services/auth';
import { useProfile } from '../services/profileContext';

interface SidebarProps {
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

/**
 * Rewrite against the NAV table (ui-ux-prototype.html:1792-1803): sectioned
 * nav (Intelligence/Create/Measure/Account), a Dashboard unread badge, an
 * expandable Settings item with its 3 sub-tabs, and a footer identity block.
 */
const Sidebar: React.FC<SidebarProps> = ({ isMobileOpen, onCloseMobile }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, operatorId } = useAuth();
  const { profile } = useProfile();
  const [settingsOpen, setSettingsOpen] = useState(location.pathname.startsWith('/settings'));

  const go = (path: string) => {
    navigate(path);
    onCloseMobile();
  };

  const identityLabel = profile?.businessName || 'Business Operator';
  const identityInitials = identityLabel.trim().slice(0, 2).toUpperCase() || 'CV';

  return (
    <>
      {isMobileOpen && (
        <div
          className="scrim on"
          style={{ position: 'fixed', inset: 0, background: 'rgba(10,35,66,.42)', zIndex: 80 }}
          onClick={onCloseMobile}
        />
      )}
      <aside id="sidebar" className={`sidebar ${isMobileOpen ? 'on' : ''}`}>
        <div className="sb-head">
          <div className="sb-glyph">Ce</div>
          <div>
            <b>CeView</b>
            <span>Tourism Demand Intelligence</span>
          </div>
        </div>

        <nav className="sb-nav">
          {NAV.map(section => (
            <React.Fragment key={section.section}>
              <div className="sb-sec">{section.section}</div>
              {section.items.map(item => {
                const Icon = item.icon;

                if (item.subTabs) {
                  const sectionActive = location.pathname.startsWith('/settings');
                  return (
                    <React.Fragment key={item.id}>
                      <button
                        type="button"
                        className={`sb-item expandable ${sectionActive ? 'active' : ''} ${settingsOpen ? 'open' : ''}`}
                        aria-expanded={settingsOpen}
                        onClick={() => setSettingsOpen(o => !o)}
                      >
                        <Icon />
                        <span>{item.label}</span>
                        <ChevronDown className="chev" />
                      </button>
                      <div className="sb-sub">
                        {item.subTabs.map(tab => {
                          const subActive = location.pathname === `/settings/${tab.id}`;
                          return (
                            <button
                              key={tab.id}
                              type="button"
                              className={`sb-sub-item ${subActive ? 'active' : ''}`}
                              onClick={() => go(`/settings/${tab.id}`)}
                            >
                              <span>{tab.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </React.Fragment>
                  );
                }

                const isActive = location.pathname.startsWith(item.path);
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`sb-item ${isActive ? 'active' : ''}`}
                    onClick={() => go(item.path)}
                  >
                    <Icon />
                    <span>{item.label}</span>
                    {item.badge != null && <span className="sb-badge">{item.badge}</span>}
                  </button>
                );
              })}
            </React.Fragment>
          ))}
        </nav>

        <div className="sb-foot">
          <div className="sb-user">
            <div className="sb-avatar">{identityInitials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <b>{identityLabel}</b>
              <span>{operatorId ?? ''}</span>
            </div>
          </div>
          <button type="button" className="sb-item" onClick={logout}>
            <LogOut />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
