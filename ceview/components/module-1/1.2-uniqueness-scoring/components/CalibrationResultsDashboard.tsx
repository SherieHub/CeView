import React from 'react';
import { Sparkles, CheckCircle } from 'lucide-react';
import OverallScoreCard from './OverallScoreCard';
import ActionableScoreCard from './ActionableScoreCard';
import { COLORS } from '../../../../constants';

export interface DetailedCalibrationResultDTO {
  overallScore: number;
  semanticsScore: number;
  categoryScore: number;
}

interface DashboardProps {
  isAwaiting: boolean;
  result: DetailedCalibrationResultDTO | null;
  onConfirm: () => void;
}

const CalibrationResultsDashboard: React.FC<DashboardProps> = ({ isAwaiting, result, onConfirm }) => {
  if (isAwaiting || !result) {
    return (
      <div className="h-full border-2 border-dashed rounded-2xl flex flex-col items-center justify-center p-8 text-center" style={{ borderColor: COLORS.LIGHT_GREY, backgroundColor: COLORS.WHITE }}>
        <div className={`p-4 rounded-full mb-4 ${isAwaiting ? 'animate-pulse' : ''}`} style={{ backgroundColor: COLORS.CREAM }}>
          <Sparkles size={32} style={{ color: COLORS.TEAL }} />
        </div>
        <h3 className="text-sm font-black uppercase tracking-wider mb-2" style={{ color: COLORS.NAVY }}>
          {isAwaiting ? 'Computing Uniqueness...' : 'Awaiting Calibration'}
        </h3>
        <p className="text-xs font-medium max-w-xs" style={{ color: COLORS.TEXT_MUTED }}>
          {isAwaiting
            ? 'Running semantic evaluation against regional MSME vectors...'
            : 'Fill in your details and click "Analyze Business Profile" to begin the calibration process.'}
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col animate-fade-in">
      <div className="flex items-center gap-2 mb-6">
        <CheckCircle size={18} style={{ color: COLORS.GREEN }} />
        <span className="text-xs font-black uppercase tracking-wider" style={{ color: COLORS.NAVY }}>
          Calibration Complete
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <OverallScoreCard score={result.overallScore} />

        <ActionableScoreCard
          title="Description Semantics Score"
          score={result.semanticsScore}
          color={COLORS.TEAL}
          description="Measures how original and distinctive your business description and value proposition are compared to standard Cebu tourism marketing copy."
          className="text-2xl"
        />

        <ActionableScoreCard
          title="Category Uniqueness Score"
          score={result.categoryScore}
          color={COLORS.GOLD}
          description="Measures how rare or differentiated your operational category mix is within the regional tourism landscape."
        />
      </div>

      <button
        onClick={onConfirm}
        className="w-full mt-auto px-6 py-4 rounded-xl text-white font-black flex items-center justify-center gap-2 hover:opacity-90 shadow-lg transition-all"
        style={{ backgroundColor: COLORS.NAVY }}
      >
        Confirm & Register Profile
      </button>
    </div>
  );
};

export default CalibrationResultsDashboard;
