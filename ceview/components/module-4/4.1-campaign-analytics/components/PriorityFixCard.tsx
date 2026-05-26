import React, { useState } from 'react';
import { AlertTriangle, ArrowRight, ChevronUp, ChevronDown } from 'lucide-react';
import { COLORS } from '../../../../constants';

interface PriorityFixCardProps {
  weakestStage: any;
  secondaryLeaks: any[];
}

const PriorityFixCard: React.FC<PriorityFixCardProps> = ({ weakestStage, secondaryLeaks }) => {
  const [showSecondaryLeaks, setShowSecondaryLeaks] = useState(false);

  return (
    <div className="bg-[#FEF2F2] p-6 md:p-8 rounded-2xl shadow-sm border relative overflow-hidden flex flex-col items-center text-center flex-1" style={{ borderColor: COLORS.RED_ORANGE }}>
      <div className="mb-4 p-3 bg-white rounded-full text-red-500 shadow-sm inline-flex">
        <AlertTriangle size={32} />
      </div>

      <div className="relative z-10 w-full flex flex-col items-center flex-1">
        <h3 className="text-sm font-bold text-red-800 uppercase tracking-wider mb-2">Highest Priority Fix</h3>
        <p className="text-xl font-black mb-3" style={{ color: COLORS.RED }}>{weakestStage.name}</p>

        <div className="inline-flex items-center gap-1 bg-red-800 px-4 py-1.5 rounded-full border font-bold text-md mb-6 shadow-sm" style={{ borderColor: '#FECACA', color: COLORS.WHITE }}>
          <ArrowRight size={16} />{weakestStage.dropoff} Drop-off
        </div>

        <div className="bg-white/60 p-5 rounded-xl border border-red-100 text-left backdrop-blur-sm w-full mb-2">
          <h4 className="font-bold text-red-900 text-sm mb-1">What does this mean?</h4>
          <p className="text-xs text-red-800/80 leading-relaxed mb-1">
            Out of every 100 potential customers who reach this stage, <strong>{weakestStage.dropoff}</strong> are leaving without taking action.
          </p>
        </div>

        {secondaryLeaks && secondaryLeaks.length > 0 && (
          <div className="mt-2 w-full border border-red-200 rounded-xl bg-white overflow-hidden shadow-sm transition-all duration-200 text-left">
            <div onClick={() => setShowSecondaryLeaks(!showSecondaryLeaks)} className="p-4 bg-red-50/50 hover:bg-red-50 border-b border-red-100 flex items-center justify-between cursor-pointer transition-colors">
              <div className="flex items-center gap-3">
                <h4 className="text-sm font-bold text-red-900">Other Areas for Improvement</h4>
                <span className="text-xs font-bold text-red-700 bg-white px-2 py-1 rounded-md border border-red-200 shadow-sm">
                  {secondaryLeaks.length} Issues
                </span>
              </div>
              <div className="text-red-400">
                {showSecondaryLeaks ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </div>
            </div>

            {showSecondaryLeaks && (
              <div className="divide-y divide-red-50 animate-fade-in bg-white">
                {secondaryLeaks.map((leak: any, idx: number) => (
                  <div key={idx} className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors">
                    <span className="text-sm font-medium text-red-700">{leak.name}</span>
                    <span className="text-sm font-bold text-red-800">{leak.dropoff} Drop-off</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PriorityFixCard;
