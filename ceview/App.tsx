import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import BusinessProfile from './components/BusinessProfile';
import CalendarView from './components/CalendarView';
import CampaignEngagementMetrics from './components/CampaignEngagementMetrics';
import { COLORS } from './constants';
import MarketPrediction from './components/MarketPrediction';
import Home_Notification from './components/Home_Notification';
import ContentGeneration from './components/ContentGeneration';
import UniquenessScore from './components/UniquenessScore';

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
  // Configured initial state to load the Home Dashboard automatically on mount
  const [activeTab, setActiveTab] = useState<string>('home');

  // Shared profile state — single source of truth for Business Profile + Uniqueness Score
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
      {/* The Sidebar controls main tab switches */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="flex-1 ml-64 p-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto">

          {/* 1. Home/Notification View */}
          {activeTab === 'home' && (
            <Home_Notification
              // Triggers navigation redirection directly into content generation workflow options
              onNavigateToContent={() => setActiveTab('content')}
            />
          )}

          {/* 2. Market Radar View */}
          {activeTab === 'radar' && (
            <MarketPrediction
              onNavigateToContent={() => setActiveTab('content')}
            />
          )}

          {/* 3. Content Generation Workspace */}
          {activeTab === 'content' && (
            <ContentGeneration
              onBack={() => setActiveTab('radar')}
            />
          )}

          {/* Other standalone system pages */}
          {activeTab === 'reports' && <CampaignEngagementMetrics />}
          {activeTab === 'profile' && <BusinessProfile profile={profile} setters={setters} />}
          {activeTab === 'uniqueness' && <UniquenessScore profile={profile} setters={setters} />}
          {activeTab === 'calendar' && <CalendarView />}

        </div>
      </main>
    </div>
  );
};

export default App;
