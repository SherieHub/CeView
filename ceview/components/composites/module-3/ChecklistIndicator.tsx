import React from 'react';
import { CheckCircle } from 'lucide-react';
import { COLORS } from '../../../constants';

const ChecklistIndicator: React.FC = () => {
  const checks = [
    { name: 'Image Check', task: 'Looking at layout and background' }, 
    { name: 'Text Reader', task: 'Finding and reading the words' }, 
    { name: 'Meaning Matcher', task: 'Checking if the message fits the audience' }
  ];

  return (
    <div className="p-4 rounded-xl border" style={{ backgroundColor: COLORS.CREAM, borderColor: COLORS.LIGHT_GREY }}>
      <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: COLORS.TEXT_MUTED }}>Checks Completed</p>
      <div className="space-y-2">
        {checks.map(m => (
          <div key={m.name} className="flex items-start gap-2">
            <CheckCircle size={14} className="shrink-0 mt-0.5" style={{ color: COLORS.GREEN }} />
            <p className="text-xs font-medium"><strong className="font-black" style={{ color: COLORS.NAVY }}>{m.name}</strong> — {m.task}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ChecklistIndicator;