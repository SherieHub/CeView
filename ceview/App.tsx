import React, { useEffect, useState } from 'react';
import { Menu } from 'lucide-react';
import Sidebar from './layout/Sidebar';
import CalendarView from './old-components/CalendarView';
import { COLORS } from './constants';
import { api } from './services/apiClient';
import { OPERATOR_ID } from './services/identity';

import BusinessProfile from './components/module-1/1.1-business-input/BusinessProfile';
import UniquenessCalibrationView from './components/module-1/1.2-uniqueness-scoring/UniquenessCalibrationView';
import HomeView from './components/module-2/2.1-home/HomeView';
import MarketRadarView from './components/module-2/2.2-market-radar/MarketRadarView';
import ContentStudioView from './components/module-3/3.1-content-studio/ContentStudioView';
import CampaignAnalyticsView from './components/module-4/4.1-campaign-analytics/CampaignAnalyticsView';

//hehe
export interface ProfileData {
  businessProfileId: string | null;
  businessName: string;
  categories: string[];
  coreServices: string[];
  description: string;
  uvp: string;
  imagePreview: string | null;
  uniquenessScore: number | null;
}

export interface ProfileSetters {
  setBusinessProfileId: React.Dispatch<React.SetStateAction<string | null>>;
  setBusinessName: React.Dispatch<React.SetStateAction<string>>;
  setCategories: React.Dispatch<React.SetStateAction<string[]>>;
  setCoreServices: React.Dispatch<React.SetStateAction<string[]>>;
  setDescription: React.Dispatch<React.SetStateAction<string>>;
  setUvp: React.Dispatch<React.SetStateAction<string>>;
  setImagePreview: React.Dispatch<React.SetStateAction<string | null>>;
  setUniquenessScore: React.Dispatch<React.SetStateAction<number | null>>;
}

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('home');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const [businessProfileId, setBusinessProfileId] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState<string>('');
  const [categories, setCategories] = useState<string[]>([]);
  const [coreServices, setCoreServices] = useState<string[]>([]);
  const [description, setDescription] = useState<string>('');
  const [uvp, setUvp] = useState<string>('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uniquenessScore, setUniquenessScore] = useState<number | null>(null);

  useEffect(() => {
    api.loadProfile(OPERATOR_ID)
      .then(dto => {
        setBusinessProfileId(dto.businessProfileId);
        setBusinessName(dto.businessName ?? '');
        setCategories(dto.categories ?? []);
        setCoreServices(dto.coreServices ?? []);
        setDescription(dto.description ?? '');
        setUvp(dto.uvp ?? '');
        setImagePreview(dto.imagePreview);
        setUniquenessScore(dto.uniquenessScore);
      })
      .catch(err => console.error('loadProfile failed', err));
  }, []);

  const profile: ProfileData = {
    businessProfileId, businessName, categories, coreServices,
    description, uvp, imagePreview, uniquenessScore,
  };
  const setters: ProfileSetters = {
    setBusinessProfileId, setBusinessName, setCategories, setCoreServices,
    setDescription, setUvp, setImagePreview, setUniquenessScore,
  };

  return (
    <div className="flex h-screen" style={{ backgroundColor: COLORS.OFF_WHITE }}>
      {/* Mobile top bar */}
      <div className="fixed top-0 left-0 right-0 h-14 flex md:hidden items-center px-4 gap-3 z-30 shadow-sm" style={{ backgroundColor: COLORS.NAVY }}>
        <button
          onClick={() => setIsMobileOpen(true)}
          className="text-white/80 hover:text-white transition-colors"
        >
          <Menu size={22} />
        </button>
        <h1 className="text-xl font-bold text-white tracking-tight">
          Ce<span style={{ color: COLORS.LIGHT_GOLD }}>View</span>
        </h1>
      </div>

      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
      />

      <main
        className={`flex-1 overflow-y-auto pt-14 md:pt-0 p-4 md:p-8 transition-all duration-300 ${
          isCollapsed ? 'md:ml-16' : 'md:ml-64'
        }`}
      >
        <div className="max-w-6xl mx-auto">

          {activeTab === 'home' && (
            <HomeView
              businessProfileId={businessProfileId}
              businessName={businessName}
              categories={categories}
              onNavigateToContent={() => setActiveTab('content')}
            />
          )}

          {activeTab === 'radar' && (
            <MarketRadarView
              businessProfileId={businessProfileId}
              businessName={businessName}
              categories={categories}
              onNavigateToContent={() => setActiveTab('content')}
            />
          )}

          {activeTab === 'content' && (
            <ContentStudioView
              onBack={() => setActiveTab('radar')}
            />
          )}

          {activeTab === 'reports' && <CampaignAnalyticsView />}

          {activeTab === 'profile' && (
            <BusinessProfile profile={profile} setters={setters} />
          )}

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
