

import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import BusinessProfile from './components/BusinessProfile';
import CalendarView from './components/CalendarView';
import LandingPage from './components/LandingPage';
import PerformanceReports from './components/PerformanceReports'; 
import { COLORS } from './constants';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('landing');

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: COLORS.OFF_WHITE }}>
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <main className="flex-1 ml-64 p-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          {activeTab === 'landing' && <LandingPage />}
          {activeTab === 'reports' && <PerformanceReports />}
          {activeTab === 'profile' && <BusinessProfile />}
          {activeTab === 'calendar' && <CalendarView />}
        </div>
      </main>
    </div>
  );
};

export default App;