import React from 'react';
import { Sparkles, Activity } from 'lucide-react';
import TextField from '../../../composites/module-1/1.1-business-input/TextField';
import TextAreaField from '../../../composites/module-1/1.1-business-input/TextAreaField';
import DynamicListManager from '../../../composites/module-1/1.1-business-input/DynamicListManager';
import ValidationBanner from '../../../composites/module-1/1.1-business-input/ValidationBanner';
import InferredCategoryBoard, { CategoryAllocation } from './InferredCategoryBoard';
import { COLORS } from '../../../../constants';

export interface UniquenessPayloadDTO {
  businessName: string;
  coreServices: string[];
  description: string;
  uvp: string;
}

interface FormProps {
  payload: UniquenessPayloadDTO;
  setPayload: React.Dispatch<React.SetStateAction<UniquenessPayloadDTO>>;
  onAnalyze: () => void;
  isAnalyzing: boolean;
  hasAnalyzed: boolean;
  categories: CategoryAllocation[];
  onCategoryChange: (name: string, val: number) => void;
  onCompute: () => void;
  isComputing: boolean;
}

const UniquenessCalibrationForm: React.FC<FormProps> = ({
  payload, setPayload, onAnalyze, isAnalyzing, hasAnalyzed, categories, onCategoryChange, onCompute, isComputing
}) => {
  const isFormValid = Boolean(payload.businessName && payload.coreServices.length > 0 && payload.description && payload.uvp);

  return (
    <div className="p-6 md:p-8 rounded-2xl border bg-white shadow-sm" style={{ borderColor: COLORS.LIGHT_GREY }}>

      {/* ✨ UPDATED: 2x2 Grid Layout for Full-Width Form */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-2 mb-2">
        <div className="classname">
          <TextField label="Business Name" value={payload.businessName} onChange={(val) => setPayload({ ...payload, businessName: val })} placeholder="e.g. Sunset Cove Beach Resort" />
          <TextAreaField label="Full Description" guideText="Provide a detailed overview of your property or business experience." value={payload.description} onChange={(val) => setPayload({ ...payload, description: val })} placeholder="e.g., A serene beachfront property in Moalboal offering direct access to the sardine run..." className="h-52"/>
        </div>
        <div className="classname">
          <DynamicListManager guideText="List the specific amenities and core services your business provides to guests." items={payload.coreServices} onChange={(services) => setPayload({ ...payload, coreServices: services })} />
          <TextAreaField label="Unique Value Proposition" guideText="What makes your business stand out from nearby competitors?" value={payload.uvp} onChange={(val) => setPayload({ ...payload, uvp: val })} placeholder="e.g., We are the only eco-resort in the area with a certified on-site marine biologist..." />
        </div>
      </div>

      <ValidationBanner isValid={isFormValid} />

      {!hasAnalyzed && (
        <button
          onClick={onAnalyze} disabled={!isFormValid || isAnalyzing}
          className="w-full mt-4 px-6 py-4 rounded-xl text-white font-black flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: COLORS.NAVY }}
        >
          {isAnalyzing ? <Activity size={18} className="animate-spin" /> : <Sparkles size={18} />}
          {isAnalyzing ? 'Analyzing Profile...' : 'Analyze Business Profile'}
        </button>
      )}

      {hasAnalyzed && (
        <div className="animate-fade-in border-t pt-8 mt-4" style={{ borderColor: COLORS.LIGHT_GREY }}>
          <InferredCategoryBoard categories={categories} onChangeCategory={onCategoryChange} />

          <button
            onClick={onCompute} disabled={isComputing}
            className="w-full mt-4 px-6 py-4 rounded-xl text-white font-black flex items-center justify-center gap-2 hover:opacity-90 shadow-md transition-all"
            style={{ backgroundColor: COLORS.GOLD }}
          >
            {isComputing ? <Activity size={18} className="animate-spin" /> : <Activity size={18} />}
            {isComputing ? 'Computing Uniqueness...' : 'Compute Final Uniqueness Score'}
          </button>
        </div>
      )}
    </div>
  );
};

export default UniquenessCalibrationForm;
