import { Calculator, Loader2 } from 'lucide-react';

interface ComputeUniquenessButtonProps {
  onClick: () => void;
  isLoading?: boolean;
  disabled?: boolean;
}

export default function ComputeUniquenessButton({
  onClick,
  isLoading = false,
  disabled = false,
}: ComputeUniquenessButtonProps) {
  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || isLoading}
        className="w-full py-3.5 px-6 rounded-md bg-gold hover:bg-gold-dark text-navy font-bold text-base flex items-center justify-center gap-2.5 transition-all shadow-1 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            <span>Computing uniqueness score...</span>
          </>
        ) : (
          <>
            <Calculator size={18} />
            <span>Compute uniqueness score</span>
          </>
        )}
      </button>
      <p className="body-xs mt-2 text-center text-muted text-[12px]">
        Overall = (category confidence + description semantics) ÷ 2
      </p>
    </div>
  );
}
