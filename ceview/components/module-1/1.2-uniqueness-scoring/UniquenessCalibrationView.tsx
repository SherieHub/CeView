import React, { useState } from 'react';
import UniquenessCalibrationForm, { UniquenessPayloadDTO } from '../1.1-business-input/components/UniquenessCalibrationForm';
import CalibrationResultsDashboard, { DetailedCalibrationResultDTO } from './components/CalibrationResultsDashboard';
import { CategoryAllocation } from '../1.1-business-input/components/InferredCategoryBoard';
import { COLORS } from '../../../constants';
import { ProfileData, ProfileSetters } from '../../../App';
import { api, ApiError } from '../../../services/apiClient';
import ServerErrorBanner from '../../shared/ServerErrorBanner';


interface UniquenessCalibrationViewProps {
  profile?: ProfileData;
  setters?: ProfileSetters;
  onNavigate?: (tab: string) => void;
}

const UniquenessCalibrationView: React.FC<UniquenessCalibrationViewProps> = ({ profile, setters, onNavigate }) => {
  const [payload, setPayload] = useState<UniquenessPayloadDTO>({
    businessName: profile?.businessName || '',
    coreServices: profile?.coreServices || [],
    description: profile?.description || '',
    uvp: profile?.uvp || ''
  });

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [categories, setCategories] = useState<CategoryAllocation[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const toggleCategory = (name: string) => {
    setSelectedCategories(prev =>
      prev.includes(name)
        ? prev.length > 1 ? prev.filter(n => n !== name) : prev
        : [...prev, name]
    );
  };

  const [isComputing, setIsComputing] = useState(false);
  const [calibrationResult, setCalibrationResult] = useState<DetailedCalibrationResultDTO | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const formatError = (prefix: string, e: unknown): string => {
    if (e instanceof ApiError) {
      const trace = e.traceId ? ` · trace ${e.traceId}` : '';
      return `${prefix} [${e.code}${trace}]`;
    }
    return prefix;
  };

  const handleAnalyzeRequest = async () => {
    setIsAnalyzing(true);
    setServerError(null);
    try {
      const { categories: allocs } = await api.classifyAnalyze({
        businessName: payload.businessName,
        coreServices: payload.coreServices,
        description: payload.description,
        uvp: payload.uvp,
      });
      setCategories(allocs);
      setSelectedCategories([]);
      setHasAnalyzed(true);
    } catch (e) {
      setServerError(formatError('Failed to analyze business profile. The AI service may be unavailable.', e));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleComputeRequest = async () => {
    setIsComputing(true);
    setServerError(null);
    try {
      const result = await api.classifyUniqueness({

        businessProfileId: profile?.businessProfileId ?? '',

        businessName: payload.businessName,
        categories: selectedCategories,
        coreServices: payload.coreServices,
        description: payload.description,
        uvp: payload.uvp,
      });
      setCalibrationResult(result);
    } catch (e) {
      setServerError(formatError('Failed to compute uniqueness score. The AI service may be unavailable.', e));
    } finally {
      setIsComputing(false);
    }
  };

  const handleConfirmProfile = async () => {
    const activeCats = selectedCategories;
    const overallScore = calibrationResult?.overallScore ?? null;

    try {
      const saved = await api.saveProfile({
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
      setServerError(formatError('Profile could not be saved. Backend sync failed.', e));
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 min-h-screen" style={{ backgroundColor: COLORS.CREAM }}>
      {serverError && <ServerErrorBanner message={serverError} onDismiss={() => setServerError(null)} />}
      <div className="mb-6 md:mb-8">
         <h1 className="text-2xl md:text-3xl font-black tracking-tight leading-none mb-2" style={{ color: COLORS.NAVY }}>
           Uniqueness Score
         </h1>
         <p className="text-sm font-medium" style={{ color: COLORS.TEXT_MUTED }}>
           Fill in your business profile and run a CeView uniqueness calibration to see how distinctive your offering is in the regional market.
         </p>
      </div>

      <div className="flex flex-col gap-8 md:gap-12 pb-12">
        <UniquenessCalibrationForm
          payload={payload} setPayload={setPayload}
          onAnalyze={handleAnalyzeRequest} isAnalyzing={isAnalyzing} hasAnalyzed={hasAnalyzed}
          categories={categories}
          selectedCategories={selectedCategories}
          onCategoryToggle={toggleCategory}
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
