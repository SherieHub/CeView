import { Check } from 'lucide-react';

interface AdjustableCategoryItemProps {
  name: string;
  percentage: number;
  selected: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

export default function AdjustableCategoryItem({
  name,
  percentage,
  selected,
  onToggle,
  disabled = false,
}: AdjustableCategoryItemProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      disabled={disabled}
      className={`cat-row w-full text-left grid grid-cols-[1fr_auto] gap-4 items-center p-3.5 px-4 rounded-md border transition-all cursor-pointer ${
        selected
          ? 'bg-[rgba(15,40,84,0.03)] border-navy shadow-1'
          : 'bg-panel border-line hover:border-line-strong'
      } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
    >
      <div>
        <div className="cat-row-top flex items-baseline justify-between gap-2.5 mb-1.5">
          <b className="text-[13px] font-bold text-ink">{name}</b>
          <span className="cat-pct num text-[12px] font-extrabold text-navy">
            {percentage}%
          </span>
        </div>
        {/* Progress Confidence Bar */}
        <div className="w-full h-1.5 bg-line rounded-full overflow-hidden">
          <div
            className="h-full bg-gold transition-all duration-300 rounded-full"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      {/* Checkbox Badge */}
      <span
        className={`cat-check w-5 h-5 rounded-md border grid place-items-center transition-all ${
          selected
            ? 'bg-navy border-navy text-white'
            : 'border-line-strong bg-panel text-transparent'
        }`}
      >
        <Check size={13} strokeWidth={3} className={selected ? 'opacity-100' : 'opacity-0'} />
      </span>
    </button>
  );
}
