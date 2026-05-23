import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import PlatformTab from '../../base/module-3/PlatformTab';
import CopywritingOptionCard from '../../composites/module-3/CopywritingOptionCard';
import { COLORS } from '../../../constants';

interface AIContentMatrixPanelProps {
  platforms: any[];
  activeTab: string;
  setActiveTab: (id: string) => void;
  options: string[];
  onCopyOption: (text: string) => void;
}

const AIContentMatrixPanel: React.FC<AIContentMatrixPanelProps> = ({ platforms, activeTab, setActiveTab, options, onCopyOption }) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      onCopyOption(text);
      setTimeout(() => setCopiedId(null), 2200);
    });
  };

  return (
    <div className="rounded-2xl shadow-sm border overflow-hidden flex flex-col max-h-[600px]" style={{ backgroundColor: COLORS.WHITE, borderColor: COLORS.LIGHT_GREY }}>
      <div className="p-5 border-b flex items-center gap-3 shrink-0" style={{ borderColor: COLORS.LIGHT_GREY }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${COLORS.TEAL}18` }}>
          <Sparkles size={16} style={{ color: COLORS.TEAL }} />
        </div>
        <div>
          <h2 className="text-base font-black leading-tight" style={{ color: COLORS.NAVY }}>AI Copywriting Matrix</h2>
          <p className="text-xs font-bold uppercase tracking-wider mt-0.5" style={{ color: COLORS.TEXT_MUTED }}>Culture-Fit Generation Options</p>
        </div>
      </div>

      <div className="flex border-b shrink-0" style={{ borderColor: COLORS.LIGHT_GREY }}>
        {platforms.map(p => (
          <PlatformTab key={p.id} {...p} isActive={activeTab === p.id} onClick={() => setActiveTab(p.id)} />
        ))}
      </div>

      <div className="p-5 overflow-y-auto flex-1 space-y-6">
        {options.map((opt, idx) => {
          const uniqueId = `${activeTab}-cap-${idx}`;
          return (
            <CopywritingOptionCard 
              key={uniqueId} index={idx} text={opt} 
              isCopied={copiedId === uniqueId} 
              onCopy={() => handleCopy(opt, uniqueId)} 
            />
          );
        })}
      </div>
    </div>
  );
};

export default AIContentMatrixPanel;