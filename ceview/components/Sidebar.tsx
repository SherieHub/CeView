import React from 'react';
import { Calendar, Settings, LogOut, UserCircle, Bell, BarChart2, Share2 } from 'lucide-react';
import { COLORS } from '../constants';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const menuItems = [
    { id: 'landing', label: 'Home / Updates', icon: Bell },
    { id: 'reports', label: 'Performance Reports', icon: BarChart2 },
    // Removed 'integrations' (Social Connections) as it is merged into Business Profile
    { id: 'profile', label: 'Business Profile', icon: UserCircle }, 
    { id: 'calendar', label: 'Experience Calendar', icon: Calendar },
  ];

  return (
    <div className="h-screen w-64 fixed left-0 top-0 flex flex-col shadow-xl z-50" style={{ backgroundColor: COLORS.TEAL }}>
      {/* Logo Area */}
      <div className="p-6 border-b border-white/10">
        <h1 className="text-3xl font-bold text-white tracking-tight">
          Ce<span style={{ color: COLORS.CYAN }}>View</span>
        </h1>
        <p className="text-xs text-white/70 mt-1">Demand Stabilization Engine</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-6 px-3 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                isActive 
                  ? 'bg-white/10 text-white font-medium' 
                  : 'text-white/60 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Icon size={20} color={isActive ? COLORS.CYAN : 'currentColor'} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-white/10">
        <button className="flex items-center space-x-3 text-white/60 hover:text-white transition-colors w-full px-4 py-2">
          <Settings size={18} />
          <span className="text-sm">Calibration</span>
        </button>
        <button className="flex items-center space-x-3 text-white/60 hover:text-white transition-colors w-full px-4 py-2 mt-1">
          <LogOut size={18} />
          <span className="text-sm">Sign Out</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;