import React from 'react';
import { COLORS } from '../../../constants';

interface UploadIconBadgeProps {
  icon: React.ReactNode;
  isDragging?: boolean;
}

const UploadIconBadge: React.FC<UploadIconBadgeProps> = ({ icon, isDragging = false }) => (
  <div 
    className="w-12 h-12 rounded-xl flex items-center justify-center transition-all" 
    style={{ backgroundColor: isDragging ? `${COLORS.TEAL}18` : COLORS.LIGHT_GREY }}
  >
    {icon}
  </div>
);

export default UploadIconBadge;