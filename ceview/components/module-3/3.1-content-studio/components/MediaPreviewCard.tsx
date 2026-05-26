import React from 'react';
import { Eye, X } from 'lucide-react';
import { COLORS } from '../../../../constants';

interface MediaPreviewCardProps {
  file: File | null;
  previewUrl: string | null;
  onRemove: () => void;
}

const MediaPreviewCard: React.FC<MediaPreviewCardProps> = ({ file, previewUrl, onRemove }) => {
  if (previewUrl) {
    return (
      <div className="rounded-2xl overflow-hidden border relative min-h-[160px]" style={{ borderColor: COLORS.LIGHT_GREY }}>
        <img src={previewUrl} alt="Preview" className="w-full h-full object-cover block" />
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black shadow-md transition-all hover:scale-105"
          style={{ backgroundColor: 'rgba(0,0,0,0.7)', color: COLORS.WHITE }}
        >
          <X size={12} /> Remove
        </button>
        <div className="absolute bottom-0 left-0 right-0 p-4 pt-8" style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.8))' }}>
          <p className="m-0 text-xs font-black text-white line-clamp-1">📎 {file?.name}</p>
          <p className="mt-1 text-xs font-medium text-slate-300">{(file!.size / 1024).toFixed(0)}KB · Ready for audit</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border flex flex-col items-center justify-center p-6 text-center" style={{ backgroundColor: COLORS.OFF_WHITE, borderColor: COLORS.LIGHT_GREY }}>
      <Eye size={24} style={{ color: COLORS.TEXT_MUTED }} className="mb-2 opacity-50" />
      <p className="text-sm font-bold" style={{ color: COLORS.TEXT_MUTED }}>No Media Attached</p>
      <p className="text-xs font-medium mt-1" style={{ color: COLORS.TEXT_MUTED }}>Upload an asset to preview</p>
    </div>
  );
};

export default MediaPreviewCard;
