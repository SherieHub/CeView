import React, { useState } from 'react';
import Sidebar from './old-components/Sidebar';
import CalendarView from './old-components/CalendarView';
import { COLORS } from './constants';

// 1. IMPORT MODULE 1 VIEWS & PROFILE
import UniquenessCalibrationView from './components/views/module-1/UniquenessCalibrationView';
import BusinessProfile from './components/views/module-1/BusinessProfile'; // ✨ NEW: Import BusinessProfile

// 2. IMPORT MODULE 2 VIEWS
import HomeView from './components/views/module-2/HomeView';
import MarketRadarView from './components/views/module-2/MarketRadarView';

// 3. IMPORT MODULE 3 VIEWS
import ContentStudioView from './components/views/module-3/ContentStudioView';

// 4. IMPORT MODULE 4 VIEWS
import CampaignAnalyticsView from './components/views/module-4/CampaignAnalyticsView';

export interface ProfileData {
  businessName: string;
  categories: string[];
  coreServices: string[];
  description: string;
  uvp: string;
  imagePreview: string | null;
}

export interface ProfileSetters {
  setBusinessName: React.Dispatch<React.SetStateAction<string>>;
  setCategories: React.Dispatch<React.SetStateAction<string[]>>;
  setCoreServices: React.Dispatch<React.SetStateAction<string[]>>;
  setDescription: React.Dispatch<React.SetStateAction<string>>;
  setUvp: React.Dispatch<React.SetStateAction<string>>;
  setImagePreview: React.Dispatch<React.SetStateAction<string | null>>;
}

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('home');

  // Shared profile state — populated entirely via the Uniqueness Calibration Form
  const [businessName, setBusinessName] = useState<string>('');
  const [categories, setCategories] = useState<string[]>([]);
  const [coreServices, setCoreServices] = useState<string[]>([]);
  const [description, setDescription] = useState<string>('');
  const [uvp, setUvp] = useState<string>('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const profile: ProfileData = { businessName, categories, coreServices, description, uvp, imagePreview };
  const setters: ProfileSetters = { setBusinessName, setCategories, setCoreServices, setDescription, setUvp, setImagePreview };

  return (
    <div className="flex h-screen" style={{ backgroundColor: COLORS.OFF_WHITE }}>
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="flex-1 ml-64 p-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto">

          {activeTab === 'home' && (
            <HomeView
              onNavigateToContent={() => setActiveTab('content')}
            />
          )}

          {activeTab === 'radar' && (
            <MarketRadarView
              onNavigateToContent={() => setActiveTab('content')}
            />
          )}

          {activeTab === 'content' && (
            <ContentStudioView
              onBack={() => setActiveTab('radar')}
            />
          )}

          {activeTab === 'reports' && <CampaignAnalyticsView />}
          
          {/* ✨ NEW: Render the Business Profile Dashboard */}
          {activeTab === 'profile' && (
            <BusinessProfile profile={profile} setters={setters} />
          )}
          
          {/* ✨ UPDATED: Pass props to Calibration View to allow data saving & redirection */}
          {activeTab === 'uniqueness' && (
            <UniquenessCalibrationView 
              profile={profile} 
              setters={setters} 
              onNavigate={(tab) => setActiveTab(tab)} 
            />
          )}
          
          {activeTab === 'calendar' && <CalendarView />}

        </div>
      </main>
    </div>
  );
};

export default App;