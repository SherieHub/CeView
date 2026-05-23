import React, { useState } from 'react';
import TextField from '../../composites/module-1/TextField';
import TextAreaField from '../../composites/module-1/TextAreaField';
import CategoryGridSelector from '../../composites/module-1/CategoryGridSelector';
import DynamicListManager from '../../composites/module-1/DynamicListManager';
import ValidationBanner from '../../composites/module-1/ValidationBanner';
import ComputeUniquenessButton from '../../composites/module-1/ComputeUniquenessButton';
import { BUSINESS_CATEGORIES, COLORS } from '../../../constants';

export interface UniquenessPayloadDTO {
  businessName: string;
  categories: string[];
  coreServices: string[];
  description: string;
  uvp: string;
}

interface FormProps {
  onSubmitPayload: (payload: UniquenessPayloadDTO) => void;
  isProcessing: boolean;
}

const UniquenessCalibrationForm: React.FC<FormProps> = ({ onSubmitPayload, isProcessing }) => {
  const [payload, setPayload] = useState<UniquenessPayloadDTO>({
    businessName: '',
    categories: [],
    coreServices: [],
    description: '',
    uvp: ''
  });

  const isFormValid = Boolean(
    payload.businessName && 
    payload.categories.length > 0 && 
    payload.coreServices.length > 0 && 
    payload.description && 
    payload.uvp
  );

  return (
    <div className="p-6 rounded-2xl border bg-white shadow-sm h-full" style={{ borderColor: COLORS.LIGHT_GREY }}>
      <TextField 
        label="Business Name" 
        value={payload.businessName} 
        onChange={(val) => setPayload({ ...payload, businessName: val })} 
        placeholder="e.g. Sunset Cove Beach Resort"
      />
      
      <CategoryGridSelector 
        options={BUSINESS_CATEGORIES} 
        selectedCategories={payload.categories} 
        onChange={(cats) => setPayload({ ...payload, categories: cats })} 
      />
      
      <DynamicListManager 
        items={payload.coreServices} 
        onChange={(services) => setPayload({ ...payload, coreServices: services })} 
      />
      
      <TextAreaField 
        label="Full Description" 
        value={payload.description} 
        onChange={(val) => setPayload({ ...payload, description: val })} 
      />
      
      <TextAreaField 
        label="Unique Value Proposition" 
        value={payload.uvp} 
        onChange={(val) => setPayload({ ...payload, uvp: val })} 
      />

      <ValidationBanner isValid={isFormValid} />
      
      <ComputeUniquenessButton 
        isValid={isFormValid} 
        isLoading={isProcessing} 
        onSubmit={() => onSubmitPayload(payload)} 
      />
    </div>
  );
};

export default UniquenessCalibrationForm;