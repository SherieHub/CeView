import React, { useState } from 'react';
import { Share2, CheckCircle } from 'lucide-react';
import PlatformSyncCard from './PlatformSyncCard';
import { COLORS } from '../../../../constants';

interface DistributionPanelProps {
  channels: any[];
}

const DistributionPanel: React.FC<DistributionPanelProps> = ({ channels }) => {
  const [selectedChannels, setSelectedChannels] = useState(new Set(['instagram']));
  const [posted, setPosted] = useState(false);

  const toggleChannel = (id: string) => {
    setSelectedChannels(prev => {
      const next = new Set(prev);
      if (next.has(id) && next.size > 1) next.delete(id);
      else next.add(id);
      return next;
    });
    setPosted(false);
  };

  const deployLabel = () => {
    const sel = channels.filter(c => selectedChannels.has(c.id));
    if (sel.length === channels.length) return `Deploy to All ${channels.length} Channels Simultaneously`;
    if (sel.length === 1) return `Post to ${sel[0].label}`;
    return `Post to ${sel.map(c => c.label).join(' & ')} Simultaneously`;
  };

  return (
    <div className="rounded-2xl shadow-sm border overflow-hidden" style={{ backgroundColor: COLORS.WHITE, borderColor: COLORS.LIGHT_GREY }}>
      <div className="p-5 border-b flex items-center gap-3" style={{ borderColor: COLORS.LIGHT_GREY }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${COLORS.RED_ORANGE}18` }}>
          <Share2 size={16} style={{ color: COLORS.RED_ORANGE }} />
        </div>
        <div>
          <h2 className="text-base font-black leading-tight" style={{ color: COLORS.NAVY }}>Multi-Platform Distribution</h2>
          <p className="text-xs font-bold uppercase tracking-wider mt-0.5" style={{ color: COLORS.TEXT_MUTED }}>Simultaneous Deployment</p>
        </div>
      </div>

      <div className="p-4 md:p-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {channels.map(ch => (
            <PlatformSyncCard key={ch.id} channel={ch} isSelected={selectedChannels.has(ch.id)} onToggle={() => toggleChannel(ch.id)} />
          ))}
        </div>

        <button
          onClick={() => setPosted(true)}
          className="w-full p-4 rounded-xl text-sm font-black flex items-center justify-center gap-2 transition-all hover:opacity-90 shadow-lg"
          style={{ backgroundColor: posted ? COLORS.GREEN : COLORS.NAVY, color: COLORS.WHITE }}
        >
          {posted ? <><CheckCircle size={18} /> Successfully Deployed to {selectedChannels.size} Channel{selectedChannels.size > 1 ? 's' : ''}!</> : <><Share2 size={18} /> {deployLabel()}</>}
        </button>

        {posted && (
          <div className="mt-4 p-4 rounded-xl border flex items-center gap-3 animate-fade-in" style={{ backgroundColor: COLORS.GREEN_LIGHT, borderColor: `${COLORS.GREEN}40` }}>
            <CheckCircle size={18} style={{ color: COLORS.GREEN }} />
            <p className="text-sm font-bold" style={{ color: COLORS.GREEN }}>Content is live. Analytics will propagate to the Phase 5 dashboard within 2–4 hours.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DistributionPanel;
