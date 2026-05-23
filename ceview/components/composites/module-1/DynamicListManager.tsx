import React, { useState } from 'react';
import ActionTag from '../../base/module-1/ActionTag';
import PrimaryButton from '../../base/module-1/PrimaryButton';
import { Plus } from 'lucide-react';
import { COLORS } from '../../../constants';

interface DynamicListManagerProps {
  items: string[];
  onChange: (items: string[]) => void;
}

const DynamicListManager: React.FC<DynamicListManagerProps> = ({ items, onChange }) => {
  const [draft, setDraft] = useState('');

  const handleAdd = () => {
    const val = draft.trim();
    if (val && !items.includes(val)) {
      onChange([...items, val]);
      setDraft('');
    }
  };

  return (
    <div className="mb-4">
      <label className="text-xs font-black uppercase tracking-wider block mb-1.5" style={{ color: COLORS.TEXT_MUTED }}>
        Core Service Offerings
      </label>
      <div className="p-3 rounded-xl border bg-white space-y-3" style={{ borderColor: COLORS.LIGHT_GREY }}>
        <div className="flex flex-wrap gap-2 min-h-[36px] items-center">
          {items.length === 0 && <span className="text-xs font-bold italic" style={{ color: COLORS.TEXT_MUTED }}>No core services added yet</span>}
          {items.map(item => (
            <ActionTag key={item} label={item} onRemove={() => onChange(items.filter(i => i !== item))} />
          ))}
        </div>
        <div className="flex gap-2 pt-2 border-t" style={{ borderColor: COLORS.LIGHT_GREY }}>
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="e.g. Overwater Villas — press Enter to add"
            className="flex-1 px-3 py-2 rounded-lg border text-sm focus:outline-none"
            style={{ borderColor: COLORS.LIGHT_GREY }}
          />
          <PrimaryButton onClick={handleAdd} icon={<Plus size={14} />}>Add</PrimaryButton>
        </div>
      </div>
    </div>
  );
};

export default DynamicListManager;