import React from 'react';
import { Sparkles, CheckCircle } from 'lucide-react';
import OverallScoreCard from '../../composites/module-1/OverallScoreCard';
import ActionableScoreCard from '../../composites/module-1/ActionableScoreCard';
import { COLORS } from '../../../constants';

export interface DetailedCalibrationResultDTO {
  overallScore: number;
  semanticsScore: number;
  categoryScore: number;
  descriptionFeedback: string;
  categoryFeedback: string;
}

interface DashboardProps {
  isAwaiting: boolean;
  result: DetailedCalibrationResultDTO | null;
}

const CalibrationResultsDashboard: React.FC<DashboardProps> = ({ isAwaiting, result }) => {
  
  // 1. Loading / Empty State
  if (isAwaiting || !result) {
    return (
      <div className="h-full border-2 border-dashed rounded-2xl flex flex-col items-center justify-center p-8 text-center" style={{ borderColor: COLORS.LIGHT_GREY, backgroundColor: COLORS.WHITE }}>
        <div className={`p-4 rounded-full mb-4 ${isAwaiting ? 'animate-pulse' : ''}`} style={{ backgroundColor: COLORS.CREAM }}>
          <Sparkles size={32} style={{ color: COLORS.TEAL }} />
        </div>
        <h3 className="text-sm font-black uppercase tracking-wider mb-2" style={{ color: COLORS.NAVY }}>
          {isAwaiting ? 'Processing Calibration' : 'Awaiting Calibration'}
        </h3>
        <p className="text-xs font-medium max-w-xs" style={{ color: COLORS.TEXT_MUTED }}>
          {isAwaiting 
            ? 'Running semantic evaluation against regional MSME vectors...' 
            : 'Fill in all five fields and click "Compute Uniqueness" to see your scores.'}
        </p>
      </div>
    );
  }

  // 2. Calibration Complete State (Using our new Composites)
  return (
    <div className="h-full flex flex-col space-y-4 animate-fade-in">
      
      {/* Success Header */}
      <div className="flex items-center gap-2 mb-2">
        <CheckCircle size={18} style={{ color: COLORS.GREEN }} />
        <span className="text-xs font-black uppercase tracking-wider" style={{ color: COLORS.NAVY }}>
          Calibration Complete
        </span>
      </div>

      {/* Top Level Metric */}
      <OverallScoreCard score={result.overallScore} />

      {/* Narrative Insight Metric */}
      <ActionableScoreCard 
        title="Description Semantics Score"
        score={result.semanticsScore}
        color={COLORS.TEAL}
        description="Measures how original and distinctive your business description and value proposition are compared to standard Cebu tourism marketing copy."
        feedbackText={result.descriptionFeedback}
      />

      {/* Categorical Insight Metric */}
      <ActionableScoreCard 
        title="Category Uniqueness Score"
        score={result.categoryScore}
        color={COLORS.GOLD}
        description="Measures how rare or differentiated your operational category mix is within the regional tourism landscape."
        feedbackText={result.categoryFeedback}
      />
      
    </div>
  );
};

export default CalibrationResultsDashboard;