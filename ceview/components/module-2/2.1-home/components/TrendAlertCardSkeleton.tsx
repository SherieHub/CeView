import React from 'react';
import { COLORS } from '../../../../constants';
import SkeletonBox from '../../../shared/SkeletonBox';

const TrendAlertCardSkeleton: React.FC = () => (
  <div
    className="p-6 rounded-xl shadow-sm border"
    style={{ backgroundColor: COLORS.WHITE, borderColor: COLORS.LIGHT_GREY, borderWidth: 1, borderStyle: 'solid' }}
  >
    <div className="flex items-start gap-4">
      {/* Bell icon circle */}
      <SkeletonBox style={{ width: 48, height: 48, borderRadius: '50%', flexShrink: 0 }} />
      <div className="flex-1 space-y-3">
        {/* Date */}
        <SkeletonBox style={{ height: 12, width: '30%' }} />
        {/* Title */}
        <SkeletonBox style={{ height: 20, width: '70%' }} />
        {/* Body text */}
        <SkeletonBox style={{ height: 14, width: '90%' }} />
        {/* CTA */}
        <SkeletonBox style={{ height: 14, width: '35%' }} />
      </div>
    </div>
  </div>
);

export default TrendAlertCardSkeleton;
