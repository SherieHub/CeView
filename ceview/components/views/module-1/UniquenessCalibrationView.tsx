import React, { useState } from 'react';
import UniquenessCalibrationForm, { UniquenessPayloadDTO } from '../../modules/module-1/UniquenessCalibrationForm';
import CalibrationResultsDashboard, { DetailedCalibrationResultDTO } from '../../modules/module-1/CalibrationResultsDashboard';
import { CategoryAllocation } from '../../modules/module-1/InferredCategoryBoard';
import { COLORS } from '../../../constants';
import { ProfileData, ProfileSetters } from '../../../App';
import { api } from '../../../services/apiClient';

const BASE_CATEGORIES: CategoryAllocation[] = [
  { name: "Coastal & Island", percentage: 0 },
  { name: "Adventure & Nature", percentage: 0 },
  { name: "Cultural & Heritage", percentage: 0 },
  { name: "Theme Parks / Entertainment", percentage: 0 },
  { name: "Urban & City", percentage: 0 },
  { name: "Culinary & Gastronomy", percentage: 0 },
  { name: "Accommodation & Staycation", percentage: 0 },
];

interface UniquenessCalibrationViewProps {
  profile?: ProfileData;
  setters?: ProfileSetters;
  onNavigate?: (tab: string) => void;
}

const UniquenessCalibrationView: React.FC<UniquenessCalibrationViewProps> = ({ profile, setters, onNavigate }) => {
  // Initialize payload from global profile state if it exists
  const [payload, setPayload] = useState<UniquenessPayloadDTO>({ 
    businessName: profile?.businessName || '', 
    coreServices: profile?.coreServices || [], 
    description: profile?.description || '', 
    uvp: profile?.uvp || '' 
  });
  
  // Phase 1: Analysis State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  
  // Pre-fill percentages if categories were already set globally
  const initialCategories = BASE_CATEGORIES.map(cat => ({
    ...cat,
    percentage: profile?.categories.includes(cat.name) && profile.categories.length > 0 
      ? Math.floor(100 / profile.categories.length) 
      : 0
  }));
  const [categories, setCategories] = useState<CategoryAllocation[]>(initialCategories);

  // Phase 2: Compute State
  const [isComputing, setIsComputing] = useState(false);
  const [calibrationResult, setCalibrationResult] = useState<DetailedCalibrationResultDTO | null>(null);

  const handleAnalyzeRequest = async () => {
    setIsAnalyzing(true);
    try {
      const { categories: allocs } = await api.classifyAnalyze({
        businessName: payload.businessName,
        coreServices: payload.coreServices,
        description: payload.description,
        uvp: payload.uvp,
      });
      // Backend returns the full canonical list; merge so the UI keeps its ordering
      setCategories(BASE_CATEGORIES.map(base => {
        const match = allocs.find(a => a.name === base.name);
        return { ...base, percentage: match ? Math.round(match.percentage) : 0 };
      }));
      setHasAnalyzed(true);
    } catch (e) {
      console.error('classifyAnalyze failed', e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCategoryChange = (name: string, newPercentage: number) => {
    setCategories(prev => prev.map(cat => cat.name === name ? { ...cat, percentage: newPercentage } : cat));
  };

  const handleComputeRequest = async () => {
    setIsComputing(true);
    try {
      const result = await api.classifyUniqueness({
        businessName: payload.businessName,
        categories: categories.filter(c => c.percentage > 0).map(c => c.name),
        coreServices: payload.coreServices,
        description: payload.description,
        uvp: payload.uvp,
      });
      setCalibrationResult(result);
    } catch (e) {
      console.error('classifyUniqueness failed', e);
    } finally {
      setIsComputing(false);
    }
  };

  const handleConfirmProfile = () => {
    // 1. Commit everything to Global App State
    if (setters) {
      setters.setBusinessName(payload.businessName);
      setters.setCoreServices(payload.coreServices);
      setters.setDescription(payload.description);
      setters.setUvp(payload.uvp);
      
      // Extract only active categories (percentage > 0)
      const activeCats = categories.filter(c => c.percentage > 0).map(c => c.name);
      setters.setCategories(activeCats);
    }

    // 2. Redirect to Profile View
    if (onNavigate) {
      onNavigate('profile'); 
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 min-h-screen" style={{ backgroundColor: COLORS.CREAM }}>
      <div className="mb-8">
         <h1 className="text-3xl font-black tracking-tight leading-none mb-2" style={{ color: COLORS.NAVY }}>
           Uniqueness Score
         </h1>
         <p className="text-sm font-medium" style={{ color: COLORS.TEXT_MUTED }}>
           Fill in your business profile and run a CeView uniqueness calibration to see how distinctive your offering is in the regional market.
         </p>
      </div>

      <div className="flex flex-col gap-12 pb-12">
        <UniquenessCalibrationForm 
          payload={payload} setPayload={setPayload}
          onAnalyze={handleAnalyzeRequest} isAnalyzing={isAnalyzing} hasAnalyzed={hasAnalyzed}
          categories={categories} onCategoryChange={handleCategoryChange}
          onCompute={handleComputeRequest} isComputing={isComputing}
        />
        
        <CalibrationResultsDashboard 
          isAwaiting={isComputing} result={calibrationResult} onConfirm={handleConfirmProfile}
        />
      </div>
    </div>
  );
};

export default UniquenessCalibrationView;