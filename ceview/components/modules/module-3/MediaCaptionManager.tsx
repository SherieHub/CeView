import React from 'react';
import { UploadCloud } from 'lucide-react';
import CaptionTextArea from '../../composites/module-3/CaptionTextArea';
import MediaDropzone from '../../composites/module-3/MediaDropzone';
import MediaPreviewCard from '../../composites/module-3/MediaPreviewCard';
import { COLORS } from '../../../constants';

interface MediaCaptionManagerProps {
  stagedCaption: string;
  setStagedCaption: (val: string) => void;
  file: File | null;
  previewUrl: string | null;
  onFileIngest: (file?: File | null) => void;
  onRemoveFile: () => void;
}

const MediaCaptionManager: React.FC<MediaCaptionManagerProps> = ({ stagedCaption, setStagedCaption, file, previewUrl, onFileIngest, onRemoveFile }) => (
  <div className="rounded-2xl shadow-sm border overflow-hidden" style={{ backgroundColor: COLORS.WHITE, borderColor: COLORS.LIGHT_GREY }}>
    <div className="p-5 border-b flex items-center gap-3" style={{ borderColor: COLORS.LIGHT_GREY }}>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${COLORS.GOLD}18` }}>
        <UploadCloud size={16} style={{ color: COLORS.GOLD }} />
      </div>
      <div>
        <h2 className="text-lg font-black leading-tight" style={{ color: COLORS.NAVY }}>Media & Caption Manager</h2>
        <p className="text-sm tracking-wider mt-0.5" style={{ color: COLORS.TEXT_MUTED }}>Stage text content and upload media profiles for distribution</p>
      </div>
    </div>

    <div className="p-5 md:p-6 space-y-4">
      <CaptionTextArea value={stagedCaption} onChange={setStagedCaption} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MediaDropzone onFileIngest={onFileIngest} />
        <MediaPreviewCard file={file} previewUrl={previewUrl} onRemove={onRemoveFile} />
      </div>
    </div>
  </div>
);

export default MediaCaptionManager;