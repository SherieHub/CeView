import AdjustableCategoryItem from './AdjustableCategoryItem';

export interface InferredCategory {
  name: string;
  percentage: number;
  selected: boolean;
}

interface InferredCategoryBoardProps {
  categories: InferredCategory[];
  onToggle: (name: string) => void;
}

export default function InferredCategoryBoard({
  categories,
  onToggle,
}: InferredCategoryBoardProps) {
  const selectedCount = categories.filter((c) => c.selected).length;

  return (
    <div className="flex flex-col gap-2 mb-6">
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <p className="eyebrow">Inferred categories — sorted by model confidence</p>
        <span className="body-xs font-semibold">{selectedCount} selected</span>
      </div>

      <div className="grid gap-2">
        {categories.map((cat) => (
          <AdjustableCategoryItem
            key={cat.name}
            name={cat.name}
            percentage={cat.percentage}
            selected={cat.selected}
            onToggle={() => onToggle(cat.name)}
          />
        ))}
      </div>
    </div>
  );
}
