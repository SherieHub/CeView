import React from 'react';
import { Calendar, LogOut, UserCircle, Bell, BarChart2, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { COLORS } from '../constants';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isCollapsed: boolean;
  setIsCollapsed: (v: boolean) => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (v: boolean) => void;
}

const menuItems = [
  { id: 'home', label: 'Home / Notification', icon: Bell },
  { id: 'reports', label: 'Campaign Analytics', icon: BarChart2 },
  { id: 'profile', label: 'Business Profile', icon: UserCircle },
  { id: 'uniqueness', label: 'Uniqueness Score', icon: Sparkles },
  { id: 'calendar', label: 'Experience Calendar', icon: Calendar },
];

const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isCollapsed,
  setIsCollapsed,
  isMobileOpen,
  setIsMobileOpen,
}) => {
  const handleNavClick = (id: string) => {
    setActiveTab(id);
    setIsMobileOpen(false);
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <div
        className={`
          fixed left-0 top-0 h-screen flex flex-col shadow-xl z-50
          transition-all duration-300
          ${isCollapsed ? 'md:w-16' : 'md:w-64'}
          w-64
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
        style={{ backgroundColor: COLORS.NAVY }}
      >
        {/* Logo */}
        <div className={`border-b border-white/10 flex items-center ${isCollapsed ? 'p-4 justify-center' : 'p-6'}`}>
          {isCollapsed ? (
            <span className="text-2xl font-bold text-white">C</span>
          ) : (
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">
                Ce<span style={{ color: COLORS.LIGHT_GOLD }}>View</span>
              </h1>
              <p className="text-xs text-white/70 mt-1">Demand Stabilization Engine</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-6 px-2 space-y-1 overflow-hidden">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                title={isCollapsed ? item.label : undefined}
                className={`w-full flex items-center px-3 py-3 rounded-xl transition-all duration-200 ${
                  isCollapsed ? 'justify-center' : 'space-x-3'
                } ${
                  isActive
                    ? 'bg-white/10 text-white font-medium shadow-inner'
                    : 'text-white/60 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon size={20} color={isActive ? COLORS.GOLD : 'currentColor'} />
                {!isCollapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-white/10 space-y-1">
          <button
            className={`flex items-center text-white/60 hover:text-white transition-colors w-full px-3 py-2 rounded-xl hover:bg-white/5 ${isCollapsed ? 'justify-center' : 'space-x-3'}`}
            title={isCollapsed ? 'Sign Out' : undefined}
          >
            <LogOut size={18} />
            {!isCollapsed && <span className="text-sm">Sign Out</span>}
          </button>

          {/* Desktop collapse toggle */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden md:flex items-center justify-center w-full px-3 py-2 text-white/40 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
