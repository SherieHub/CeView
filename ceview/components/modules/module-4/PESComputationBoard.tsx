import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import ScoreGauge from '../../composites/module-4/ScoreGauge';
import QualitativeLabel from '../../base/module-4/QualitativeLabel';
import { COLORS } from '../../../constants';

const PESComputationBoard: React.FC = () => {
  const pesScore = 0.68;
  const breakdownData = [
    { metric: 'ROAS', weight: '35%', contribution: 0.28, fill: COLORS.NAVY },
    { metric: 'Conv. Rate', weight: '30%', contribution: 0.15, fill: COLORS.GOLD },
    { metric: 'CAC (Inv)', weight: '15%', contribution: 0.10, fill: COLORS.RED_ORANGE },
    { metric: 'CTR', weight: '15%', contribution: 0.12, fill: COLORS.GREEN },
    { metric: 'CPC (Inv)', weight: '5%', contribution: 0.03, fill: COLORS.NAVY_LIGHT }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in mt-12">
      {/* Gauge Box */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center justify-center">
        <h3 className="text-lg font-semibold mb-4 w-full text-left" style={{ color: COLORS.NAVY }}>Overall Score (PES)</h3>
        <ScoreGauge score={pesScore} />
        <QualitativeLabel label="Good Performance" />
      </div>

      {/* Breakdown Box */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 md:col-span-2 flex flex-col">
        <h3 className="text-lg font-semibold mb-2" style={{ color: COLORS.NAVY }}>Metric Weight Contribution</h3>
        <div className="h-[180px] w-full flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart layout="vertical" data={breakdownData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
              <XAxis type="number" domain={[0, 0.4]} hide />
              <YAxis dataKey="metric" type="category" interval={0} width={90} axisLine={false} tickLine={false} tick={{ fill: COLORS.TEXT_MUTED, fontSize: 12, fontWeight: 600 }} />
              <Tooltip cursor={{fill: '#F8FAFC'}} formatter={(value) => typeof value === 'number' ? value.toFixed(2) : ''} labelStyle={{color: COLORS.TEXT_MAIN, fontWeight: 'bold'}} />
              <Bar dataKey="contribution" radius={[0, 4, 4, 0]} barSize={20}>
                {breakdownData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                <LabelList dataKey="weight" position="right" style={{ fill: COLORS.TEXT_MUTED, fontSize: 12 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 pt-4 border-t border-slate-100 text-center">
          <code className="text-[11px] font-mono bg-slate-50 px-3 py-2 rounded-lg" style={{ color: COLORS.TEXT_MUTED }}>
            Performance Score = (ROAS × 0.35) + (Conv. Rate × 0.30) + (CAC_inv × 0.15) + (CTR × 0.15) + (CPC_inv × 0.05)
          </code>
        </div>
      </div>
    </div>
  );
};

export default PESComputationBoard;