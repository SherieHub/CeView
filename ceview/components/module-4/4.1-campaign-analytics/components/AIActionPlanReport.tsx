import React, { useState } from 'react';
import { Sparkles, Download, FileText, ListOrdered, Loader2 } from 'lucide-react';
import ReportActionBtn from './ReportActionBtn';
import RecommendationItem from './RecommendationItem';
import PriorityFixCard from './PriorityFixCard';
import { COLORS } from '../../../../constants';
import { api } from '../../../../services/apiClient';
import ServerErrorBanner from '../../../shared/ServerErrorBanner';

const AIActionPlanReport: React.FC = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportData, setReportData] = useState<any>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    try {
      const r = await api.prescriptiveReport();
      setReportData({
        executiveSummary: r.executiveSummary,
        weakestStage: r.weakestStage,
        secondaryLeaks: r.secondaryLeaks ?? [],
        recommendations: (r.recommendations ?? []).map(line => {
          const [title, ...rest] = line.split(/—|:/);
          return { title: title.trim(), explanation: rest.join(' ').trim() || line };
        }),
      });
    } catch (e) {
      console.error('prescriptiveReport failed', e);
      setServerError('AI report generation failed. The analytics service may be unavailable.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="border-t-2 border-dashed border-slate-200 pt-12 animate-fade-in space-y-6 mt-12">
      {serverError && <ServerErrorBanner message={serverError} onDismiss={() => setServerError(null)} />}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-6 rounded-2xl border" style={{ backgroundColor: COLORS.CREAM, borderColor: '#E2E8F0' }}>
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2" style={{ color: COLORS.NAVY }}>
            <Sparkles size={24} style={{ color: COLORS.GOLD }} /> AI Action Plan
          </h2>
          <p className="mt-1 text-sm" style={{ color: COLORS.TEXT_MUTED }}>Clear, step-by-step advice to turn more of your ad views into paying customers.</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <ReportActionBtn
            onClick={handleGenerateReport} disabled={isGenerating}
            icon={isGenerating ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
            label={isGenerating ? 'Analyzing...' : reportData ? 'Regenerate Analysis' : 'Generate AI Report'}
          />
          {reportData && <ReportActionBtn icon={<Download size={18} />} label="PDF" variant="danger" />}
        </div>
      </div>

      {!reportData && !isGenerating && (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center flex flex-col items-center justify-center min-h-[250px]">
          <div className="w-16 h-16 border rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: COLORS.CREAM, borderColor: '#E2E8F0', color: COLORS.GOLD }}>
            <Sparkles size={32} />
          </div>
          <h3 className="text-lg font-bold" style={{ color: COLORS.TEXT_MAIN }}>Ready for Strategic Calibration</h3>
          <p className="max-w-md mt-2" style={{ color: COLORS.TEXT_MUTED }}>Click generate to let our custom forecasting model analyze your current metrics.</p>
        </div>
      )}

      {isGenerating && (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center flex flex-col items-center justify-center min-h-[250px]">
          <Loader2 size={48} className="animate-spin mb-4" style={{ color: COLORS.NAVY }} />
          <h3 className="text-lg font-bold animate-pulse" style={{ color: COLORS.NAVY }}>Analyzing your campaign data...</h3>
        </div>
      )}

      {reportData && !isGenerating && (
        <div className="flex flex-col gap-6 animate-fade-in">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col gap-4">
            <div className="flex items-center gap-2 mb-2 border-b border-slate-100 pb-4">
              <div className="p-2 rounded-lg" style={{ backgroundColor: COLORS.TEXT_MUTED, color: COLORS.WHITE }}><FileText size={20} /></div>
              <h3 className="text-lg font-bold" style={{ color: COLORS.TEXT_MAIN }}>Executive Summary</h3>
            </div>
            <p className="leading-relaxed text-sm flex-1" style={{ color: COLORS.GREY }}>{reportData.executiveSummary}</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col">
              <div className="flex items-center gap-2 mb-6 border-b border-slate-100 pb-4">
                <div className="p-2 rounded-lg border" style={{ backgroundColor: COLORS.GOLD_LIGHT, color: COLORS.GOLD, borderColor: '#FDE68A' }}><ListOrdered size={20} /></div>
                <h3 className="text-lg font-bold" style={{ color: COLORS.TEXT_MAIN }}>Ranked Recommendations</h3>
              </div>
              <div className="flex flex-col gap-5">
                {reportData.recommendations.map((rec: any, index: number) => (
                  <RecommendationItem key={index} index={index + 1} title={rec.title} explanation={rec.explanation} />
                ))}
              </div>
            </div>
            <PriorityFixCard weakestStage={reportData.weakestStage} secondaryLeaks={reportData.secondaryLeaks} />
          </div>
        </div>
      )}
    </div>
  );
};

export default AIActionPlanReport;
