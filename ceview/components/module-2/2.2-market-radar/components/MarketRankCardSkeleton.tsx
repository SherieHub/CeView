import React from 'react';
import { COLORS } from '../../../../constants';
import SkeletonBox from '../../../shared/SkeletonBox';

const MarketRankCardSkeleton: React.FC = () => (
  <div
    className="p-5 rounded-2xl border shadow-sm"
    style={{ backgroundColor: COLORS.WHITE, borderColor: COLORS.LIGHT_GREY, borderWidth: 1, borderStyle: 'solid' }}
  >
    {/* Rank badge */}
    <SkeletonBox style={{ height: 24, width: 32, marginBottom: 12 }} />
    {/* Market name */}
    <SkeletonBox style={{ height: 20, width: '60%', marginBottom: 8 }} />
    {/* City */}
    <SkeletonBox style={{ height: 14, width: '40%', marginBottom: 16 }} />
    {/* Flight type pill */}
    <SkeletonBox style={{ height: 14, width: '50%', marginBottom: 16 }} />
    {/* Progress bar label */}
    <SkeletonBox style={{ height: 10, width: '35%', marginBottom: 6 }} />
    {/* Progress bar */}
    <SkeletonBox style={{ height: 8, width: '100%', borderRadius: 4 }} />
  </div>
);

export default MarketRankCardSkeleton;
