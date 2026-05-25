import React, { useState } from 'react';
import UniquenessCalibrationForm, { UniquenessPayloadDTO } from '../../../modules/module-1/1.1-business-input/UniquenessCalibrationForm';
import CalibrationResultsDashboard, { DetailedCalibrationResultDTO } from '../../../modules/module-1/1.2-uniqueness-scoring/CalibrationResultsDashboard';
import { CategoryAllocation } from '../../../modules/module-1/1.1-business-input/InferredCategoryBoard';
import { COLORS, BUSINESS_CATEGORIES } from '../../../../constants';
import { ProfileData, ProfileSetters } from '../../../../App';
import { api } from '../../../../services/apiClient';
import { OPERATOR_ID } from '../../../../services/identity';

const BASE_CATEGORIES: CategoryAllocation[] = BUSINESS_CATEGORIES.map(name => ({ name, percentage: 0 }));

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

  const handleConfirmProfile = async () => {
    const activeCats = categories.filter(c => c.percentage > 0).map(c => c.name);
    const overallScore = calibrationResult?.overallScore ?? null;

    try {
      const saved = await api.saveProfile(OPERATOR_ID, {
        businessProfileId: profile?.businessProfileId ?? null,
        businessName: payload.businessName,
        categories: activeCats,
        coreServices: payload.coreServices,
        description: payload.description,
        uvp: payload.uvp,
        imagePreview: profile?.imagePreview ?? null,
        uniquenessScore: overallScore,
      });

      if (setters) {
        setters.setBusinessProfileId(saved.businessProfileId);
        setters.setBusinessName(saved.businessName);
        setters.setCategories(saved.categories);
        setters.setCoreServices(saved.coreServices);
        setters.setDescription(saved.description);
        setters.setUvp(saved.uvp);
        setters.setImagePreview(saved.imagePreview);
        setters.setUniquenessScore(saved.uniquenessScore);
      }

      if (onNavigate) onNavigate('profile');
    } catch (e) {
      console.error('saveProfile failed', e);
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
