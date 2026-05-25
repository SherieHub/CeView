import React from 'react';
import PrimaryButton from '../../../base/module-1/1.2-uniqueness-scoring/PrimaryButton';
import { Sparkles } from 'lucide-react';

interface ComputeButtonProps {
  isValid: boolean;
  isLoading: boolean;
  onSubmit: () => void;
}

const ComputeUniquenessButton: React.FC<ComputeButtonProps> = ({ isValid, isLoading, onSubmit }) => (
  <PrimaryButton
    fullWidth
    disabled={!isValid}
    isLoading={isLoading}
    onClick={onSubmit}
    icon={<Sparkles size={16} />}
  >
    Compute Uniqueness
  </PrimaryButton>
);

export default ComputeUniquenessButton;
