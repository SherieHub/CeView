import React from 'react';
import { COLORS } from '../../constants';

interface SkeletonBoxProps {
  className?: string;
  style?: React.CSSProperties;
}

const SkeletonBox: React.FC<SkeletonBoxProps> = ({ className = '', style }) => (
  <div
    className={`rounded-xl animate-pulse ${className}`}
    style={{ backgroundColor: COLORS.LIGHT_GREY, opacity: 0.5, ...style }}
  />
);

export default SkeletonBox;
