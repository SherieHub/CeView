import React from 'react';
import { Sparkles, Activity } from 'lucide-react';
import TextField from './TextField';
import TextAreaField from './TextAreaField';
import DynamicListManager from './DynamicListManager';
import ValidationBanner from './ValidationBanner';
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
  selectedCategories: string[];
  onCategoryToggle: (name: string) => void;
  onCompute: () => void;
  isComputing: boolean;
}

const SkeletonBox: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ className = '', style }) => (
  <div
    className={`rounded-xl animate-pulse ${className}`}
    style={{ backgroundColor: COLORS.LIGHT_GREY, opacity: 0.5, ...style }}
  />
);

const DESC_MIN_WORDS = 50;
const UVP_MIN_WORDS = 30;

const countWords = (text: string): number =>
  text.trim() ? text.trim().split(/\s+/).length : 0;

const UniquenessCalibrationForm: React.FC<FormProps> = ({
  payload, setPayload, onAnalyze, isAnalyzing, hasAnalyzed,
  categories, selectedCategories, onCategoryToggle, onCompute, isComputing,
}) => {
  const descWordCount = countWords(payload.description);
  const uvpWordCount  = countWords(payload.uvp);

  const validationErrors: string[] = [];
  if (!payload.businessName) validationErrors.push('Business name is required.');
  if (payload.coreServices.length === 0) validationErrors.push('At least one core service is required.');
  if (!payload.description) {
    validationErrors.push('Full description is required.');
  } else if (descWordCount < DESC_MIN_WORDS) {
    validationErrors.push(`Description must be at least ${DESC_MIN_WORDS} words (currently ${descWordCount}).`);
  }
  if (!payload.uvp) {
    validationErrors.push('Unique Value Proposition is required.');
  } else if (uvpWordCount < UVP_MIN_WORDS) {
    validationErrors.push(`UVP must be at least ${UVP_MIN_WORDS} words (currently ${uvpWordCount}).`);
  }

  const isFormValid = validationErrors.length === 0;

  return (
    <div className="p-6 md:p-8 rounded-2xl border bg-white shadow-sm" style={{ borderColor: COLORS.LIGHT_GREY }}>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-2 mb-2">
        <div className="classname">
          <TextField label="Business Name" value={payload.businessName} onChange={(val) => setPayload({ ...payload, businessName: val })} placeholder="e.g. Sunset Cove Beach Resort" />
          <TextAreaField label="Full Description" guideText="Provide a detailed overview of your property or business experience." value={payload.description} onChange={(val) => setPayload({ ...payload, description: val })} placeholder="e.g., A serene beachfront property in Moalboal offering direct access to the sardine run..." className="h-52" minWords={DESC_MIN_WORDS} />
        </div>
        <div className="classname">
          <DynamicListManager guideText="List the specific amenities and core services your business provides to guests." items={payload.coreServices} onChange={(services) => setPayload({ ...payload, coreServices: services })} />
          <TextAreaField label="Unique Value Proposition" guideText="What makes your business stand out from nearby competitors?" value={payload.uvp} onChange={(val) => setPayload({ ...payload, uvp: val })} placeholder="e.g., We are the only eco-resort in the area with a certified on-site marine biologist..." minWords={UVP_MIN_WORDS} />
        </div>
      </div>

      <ValidationBanner isValid={isFormValid} errors={validationErrors} />

      {!hasAnalyzed && !isAnalyzing && (
        <button
          onClick={onAnalyze} disabled={!isFormValid || isAnalyzing}
          className="w-full mt-4 px-6 py-4 rounded-xl text-white font-black flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: COLORS.NAVY }}
        >
          <Sparkles size={18} />
          Analyze Business Profile
        </button>
      )}

      {isAnalyzing && (
        <div className="border-t pt-8 mt-4" style={{ borderTopColor: COLORS.LIGHT_GREY }}>
          {/* Category board skeleton */}
          <div
            className="p-6 md:p-8 rounded-2xl border bg-white shadow-sm mb-6"
            style={{ borderColor: COLORS.LIGHT_GREY }}
          >
            <div className="flex items-center gap-2 mb-2">
              <SkeletonBox style={{ width: 16, height: 16, borderRadius: '50%' }} />
              <SkeletonBox style={{ width: 160, height: 14 }} />
            </div>
            <SkeletonBox style={{ width: '70%', height: 12, marginBottom: 24 }} />

            <SkeletonBox style={{ width: 100, height: 10, marginBottom: 10 }} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
              {[1, 2, 3].map(i => <SkeletonBox key={i} style={{ height: 52 }} />)}
            </div>

            <SkeletonBox style={{ width: 120, height: 10, marginBottom: 10 }} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[1, 2, 3, 4].map(i => <SkeletonBox key={i} style={{ height: 52 }} />)}
            </div>
          </div>

          {/* Compute button skeleton */}
          <SkeletonBox style={{ height: 56 }} />
        </div>
      )}

      {hasAnalyzed && (
        <div className="animate-fade-in border-t pt-8 mt-4" style={{ borderColor: COLORS.LIGHT_GREY }}>
          <InferredCategoryBoard
            allCategories={categories}
            selectedCategories={selectedCategories}
            onToggle={onCategoryToggle}
          />

          <button
            onClick={onCompute} disabled={isComputing || selectedCategories.length === 0}
            className="w-full mt-4 px-6 py-4 rounded-xl text-white font-black flex items-center justify-center gap-2 hover:opacity-90 shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
