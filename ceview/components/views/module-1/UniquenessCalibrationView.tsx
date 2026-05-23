import React, { useState } from 'react';
import UniquenessCalibrationForm, { UniquenessPayloadDTO } from '../../modules/module-1/UniquenessCalibrationForm';
import CalibrationDashboard, { DetailedCalibrationResultDTO } from '../../modules/module-1/CalibrationResultsDashboard';
import { COLORS } from '../../../constants';

const UniquenessCalibrationView: React.FC = () => {
  const [isAwaitingCalibration, setIsAwaitingCalibration] = useState(false);
  const [calibrationResult, setCalibrationResult] = useState<DetailedCalibrationResultDTO | null>(null);

  const handleComputeRequest = async (payload: UniquenessPayloadDTO) => {
    setIsAwaitingCalibration(true);
    
    try {
      // TODO: Replace with actual Spring Boot API call
      // const response = await fetch('/api/v1/calibration/evaluate', { ... });
      
      // Mock API Delay
      await new Promise(resolve => setTimeout(resolve, 2500));
      
      // Mock Data derived from AI Inference Services
      setCalibrationResult({
        overallScore: 65,
        semanticsScore: 72,
        categoryScore: 58,
        descriptionFeedback: "Use more sensory, place-specific language to separate your copy from generic resort descriptions.",
        categoryFeedback: "Align but diversify your category mix to stand out from nearby competitors."
      });
    } catch (error) {
      console.error("Calibration failed", error);
    } finally {
      setIsAwaitingCalibration(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 min-h-screen" style={{ backgroundColor: COLORS.CREAM }}>
      
      {/* View Header */}
      <div className="mb-8">
         <h1 className="text-3xl font-black tracking-tight leading-none mb-2" style={{ color: COLORS.NAVY }}>
           Uniqueness Score
         </h1>
         <p className="text-sm font-medium" style={{ color: COLORS.TEXT_MUTED }}>
           Fill in your business profile and run a CeView uniqueness calibration to see how distinctive your offering is in the regional market.
         </p>
      </div>

      {/* Two-Column Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Left Column: Form Organism */}
        <div>
          <UniquenessCalibrationForm 
            isProcessing={isAwaitingCalibration} 
            onSubmitPayload={handleComputeRequest} 
          />
        </div>

        {/* Right Column: Dashboard Organism */}
        <div>
          <CalibrationDashboard 
            isAwaiting={isAwaitingCalibration} 
            result={calibrationResult} 
          />
        </div>

      </div>
    </div>
  );
};

export default UniquenessCalibrationView;