import React, { useState, useRef } from 'react';
import { UploadCloud } from 'lucide-react';
import UploadIconBadge from './UploadIconBadge';
import { COLORS } from '../../../../constants';

interface MediaDropzoneProps {
  onFileIngest: (file?: File | null) => void;
}

const MediaDropzone: React.FC<MediaDropzoneProps> = ({ onFileIngest }) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    onFileIngest(e.dataTransfer.files[0]);
  };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onClick={() => fileRef.current?.click()}
      className="border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all min-h-[160px]"
      style={{ borderColor: isDragging ? COLORS.TEAL : COLORS.LIGHT_GREY, backgroundColor: isDragging ? `${COLORS.TEAL}07` : COLORS.CREAM }}
    >
      <UploadIconBadge isDragging={isDragging} icon={<UploadCloud size={24} style={{ color: isDragging ? COLORS.TEAL : COLORS.TEXT_MUTED }} />} />
      <div className="text-center">
        <p className="font-black text-sm" style={{ color: isDragging ? COLORS.TEAL : COLORS.TEXT_MAIN }}>
          {isDragging ? 'Release to upload' : 'Drag & drop your media here'}
        </p>
        <p className="text-xs font-medium mt-1" style={{ color: COLORS.TEXT_MUTED }}>PNG, JPG, WEBP — up to 20MB</p>
      </div>
      <div className="px-4 py-2 rounded-lg text-xs font-bold border mt-2" style={{ backgroundColor: COLORS.WHITE, borderColor: COLORS.LIGHT_GREY, color: COLORS.TEXT_MUTED }}>
        Browse files
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => onFileIngest(e.target.files?.[0])} />
    </div>
  );
};

export default MediaDropzone;
