import React, { useState } from 'react';
import UniquenessCalibrationForm, { UniquenessPayloadDTO } from '../../modules/module-1/UniquenessCalibrationForm';
import CalibrationResultsDashboard, { DetailedCalibrationResultDTO } from '../../modules/module-1/CalibrationResultsDashboard';
import { CategoryAllocation } from '../../modules/module-1/InferredCategoryBoard';
import { COLORS } from '../../../constants';

const INITIAL_CATEGORIES: CategoryAllocation[] = [
  { name: "Coastal & Island", percentage: 0 },
  { name: "Adventure & Nature", percentage: 0 },
  { name: "Cultural & Heritage", percentage: 0 },
  { name: "Theme Parks / Entertainment", percentage: 0 },
  { name: "Urban & City", percentage: 0 },
  { name: "Culinary & Gastronomy", percentage: 0 },
  { name: "Accommodation & Staycation", percentage: 0 },
];

const UniquenessCalibrationView: React.FC = () => {
  const [payload, setPayload] = useState<UniquenessPayloadDTO>({ businessName: '', coreServices: [], description: '', uvp: '' });
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [categories, setCategories] = useState<CategoryAllocation[]>(INITIAL_CATEGORIES);

  const [isComputing, setIsComputing] = useState(false);
  const [calibrationResult, setCalibrationResult] = useState<DetailedCalibrationResultDTO | null>(null);

  const handleAnalyzeRequest = async () => {
    setIsAnalyzing(true);
    setTimeout(() => {
      setCategories([
        { name: "Coastal & Island", percentage: 10 },
        { name: "Adventure & Nature", percentage: 0 },
        { name: "Cultural & Heritage", percentage: 0 },
        { name: "Theme Parks / Entertainment", percentage: 0 },
        { name: "Urban & City", percentage: 0 },
        { name: "Culinary & Gastronomy", percentage: 30 },
        { name: "Accommodation & Staycation", percentage: 60 },
      ]);
      setHasAnalyzed(true);
      setIsAnalyzing(false);
    }, 1500);
  };

  const handleCategoryChange = (name: string, newPercentage: number) => {
    setCategories(prev => prev.map(cat => cat.name === name ? { ...cat, percentage: newPercentage } : cat));
  };

  const handleComputeRequest = async () => {
    setIsComputing(true);
    setTimeout(() => {
      setCalibrationResult({
        overallScore: 68,
        semanticsScore: 72,
        categoryScore: 61,
        descriptionFeedback: "Use more sensory, place-specific language to separate your copy from generic resort descriptions.",
        categoryFeedback: "Your revised category mix shows high uniqueness against local market saturation."
      });
      setIsComputing(false);
    }, 2000);
  };

  const handleConfirmProfile = () => {
    alert("Profile Registered! Routing to Business Dashboard...");
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

      {/* ✨ UPDATED: Vertical Stack instead of Grid Columns */}
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